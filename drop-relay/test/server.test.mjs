import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createRelay} from '../server.mjs';
import {encodeFrame,decodeFrame,MAX_FRAME} from '../../drop/relay-codec.js';
import {newCode,digest,FileReceiver} from '../../drop/protocol.js';

const origin='https://reynosoch.github.io';
async function fixture(options={}){
  const relay=createRelay(options);relay.server.listen(0,'127.0.0.1');await once(relay.server,'listening');
  const base=`http://127.0.0.1:${relay.server.address().port}`,url=base.replace('http:','ws:')+'/relay',sockets=[];
  async function client({room='0012',host=false,id=host?`reynoso-drop-${room}`:`reynoso-drop-device-${newCode()}`,ownerKey=newCode(),memberKey=newCode(),clientOrigin=origin}={}){
    const socket=new WebSocket(url,{origin:clientOrigin});sockets.push(socket);await once(socket,'open');
    const messages=[],waiters=[];socket.on('message',data=>{const packet=decodeFrame(data);messages.push(packet);for(const waiter of [...waiters])if(waiter.test(packet)){waiters.splice(waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(packet);}});
    function next(test){const old=messages.find(test);if(old)return Promise.resolve(old);return new Promise((resolve,reject)=>{const waiter={test,resolve,timer:setTimeout(()=>reject(Error('Expected relay packet not received')),2000)};waiters.push(waiter);});}
    const send=packet=>socket.send(encodeFrame(packet));
    send({type:'join',room,host,peerId:id,ownerKey,memberKey,device:host?'PC':'Celular',kind:host?'Windows':'iPhone'});
    return {socket,id,ownerKey,memberKey,send,next,messages};
  }
  return {relay,base,url,client,async close(){for(const socket of sockets)socket.terminate();await relay.close();}};
}

test('health y UI desplegable: mismo origen, configuración propia y sin archivos privados',async()=>{
  const f=await fixture();try{
    assert.equal((await fetch(f.base+'/healthz')).status,200);
    const html=await(await fetch(f.base+'/drop/')).text();assert(html.includes('id="recipient"'));assert(html.includes('ws://127.0.0.1:'));
    assert((await(await fetch(f.base+'/drop/deployment-config.js')).text()).includes("new URL('/relay',location.origin)"));
    for(const path of ['/drop-relay/server.mjs','/.git/config','/drop/test/app.test.js','/drop/../package.json'])assert.equal((await fetch(f.base+path)).status,404);
  }finally{await f.close();}
});
test('el relay autentica el origen lógico y nunca permite enviar a otra sala',async()=>{
  const f=await fixture();try{
    const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');
    a.send({type:'data',to:b.id,from:'spoof',message:{type:'text',id:newCode(),text:'hola'}});
    const incoming=await b.next(p=>p.type==='data');assert.equal(incoming.from,a.id);assert.equal(incoming.message.text,'hola');
    const other=await f.client({host:true,room:'3456'});await other.next(p=>p.type==='members');
    a.send({type:'data',to:other.id,message:{type:'text',id:newCode(),text:'no cruzar salas'}});
    assert.equal((await a.next(p=>p.type==='error')).reason,'invalid-message');assert.equal(other.messages.filter(p=>p.type==='data').length,0);
  }finally{await f.close();}
});
test('PDF binario, ACK del destinatario e integridad: no se conservan bloques después del envío',async()=>{
  const f=await fixture();try{
    const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');
    const bytes=new TextEncoder().encode('%PDF-1.4\nPDF de prueba\n%%EOF'),id=newCode();
    const offer={type:'file-offer',id,name:'tarea.pdf',size:bytes.length,hash:await digest(bytes)};
    a.send({type:'data',to:b.id,message:offer});await b.next(p=>p.message?.type==='file-offer');
    const state=f.relay.rooms.get('0012');assert.equal(state.transfers.size,1);
    const receive=new FileReceiver(offer);
    b.send({type:'data',to:a.id,message:{type:'ack',key:`offer:${id}`}});await a.next(p=>p.message?.key===`offer:${id}`);
    a.send({type:'data',to:b.id,message:{type:'file-chunk',id,index:0,bytes}});
    receive.append((await b.next(p=>p.message?.type==='file-chunk')).message);
    assert.equal('bytes' in [...state.transfers.values()][0],false);
    b.send({type:'data',to:a.id,message:{type:'ack',key:`chunk:${id}:0`}});await a.next(p=>p.message?.key===`chunk:${id}:0`);
    a.send({type:'data',to:b.id,message:{type:'file-end',id}});await b.next(p=>p.message?.type==='file-end');
    assert.deepEqual(new Uint8Array(await(await receive.finish()).arrayBuffer()),bytes);
    b.send({type:'data',to:a.id,message:{type:'ack',key:`end:${id}`}});await a.next(p=>p.message?.key===`end:${id}`);assert.equal(state.transfers.size,0);
  }finally{await f.close();}
});
test('propiedad, límite de sala y reingreso: otro host no puede apropiarse del código',async()=>{
  const f=await fixture({maxParticipants:2});try{
    const a=await f.client({host:true});await a.next(p=>p.type==='members');
    const bad=await f.client({host:true});assert.equal((await bad.next(p=>p.type==='error')).reason,'room-exists');
    const b=await f.client();await b.next(p=>p.type==='members');
    const third=await f.client();assert.equal((await third.next(p=>p.type==='error')).reason,'room-full');
    b.send({type:'leave'});await once(b.socket,'close');
    const returning=await f.client();assert((await returning.next(p=>p.type==='members')).members.some(m=>m.id===a.id));
  }finally{await f.close();}
});
test('TTL limpia metadatos y salas abandonadas incluso con sockets conectados',async()=>{
  let clock=1000;const f=await fixture({roomTTL:600,transferTTL:100,now:()=>clock});try{
    const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');
    a.send({type:'data',to:b.id,message:{type:'file-offer',id:newCode(),name:'pendiente.pdf',size:1,hash:'a'.repeat(64)}});await b.next(p=>p.message?.type==='file-offer');
    clock+=101;f.relay.sweep();assert.equal(f.relay.rooms.get('0012').transfers.size,0);
    clock+=600;f.relay.sweep();assert.equal(f.relay.rooms.size,0);assert.equal((await b.next(p=>p.type==='closed')).reason,'expired');
  }finally{await f.close();}
});
test('rechaza archivos grandes, mensajes malformados y frames mayores al límite',async()=>{
  for(const message of [{type:'file-offer',id:newCode(),name:'grande.pdf',size:51*1024*1024,hash:'a'.repeat(64)},{type:'file-chunk',id:newCode(),index:0,bytes:new Uint8Array(1)}]){
    const f=await fixture();try{const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');a.send({type:'data',to:b.id,message});assert.equal((await a.next(p=>p.type==='error')).reason,'invalid-message');}finally{await f.close();}
  }
  const f=await fixture();try{const a=await f.client({host:true});await a.next(p=>p.type==='members');const closed=once(a.socket,'close');a.socket.send(Buffer.alloc(MAX_FRAME+1));assert.equal((await closed)[0],1009);}finally{await f.close();}
});
test('origen no permitido se rechaza antes de crear una sala',async()=>{
  const f=await fixture();try{await assert.rejects(f.client({host:true,clientOrigin:'https://untrusted.example'}),/403/);assert.equal(f.relay.rooms.size,0);}finally{await f.close();}
});
test('recarga de anfitrión recupera su sala y el dueño no depende de la clave vieja del socket',async()=>{
  const f=await fixture();try{
    const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');
    const owner=a.ownerKey;a.socket.terminate();await once(a.socket,'close');
    const returning=await f.client({host:true,ownerKey:owner});const packet=await returning.next(p=>p.type==='members');
    assert.equal(packet.members.length,2);assert.equal(packet.members.filter(m=>m.isHost).length,1);assert(f.relay.rooms.get('0012').members.has(b.id));
  }finally{await f.close();}
});
test('desconexión temporal retiene solo identidad y el puesto vence después de ocho segundos',async()=>{
  let clock=1000;const f=await fixture({now:()=>clock});try{
    const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');
    const serverSocket=f.relay.rooms.get('0012').members.get(b.id).socket,serverClosed=once(serverSocket,'close');
    b.socket.terminate();await serverClosed;
    const descriptor=f.relay.rooms.get('0012').members.get(b.id);assert.equal(descriptor.socket,null);assert(descriptor.absentAt);
    clock+=8001;f.relay.sweep();assert(!f.relay.rooms.get('0012').members.has(b.id));assert(f.relay.rooms.get('0012').members.has(a.id));
  }finally{await f.close();}
});
test('un ACK final prematuro no confirma ni conserva metadatos de un archivo incompleto',async()=>{
  const f=await fixture();try{
    const a=await f.client({host:true}),b=await f.client();await b.next(p=>p.type==='members');const id=newCode();
    a.send({type:'data',to:b.id,message:{type:'file-offer',id,name:'incompleto.pdf',size:1,hash:'a'.repeat(64)}});await b.next(p=>p.message?.type==='file-offer');
    b.send({type:'data',to:a.id,message:{type:'ack',key:`end:${id}`}});assert.equal((await b.next(p=>p.type==='error')).reason,'invalid-message');
    assert.equal(a.messages.filter(p=>p.message?.key===`end:${id}`).length,0);
  }finally{await f.close();}
});
test('sala agotada e intentos repetidos se limitan sin afectar a participantes existentes',async()=>{
  const f=await fixture({maxRooms:1});try{
    const a=await f.client({host:true});await a.next(p=>p.type==='members');
    const other=await f.client({host:true,room:'3456'});assert.equal((await other.next(p=>p.type==='error')).reason,'capacity');
    for(let i=0;i<28;i++){
      const unknown=await f.client({room:'2345'});await unknown.next(p=>p.type==='error');
      if(unknown.socket.readyState!==WebSocket.CLOSED)await once(unknown.socket,'close');
    }
    await assert.rejects(f.client({room:'2345'}),/429/);assert(f.relay.rooms.get('0012').members.has(a.id));
  }finally{await f.close();}
});
