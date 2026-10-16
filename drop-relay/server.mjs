import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {encodeFrame,decodeFrame,validMessage,MAX_FRAME} from '../drop/relay-codec.js';
import {CHUNK_SIZE,MAX_MEMORY,deviceName} from '../drop/protocol.js';

const validPeer=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const validKey=key=>typeof key==='string'&&/^[a-f0-9]{24,64}$/.test(key);
const sameKey=(a,b)=>validKey(a)&&validKey(b)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const memberInfo=client=>({id:client.id,name:client.name,kind:client.kind,deviceType:client.deviceType,isHost:client.host,online:!client.absentAt,version:3});

export function createRelay({allowedOrigins=['https://reynosoch.github.io'],allowOwnOrigin=true,roomTTL=600000,transferTTL=120000,maxRooms=256,maxClients=256,maxPerIP=16,maxParticipants=8,maxBuffered=1024*1024,now=()=>Date.now(),sweepInterval=5000}={}) {
  const rooms=new Map(),clients=new Set(),rates=new Map();
  const publicRoot=fileURLToPath(new URL('../drop/',import.meta.url));
  const server=createServer(async(req,res)=>{
    if(req.method==='GET'&&req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end('{"status":"ok","protocol":1}');return;}
    if(req.method==='GET'&&req.url==='/'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'self'",'cache-control':'no-store'});
      res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Drop</title><h1>Drop</h1><p>Texto, fotos y archivos entre tus dispositivos.</p><p><a href="/drop/">Abrir Drop</a></p><p><a href="https://reynosoch.github.io/" target="_blank" rel="noopener noreferrer">Reynoso Toolchain</a></p></html>');return;
    }
    if(req.method==='GET'){
      try{
        const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
        if(path==='/drop/deployment-config.js'){
          res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});
          res.end("export const DEPLOYMENT_CONFIG = Object.freeze({relayUrl:new URL('/relay',location.origin).href});");return;
        }
        const relative=path==='/drop/'?'index.html':path.startsWith('/drop/')?path.slice(6):'';
        const target=resolve(publicRoot,relative);
        if(!relative||!target.startsWith(publicRoot)||relative.includes('..')||relative.split('/').some(part=>part.startsWith('.'))||/^(?:test|scripts)\//.test(relative)||!/\.(?:html|m?js|css|svg|png|webmanifest|wasm|txt)$/.test(relative))throw Error();
        let content=await readFile(target);
        if(relative==='index.html'){
          // Exact same-origin socket in addition to the static app's PeerJS CSP.
          const host=req.headers.host;
          if(!/^[a-zA-Z0-9.:[\]-]+$/.test(host||''))throw Error();
          const origin=`${host.startsWith('localhost')||host.startsWith('127.0.0.1')?'ws':'wss'}://${host}`;
          content=Buffer.from(content.toString().replace("connect-src 'self'",`connect-src 'self' ${origin}`));
        }
        const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.txt':'text/plain'};
        res.writeHead(200,{'content-type':mime[extname(target)],'cache-control':relative.endsWith('.html')?'no-cache':'public,max-age=0','x-content-type-options':'nosniff'});res.end(content);return;
      }catch{/* Serve only public Drop resources; never repository metadata. */}
    }
    res.writeHead(404,{'cache-control':'no-store'});res.end();
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:MAX_FRAME,perMessageDeflate:false});
  const send=(socket,packet)=>{
    if(!socket||socket.readyState!==WebSocket.OPEN)return false;
    if(socket.bufferedAmount>maxBuffered){socket.terminate();return false;}
    socket.send(encodeFrame(packet),{binary:true},error=>{if(error)socket.terminate();});return true;
  };
  const reject=(socket,reason)=>{send(socket,{type:'error',reason});socket.close(1008,'Request rejected');};
  function broadcast(room){const members=[...room.members.values()].map(memberInfo);for(const c of room.members.values())send(c.socket,{type:'members',members,token:room.token});}
  function remove(client){
    clients.delete(client);const room=client.room;if(!room||room.members.get(client.id)!==client)return;
    for(const [key,transfer] of room.transfers)if(transfer.from===client.id||transfer.to===client.id)room.transfers.delete(key);
    if(client.explicitLeave)room.members.delete(client.id);
    else{client.absentAt=now()||1;client.socket=null;}
    broadcast(room);
    // Empty rooms retain only ownership metadata until TTL, allowing F5/resume.
  }
  function destroyRoom(room,reason){
    rooms.delete(room.code);room.transfers.clear();
    for(const c of room.members.values()){c.room=null;send(c.socket,{type:'closed',reason});c.socket?.close(1000,'Room closed');}
    room.members.clear();
  }
  function allowance(ip,cost){
    let rate=rates.get(ip);
    if(!rate){if(rates.size>=4096)return false;rate={since:now(),bytes:0,joins:0,messages:0};rates.set(ip,rate);}
    if(now()-rate.since>=60000){rate.since=now();rate.bytes=0;rate.joins=0;rate.messages=0;}
    rate.bytes+=cost;rate.messages++;
    return rate.bytes<=128*1024*1024&&rate.messages<=16000;
  }
  server.on('upgrade',(request,socket,head)=>{
    // Use the TCP peer address. A reverse proxy must also rate-limit real users;
    // never trust arbitrary X-Forwarded-For supplied by an Internet client.
    const ip=request.socket.remoteAddress;
    let sameOrigin=false;try{const origin=new URL(request.headers.origin);sameOrigin=allowOwnOrigin&&['https:','http:'].includes(origin.protocol)&&origin.host===request.headers.host;}catch{}
    if(request.url!=='/relay'||!allowedOrigins.includes(request.headers.origin)&&!sameOrigin||clients.size>=maxClients||[...clients].filter(c=>c.ip===ip).length>=maxPerIP||!allowance(ip,0)){
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
    }
    const rate=rates.get(ip);if(++rate.joins>30){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,ip));
  });
  function join(client,packet){
    if(client.room||typeof packet.room!=='string'||!/^\d{4}$|^[a-f0-9]{24}$/.test(packet.room)||!validPeer(packet.peerId)||!validKey(packet.memberKey)||typeof packet.host!=='boolean')throw Error('invalid-join');
    const expectedHost=`reynoso-drop-${packet.room}`;
    if(packet.host&&(packet.peerId!==expectedHost||!validKey(packet.ownerKey)))throw Error('invalid-join');
    let room=rooms.get(packet.room);
    if(!room){
      if(!packet.host)throw Error('room-not-found');
      if(rooms.size>=maxRooms)throw Error('capacity');
      room={code:packet.room,ownerKey:packet.ownerKey,token:validKey(packet.meshToken)?packet.meshToken:randomBytes(12).toString('hex'),hostId:expectedHost,members:new Map(),transfers:new Map(),lastActivity:now()};rooms.set(packet.room,room);
    }
    if(packet.host&&!sameKey(room.ownerKey,packet.ownerKey))throw Error('room-exists');
    if(!packet.host&&packet.peerId===expectedHost)throw Error('invalid-join');
    const previous=room.members.get(packet.peerId);
    if(previous&&!packet.host&&!sameKey(previous.memberKey,packet.memberKey))throw Error('identity-in-use');
    if(!previous&&room.members.size>=maxParticipants)throw Error('room-full');
    if(previous){previous.room=null;previous.socket?.close(1000,'Reconnected');}
    Object.assign(client,{room,id:packet.peerId,host:packet.host,memberKey:packet.memberKey,name:deviceName(packet.device),kind:deviceName(packet.kind),deviceType:['computer','phone','tablet'].includes(packet.deviceType)?packet.deviceType:'unknown'});
    room.members.set(client.id,client);room.lastActivity=now();broadcast(room);
  }
  function route(client,packet){
    const room=client.room,destination=room?.members.get(packet.to),msg=packet.message;
    if(!room||!destination||destination===client||!validMessage(msg))throw Error('invalid-message');
    if(!destination.socket)throw Error('recipient-unavailable');
    const key=`${client.id}|${packet.to}|${msg.id}`;
    if(msg.type==='file-offer'){
      const previous=room.transfers.get(key);
      if(previous&&(previous.size!==msg.size||previous.hash!==msg.hash))throw Error('transfer-conflict');
      if(!previous){
        if(room.transfers.size>=16||[...room.transfers.values()].filter(t=>t.to===packet.to).reduce((n,t)=>n+t.size,0)+msg.size>MAX_MEMORY)throw Error('transfer-capacity');
        room.transfers.set(key,{from:client.id,to:packet.to,id:msg.id,size:msg.size,hash:msg.hash,next:0,accepted:false,at:now(),awaiting:'offer'});
      }
      else if(msg.restart){previous.next=0;previous.accepted=false;previous.awaiting='offer';previous.at=now();}
    }else if(msg.type==='file-chunk'||msg.type==='file-end'){
      const transfer=room.transfers.get(key);
      if(!transfer?.accepted)throw Error('transfer-not-accepted');
      if(msg.type==='file-chunk'&&(msg.index!==transfer.next||msg.bytes.byteLength!==Math.min(CHUNK_SIZE,transfer.size-transfer.next*CHUNK_SIZE)))throw Error('invalid-chunk');
      if(msg.type==='file-end'&&transfer.next!==Math.ceil(transfer.size/CHUNK_SIZE))throw Error('incomplete-file');
      transfer.awaiting=msg.type==='file-end'?'end':`chunk:${msg.index}`;transfer.at=now();
    }else if(msg.type==='ack'){
      const [stage,id,index]=msg.key.split(':'),reverse=`${packet.to}|${client.id}|${id}`,transfer=room.transfers.get(reverse);
      if(stage!=='text'){
        if(!transfer)throw Error('unknown-transfer');
        if(stage==='offer'){if(transfer.awaiting!=='offer')throw Error('invalid-ack');transfer.accepted=true;}
        else if(stage==='chunk'){
          if(Number(index)!==transfer.next||transfer.awaiting!==`chunk:${index}`)throw Error('invalid-ack');transfer.next++;
        }else if(stage==='end'){if(transfer.awaiting!=='end')throw Error('invalid-ack');room.transfers.delete(reverse);}
        transfer.awaiting=null;
        transfer.at=now();
      }
    }else if(msg.type==='failed'){
      room.transfers.delete(key);room.transfers.delete(`${packet.to}|${client.id}|${msg.id}`);
    }
    if(!['ping','pong','health-ready'].includes(msg.type))room.lastActivity=now();
    if(!send(destination.socket,{type:'data',from:client.id,message:msg}))throw Error('recipient-unavailable');
  }
  wss.on('connection',(socket,ip)=>{
    const client={socket,ip,room:null,alive:true,joinedAt:now()};clients.add(client);
    socket.on('pong',()=>{client.alive=true;});
    socket.on('error',()=>{}); // No frame contents, names, paths, hashes, or errors logged.
    socket.on('close',()=>remove(client));
    socket.on('message',(data,isBinary)=>{
      if(!isBinary||!allowance(ip,data.byteLength)){reject(socket,'rate-limit');return;}
      try{
        const packet=decodeFrame(data);
        if(packet.type==='join')join(client,packet);
        else if(packet.type==='data')route(client,packet);
        else if(packet.type==='activity'&&client.room)client.room.lastActivity=now();
        else if(packet.type==='leave'&&client.room){client.explicitLeave=true;if(packet.closeRoom&&client.host)destroyRoom(client.room,'room-closed');else socket.close(1000,'Left');}
        else throw Error('invalid-message');
      }catch(error){reject(socket,['room-not-found','room-exists','room-full','capacity','identity-in-use','transfer-capacity','recipient-unavailable'].includes(error.message)?error.message:'invalid-message');}
    });
  });
  function sweep(){
    for(const room of rooms.values()){
      if(now()-room.lastActivity>=roomTTL){destroyRoom(room,'expired');continue;}
      for(const [key,t] of room.transfers)if(now()-t.at>=transferTTL)room.transfers.delete(key);
      let changed=false;for(const [id,c] of room.members)if(c.absentAt&&now()-c.absentAt>=8000){room.members.delete(id);changed=true;}
      if(changed)broadcast(room);
    }
    for(const client of clients){if(!client.room&&now()-client.joinedAt>8000)client.socket.terminate();}
    for(const [ip,rate] of rates)if(now()-rate.since>120000&&!([...clients].some(c=>c.ip===ip)))rates.delete(ip);
  }
  const sweeper=setInterval(sweep,sweepInterval);sweeper.unref();
  const heartbeat=setInterval(()=>{for(const c of clients){if(!c.alive){c.socket.terminate();continue;}c.alive=false;c.socket.ping();}},30000);heartbeat.unref();
  return {server,rooms,clients,sweep,async close(){clearInterval(sweeper);clearInterval(heartbeat);for(const c of clients)c.socket.terminate();await new Promise(resolve=>wss.close(resolve));if(server.listening)await new Promise(resolve=>server.close(resolve));}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const allowedOrigins=(process.env.DROP_ALLOWED_ORIGINS||'https://reynosoch.github.io').split(',').map(s=>s.trim()).filter(Boolean);
  const relay=createRelay({allowedOrigins});const port=Number(process.env.PORT||8787),address=process.env.HOST||'127.0.0.1';
  relay.server.listen(port,address,()=>console.log('Drop Relay listening'));
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{relay.close().then(()=>process.exit(0));});
}
