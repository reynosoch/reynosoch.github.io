import { MAX_TEXT, MAX_FILE, MAX_MEMORY, CHUNK_SIZE, newCode, newRoomCode, formatCode, parseCode, deviceName, validId, safeName, sizeLabel, validOffer, digest, FileReceiver } from './protocol.js?v=1.7.1';
import { fileKind, extendQueue, imageMime } from './files.js?v=1.7.1';
import { lineCount, needsTextFile, textFile } from './clipboard.js?v=1.7.1';
import { drawRoomQR } from './qr.js?v=1.7.1';
import { detectDevice, deviceType, deviceIcon } from './devices.js?v=1.7.1';
import { startQRScanner } from './qrscan.js?v=1.7.1';
import { DROP_CONFIG } from './transport-config.js';
import { TransportManager } from './transport-manager.js';
const $ = id => document.getElementById(id);
let ready = false, room = '', host = false;
let toastTimer, outgoingId = null, busy = false, usedMemory = 0, sendingTarget = '';
let autoJoinTimer, roomName = '', stopScan = null;
const pending = new Map(), receivers = new Map(), urls = new Set(), completed = new Map();
const fileDeliveries = new WeakMap();
let textDelivery = null;
let queuedFiles = [], queueGeneration = 0;
const queueUrls = new Set(), cardUrls = new Map();
const localDevice = detectDevice(navigator), device = localDevice.label;
const manager = new TransportManager({Peer:window.Peer,config:DROP_CONFIG,timers:{setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)},now:()=>Date.now(),online:()=>navigator.onLine});
$('device-name').value = device;
function remoteMembers() { return manager.state.members.filter(member=>!member.local); }
function selectedTargets() {
  const value=$('recipient').value;
  return remoteMembers().filter(member=>member.connected&&(value==='all'||member.id===value)).map(member=>member.id);
}
function targetLabel(id) { return remoteMembers().find(member=>member.id===id)?.name || 'Dispositivo'; }
function renderDevices() {
  const members=remoteMembers(), connected=members.filter(member=>member.connected);
  document.body.dataset.dropSession = room ? 'active' : 'idle';
  $('local-device-name').textContent = roomName || deviceName($('device-name').value, device);
  $('local-device-detail').textContent = `${device} · Este dispositivo`;
  $('local-device-icon').innerHTML = deviceIcon(localDevice.type);
  $('local-device-status').textContent = ready ? 'Listo para enviar' : room ? 'En la sala' : 'Disponible';
  $('local-device-status').className = `device-state${ready ? ' live' : ''}`;
  // Keep the first card's established IDs for accessibility and older integrations.
  const first=members[0]; $('remote-device').hidden=!first;
  if(first){
    $('remote-device-name').textContent=first.name;
    $('remote-device-detail').textContent=first.kind;
    $('remote-device-icon').innerHTML=deviceIcon(deviceType(first.deviceType,first.kind));
    $('remote-device-status').textContent=first.connected?'Conectado':'Conectando…';
    $('remote-device-status').className=`device-state${first.connected?' live':''}`;
  }
  $('additional-devices').replaceChildren();
  for(const member of members.slice(1)){
    const card=document.createElement('li');card.className='device-card';
    const icon=document.createElement('span');icon.className='device-glyph';icon.innerHTML=deviceIcon(member.deviceType);icon.setAttribute('aria-hidden','true');
    const identity=document.createElement('div'),name=document.createElement('strong'),kind=document.createElement('span');
    name.textContent=member.name;kind.textContent=member.kind;identity.append(name,kind);
    const badge=document.createElement('span');badge.className=`device-state${member.connected?' live':''}`;badge.textContent=member.connected?'Conectado':'Conectando…';
    card.append(icon,identity,badge);$('additional-devices').append(card);
  }
  const count=1+members.length;
  $('device-count').textContent=`${count} ${count===1?'dispositivo':'dispositivos'}${members.some(member=>!member.connected)?' · conectando':''}`;
  $('device-name').disabled=Boolean(room);
  $('session-summary').textContent=ready?`Sala ${formatCode(room)} · ${connected.length===1?connected[0].name+' conectado':connected.length+' dispositivos conectados'}`:room?`Sala ${formatCode(room)}`:'';
  const selected=$('recipient').value;
  const options=members.map(member=>{
    const option=document.createElement('option');option.value=member.id;option.textContent=member.name+(member.connected?'':' · conectando');option.disabled=!member.connected;return option;
  });
  if(members.length>1){const all=document.createElement('option');all.value='all';all.textContent='Todos los dispositivos conectados';options.unshift(all);}
  if(!options.length){const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Conecta tus dispositivos';options.push(placeholder);}
  $('recipient').replaceChildren(...options);
  // Keep an unavailable selection explicit instead of silently sending elsewhere.
  if(selected==='all'&&members.length>1||members.some(member=>member.id===selected))$('recipient').value=selected;
  else if(!selected)$('recipient').value=connected[0]?.id||members[0]?.id||'';
  else {const unavailable=document.createElement('option');unavailable.value=selected;unavailable.textContent='Dispositivo desconectado · elige destinatario';unavailable.disabled=true;$('recipient').append(unavailable);$('recipient').value=selected;}
  $('recipient').disabled=busy||!connected.length;
  const info=manager.diagnostics();
  $('connection-diagnostics').textContent=JSON.stringify(info,null,2);
}
function clearSessionTransfers(peerId) {
  for(const key of [...pending.keys()])if(!peerId||key.startsWith(peerId+'|'))ack(key,null,'Conexión interrumpida. El contenido pendiente se conserva para reenviarlo.');
  for(const [key,entry] of [...receivers])if(!peerId||entry.peerId===peerId)dropReceiver(key);
}
manager.on('state',state=>{
  room=state.room;host=state.host;ready=state.ready;
  status(ready?'Conectado':room?state.recovering?'Reconectando…':'Esperando dispositivo':'Sin conexión',ready?'connected':room?'waiting':'');
  renderDevices();controls();
});
manager.on('room',()=>showRoom());
manager.on('connected',()=>{
  $('connection-hint').textContent='Puedes unir más dispositivos con el mismo código. Elige a quién enviar el contenido.';
  $('session-error').hidden=true;closeScanner();$('session-panel').open=false;controls();
});
manager.on('disconnected',peerId=>clearSessionTransfers(peerId));
manager.on('migration',peerId=>{
  for(const [key,task] of [...pending])if(key.startsWith(peerId+'|')){
    clearTimeout(task.timer);pending.delete(key);
    const error=new Error('Restableciendo conexión…');error.code='transport-changed';task.reject(error);
  }
});
manager.on('notice',message=>{error(message);$('connection-hint').textContent=message;});
manager.on('expired',()=>{reset();toast('El código venció. Crea una sala nueva.');});
manager.on('room-closed',()=>{try{localStorage.removeItem('reynoso-drop:session-v1');}catch{}reset();toast('El anfitrión cerró la sala');});
manager.on('message',({peerId,message})=>{
  handle(message,peerId).catch(e=>{
    error(e.message);
    if(validId(message.id)){try{send({type:'failed',id:message.id,reason:e.message},peerId);}catch{}dropReceiver(transferKey(peerId,message.id));}
  });
});
function resumeConnection() { networkInfo();manager.resume(); }
function reset() {
  manager.close();clearSessionTransfers();room='';ready=false;host=false;roomName='';
  clearTimeout(autoJoinTimer);closeScanner();$('session-panel').open=true;
  $('room-details').hidden=true;$('qr-panel').hidden=true;$('setup').hidden=false;
  $('create-room').disabled=$('join-room').disabled=false;
  $('recipient').value='';status('Sin conexión');controls();renderDevices();
  history.replaceState(null,'',location.pathname+location.search);
}
function showRoom() {
  $('setup').hidden=true;$('room-details').hidden=false;$('room-code').textContent=formatCode(room);
  $('connection-hint').textContent=host?'Usa estos cuatro números o el QR en tus otros dispositivos. Hasta 8 pantallas en la misma sala.':'Conectando con los dispositivos de la sala…';
  $('leave-room').textContent=host?'Cerrar sala':'Salir de la sala';
  if(host){try{drawRoomQR($('room-qr'),roomURL().href);$('qr-panel').hidden=false;}catch(e){toast(e.message);}}
  renderDevices();
}
function roomURL() {const url=new URL(location.href);url.searchParams.set('v','1.9');url.hash=room;return url;}
function start(isHost,code,collisionAttempts=0,isRecovery=false) {
  reset();$('session-error').hidden=true;
  if(!crypto.subtle||!DROP_CONFIG.relayUrl&&(!window.Peer||!window.RTCPeerConnection)){error('Este navegador no permite WebRTC. Usa una versión reciente de Chrome, Edge o Safari mediante HTTPS.');return;}
  roomName=deviceName($('device-name').value,device);
  $('create-room').disabled=$('join-room').disabled=true;
  manager.connect({host:isHost,code,device:roomName,kind:device,deviceType:localDevice.type,recovering:isRecovery});
}

function networkInfo() {
  const type = navigator.connection?.type;
  const label = {wifi:'Wi-Fi', ethernet:'Ethernet', cellular:'Datos móviles'}[type];
  $('network-status').textContent = navigator.onLine ? label ? `Conexión: ${label}` : 'Conexión de red disponible' : 'Sin conexión de red';
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
function error(message) { $('session-error').textContent = message; $('session-error').hidden = false; }
function status(message, kind = '') { $('status').textContent = message; $('status').className = `badge ${kind}`; }
function sendLabel() {
  const value = $('text-input').value, hasText = Boolean(value.trim()), count = queuedFiles.length;
  const files = `${count} ${count === 1 ? 'archivo' : 'archivos'}`;
  if (hasText && count) return `Enviar texto + ${files} →`;
  if (count) return `Enviar ${files} →`;
  if (hasText) return needsTextFile(value) ? 'Enviar como .txt →' : 'Enviar texto →';
  return 'Enviar →';
}
function controls() {
  const hasText = Boolean($('text-input').value.trim());
  $('send-text').disabled = !selectedTargets().length || busy || (!hasText && !queuedFiles.length) || (!hasText && receivers.size > 0);
  $('send-text').textContent = sendLabel();
  $('file-zone').disabled = $('choose-photos').disabled = $('file-input').disabled = $('photo-input').disabled = busy;
  $('clear-files').disabled = busy || !queuedFiles.length;
  $('recipient').disabled = busy || !remoteMembers().some(member=>member.connected);
  $('queue-hint').textContent = !queuedFiles.length && !hasText ? 'Puedes preparar tu envío antes de conectar. Todo sale con un solo botón.' : !ready ? 'Conecta un dispositivo y elige a quién enviar tu selección.' : receivers.size ? 'Termina la recepción actual para enviar archivos.' : 'Listo: texto y archivos salen juntos con Enviar.';
}
function releaseCardPreview(card) {
  const url = cardUrls.get(card); if (!url) return;
  URL.revokeObjectURL(url); urls.delete(url); cardUrls.delete(card);
}
function renderQueue() {
  const generation = ++queueGeneration;
  for (const url of queueUrls) URL.revokeObjectURL(url); queueUrls.clear();
  $('file-queue').replaceChildren();
  $('file-selection').hidden = queuedFiles.length === 0;
  $('queue-summary').textContent = `${queuedFiles.length} ${queuedFiles.length === 1 ? 'archivo' : 'archivos'} · ${sizeLabel(queuedFiles.reduce((sum,file) => sum + file.size, 0))}`;
  for (const [index,file] of queuedFiles.entries()) {
    const item = document.createElement('div'); item.className = 'queued-file';
    const badge = document.createElement('span'); badge.className = 'file-badge'; badge.textContent = fileKind(file.name) === 'Foto' ? 'FOTO' : file.name.includes('.') ? file.name.split('.').pop().slice(0,5).toUpperCase() : 'FILE';
    const details = document.createElement('div'); details.className = 'queued-details';
    const name = document.createElement('strong'); name.textContent = safeName(file.name);
    const info = document.createElement('span'); info.textContent = `${fileKind(file.name)} · ${sizeLabel(file.size)}`; details.append(name,info);
    item.append(badge,details);
    const remove = addButton(item, 'Quitar', () => { queuedFiles.splice(index,1); renderQueue(); controls(); }, 'subtle'); remove.disabled = busy;
    $('file-queue').append(item);
    imageMime(file).then(mime => {
      if (!mime || generation !== queueGeneration) return;
      const url = URL.createObjectURL(file.slice(0,file.size,mime)); queueUrls.add(url);
      const image = document.createElement('img'); image.className = 'queued-thumbnail'; image.alt = `Vista previa: ${safeName(file.name)}`; image.decoding = 'async';
      image.onload = () => { if (generation === queueGeneration) badge.replaceWith(image); };
      image.onerror = () => { URL.revokeObjectURL(url); queueUrls.delete(url); };
      image.src = url;
    }).catch(() => { /* Keep the original file and generic badge if decoding fails. */ });
  }
}
function stageFiles(files) {
  if (busy) { toast('Espera a que termine el envío actual.'); return; }
  const result = extendQueue(queuedFiles, Array.from(files)); queuedFiles = result.files;
  renderQueue(); controls();
  $('file-input').value = $('photo-input').value = '';
  if (result.rejected.length) toast(`${result.rejected.length} ${result.rejected.length === 1 ? 'archivo omitido' : 'archivos omitidos'}: ${result.rejected[0].reason}.`);
}
function linesLabel(text) { const count = lineCount(text); return `${count.toLocaleString('es-MX')} ${count === 1 ? 'línea' : 'líneas'}`; }
function prepareTextFile(text) {
  let file;
  try { file = textFile(text); } catch (e) { toast(e.message); return null; }
  stageFiles([file]);
  if (!queuedFiles.includes(file)) return null;
  toast(`${linesLabel(text)} preparadas como .txt. El contenido se conserva completo.`);
  return file;
}
function pasteIntoEditor(text, atSelection = false) {
  if (!text) return;
  const area = $('text-input');
  const start = atSelection ? area.selectionStart ?? area.value.length : area.value.length;
  const end = atSelection ? area.selectionEnd ?? start : start;
  const separator = !atSelection && area.value && !area.value.endsWith('\n') ? '\n' : '';
  const next = area.value.slice(0, start) + separator + text + area.value.slice(end);
  if (needsTextFile(next)) {
    if (prepareTextFile(next)) { area.value = ''; countText(); }
    return;
  }
  area.value = next;
  area.focus(); area.setSelectionRange(start + separator.length + text.length, start + separator.length + text.length);
  countText();
}
async function pasteClipboard() {
  try {
    if (!navigator.clipboard?.read) { pasteIntoEditor(await navigator.clipboard.readText(), true); return; }
    const items = await navigator.clipboard.read();
    let found = false;
    for (const item of items) {
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const extension = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif' }[imageType] || 'image';
        stageFiles([new File([blob], `portapapeles-${Date.now()}.${extension}`, {type:imageType})]); found = true;
      }
      if (item.types.includes('text/plain')) { pasteIntoEditor(await (await item.getType('text/plain')).text(), true); found = true; }
    }
    if (!found) toast('El navegador no expone este contenido. Agrega el archivo desde el selector.');
  } catch {
    $('text-input').focus(); toast('Pega con Ctrl+V o mantén presionado el campo en iPad.');
  }
}
async function receivedPhoto(blob, card, name) {
  const mime = await imageMime(blob); if (!mime || !card.isConnected) return;
  const url = URL.createObjectURL(blob.slice(0,blob.size,mime)); urls.add(url); cardUrls.set(card,url);
  const image = document.createElement('img'); image.className = 'received-photo'; image.alt = safeName(name); image.decoding = 'async';
  image.onload = () => { if (card.isConnected && cardUrls.get(card) === url) card.append(image); };
  image.onerror = () => { releaseCardPreview(card); if (card.isConnected) { const note = document.createElement('p'); note.className = 'preview-note'; note.textContent = 'Vista previa no disponible en este navegador. Puedes descargar la foto original.'; card.append(note); } };
  image.src = url;
}
function ack(key, value = true, fail = null) { const task = pending.get(key); if (!task) return; clearTimeout(task.timer); pending.delete(key); fail ? task.reject(new Error(fail)) : task.resolve(value); }
function transferKey(peerId,key) {return `${peerId}|${key}`;}
function send(msg,peerId) {manager.send(msg,peerId);}
function request(msg,key,timeout=30000,peerId) {
  const scoped=transferKey(peerId,key);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{if(manager.fallback(peerId))return;pending.delete(scoped);reject(new Error(`${targetLabel(peerId)} no respondió a tiempo`));},timeout);
    pending.set(scoped,{resolve,reject,timer});
    try{send(msg,peerId);}catch(e){ack(scoped,null,e.message);}
  });
}
function receipt(key) {
  for(const [id,value] of completed)if(Date.now()-value.at>10*60*1000)completed.delete(id);
  return completed.get(key);
}
function remember(key,value) {
  completed.set(key,{...value,at:Date.now()});
  if(completed.size>512)completed.delete(completed.keys().next().value);
}
function dropReceiver(id, message) {
  const entry = receivers.get(id); if (!entry) return;
  clearTimeout(entry.timer);
  usedMemory -= entry.offer.size; receivers.delete(id); entry.card.remove();
  if (message) toast(message); updateInbox(); controls();
}
function updateInbox() { const count = $('inbox-items').children.length; $('inbox-empty').hidden = count > 0; $('clear-inbox').disabled = count === 0; }
function stamp(value) { return Number.isFinite(value) && Math.abs(Date.now() - value) < 86400000 ? new Date(value) : new Date(); }
function fromLabel(sent,peerId) {const member=remoteMembers().find(member=>member.id===peerId);return `${sent?'Para':'De'}: ${member?.name||'Dispositivo'}${member?.kind&&member.kind!==member.name?' · '+member.kind:''}`;}
function makeCard(label, from = '', at) {
  if ($('inbox-items').children.length >= 30) throw new Error('Bandeja llena. Vacíala antes de recibir más.');
  const card = document.createElement('article'); card.className = 'item';
  const meta = document.createElement('div'); meta.className = 'item-meta';
  const kind = document.createElement('span'); kind.textContent = label;
  const time = document.createElement('span'); time.textContent = stamp(at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  meta.append(kind, time);
  if (from) { const origin = document.createElement('span'); origin.className = 'item-from'; origin.textContent = from; meta.append(origin); }
  card.append(meta); $('inbox-items').prepend(card); updateInbox(); return card;
}
function addButton(parent, text, action, kind = 'secondary') { const button = document.createElement('button'); button.className = `button ${kind}`; button.textContent = text; button.addEventListener('click', action); parent.append(button); return button; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado'); }
  catch { const input = document.createElement('textarea'); input.value = text; input.setAttribute('readonly', ''); document.body.append(input); input.select(); input.setSelectionRange(0, input.value.length); const ok = document.execCommand('copy'); input.remove(); toast(ok ? 'Copiado' : 'El navegador bloqueó copiar. Selecciona el texto y cópialo manualmente.'); }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob); urls.add(url); const a = document.createElement('a'); a.href = url; a.download = safeName(name); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 60000);
}
function textCard(text, sent = false, at, peerId) {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (usedMemory + bytes > MAX_MEMORY) throw new Error('Bandeja llena. Vacíala para continuar.');
  const card = makeCard(sent ? 'TEXTO · ENVIADO' : 'TEXTO · RECIBIDO', fromLabel(sent,peerId), at); usedMemory += bytes;
  const pre = document.createElement('pre'); pre.textContent = text; card.append(pre);
  const actions = document.createElement('div'); actions.className = 'item-actions'; card.append(actions);
  addButton(actions, 'Copiar', () => copy(text)); addButton(actions, 'Descargar .txt', () => download(new Blob([text], {type:'text/plain;charset=utf-8'}), 'texto.txt'));
  addButton(actions, 'Quitar', () => { usedMemory -= bytes; card.remove(); updateInbox(); }, 'subtle');
}
function receiverTimeout(entry, duration = 30000) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (receivers.get(entry.key) !== entry) return;
    try { send({type:'failed',id:entry.offer.id,reason:'La recepción expiró. Vuelve a enviar el archivo.'},entry.peerId); } catch { /* disconnected */ }
    dropReceiver(entry.key, 'La recepción expiró. Puedes volver a enviar el archivo.');
  }, duration);
}
function receiveFile(entry) {
  if (receivers.get(entry.key) !== entry || entry.receiver) return;
  entry.receiver = new FileReceiver(entry.offer); entry.actions.replaceChildren(); entry.state.textContent = 'Recibiendo… 0%';
  entry.card.querySelector('.item-meta span').textContent = 'ARCHIVO · RECIBIENDO';
  addButton(entry.actions, 'Cancelar', () => { send({type:'failed',id:entry.offer.id,reason:'El receptor canceló el archivo'},entry.peerId); dropReceiver(entry.key); }, 'subtle danger');
  receiverTimeout(entry); send({type:'ack',key:`offer:${entry.offer.id}`},entry.peerId);
}
function fileCard(offer,peerId) {
  const card = makeCard('ARCHIVO · SOLICITUD', fromLabel(false,peerId), offer.sentAt);
  const name = document.createElement('strong'); name.className = 'item-name'; name.textContent = safeName(offer.name);
  const state = document.createElement('div'); state.className = 'item-size'; state.textContent = `${fileKind(offer.name)} · ${sizeLabel(offer.size)} · Esperando tu permiso`;
  const actions = document.createElement('div'); actions.className = 'item-actions'; card.append(name, state, actions);
  const entry = {offer,card,state,actions,peerId,key:transferKey(peerId,offer.id),receiver:null,timer:null}; receivers.set(entry.key,entry); usedMemory += offer.size; controls();
  if ($('auto-receive').checked) { receiveFile(entry); return; }
  receiverTimeout(entry, 90000);
  addButton(actions, 'Recibir archivo', () => receiveFile(entry), 'primary');
  addButton(actions, 'Rechazar', () => { send({type:'failed',id:offer.id,reason:'El otro dispositivo rechazó el archivo'},peerId); dropReceiver(entry.key); }, 'subtle');
}

