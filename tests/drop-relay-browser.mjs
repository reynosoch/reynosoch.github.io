import {once} from 'node:events';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createRelay} from '../drop-relay/server.mjs';
import {peerAdapter} from './helpers/drop-peer.mjs';
import {decodeFrame} from '../drop/relay-codec.js';

// Real HTTP + WebSocket server. Only the initial WebRTC links/signaling are
// simulated, because the managed system browser disallows direct WebRTC UDP.
const relay=createRelay();relay.server.listen(0,'127.0.0.1');await once(relay.server,'listening');
const base=`http://127.0.0.1:${relay.server.address().port}`,registry=new Map(),errors=[];
let browser;
try{
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const contexts=[],pages=[];
  async function pageFor(name,{blocked=false,brokerBlocked=false}={}){
    const context=await browser.newContext({serviceWorkers:'block',viewport:name==='iPhone'?{width:390,height:844}:{width:1280,height:900}});contexts.push(context);
    await context.addInitScript(({blocked})=>{window.__blockRTC=blocked;}, {blocked});
    await context.route('**/transport-config.js',async route=>{
      const response=await route.fetch();const text=await response.text();
      await route.fulfill({response,body:text.replace('connectionTimeout: 12000','connectionTimeout: 250').replace('signalingTimeout: 8000','signalingTimeout: 300')});
    });
    await context.exposeBinding('__signal',({page},msg)=>{
      if(msg.type==='register'){registry.set(msg.from,{page,token:msg.token});return true;}
      if(msg.type==='destroy'){if(registry.get(msg.from)?.token===msg.token)registry.delete(msg.from);return true;}
      const target=registry.get(msg.to);if(!target)return false;target.page.evaluate(msg=>window.__receive(msg),msg).catch(()=>{});return true;
    });
    await context.route('**/vendor/peerjs.min.js',route=>route.fulfill({contentType:'text/javascript',body:brokerBlocked?'window.Peer=class {constructor(){throw new Error("broker unavailable")}};':peerAdapter(true)}));
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/drop/');await page.fill('#device-name',name);pages.push(page);return page;
  }
  const host=await pageFor('PC personal');await host.click('#create-room');await host.waitForFunction(()=>!document.querySelector('#room-details').hidden);
  const code=await host.locator('#room-code').textContent();
  const laptop=await pageFor('Laptop empresa');await laptop.fill('#room-input',code);
  for(const page of [host,laptop])await page.waitForFunction(()=>window.dropConnection.state.ready);
  assert.equal((await host.evaluate(()=>window.dropConnection.diagnostics())).activeTransport,'WebRTC');
  console.log('Direct fast path stays WebRTC; relay carries membership only.');
  const id=page=>page.evaluate(()=>window.dropConnection.state.members.find(m=>m.local).id);
  async function file(from,to,name,bytes){
    await from.selectOption('#recipient',await id(to));
    await from.setInputFiles('#file-input',{name,mimeType:'application/pdf',buffer:bytes});
    await from.click('#send-text');
    const card=to.locator('#inbox-items .item').filter({hasText:name});await card.getByText(/Integridad verificada/).waitFor();
    const downloading=to.waitForEvent('download');await card.getByRole('button',{name:'Descargar',exact:true}).click();
    assert.deepEqual(await readFile(await(await downloading).path()),bytes);assert.equal(await card.count(),1);
    await from.waitForFunction(()=>document.querySelector('#file-selection').hidden);
  }
  // Fail an actual pending file operation after the direct offer was accepted.
  for(const page of [host,laptop])await page.evaluate(()=>{window.__blockRTC=true;});
  await laptop.evaluate(()=>{
    for(const link of window.__links.values()){
      const send=link.send.bind(link);link.send=message=>{
        if(message.type==='file-chunk'&&!window.__brokeFile){window.__brokeFile=true;link.close();return;}
        send(message);
      };
    }
  });
  const pdf=Buffer.alloc(160*1024+23,65);pdf.write('%PDF-1.4\n');pdf.write('\n%%EOF',pdf.length-6);
  await file(laptop,host,'archivo-en-migracion.pdf',pdf);
  assert.equal((await laptop.evaluate(()=>window.dropConnection.diagnostics())).activeTransport,'Drop Relay');
  assert.equal((await host.evaluate(()=>window.dropConnection.diagnostics())).activeTransport,'Drop Relay');
  console.log('Mid-file direct failure → short retry → real WebSocket relay; same PDF bytes, one card.');
  const phone=await pageFor('iPhone',{blocked:true,brokerBlocked:true});await phone.fill('#room-input',code);
  const tablet=await pageFor('iPad',{blocked:true,brokerBlocked:true});await tablet.fill('#room-input',code);
  const ethernet=await pageFor('PC Ethernet',{blocked:true});await ethernet.fill('#room-input',code);
  for(const page of pages)await page.waitForFunction(()=>window.dropConnection.state.members.length===5&&window.dropConnection.state.members.every(m=>m.connected),null,{timeout:15000});
  await file(phone,tablet,'tarea-universidad.pdf',Buffer.from('%PDF-1.4\nUniversidad a iPad\n%%EOF'));
  await file(tablet,phone,'respuesta-celular.pdf',Buffer.from('%PDF-1.4\nRespuesta al celular\n%%EOF'));
  const sourceId=await id(phone),tabletId=await id(tablet),source=[...relay.clients].find(c=>c.id===sourceId);
  const interrupt=data=>{
    const packet=decodeFrame(data);
    if(packet.to===tabletId&&packet.message?.type==='file-chunk'){
      source.socket.off('message',interrupt);[...relay.clients].find(c=>c.id===tabletId).socket.terminate();
    }
  };
  source.socket.on('message',interrupt);
  await file(phone,tablet,'cambio-de-wifi.pdf',pdf);
  console.log('Receiver socket interruption mid-PDF reconnects and restarts without a duplicate.');
  await file(ethernet,laptop,'oficina-ethernet.pdf',Buffer.from('%PDF-1.4\nEthernet hacia laptop\n%%EOF'));
  await phone.selectOption('#recipient','all');await phone.fill('#text-input','Saludo a los cinco por conexión alternativa');await phone.click('#send-text');
  for(const page of pages.filter(p=>p!==phone))await page.waitForFunction(()=>document.querySelector('#inbox-items').textContent.includes('Saludo a los cinco'));
  assert.equal([...relay.rooms.values()][0].transfers.size,0);
  console.log('Five devices: broker unavailable, PDFs in both directions, Ethernet peer and broadcast over real relay passed.');
  // Restart a room socket while preserving the room and the other participants.
  const phoneId=await id(phone);[...relay.clients].find(client=>client.id===phoneId).socket.terminate();
  await phone.waitForFunction(()=>window.dropConnection.diagnostics().relayState==='connected'&&window.dropConnection.state.ready,null,{timeout:15000});
  await phone.reload();await phone.waitForFunction(()=>window.dropConnection.state.ready,null,{timeout:15000});
  assert.equal(await id(phone),phoneId);
  assert.equal(await phone.locator('#room-code').textContent(),code);
  await host.reload();await host.waitForFunction(()=>window.dropConnection.state.ready,null,{timeout:15000});
  assert.equal(await host.locator('#room-code').textContent(),code);
  assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('Relay reconnect, F5/same room, file metadata cleanup and mobile layout passed.');
}finally{await browser?.close();await relay.close();}
