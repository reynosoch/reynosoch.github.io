import { MAX_TEXT, MAX_FILE, MAX_MEMORY, CHUNK_SIZE, newCode, newRoomCode, formatCode, parseCode, deviceName, validId, safeName, sizeLabel, validOffer, digest, FileReceiver } from './protocol.js?v=1.7.1';
import { fileKind, extendQueue, imageMime } from './files.js?v=1.7.1';
import { lineCount, needsTextFile, textFile } from './clipboard.js?v=1.7.1';
import { drawRoomQR } from './qr.js?v=1.7.1';
import { detectDevice, deviceType, deviceIcon } from './devices.js?v=1.7.1';
import { startQRScanner } from './qrscan.js?v=1.7.1';
const $ = id => document.getElementById(id);
let peer = null, connection = null, incoming = null, ready = false, room = '', host = false;
let connectTimer, signalTimer, toastTimer, outgoingId = null, busy = false, usedMemory = 0;
let autoJoinTimer, roomExpiryTimer, reconnectTimer, remoteName = '', remoteKind = '', roomName = '', stopScan = null;
const ROOM_TTL = 10 * 60 * 1000;
const pending = new Map(), receivers = new Map(), urls = new Set();
let queuedFiles = [], queueGeneration = 0;
const queueUrls = new Set(), cardUrls = new Map();
const localDevice = detectDevice(navigator), device = localDevice.label;
let remoteType = '';
$('device-name').value = device;
function renderDevices() {
  $('local-device-name').textContent = roomName || deviceName($('device-name').value, device);
  $('local-device-detail').textContent = `${device} · Este dispositivo`;
  $('local-device-icon').innerHTML = deviceIcon(localDevice.type);
  $('local-device-status').textContent = ready ? 'Listo para enviar' : room ? 'En la sala' : 'Disponible';
  $('local-device-status').className = `device-state${ready ? ' live' : ''}`;
  const hasRemote = Boolean(room && (ready || incoming));
  $('remote-device').hidden = !hasRemote;
  if (hasRemote) {
    $('remote-device-name').textContent = remoteName || 'Dispositivo';
    $('remote-device-detail').textContent = remoteKind || 'Conectando a la sala';
    $('remote-device-icon').innerHTML = deviceIcon(deviceType(remoteType, remoteKind));
    $('remote-device-status').textContent = ready ? 'Conectado' : 'Conectando…';
    $('remote-device-status').className = `device-state${ready ? ' live' : ''}`;
  }
  $('device-count').textContent = ready ? '2 dispositivos' : hasRemote ? '2 · conectando' : '1 dispositivo';
  $('device-name').disabled = Boolean(room);
  $('session-summary').textContent = ready ? `Sala ${formatCode(room)} · ${remoteName || 'Dispositivo'} conectado` : room ? `Sala ${formatCode(room)}` : '';
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
  $('send-text').disabled = !ready || busy || (!hasText && !queuedFiles.length) || (!hasText && receivers.size > 0);
  $('send-text').textContent = sendLabel();
  $('file-zone').disabled = $('choose-photos').disabled = $('file-input').disabled = $('photo-input').disabled = busy;
  $('clear-files').disabled = busy || !queuedFiles.length;
  $('queue-hint').textContent = !queuedFiles.length && !hasText ? 'Puedes preparar tu envío antes de conectar. Todo sale con un solo botón.' : !ready ? 'Conecta la otra pantalla para enviar tu selección.' : receivers.size ? 'Termina la recepción actual para enviar archivos.' : 'Listo: texto y archivos salen juntos con Enviar.';
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
function send(msg) { if (!connection?.open) throw new Error('El otro dispositivo se desconectó'); connection.send(msg); }
function request(msg, key, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(key); reject(new Error('El otro dispositivo no respondió a tiempo')); }, timeout);
    pending.set(key, { resolve, reject, timer });
    try { send(msg); } catch (e) { ack(key, null, e.message); }
  });
}
function dropReceiver(id, message) {
  const entry = receivers.get(id); if (!entry) return;
  clearTimeout(entry.timer);
  usedMemory -= entry.offer.size; receivers.delete(id); entry.card.remove();
  if (message) toast(message); updateInbox(); controls();
}
function reset() {
  ready = false; room = ''; host = false;
  remoteName = remoteKind = remoteType = roomName = '';
  clearTimeout(autoJoinTimer); clearTimeout(roomExpiryTimer); clearTimeout(reconnectTimer);
  clearTimeout(connectTimer); clearTimeout(signalTimer);
  for (const key of [...pending.keys()]) ack(key, null, 'La sala se cerró');
  for (const id of [...receivers.keys()]) dropReceiver(id);
  const previous = connection, next = incoming, previousPeer = peer;
  connection = incoming = peer = null;
  previous?.close(); next?.close(); previousPeer?.destroy();
  closeScanner(); $('session-panel').open = true;
  $('room-details').hidden = true; $('qr-panel').hidden = true; $('setup').hidden = false;
  $('create-room').disabled = $('join-room').disabled = false;
  status('Sin conexión'); controls(); renderDevices();
  history.replaceState(null, '', location.pathname + location.search);
}
function disconnected(conn) {
  if (conn !== connection && conn !== incoming) return;
  if (host) {
    clearTimeout(connectTimer);
    if (conn === incoming) { incoming = null; remoteName = remoteKind = remoteType = ''; status('Esperando dispositivo', 'waiting'); renderDevices(); return; }
    connection = null; ready = false;
    for (const key of [...pending.keys()]) ack(key, null, 'El otro dispositivo se desconectó');
    for (const id of [...receivers.keys()]) dropReceiver(id);
    status('Esperando dispositivo', 'waiting'); controls(); renderDevices();
    $('connection-hint').textContent = 'El dispositivo se desconectó. Intentará volver automáticamente mientras ambas páginas sigan abiertas. También puedes unir otra pantalla con estos 4 números o el QR.';
    clearTimeout(roomExpiryTimer);
    roomExpiryTimer = setTimeout(() => { if (room && host && !ready) { reset(); toast('El código venció. Crea una sala nueva.'); } }, ROOM_TTL);
    return;
  }
  const previousRoom = room, shouldReconnect = ready;
  reset(); error('El otro dispositivo se desconectó. Crea una sala nueva para continuar.');
  if (shouldReconnect) {
    status('Reconectando…', 'waiting'); $('session-error').hidden = true;
    reconnectTimer = setTimeout(() => start(false, previousRoom), 1500);
  }
}
function connected() {
  clearTimeout(connectTimer); clearTimeout(roomExpiryTimer); ready = true; status('Conectado', 'connected'); renderDevices();
  $('connection-hint').textContent = 'Las dos pantallas están conectadas. Puedes enviar en ambas direcciones.';
  $('session-error').hidden = true; closeScanner(); $('session-panel').open = false; controls(); toast('Tu otra pantalla está conectada');
}
function showRoom() {
  $('setup').hidden = true; $('room-details').hidden = false; $('room-code').textContent = formatCode(room);
  $('connection-hint').textContent = host ? 'Escribe estos 4 números o escanea el QR en tu otra pantalla. Conecta directamente, sin pedir permiso al anfitrión. El código vence en 10 minutos si no conectas.' : 'Conectando directamente con la otra pantalla…';
  if (host) {
    try { const url = roomURL(); drawRoomQR($('room-qr'), url.href); $('qr-panel').hidden = false; }
    catch (e) { toast(e.message); }
  }
  status(host ? 'Esperando dispositivo' : 'Conectando…', 'waiting');
  renderDevices();
}
function roomURL() { const url = new URL(location.href); url.searchParams.set('v', '1.7'); url.hash = room; return url; }
function watchConnection(conn) {
  const rtc = conn.peerConnection; if (!rtc?.addEventListener) return;
  const update = () => {
    if (conn !== connection && conn !== incoming || ready) return;
    if (rtc.iceConnectionState === 'checking') {
      status('Abriendo canal de datos…', 'waiting');
      $('connection-hint').textContent = 'La sala respondió. Estableciendo el enlace entre las dos pantallas; no necesitas autorizar nada.';
    }
    if (rtc.iceConnectionState === 'failed') {
      disconnected(conn); conn.close();
      error('La sala respondió, pero el canal de datos falló. La red, la VPN o el servicio de conexión pueden impedir el enlace entre dispositivos.');
    }
  };
  rtc.addEventListener('iceconnectionstatechange', update); update();
}
function wire(conn, isIncoming) {
  conn.on('error', () => { disconnected(conn); error('No se pudo abrir el canal entre dispositivos. No hay un permiso pendiente; revisa que ambas páginas estén abiertas.'); });
  conn.on('close', () => disconnected(conn));
  conn.on('open', () => {
    if (isIncoming) {
      if (incoming !== conn) { conn.close(); return; }
      clearTimeout(connectTimer);
      connection = conn; incoming = null;
      remoteName = deviceName(conn.metadata?.device);
      remoteKind = deviceName(conn.metadata?.kind, 'Otro dispositivo'); remoteType = deviceType(conn.metadata?.deviceType, remoteKind);
      // Automatic room handshake; this message never requires user approval.
      send({type:'approved',device:roomName,kind:device,deviceType:localDevice.type}); connected();
    } else { status('Terminando conexión…', 'waiting'); renderDevices(); }
  });
  conn.on('data', msg => {
    if (conn === incoming || conn !== connection || !msg || typeof msg !== 'object') return;
    handle(msg).catch(e => { error(e.message); if (validId(msg.id)) { try { send({ type: 'failed', id: msg.id, reason: e.message }); } catch { /* disconnected */ } dropReceiver(msg.id); } });
  });
  watchConnection(conn);
}

