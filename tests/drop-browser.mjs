import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(new URL('../dist/',import.meta.url).pathname);
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(path!==root&&!path.startsWith(root+'/'))throw Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
// Test-only signaling adapter. Payloads use actual RTCDataChannels between isolated
// browser contexts, not a mocked send() method. Production still uses vendored PeerJS.
const memory=process.env.DROP_TEST_TRANSPORT==='memory';
const adapter=`
const MEMORY=${memory};
class Emitter{constructor(){this.events={}}on(name,fn){(this.events[name]??=[]).push(fn);return this}emit(name,...args){for(const fn of this.events[name]||[])fn(...args)}}
const encode=msg=>JSON.stringify(msg,(_,v)=>v instanceof ArrayBuffer?{$bytes:[...new Uint8Array(v)]}:v);
const decode=msg=>JSON.parse(msg,(_,v)=>v&&v.$bytes?new Uint8Array(v.$bytes).buffer:v);
const gather=rtc=>rtc.iceGatheringState==='complete'?Promise.resolve():new Promise(resolve=>rtc.addEventListener('icegatheringstatechange',()=>{if(rtc.iceGatheringState==='complete')resolve()}));
class Link extends Emitter{
 constructor(owner,id,target,metadata){super();this.owner=owner;this.id=id;this.peer=target;this.metadata=metadata;this.open=false;this.peerConnection=MEMORY?{addEventListener(){},close(){}}:new RTCPeerConnection({iceServers:[]});if(!MEMORY)this.peerConnection.ondatachannel=e=>this.attach(e.channel)}
 attach(channel){this.channel=channel;channel.onopen=()=>{this.open=true;this.emit('open')};channel.onclose=()=>{this.open=false;this.emit('close')};channel.onmessage=e=>this.emit('data',decode(e.data))}
 send(msg){if(MEMORY){window.__signal({type:'data',from:this.owner.id,to:this.peer,link:this.id,payload:encode(msg)});return}this.channel.send(encode(msg))}
 close(){if(MEMORY&&this.open)window.__signal({type:'close',from:this.owner.id,to:this.peer,link:this.id});this.channel?.close();this.peerConnection.close();this.open=false;this.emit('close')}
}
window.__peerInstances=[];window.__links=new Map();
window.Peer=class extends Emitter{
 constructor(id){super();this.id=id||crypto.randomUUID();this.token=crypto.randomUUID();this.destroyed=false;this.disconnected=false;window.__currentPeer=this;window.__peerInstances.push(this);window.__signal({type:'register',from:this.id,token:this.token}).then(()=>{if(!this.destroyed)this.emit('open')})}
 connect(target,options){const link=new Link(this,crypto.randomUUID(),target,options.metadata);window.__links.set(link.id,link);if(MEMORY){setTimeout(()=>{link.open=true;link.emit('open');window.__signal({type:'offer',from:this.id,to:target,link:link.id,metadata:options.metadata})},0);return link}link.attach(link.peerConnection.createDataChannel('drop'));(async()=>{await link.peerConnection.setLocalDescription(await link.peerConnection.createOffer());await gather(link.peerConnection);const ok=await window.__signal({type:'offer',from:this.id,to:target,link:link.id,metadata:options.metadata,sdp:link.peerConnection.localDescription.toJSON()});if(!ok)this.emit('error',{type:'peer-unavailable'})})().catch(()=>{});return link}
 reconnect(){this.disconnected=false;this.emit('open')}
 destroy(){this.destroyed=true;window.__signal({type:'destroy',from:this.id,token:this.token});for(const link of window.__links.values())if(link.owner===this)link.close()}
};
window.__receive=async msg=>{const peer=window.__currentPeer;if(peer.destroyed)return;if(MEMORY){if(msg.type==='offer'){const link=new Link(peer,msg.link,msg.from,msg.metadata);window.__links.set(msg.link,link);peer.emit('connection',link);link.open=true;link.emit('open')}else if(msg.type==='data'){window.__links.get(msg.link)?.emit('data',decode(msg.payload))}else if(msg.type==='close'){const link=window.__links.get(msg.link);if(link){link.open=false;link.emit('close')}}return}if(msg.type==='offer'){const link=new Link(peer,msg.link,msg.from,msg.metadata);window.__links.set(msg.link,link);peer.emit('connection',link);await link.peerConnection.setRemoteDescription(msg.sdp);await link.peerConnection.setLocalDescription(await link.peerConnection.createAnswer());await gather(link.peerConnection);await window.__signal({type:'answer',from:peer.id,to:msg.from,link:msg.link,sdp:link.peerConnection.localDescription.toJSON()})}else if(msg.type==='answer'){await window.__links.get(msg.link)?.peerConnection.setRemoteDescription(msg.sdp)}};
`;
const registry=new Map();let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--allow-loopback-in-peer-connection','--disable-features=WebRtcHideLocalIpsWithMdns','--force-webrtc-ip-handling-policy=default_public_and_private_interfaces'],...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{} });
  const contexts=await Promise.all([...Array.from({length:5},(_,i)=>browser.newContext({serviceWorkers:'block',viewport:i===3?{width:390,height:844}:i===4?{width:820,height:1180}:{width:1366,height:900},hasTouch:i>2}))]);
  for(const context of contexts){
    await context.exposeBinding('__signal',({page},msg)=>{
      if(msg.type==='register'){registry.set(msg.from,{page,token:msg.token});return true;}
      if(msg.type==='destroy'){if(registry.get(msg.from)?.token===msg.token)registry.delete(msg.from);return true;}
      const target=registry.get(msg.to);if(!target)return false;
      target.page.evaluate(msg=>window.__receive(msg),msg).catch(()=>{});return true;
    });
    await context.route('**/vendor/peerjs.min.js',route=>route.fulfill({contentType:'text/javascript',body:adapter}));
  }
  const host=await contexts[0].newPage(),guest=await contexts[1].newPage();
  for(const page of [host,guest])page.on('pageerror',error=>console.log('PAGE ERROR',error.stack));
  await host.goto(base+'/drop/');await host.locator('#device-name').fill('PC personal');await host.locator('#create-room').click();
  await host.waitForFunction(()=>window.dropConnection?.state.room&&document.querySelector('#room-details').hidden===false);
  const code=await host.locator('#room-code').innerText();
  for(const page of [host,guest]) { page.on('pageerror',e=>console.log('browser error',e.message)); page.on('console',m=>{if(m.type()==='error')console.log('console',m.text())}); }
  await guest.goto(base+'/drop/');await guest.locator('#device-name').fill('PC Ethernet');await guest.locator('#room-input').fill(code);
  try {  await Promise.all([host.waitForFunction(()=>window.dropConnection?.state.ready),guest.waitForFunction(()=>window.dropConnection?.state.ready)]);}catch(error){for(const page of [host,guest])console.log(await page.evaluate(()=>({state:window.dropConnection?.state,peer:window.__currentPeer?.id,links:[...window.__links.values()].map(c=>({ice:c.peerConnection.iceConnectionState,state:c.peerConnection.connectionState,local:c.peerConnection.localDescription?.type,remote:c.peerConnection.remoteDescription?.type})),error:document.querySelector('#session-error').textContent})));throw error;}
  console.log('Initial channel connected');
  const send=async(page,text)=>{await page.locator('#text-input').fill(text);await page.locator('#send-text').click();};
  await host.locator('.tc-home').click();await host.locator('.drop-catalog-layer:not([hidden])').waitFor();
  await host.frameLocator('.drop-catalog-layer iframe').locator('body[data-portal=toolchain]').waitFor();
  await send(guest,'Mensaje con Toolchain abierto');
  await host.waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Mensaje con Toolchain abierto'));
  assert.equal(await host.evaluate(()=>window.dropConnection.state.ready),true);
  assert.equal(await host.evaluate(()=>window.__peerInstances.length),1);
  await host.frameLocator('.drop-catalog-layer iframe').locator('[data-tool=drop]').click();
  await host.locator('.drop-catalog-layer[hidden]').waitFor({state:'attached'});
  assert.match(await host.locator('#inbox-items').innerText(),/Mensaje con Toolchain abierto/);
  // Lost signaling must not replace a healthy WebRTC channel.
  await host.evaluate(()=>{const p=window.__currentPeer;p.disconnected=true;p.emit('disconnected')});
  assert.equal(await host.evaluate(()=>window.__peerInstances.length),1);
  await send(host,'Canal conservado');await guest.waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Canal conservado'));
  // Hard channel failure recovers the same room and preserves unsent files.
  await guest.locator('#file-input').setInputFiles({name:'pendiente.txt',mimeType:'text/plain',buffer:Buffer.from('Contenido sin pérdida')});
  await guest.evaluate(()=>{for(const c of window.__links.values())c.close()});
  await guest.waitForFunction(()=>window.__links.size>1&&window.dropConnection.state.ready);
  await host.waitForFunction(()=>window.dropConnection.state.ready);
  assert.equal(await guest.locator('#room-code').textContent(),code);
  assert.match(await guest.locator('#queue-summary').innerText(),/1 archivo/);
  await guest.locator('#send-text').click();await host.waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Integridad verificada'));
  await host.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))});
  assert.equal(await host.evaluate(()=>window.dropConnection.state.ready),true);
  await send(guest,'Después de volver');await host.waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Después de volver'));
  // A single shared room with the user's five devices; every pair must be ready.
  const pages=[host,guest],names=['PC personal','PC Ethernet','Laptop corpo','iPhone','iPad'];
  for(let i=2;i<5;i++){
    const page=await contexts[i].newPage();pages.push(page);
    page.on('pageerror',error=>{throw error;});
    await page.goto(base+'/drop/');await page.locator('#device-name').fill(names[i]);await page.locator('#room-input').fill(code);
    await page.waitForFunction(()=>window.dropConnection.state.ready);
  }
  console.log('Five devices joined');
  for(const page of pages){
    await page.waitForFunction(()=>window.dropConnection.state.members.length===5&&window.dropConnection.state.members.every(m=>m.connected));
    assert.equal(await page.locator('#device-count').textContent(),'5 dispositivos');
  }
  const leave=async page=>{await page.locator('#session-panel').evaluate(el=>{el.open=true;});await page.click('#leave-room');};
  const localId=page=>page.evaluate(()=>window.dropConnection.state.members.find(m=>m.local).id);
  await pages[3].selectOption('#recipient',await localId(pages[4]));await send(pages[3],'iPhone → iPad privado');
  await pages[4].waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('iPhone → iPad privado'));
  for(const page of pages.slice(0,3))assert(!(await page.locator('#inbox-items').innerText()).includes('iPhone → iPad privado'));
  const payload=Buffer.alloc(128*1024+19,67);payload.set([137,80,78,71,13,10,26,10]);
  await pages[2].selectOption('#recipient',await localId(pages[3]));
  await pages[2].locator('#file-input').setInputFiles({name:'captura-compartida.png',mimeType:'image/png',buffer:payload});
  await pages[2].click('#send-text');await pages[3].waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Integridad verificada'));
  const downloading=pages[3].waitForEvent('download');await pages[3].locator('#inbox-items .item').filter({hasText:'captura-compartida.png'}).getByRole('button',{name:'Descargar',exact:true}).click();
  assert.deepEqual(await readFile(await(await downloading).path()),payload);
  await host.selectOption('#recipient','all');await send(host,'Mensaje para los cinco');
  for(const page of pages.slice(1))await page.waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Mensaje para los cinco'));
  console.log('Private text, file download and broadcast passed');
  // One guest leaves. The others keep the same peer instances and still transfer.
  await leave(pages[3]);
  for(const page of [host,guest,pages[2],pages[4]])await page.waitForFunction(()=>window.dropConnection.state.members.length===4);
  assert.equal(await host.evaluate(()=>window.__peerInstances.length),1);
  await pages[2].selectOption('#recipient',await localId(pages[4]));await send(pages[2],'La sala continúa sin iPhone');
  await pages[4].waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('La sala continúa sin iPhone'));
  await pages[3].locator('#room-input').fill(code);
  for(const page of pages)await page.waitForFunction(()=>window.dropConnection.state.members.length===5&&window.dropConnection.state.members.every(m=>m.connected));
  await pages[4].reload();
  for(const page of pages)await page.waitForFunction(()=>window.dropConnection.state.members.length===5&&window.dropConnection.state.members.every(m=>m.connected));
  for(const page of [pages[3],pages[4]]){
    await page.locator('#session-panel').evaluate(el=>{el.open=true;});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile/tablet overflow with five devices');
  }
  const details=JSON.stringify(await host.evaluate(()=>window.dropConnection.diagnostics()));assert(!details.includes('Mensaje para los cinco'));
  // Updated guest can still join an old host's one-link handshake.
  const legacyContext=await browser.newContext({serviceWorkers:'block'});
  await legacyContext.exposeBinding('__signal',({page},msg)=>{if(msg.type==='register'){registry.set(msg.from,{page,token:msg.token});return true;}if(msg.type==='destroy'){if(registry.get(msg.from)?.token===msg.token)registry.delete(msg.from);return true;}const target=registry.get(msg.to);if(!target)return false;target.page.evaluate(msg=>window.__receive(msg),msg).catch(()=>{});return true;});
  await legacyContext.route('**/vendor/peerjs.min.js',route=>route.fulfill({contentType:'text/javascript',body:adapter}));
  const legacy=await legacyContext.newPage();await legacy.goto(base+'/drop/');
  await legacy.evaluate(()=>{window.legacyPeer=new Peer('reynoso-drop-9876');window.legacyPeer.on('connection',conn=>conn.on('open',()=>conn.send({type:'approved',device:'Host anterior',kind:'PC',heartbeat:1})));});
  await leave(pages[3]);await pages[3].locator('#room-input').fill('9876');
  await pages[3].waitForFunction(()=>window.dropConnection.state.ready);assert.equal(await pages[3].locator('#device-count').textContent(),'2 dispositivos');
  await leave(pages[3]);await legacy.evaluate(()=>window.legacyPeer.destroy());await legacy.close();
  await leave(host);
  for(const page of [guest,pages[2],pages[4]])await page.waitForFunction(()=>!window.dropConnection.active);
  const offlineContext=await browser.newContext(),offlinePage=await offlineContext.newPage();
  const offlineErrors=[];offlinePage.on('pageerror',error=>offlineErrors.push(error.message));
  await offlinePage.goto(base+'/drop/');await offlinePage.evaluate(()=>navigator.serviceWorker.ready);await offlinePage.reload();
  await offlineContext.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>document.body.dataset.dropReady==='true');
  assert.equal(await offlinePage.title(),'Drop · Reynoso Toolchain');assert.deepEqual(offlineErrors,[]);await offlineContext.close();
  console.log('PWA: complete transport modules load offline from the scoped cache.');
  console.log('Five devices: mesh, private text, binary file/hash/download, broadcast, isolated leave, rejoin, reload, mobile/tablet, old host and room closure passed.');
  console.log(`Drop (${memory?'injected transport':'real RTCDataChannel'}): text/file, catalog continuity, signaling recovery, channel reconnect, same room, queued files and BFCache passed.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