async function handle(msg,peerId) {
  const key=transferKey(peerId,msg.id),done=receipt(key);
  if (!ready) return;
  if (msg.type === 'ack' && typeof msg.key === 'string' && msg.key.length < 100) { ack(transferKey(peerId,msg.key)); return; }
  if (msg.type === 'failed' && validId(msg.id)) {
    const reason = typeof msg.reason === 'string' ? msg.reason.slice(0, 180) : 'Se canceló el envío';
    for (const key of [...pending.keys()]) if (key.startsWith(peerId+'|')&&key.includes(msg.id)) ack(key, null, reason);
    dropReceiver(key, reason); return;
  }
  if (msg.type === 'text') {
    if (!validId(msg.id) || typeof msg.text !== 'string' || !msg.text.trim() || new TextEncoder().encode(msg.text).byteLength > MAX_TEXT) throw new Error('El texto supera el límite de 512 KB o no es válido');
    if(done?.type!=='text'){textCard(msg.text,false,msg.sentAt,peerId);remember(key,{type:'text'});} send({type:'ack',key:`text:${msg.id}`},peerId); toast('Texto recibido'); return;
  }
  if (msg.type === 'file-offer') {
    if(done?.type==='file'&&validOffer(msg)&&done.hash===msg.hash&&done.size===msg.size){send({type:'ack',key:`offer:${msg.id}`},peerId);return;}
    const existing=receivers.get(key);
    if(existing){
      if(existing.offer.hash!==msg.hash||existing.offer.size!==msg.size)throw new Error('El archivo cambió durante la transferencia');
      if(msg.restart&&existing.receiver){existing.receiver=new FileReceiver(existing.offer);receiverTimeout(existing);}
      if(existing.receiver)send({type:'ack',key:`offer:${msg.id}`},peerId);return;
    }
    if (!validOffer(msg, usedMemory) || receivers.size || busy) throw new Error('Archivo no admitido, bandeja llena o hay otro envío en curso');
    fileCard(msg,peerId); if (!$('auto-receive').checked) toast('Tienes un archivo por recibir'); return;
  }
  if (msg.type === 'file-chunk') {
    if(done?.type==='file'){
      const length=ArrayBuffer.isView(msg.bytes)?msg.bytes.byteLength:msg.bytes instanceof ArrayBuffer?msg.bytes.byteLength:-1;
      if(!Number.isSafeInteger(msg.index)||msg.index<0||msg.index*CHUNK_SIZE>=done.size||length!==Math.min(CHUNK_SIZE,done.size-msg.index*CHUNK_SIZE))throw new Error('Bloque de archivo no válido');
      send({type:'ack',key:`chunk:${msg.id}:${msg.index}`},peerId);return;
    }
    const entry = receivers.get(key); if (!entry?.receiver) throw new Error('Archivo sin permiso de recepción');
    entry.receiver.append(msg); receiverTimeout(entry); entry.state.textContent = `Recibiendo… ${Math.floor(entry.receiver.size / entry.offer.size * 100)}%`;
    send({type:'ack',key:`chunk:${msg.id}:${msg.index}`},peerId); return;
  }
  if (msg.type === 'file-end') {
    if(done?.type==='file'){send({type:'ack',key:`end:${msg.id}`},peerId);return;}
    const entry = receivers.get(key); if (!entry?.receiver) throw new Error('Archivo sin permiso de recepción');
    const blob = await entry.receiver.finish();
    if (receivers.get(key) !== entry || !ready) return;
    clearTimeout(entry.timer); receivers.delete(key); entry.actions.replaceChildren();
    entry.card.querySelector('.item-meta span').textContent = 'ARCHIVO · RECIBIDO'; entry.state.textContent = `${fileKind(entry.offer.name)} · ${sizeLabel(blob.size)} · Integridad verificada`;
    addButton(entry.actions, 'Descargar', () => download(blob, entry.offer.name), 'primary');
    addButton(entry.actions, 'Quitar', () => { usedMemory -= entry.offer.size; releaseCardPreview(entry.card); entry.card.remove(); updateInbox(); }, 'subtle');
    remember(key,{type:'file',size:entry.offer.size,hash:entry.offer.hash});
    send({type:'ack',key:`end:${msg.id}`},peerId); controls(); toast('Archivo recibido y verificado');
    receivedPhoto(blob,entry.card,entry.offer.name).catch(() => { /* Download remains available independently of preview support. */ });
  }
}
async function withTransportRetry(action,peerId) {
  for(let attempt=0;attempt<3;attempt++){
    try{return await action(attempt);}
    catch(error){if(error.code!=='transport-changed'||attempt===2)throw error;}
  }
}
async function sendText(targets) {
  const text=$('text-input').value;
  if(!targets.length||busy||!text.trim())return false;
  if(needsTextFile(text)){
    const file=prepareTextFile(text);if(!file)return false;
    $('text-input').value='';countText();return await sendFiles([file],targets);
  }
  if(new TextEncoder().encode(text).byteLength>MAX_TEXT){toast('El texto supera 512 KB. Envíalo como archivo.');return false;}
  if(!textDelivery||textDelivery.text!==text)textDelivery={text,id:newCode(),delivered:new Set()};
  const delivery=textDelivery;
  busy=true;controls();let success=true;
  try {
    for(const peerId of targets){
      if(delivery.delivered.has(peerId))continue;
      if(usedMemory+new TextEncoder().encode(text).byteLength>MAX_MEMORY||$('inbox-items').children.length>=30)throw new Error('Vacía la bandeja antes de enviar más.');
      await withTransportRetry(()=>request({type:'text',id:delivery.id,text,sentAt:Date.now()},`text:${delivery.id}`,30000,peerId),peerId);
      delivery.delivered.add(peerId);textCard(text,true,undefined,peerId);
    }
    if($('text-input').value===text){$('text-input').value='';countText();}textDelivery=null;toast('Texto entregado');
  }catch(e){error(e.message);success=false;}
  finally{busy=false;controls();}
  return success;
}
async function sendFiles(files,targets) {
  if(!targets.length||busy||receivers.size){toast('Elige un dispositivo conectado y termina el envío actual.');return false;}
  const list=Array.from(files);if(!list.length)return true;
  busy=true;renderQueue();controls();let success=true;
  try {
    for(const file of list){
      if(file.size>MAX_FILE)throw new Error(`${safeName(file.name)} supera 50 MB.`);
      let delivery=fileDeliveries.get(file);
      if(!delivery){delivery={id:newCode(),delivered:new Set()};fileDeliveries.set(file,delivery);}
      const id=delivery.id;outgoingId=id;
      $('transfer-progress').hidden=false;$('progress-name').textContent=safeName(file.name);$('progress-bar').value=0;$('progress-label').textContent='Preparando archivo…';
      const hash=await digest(await file.arrayBuffer());
      for(const peerId of targets){
        if(delivery.delivered.has(peerId))continue;
        if(outgoingId!==id)throw new Error('Envío cancelado');
        sendingTarget=peerId;$('progress-label').textContent=`Preparando recepción en ${targetLabel(peerId)}…`;
        await withTransportRetry(async attempt=>{
        await request({type:'file-offer',id,name:safeName(file.name),size:file.size,hash,sentAt:Date.now(),restart:attempt>0},`offer:${id}`,95000,peerId);
        let index=0;
        for(let offset=0;offset<file.size;offset+=CHUNK_SIZE){
          const bytes=await file.slice(offset,offset+CHUNK_SIZE).arrayBuffer();
          if(outgoingId!==id)throw new Error('Envío cancelado');
          await request({type:'file-chunk',id,index,bytes},`chunk:${id}:${index}`,30000,peerId);index++;
          const percent=Math.floor(Math.min(offset+CHUNK_SIZE,file.size)/file.size*100);
          $('progress-bar').value=percent;$('progress-label').textContent=`${targetLabel(peerId)} · ${percent}% · ${sizeLabel(file.size)}`;
        }
        $('progress-label').textContent=`Verificando integridad en ${targetLabel(peerId)}…`;
        await request({type:'file-end',id},`end:${id}`,60000,peerId);
        },peerId);delivery.delivered.add(peerId);
      }
      const index=queuedFiles.indexOf(file);if(index!==-1)queuedFiles.splice(index,1);
      renderQueue();controls();toast(`${safeName(file.name)} entregado`);
    }
  }catch(e){
    if(outgoingId&&sendingTarget){try{send({type:'failed',id:outgoingId,reason:'El envío se canceló'},sendingTarget);}catch{}}
    error(e.message);success=false;
  }finally{outgoingId=null;sendingTarget='';busy=false;$('transfer-progress').hidden=true;$('file-input').value='';renderQueue();controls();}
  return success;
}
async function sendAll() {
  if(!ready||busy)return;
  const targets=selectedTargets(),hasText=Boolean($('text-input').value.trim());
  if(!targets.length||!hasText&&!queuedFiles.length)return;
  if(hasText&&!await sendText(targets))return;
  if(queuedFiles.length)await sendFiles([...queuedFiles],targets);
}
function closeScanner() { stopScan?.(); stopScan = null; $('scan-panel').hidden = true; }
async function openScanner() {
  if (room || manager.intent) { toast('Ya hay una sala abierta. Ciérrala para escanear otra.'); return; }
  $('session-error').hidden = true; $('scan-panel').hidden = false;
  try {
    const stop = await startQRScanner({ video: $('scan-video'), canvas: $('scan-canvas'), onCode: value => {
      const code = parseCode(value);
      if (!code) { toast('Ese QR no es de una sala de Reynoso Drop.'); return false; }
      closeScanner(); $('room-input').value = formatCode(code); joinRoom(); return true;
    } });
    if ($('scan-panel').hidden) { stop(); return; }
    stopScan = stop;
  } catch (e) { closeScanner(); error(e.message); }
}
function countText() {
  const text = $('text-input').value, asFile = needsTextFile(text);
  $('text-counter').textContent = `${text.length.toLocaleString('es-MX')} caracteres · ${linesLabel(text)}${asFile ? ' · Se enviará como .txt' : ''}`;
  controls();
}
function joinRoom() { const code = parseCode($('room-input').value); if (!code) { error('Escribe los 4 números de la sala. También puedes pegar su enlace.'); return; } start(false, code); }
function scheduleJoin() {
  clearTimeout(autoJoinTimer);
  if (!parseCode($('room-input').value) || room || manager.intent) return;
  autoJoinTimer = setTimeout(() => { if (!room && !manager.intent) joinRoom(); }, 300);
}
$('create-room').addEventListener('click', () => { let resumed = false; try { resumed = /^\d{4}$/.test(localStorage.getItem('reynoso-drop:resume-host-room') || ''); } catch {} start(true, newRoomCode(), 0, resumed); });
$('join-room').addEventListener('click', joinRoom);
$('room-input').addEventListener('input', scheduleJoin);
$('device-name').addEventListener('input', renderDevices);
$('room-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('join-room').disabled) $('join-room').click(); });
$('copy-code').addEventListener('click', () => copy(formatCode(room)));
$('copy-link').addEventListener('click', () => copy(roomURL().href));
$('leave-room').addEventListener('click',()=>{const wasHost=host;manager.close(true);reset();toast(wasHost?'Sala cerrada':'Saliste de la sala');});
$('recipient').addEventListener('change',controls);
$('text-input').addEventListener('input', countText);
$('text-input').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendAll(); } if (e.key === 'Tab') { e.preventDefault(); const area = e.target; const start = area.selectionStart; area.setRangeText('  ', start, area.selectionEnd, 'end'); countText(); } });
$('send-text').addEventListener('click', sendAll);
$('scan-qr').addEventListener('click', openScanner);
$('scan-close').addEventListener('click', closeScanner);
$('paste-text').addEventListener('click', pasteClipboard);
$('file-zone').addEventListener('click', () => $('file-input').click());
$('choose-photos').addEventListener('click', () => $('photo-input').click());
$('file-input').addEventListener('change', e => stageFiles(e.target.files));
$('photo-input').addEventListener('change', e => stageFiles(e.target.files));
$('auto-receive').addEventListener('change', () => { if ($('auto-receive').checked) for (const entry of receivers.values()) receiveFile(entry); });
$('clear-files').addEventListener('click', () => { queuedFiles = []; renderQueue(); controls(); });
for (const event of ['dragenter', 'dragover']) $('compose-drop').addEventListener(event, e => { e.preventDefault(); if (!busy) $('compose-drop').classList.add('drag-over'); });
for (const event of ['dragleave', 'drop']) $('compose-drop').addEventListener(event, e => { e.preventDefault(); $('compose-drop').classList.remove('drag-over'); if (event === 'drop') stageFiles(e.dataTransfer.files); });
window.addEventListener('paste', e => {
  const target = e.target, editor = $('text-input');
  if (target !== editor && (target?.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target?.tagName || ''))) return;
  const files = Array.from(e.clipboardData?.files || []);
  const text = e.clipboardData?.getData?.('text/plain') || '';
  if (!files.length && !text) return;
  e.preventDefault();
  if (files.length) stageFiles(files);
  if (text) pasteIntoEditor(text, target === editor);
});
window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', e => e.preventDefault());
$('cancel-transfer').addEventListener('click', () => { const id = outgoingId; if (!id) return; outgoingId = null; try { send({type:'failed',id,reason:'El remitente canceló el envío'},sendingTarget); } catch { /* disconnected */ } for (const key of [...pending.keys()]) if (key.includes(id)) ack(key, null, 'Envío cancelado'); });
$('clear-inbox').addEventListener('click', () => {
  if (receivers.size) { toast('Termina o rechaza el archivo pendiente antes de vaciar.'); return; }
  if (!confirm('¿Vaciar la bandeja? Descarga primero lo que quieras conservar.')) return;
  $('inbox-items').replaceChildren(); usedMemory = 0; for (const url of urls) URL.revokeObjectURL(url); urls.clear(); cardUrls.clear(); updateInbox();
});
window.addEventListener('pagehide', event => { if (!event.persisted) reset(); });
window.addEventListener('pageshow', resumeConnection);
window.addEventListener('focus', resumeConnection);
document.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'visible') resumeConnection(); });
window.dropConnection = {reconnect:resumeConnection,resume:resumeConnection,get active(){return Boolean(manager.intent);},get state(){return manager.state;},diagnostics:()=>manager.diagnostics()};
const initial = parseCode(location.hash.slice(1)); if (initial) { $('room-input').value = formatCode(initial); history.replaceState(null, '', location.pathname + location.search); scheduleJoin(); }
window.addEventListener('online', resumeConnection); window.addEventListener('offline', networkInfo);
navigator.connection?.addEventListener('change', resumeConnection);
countText(); renderDevices(); networkInfo(); renderQueue();
document.body.dataset.dropReady='true';
document.dispatchEvent(new Event('drop:ready'));