function start(isHost, code, collisionAttempts = 0) {
  reset(); $('session-error').hidden = true;
  if (!window.Peer || !window.RTCPeerConnection || !crypto.subtle) { error('Este navegador no permite WebRTC. Usa una versión reciente de Chrome, Edge o Safari mediante HTTPS.'); return; }
  room = code; host = isHost;
  roomName = deviceName($('device-name').value, device); renderDevices();
  $('create-room').disabled = $('join-room').disabled = true; status('Abriendo sala…', 'waiting');
  // Public broker only exchanges session metadata; payload uses encrypted WebRTC.
  const instance = new window.Peer(isHost ? `reynoso-drop-${room}` : undefined, {
    debug: 1,
    config: {
      sdpSemantics: 'unified-plan',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478', 'turn:eu-0.turn.peerjs.com:3478?transport=tcp', 'turn:us-0.turn.peerjs.com:3478?transport=tcp'], username: 'peerjs', credential: 'peerjsp' },
      ],
    },
  });
  peer = instance;
  signalTimer = setTimeout(() => { if (peer === instance) { reset(); error('No se pudo abrir la sala. La red o el servicio de conexión pueden no estar disponibles.'); } }, 25000);
  instance.on('open', () => {
    if (peer !== instance) return;
    clearTimeout(signalTimer); showRoom();
    if (host) {
      roomExpiryTimer = setTimeout(() => { if (peer === instance && !ready) { reset(); toast('El código venció. Crea una sala nueva.'); } }, ROOM_TTL);
    } else {
      connection = instance.connect(`reynoso-drop-${room}`, { reliable: true, serialization: 'binary', metadata: { device:roomName, kind:device, deviceType:localDevice.type } });
      wire(connection, false);
      connectTimer = setTimeout(() => { if (!ready && peer === instance) { reset(); error('No se abrió el canal entre las dos pantallas. No hay una autorización pendiente. Mantén ambas páginas abiertas; la red, la VPN o el servicio de conexión pueden impedir el enlace.'); } }, 30000);
    }
  });
  instance.on('connection', conn => {
    if (!host || incoming || connection || peer !== instance) { conn.close(); return; }
    incoming = conn;
    remoteName = deviceName(conn.metadata?.device); remoteKind = deviceName(conn.metadata?.kind, 'Otro dispositivo'); remoteType = deviceType(conn.metadata?.deviceType, remoteKind);
    status('Conectando dispositivo…', 'waiting'); renderDevices();
    wire(conn, true);
    connectTimer = setTimeout(() => {
      if (incoming !== conn || ready) return;
      disconnected(conn); conn.close();
      error('La otra pantalla encontró la sala, pero el canal de datos no abrió. La red, la VPN o el servicio de conexión pueden impedir el enlace.');
    }, 30000);
  });
  instance.on('error', e => {
    if (peer !== instance) return;
    if (e.type === 'unavailable-id' && host && collisionAttempts < 4) { start(true, newRoomCode(), collisionAttempts + 1); return; }
    const message = e.type === 'peer-unavailable' ? 'No encontré esa sala. Comprueba el código y que la otra pantalla siga abierta.' : e.type === 'unavailable-id' ? 'Esa sala ya existe. Crea otra.' : 'No se pudo conectar. PeerJS o WebRTC pueden estar bloqueados por esta red. Consulta con TI si usas la laptop corporativa.';
    reset(); error(message);
  });
  instance.on('disconnected', () => { if (peer === instance && !ready) { reset(); error('Se perdió la conexión con el servicio de salas. Vuelve a crear la sala.'); } });
}
function updateInbox() { const count = $('inbox-items').children.length; $('inbox-empty').hidden = count > 0; $('clear-inbox').disabled = count === 0; }
function stamp(value) { return Number.isFinite(value) && Math.abs(Date.now() - value) < 86400000 ? new Date(value) : new Date(); }
function fromLabel(sent) { const who = remoteName || 'Dispositivo'; return `${sent ? 'Para' : 'De'}: ${who}${remoteKind && remoteKind !== who ? ` · ${remoteKind}` : ''}`; }
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
function textCard(text, sent = false, at) {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (usedMemory + bytes > MAX_MEMORY) throw new Error('Bandeja llena. Vacíala para continuar.');
  const card = makeCard(sent ? 'TEXTO · ENVIADO' : 'TEXTO · RECIBIDO', fromLabel(sent), at); usedMemory += bytes;
  const pre = document.createElement('pre'); pre.textContent = text; card.append(pre);
  const actions = document.createElement('div'); actions.className = 'item-actions'; card.append(actions);
  addButton(actions, 'Copiar', () => copy(text)); addButton(actions, 'Descargar .txt', () => download(new Blob([text], {type:'text/plain;charset=utf-8'}), 'texto.txt'));
  addButton(actions, 'Quitar', () => { usedMemory -= bytes; card.remove(); updateInbox(); }, 'subtle');
}
function receiverTimeout(entry, duration = 30000) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (receivers.get(entry.offer.id) !== entry) return;
    try { send({type:'failed',id:entry.offer.id,reason:'La recepción expiró. Vuelve a enviar el archivo.'}); } catch { /* disconnected */ }
    dropReceiver(entry.offer.id, 'La recepción expiró. Puedes volver a enviar el archivo.');
  }, duration);
}
function receiveFile(entry) {
  if (receivers.get(entry.offer.id) !== entry || entry.receiver) return;
  entry.receiver = new FileReceiver(entry.offer); entry.actions.replaceChildren(); entry.state.textContent = 'Recibiendo… 0%';
  entry.card.querySelector('.item-meta span').textContent = 'ARCHIVO · RECIBIENDO';
  addButton(entry.actions, 'Cancelar', () => { send({type:'failed',id:entry.offer.id,reason:'El receptor canceló el archivo'}); dropReceiver(entry.offer.id); }, 'subtle danger');
  receiverTimeout(entry); send({type:'ack',key:`offer:${entry.offer.id}`});
}
function fileCard(offer) {
  const card = makeCard('ARCHIVO · SOLICITUD', fromLabel(false), offer.sentAt);
  const name = document.createElement('strong'); name.className = 'item-name'; name.textContent = safeName(offer.name);
  const state = document.createElement('div'); state.className = 'item-size'; state.textContent = `${fileKind(offer.name)} · ${sizeLabel(offer.size)} · Esperando tu permiso`;
  const actions = document.createElement('div'); actions.className = 'item-actions'; card.append(name, state, actions);
  const entry = {offer,card,state,actions,receiver:null,timer:null}; receivers.set(offer.id,entry); usedMemory += offer.size; controls();
  if ($('auto-receive').checked) { receiveFile(entry); return; }
  receiverTimeout(entry, 90000);
  addButton(actions, 'Recibir archivo', () => receiveFile(entry), 'primary');
  addButton(actions, 'Rechazar', () => { send({type:'failed',id:offer.id,reason:'El otro dispositivo rechazó el archivo'}); dropReceiver(offer.id); }, 'subtle');
}

