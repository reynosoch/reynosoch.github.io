import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import * as protocol from '../protocol.js';
import * as fileTools from '../files.js';
import * as clipboardTools from '../clipboard.js';
import * as qrTools from '../qr.js';
import * as deviceTools from '../devices.js';
import * as scanTools from '../qrscan.js';
import {peerRoundTrip} from './helpers/peer-codec.js';

// Exercise real application event handlers without a network or browser.
function setup({hash = '', clipboard = {}, autoReceive = true, userAgent = 'Windows', platform = 'Win32', maxTouchPoints = 0} = {}) {
  const elements = new Map(), timers = new Map(), peers = [], createdUrls = [], revokedUrls = [], windowEvents = new Map(); let timerId = 0;
  function node(tag = '') {
    return {tagName:tag.toUpperCase(),isConnected:true,focus(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},value:'',textContent:'',hidden:false,disabled:false,children:[],listeners:new Map(),replaceChildren(...children){this.children=[];this.append(...children);},append(...children){for(const child of children) child.parentNode=this;this.children.push(...children);},prepend(...children){for(const child of children) child.parentNode=this;this.children.unshift(...children);},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.isConnected=false;},querySelector(){return this.children.find(child=>child.className==='item-meta')?.children[0];},addEventListener(event,fn){this.listeners.set(event,fn);},fire(event){return this.listeners.get(event)?.({target:this});},classList:{add(){},remove(){}}};
  }
  function element(id) {
    if (!elements.has(id)) elements.set(id,node());
    return elements.get(id);
  }
  class Connection extends EventEmitter {
    constructor(metadata = {}) { super(); this.metadata = metadata; this.open = false; this.messages = []; }
    send(message) { this.messages.push(message); }
    close() { this.open = false; this.emit('close'); }
    establish() { this.open = true; this.emit('open'); }
  }
  class Peer extends EventEmitter {
    constructor(id) { super(); this.id = id; this.destroyed = false; peers.push(this); }
    connect(id, options) { this.target = id; this.options = options; return this.connection = new Connection(); }
    destroy() { this.destroyed = true; }
  }
  const timersAPI = {setTimeout(fn, ms) { const id = ++timerId; timers.set(id,{fn,ms}); return id; },clearTimeout(id) { timers.delete(id); }};
  class TestURL extends URL { static createObjectURL(){const url=`blob:test-${createdUrls.length}`;createdUrls.push(url);return url;} static revokeObjectURL(url){revokedUrls.push(url);} }
  const context = {...protocol, ...fileTools, ...clipboardTools, ...qrTools, ...deviceTools, ...scanTools, ...timersAPI, crypto, TextEncoder, URL:TestURL, Blob, File,
    document:{getElementById:element,createElement:node}, navigator:{userAgent,platform,maxTouchPoints,onLine:true,clipboard},
    window:{Peer,RTCPeerConnection(){},addEventListener(event,fn){windowEvents.set(event,fn);}}, history:{replaceState(){}}, location:{href:`https://reynosoch.github.io/drop/${hash}`,pathname:'/drop/',search:'',hash}, confirm:()=>true};
  element('auto-receive').checked=autoReceive;
  const source = readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
  runInNewContext(source, context);
  function expire(ms) { for (const [id,timer] of [...timers]) if (timer.ms === ms && timers.has(id)) { timers.delete(id); timer.fn(); } }
  return {element,peers,Connection,expire,createdUrls,revokedUrls,windowEvents};
}
test('permite cargar documentos antes de conectar y limpiar la selección sin enviarla', () => {
  const {element,peers}=setup();
  assert.equal(element('file-zone').disabled,false); assert.equal(element('choose-photos').disabled,false);
  element('file-input').files=[new File(['PK00'],'reporte.xlsx'),new File(['%PDF'],'manual.pdf')]; element('file-input').fire('change');
  assert.match(element('queue-summary').textContent,/2 archivos/); assert.equal(element('file-queue').children.length,2);
  assert.equal(element('send-text').disabled,true); assert.equal(peers.length,0);
  element('clear-files').fire('click'); assert.equal(element('file-selection').hidden,true); assert.equal(element('file-queue').children.length,0);
});
test('pegar una captura la agrega como archivo y limpiar revoca las miniaturas temporales', async () => {
  const {element,createdUrls,revokedUrls,windowEvents}=setup(); let prevented=false;
  const photo=new File([new Uint8Array([137,80,78,71,13,10,26,10])],'captura.png');
  windowEvents.get('paste')({clipboardData:{files:[photo]},preventDefault(){prevented=true;}});
  assert.equal(prevented,true); assert.match(element('queue-summary').textContent,/1 archivo/);
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(createdUrls.length,1);
  element('clear-files').fire('click'); assert.deepEqual(revokedUrls,createdUrls);
});
test('envía varios documentos originales y retira de la cola solo los confirmados', async () => {
  const {element,peers,Connection}=setup(); element('create-room').fire('click'); const host=peers[0]; host.emit('open');
  const conn=new Connection({device:'Otra laptop',token:protocol.newCode()}); host.emit('connection',conn); conn.establish();
  conn.send=msg=>{
    conn.messages.push(msg);
    const key=msg.type==='file-offer'?`offer:${msg.id}`:msg.type==='file-chunk'?`chunk:${msg.id}:${msg.index}`:msg.type==='file-end'?`end:${msg.id}`:null;
    if(key) conn.emit('data',{type:'ack',key});
  };
  const excel=new File([new Uint8Array([80,75,3,4,0,255])],'reporte.xlsx'); const pdf=new File(['%PDF sample'],'manual.pdf');
  element('file-input').files=[excel,pdf]; element('file-input').fire('change'); assert.equal(element('send-text').disabled,false);
  await element('send-text').fire('click');
  const offers=conn.messages.filter(msg=>msg.type==='file-offer'); assert.deepEqual(offers.map(msg=>msg.name),['reporte.xlsx','manual.pdf']);
  for(const [i,file] of [excel,pdf].entries()) {
    const parts=conn.messages.filter(msg=>msg.type==='file-chunk'&&msg.id===offers[i].id).map(msg=>msg.bytes);
    assert.deepEqual(await new Blob(parts).arrayBuffer(),await file.arrayBuffer());
  }
  assert.equal(element('file-selection').hidden,true); assert.equal(element('transfer-progress').hidden,true);
});
test('el cuarto número conecta automáticamente; tres números no abren una sala', () => {
  const {element,peers,expire} = setup();
  element('room-input').value = '001'; element('room-input').fire('input'); expire(300); assert.equal(peers.length,0);
  element('room-input').value = '0012'; element('room-input').fire('input'); expire(300); assert.equal(peers.length,1);
  peers[0].emit('open'); assert.equal(peers[0].target,'reynoso-drop-0012');
  assert.equal(element('room-code').textContent,'0012'); assert.equal(element('send-text').disabled,true);
});
test('el primer dispositivo conecta sin permiso, admite regreso y excluye un tercer equipo', () => {
  const {element,peers,Connection}=setup(); element('device-name').value='Laptop personal'; element('create-room').fire('click');
  const host=peers[0]; host.emit('open'); assert.match(host.id,/^reynoso-drop-\d{4}$/);
  const first=new Connection({device:'iPad',kind:'iPad'}); host.emit('connection',first);
  assert.equal(element('remote-device-status').textContent,'Conectando…');
  first.establish(); assert.equal(first.messages[0].type,'approved'); assert.equal(first.messages[0].device,'Laptop personal');
  assert.equal(element('device-count').textContent,'2 dispositivos');
  const third=new Connection({device:'Tercero'}); host.emit('connection',third); assert.equal(third.open,false); assert.equal(third.listenerCount('open'),0);
  first.close(); assert.equal(host.destroyed,false); assert.equal(element('remote-device').hidden,true);
  const returning=new Connection({device:'iPad',kind:'iPad'}); host.emit('connection',returning); returning.establish();
  assert.equal(returning.messages[0].type,'approved'); assert.equal(element('device-count').textContent,'2 dispositivos');
});
test('sala sin conectar vence a los diez minutos y las colisiones se reintentan', () => {
  const {element,peers,expire}=setup(); element('create-room').fire('click'); const first=peers[0];
  first.emit('error',{type:'unavailable-id'}); assert.equal(peers.length,2); assert.equal(first.destroyed,true);
  peers[1].emit('open'); expire(10*60*1000); assert.equal(peers[1].destroyed,true); assert.equal(element('room-details').hidden,true); assert.equal(element('status').textContent,'Sin conexión');
});
test('Ctrl+V dirige texto al editor, respeta su selección y deja intacto el campo de sala', () => {
  const {element,windowEvents}=setup(); const editor=element('text-input'), paste=windowEvents.get('paste');
  const event=(text,target)=>({target,clipboardData:{files:[],getData:()=>text},preventDefault(){this.prevented=true;}});
  const outside=event('texto inicial'); paste(outside); assert.equal(outside.prevented,true); assert.equal(editor.value,'texto inicial');
  editor.selectionStart=0; editor.selectionEnd=5; paste(event('código',editor)); assert.equal(editor.value,'código inicial');
  const room=element('room-input'); room.tagName='INPUT'; room.value='';
  const normal=event('0012',room); paste(normal); assert.equal(normal.prevented,undefined); assert.equal(editor.value,'código inicial');
});
test('pegar 401 líneas prepara un txt completo antes de conectar y pegar 400 queda como texto', () => {
  const {element,windowEvents}=setup(); const paste=windowEvents.get('paste');
  const text=Array.from({length:400},(_,i)=>`const línea${i} = '😊';`).join('\n');
  const event=value=>({clipboardData:{files:[],getData:()=>value},preventDefault(){}});
  paste(event(text)); assert.equal(element('text-input').value,text); assert.equal(element('file-selection').hidden,true);
  paste(event('línea 401')); assert.equal(element('text-input').value,'');
  assert.match(element('file-queue').children[0].children[1].children[0].textContent,/\.txt$/);
  assert.match(element('toast').textContent,/401 líneas/); assert.equal(element('send-text').disabled,true);
});
test('el enlace escaneado del QR conecta automáticamente conservando ceros', () => {
  const {peers,expire,element}=setup({hash:'#0012'}); assert.equal(element('room-input').value,'0012');
  expire(300); peers[0].emit('open'); assert.equal(peers[0].target,'reynoso-drop-0012');
});
test('el botón Pegar lee imágenes y texto y no solicita acceso al cargar', async () => {
  let reads=0; const clipboard={async read(){reads++; return [{types:['image/png','text/plain'],async getType(type){return type==='text/plain'?new Blob(['código completo']):new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type});}}];}};
  const {element}=setup({clipboard}); assert.equal(reads,0); await element('paste-text').fire('click');
  assert.equal(reads,1); assert.equal(element('text-input').value,'código completo'); assert.match(element('queue-summary').textContent,/1 archivo/);
});
test('enviar texto escrito con 401 líneas utiliza transferencia binaria y conserva los bytes', async () => {
  const {element,peers,Connection}=setup(); element('create-room').fire('click'); const host=peers[0]; host.emit('open');
  const conn=new Connection({token:protocol.newCode()}); host.emit('connection',conn); conn.establish();
  conn.send=msg=>{conn.messages.push(msg); const key=msg.type==='file-offer'?`offer:${msg.id}`:msg.type==='file-chunk'?`chunk:${msg.id}:${msg.index}`:msg.type==='file-end'?`end:${msg.id}`:null; if(key) conn.emit('data',{type:'ack',key});};
  const text=Array.from({length:401},(_,i)=>`línea ${i}: ñ 😊`).join('\r\n');
  element('text-input').value=text; element('text-input').fire('input'); assert.match(element('send-text').textContent,/\.txt/);
  await element('send-text').fire('click');
  assert.equal(conn.messages.some(msg=>msg.type==='text'),false);
  const offer=conn.messages.find(msg=>msg.type==='file-offer'); assert.match(offer.name,/\.txt$/);
  const receiver=new protocol.FileReceiver(offer); for(const chunk of conn.messages.filter(msg=>msg.type==='file-chunk')) receiver.append(chunk);
  assert.equal(await (await receiver.finish()).text(),text); assert.equal(element('file-selection').hidden,true);
});