async function handle(msg) {
  if (msg.type === 'room-closed') { reset(); toast('El otro dispositivo cerró la sala'); return; }
  if (msg.type === 'approved' && !host) { remoteName = deviceName(msg.device); remoteKind = deviceName(msg.kind); remoteType = deviceType(msg.deviceType, remoteKind); connected(); return; }
  if (!ready) return;
  if (msg.type === 'ack' && typeof msg.key === 'string' && msg.key.length < 100) { ack(msg.key); return; }
  if (msg.type === 'failed' && validId(msg.id)) {
    const reason = typeof msg.reason === 'string' ? msg.reason.slice(0, 180) : 'Se canceló el envío';
    for (const key of [...pending.keys()]) if (key.includes(msg.id)) ack(key, null, reason);
    dropReceiver(msg.id, reason); return;
  }
  if (msg.type === 'text') {
    if (!validId(msg.id) || typeof msg.text !== 'string' || !msg.text.trim() || new TextEncoder().encode(msg.text).byteLength > MAX_TEXT) throw new Error('El texto supera el límite de 512 KB o no es válido');
    textCard(msg.text, false, msg.sentAt); send({type:'ack',key:`text:${msg.id}`}); toast('Texto recibido'); return;
  }
  if (msg.type === 'file-offer') {
    if (!validOffer(msg, usedMemory) || receivers.size || busy) throw new Error('Archivo no admitido, bandeja llena o hay otro envío en curso');
    fileCard(msg); if (!$('auto-receive').checked) toast('Tienes un archivo por recibir'); return;
  }
  if (msg.type === 'file-chunk') {
    const entry = receivers.get(msg.id); if (!entry?.receiver) throw new Error('Archivo sin permiso de recepción');
    entry.receiver.append(msg); receiverTimeout(entry); entry.state.textContent = `Recibiendo… ${Math.floor(entry.receiver.size / entry.offer.size * 100)}%`;
    send({type:'ack',key:`chunk:${msg.id}:${msg.index}`}); return;
  }
  if (msg.type === 'file-end') {
    const entry = receivers.get(msg.id); if (!entry?.receiver) throw new Error('Archivo sin permiso de recepción');
    const blob = await entry.receiver.finish();
    if (receivers.get(msg.id) !== entry || !ready) return;
    clearTimeout(entry.timer); receivers.delete(msg.id); entry.actions.replaceChildren();
    entry.card.querySelector('.item-meta span').textContent = 'ARCHIVO · RECIBIDO'; entry.state.textContent = `${fileKind(entry.offer.name)} · ${sizeLabel(blob.size)} · Integridad verificada`;
    addButton(entry.actions, 'Descargar', () => download(blob, entry.offer.name), 'primary');
    addButton(entry.actions, 'Quitar', () => { usedMemory -= entry.offer.size; releaseCardPreview(entry.card); entry.card.remove(); updateInbox(); }, 'subtle');
    send({type:'ack',key:`end:${msg.id}`}); controls(); toast('Archivo recibido y verificado');
    receivedPhoto(blob,entry.card,entry.offer.name).catch(() => { /* Download remains available independently of preview support. */ });
  }
}
async function sendText() {
  const text = $('text-input').value;
  if (!ready || busy || !text.trim()) return;
  if (needsTextFile(text)) {
    const file = prepareTextFile(text); if (!file) return;
    $('text-input').value = ''; countText(); await sendFiles([file]); return;
  }
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT) { toast('El texto supera 512 KB. Envíalo como archivo.'); return; }
  if (usedMemory + new TextEncoder().encode(text).byteLength > MAX_MEMORY || $('inbox-items').children.length >= 30) { toast('Vacía la bandeja antes de enviar más.'); return; }
  busy = true; controls();
  try { const id = newCode(); await request({type:'text',id,text,sentAt:Date.now()}, `text:${id}`); textCard(text, true); if ($('text-input').value === text) { $('text-input').value = ''; countText(); } toast('Texto entregado'); }
  catch (e) { error(e.message); }
  finally { busy = false; controls(); }
}
async function sendFiles(files) {
  if (!ready || busy || receivers.size) { toast('Conecta la otra pantalla y termina el envío actual.'); return; }
  const list = Array.from(files); if (!list.length) return;
  busy = true; renderQueue(); controls();
  try {
    for (const file of list) {
      if (!ready) break;
      if (file.size > MAX_FILE) { toast(`${safeName(file.name)} supera 50 MB. Se omitió.`); continue; }
      const id = newCode(); outgoingId = id; $('transfer-progress').hidden = false; $('progress-name').textContent = safeName(file.name); $('progress-bar').value = 0; $('progress-label').textContent = 'Preparando archivo…';
      const hash = await digest(await file.arrayBuffer());
      if (outgoingId !== id || !ready) throw new Error('Envío cancelado');
      $('progress-label').textContent = 'Preparando la recepción en tu otra pantalla…';
      await request({type:'file-offer', id, name:safeName(file.name), size:file.size, hash, sentAt:Date.now()}, `offer:${id}`, 95000);
      let index = 0;
      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        const bytes = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        if (outgoingId !== id || !ready) throw new Error('Envío cancelado');
        await request({type:'file-chunk',id,index,bytes}, `chunk:${id}:${index}`); index++;
        const percent = Math.floor(Math.min(offset + CHUNK_SIZE, file.size) / file.size * 100);
        $('progress-bar').value = percent; $('progress-label').textContent = `${percent}% · ${sizeLabel(file.size)}`;
      }
      $('progress-label').textContent = 'Verificando integridad en la otra pantalla…';
      await request({type:'file-end',id}, `end:${id}`, 60000);
      const queueIndex = queuedFiles.indexOf(file); if (queueIndex !== -1) queuedFiles.splice(queueIndex,1);
      renderQueue(); controls();
      toast(`${safeName(file.name)} entregado`);
    }
  } catch (e) {
    if (outgoingId && ready) { try { send({type:'failed',id:outgoingId,reason:'El envío se canceló'}); } catch { /* disconnected */ } }
    error(e.message);
  } finally { outgoingId = null; busy = false; $('transfer-progress').hidden = true; $('file-input').value = ''; renderQueue(); controls(); }
}
async function sendAll() {
  if (!ready || busy) return;
  const text = $('text-input').value, hasText = Boolean(text.trim());
  if (!hasText && !queuedFiles.length) return;
  if (hasText) { await sendText(); if (!ready || busy || $('text-input').value === text) return; }
  if (queuedFiles.length) await sendFiles([...queuedFiles]);
}
function closeScanner() { stopScan?.(); stopScan = null; $('scan-panel').hidden = true; }
async function openScanner() {
  if (room || peer) { toast('Ya hay una sala abierta. Ciérrala para escanear otra.'); return; }
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
  if (!parseCode($('room-input').value) || room || peer) return;
  autoJoinTimer = setTimeout(() => { if (!room && !peer) joinRoom(); }, 300);
}
$('create-room').addEventListener('click', () => start(true, newRoomCode()));
$('join-room').addEventListener('click', joinRoom);
$('room-input').addEventListener('input', scheduleJoin);
$('device-name').addEventListener('input', renderDevices);
$('room-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('join-room').disabled) $('join-room').click(); });
$('copy-code').addEventListener('click', () => copy(formatCode(room)));
$('copy-link').addEventListener('click', () => copy(roomURL().href));
$('leave-room').addEventListener('click', () => { if (connection?.open) send({type:'room-closed'}); reset(); toast('Sala cerrada'); });
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
$('cancel-transfer').addEventListener('click', () => { const id = outgoingId; if (!id) return; outgoingId = null; try { send({type:'failed',id,reason:'El remitente canceló el envío'}); } catch { /* disconnected */ } for (const key of [...pending.keys()]) if (key.includes(id)) ack(key, null, 'Envío cancelado'); });
$('clear-inbox').addEventListener('click', () => {
  if (receivers.size) { toast('Termina o rechaza el archivo pendiente antes de vaciar.'); return; }
  if (!confirm('¿Vaciar la bandeja? Descarga primero lo que quieras conservar.')) return;
  $('inbox-items').replaceChildren(); usedMemory = 0; for (const url of urls) URL.revokeObjectURL(url); urls.clear(); cardUrls.clear(); updateInbox();
});
window.addEventListener('pagehide', reset);
const initial = parseCode(location.hash.slice(1)); if (initial) { $('room-input').value = formatCode(initial); history.replaceState(null, '', location.pathname + location.search); scheduleJoin(); }
window.addEventListener('online', networkInfo); window.addEventListener('offline', networkInfo);
navigator.connection?.addEventListener('change', networkInfo);
countText(); renderDevices(); networkInfo(); renderQueue();