test('67 llega a la otra pantalla sin pulsar Permitir y el envío recibe confirmación', async () => {
  const a=setup(), b=setup({hash:'#0012'});
  a.element('create-room').fire('click'); const host=a.peers[0]; host.emit('open');
  b.expire(300); const guest=b.peers[0]; guest.emit('open');
  const local=new a.Connection({device:'iPad',kind:'iPad'}), remote=guest.connection;
  local.send=msg=>queueMicrotask(()=>remote.emit('data',structuredClone(msg)));
  remote.send=msg=>queueMicrotask(()=>local.emit('data',structuredClone(msg)));
  host.emit('connection',local); remote.establish(); local.establish(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(a.element('status').textContent,'Conectado'); assert.equal(b.element('status').textContent,'Conectado');
  b.element('text-input').value='67'; b.element('text-input').fire('input'); assert.equal(b.element('send-text').disabled,false);
  await b.element('send-text').fire('click');
  assert.equal(a.element('inbox-items').children[0].children[1].textContent,'67');
  assert.equal(b.element('inbox-items').children[0].children[1].textContent,'67');
  assert.equal(b.element('text-input').value,'');
});
test('un canal que no abre no ocupa la sala indefinidamente ni finge conexión', () => {
  const {element,peers,Connection,expire}=setup(); element('create-room').fire('click'); const host=peers[0]; host.emit('open');
  const stalled=new Connection({device:'iPad'}); host.emit('connection',stalled); expire(30000);
  assert.equal(element('device-count').textContent,'1 dispositivo'); assert.match(element('session-error').textContent,/canal de datos no abrió/);
  const next=new Connection({device:'Laptop'}); host.emit('connection',next); next.establish(); assert.equal(element('device-count').textContent,'2 dispositivos');
});

test('sin sala solo muestra este dispositivo y la lista agrega y quita la pantalla real con su icono', () => {
  const {element,peers,Connection}=setup(); assert.equal(element('remote-device').hidden,true);
  assert.match(element('local-device-icon').innerHTML,/M8 21h8/); assert.equal(element('device-count').textContent,'1 dispositivo');
  element('create-room').fire('click'); const host=peers[0]; host.emit('open'); assert.equal(element('remote-device').hidden,true);
  const conn=new Connection({device:'iPad de Reynoso',kind:'iPad',deviceType:'tablet'});host.emit('connection',conn);conn.establish();
  assert.equal(element('remote-device').hidden,false);assert.equal(element('remote-device-name').textContent,'iPad de Reynoso');
  assert.match(element('remote-device-icon').innerHTML,/width="16" height="20"/);
  conn.close();assert.equal(element('remote-device').hidden,true);assert.equal(element('device-count').textContent,'1 dispositivo');
  const phone=new Connection({device:'Celular',kind:'iPhone'});host.emit('connection',phone);phone.establish();assert.match(element('remote-device-icon').innerHTML,/width="12" height="20"/);
});
function linkedSessions({autoReceive=true}={}) {
  const sender=setup({hash:'#0012'}),receiver=setup({autoReceive,userAgent:'iPad Safari',platform:'MacIntel',maxTouchPoints:5});
  receiver.element('create-room').fire('click');const host=receiver.peers[0];host.emit('open');
  sender.expire(300);const guest=sender.peers[0];guest.emit('open');
  const local=new receiver.Connection({device:'Laptop',kind:'Laptop Windows',deviceType:'computer'}),remote=guest.connection;
  const downloaded=[];
  let resolveConnected,resolveOffered;
  const connected=new Promise(resolve=>{resolveConnected=resolve;}),offered=new Promise(resolve=>{resolveOffered=resolve;});
  local.send=async msg=>{if(msg.type==='ack'&&msg.key.startsWith('end:'))downloaded.push(receiver.element('inbox-items').children[0]);remote.emit('data',await peerRoundTrip(msg));if(msg.type==='approved')resolveConnected();};
  remote.send=async msg=>{local.emit('data',await peerRoundTrip(msg));if(msg.type==='file-offer')resolveOffered();};
  host.emit('connection',local);remote.establish();local.establish();
  return {sender,receiver,local,remote,downloaded,connected,offered};
}
test('captura y Excel pasan por el codec real de PeerJS y llegan automáticamente con SHA verificado', async () => {
  const {sender,receiver,connected}=linkedSessions();await connected;
  const photoBytes=new Uint8Array(protocol.CHUNK_SIZE*2+23);for(let i=0;i<photoBytes.length;i++)photoBytes[i]=i%251;photoBytes.set([137,80,78,71,13,10,26,10]);
  const files=[new File([photoBytes],'captura.png'),new File([new Uint8Array([80,75,3,4,0,255])],'reporte.xlsx')];
  sender.element('file-input').files=files;sender.element('file-input').fire('change');
  await sender.element('send-text').fire('click');
  assert.equal(sender.element('file-selection').hidden,true);assert.equal(receiver.element('inbox-items').children.length,2);
  for(const card of receiver.element('inbox-items').children){
    assert.equal(card.children[0].children[0].textContent,'ARCHIVO · RECIBIDO');
    assert.match(card.children[2].textContent,/Integridad verificada/);assert.equal(card.children[3].children[0].textContent,'Descargar');
    assert.equal(card.children[3].children.some(button=>button.textContent==='Recibir archivo'),false);
  }
  assert.equal(receiver.element('session-error').textContent,'');
});
test('modo manual conserva aceptar/rechazar y activar automático libera la espera', async () => {
  const {sender,receiver,connected,offered}=linkedSessions({autoReceive:false});await connected;
  sender.element('file-input').files=[new File(['contenido completo'],'manual.txt')];sender.element('file-input').fire('change');
  const sending=sender.element('send-text').fire('click');await offered;
  const card=receiver.element('inbox-items').children[0];assert.equal(card.children[3].children[0].textContent,'Recibir archivo');
  assert.equal(sender.element('file-selection').hidden,false);
  receiver.element('auto-receive').checked=true;receiver.element('auto-receive').fire('change');await sending;
  assert.equal(sender.element('file-selection').hidden,true);assert.match(card.children[2].textContent,/Integridad verificada/);
});
test('al conectar la sección de conexión se minimiza y se reabre al cerrar la sala', () => {
  const {element,peers,Connection}=setup(); element('create-room').fire('click'); const host=peers[0]; host.emit('open');
  assert.equal(element('session-panel').open,true);
  const conn=new Connection({device:'iPad',kind:'iPad'}); host.emit('connection',conn); conn.establish();
  assert.equal(element('session-panel').open,false); assert.match(element('session-summary').textContent,/iPad conectado/);
  element('leave-room').fire('click'); assert.equal(element('session-panel').open,true);
});
test('lo recibido muestra el dispositivo que lo envió y la hora, y el envío unificado manda texto y archivos', async () => {
  const {element,peers,Connection}=setup(); element('create-room').fire('click'); const host=peers[0]; host.emit('open');
  const conn=new Connection({device:'iPad de Reynoso',kind:'iPad'}); host.emit('connection',conn); conn.establish();
  conn.send=msg=>{conn.messages.push(msg); const key=msg.type==='file-offer'?`offer:${msg.id}`:msg.type==='file-chunk'?`chunk:${msg.id}:${msg.index}`:msg.type==='file-end'?`end:${msg.id}`:msg.type==='text'?`text:${msg.id}`:null; if(key) conn.emit('data',{type:'ack',key});};
  conn.emit('data',{type:'text',id:protocol.newCode(),text:'hola',sentAt:Date.now()});
  const meta=element('inbox-items').children[0].children[0];
  assert.equal(meta.children[0].textContent,'TEXTO · RECIBIDO'); assert.match(meta.children[1].textContent,/\d{2}:\d{2}:\d{2}/); assert.match(meta.children[2].textContent,/^De: iPad de Reynoso/);
  element('text-input').value='nota'; element('file-input').files=[new File(['abc'],'a.txt')]; element('file-input').fire('change');
  element('text-input').fire('input'); assert.match(element('send-text').textContent,/texto \+ 1 archivo/);
  await element('send-text').fire('click');
  assert.deepEqual(conn.messages.filter(m=>m.type==='text'||m.type==='file-offer').map(m=>m.type),['text','file-offer']);
  assert.equal(element('text-input').value,''); assert.equal(element('file-selection').hidden,true);
});
