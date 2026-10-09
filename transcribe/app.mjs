import { stats, timestamp, toSrt } from './audio.mjs';
import { audioPlan, windowAt, estimatedRemaining, fileIdentity, SESSION_VERSION, validateCheckpoint } from './session.mjs?v=2.0.1';
import { openAudioSource, resampleWindow } from './media.mjs?v=2.0.1';
import { clearHandoffTemp, clearStaleHandoffs } from '../shared/handoff-transfer.mjs';
import { receiveAudioHandoff, outputToOriginal } from '../shared/audio-handoff.mjs';
import { readRecovery, saveRecovery, deleteRecovery } from './storage.mjs';
const $ = id => document.getElementById(id);
let mode = 'audio', file = null, objectUrl = null, busy = false, asrWorker = null, ocrWorker = null;
let segments = [], duration = 0, recorder = null, stream = null, recordingTimer = null, recordingStarted = 0;
let operation = 0, loading = false, currentLoad = 0;
let checkpoint=null, savedRecord=null, source=null, controller=null, pendingWorker=null, pauseRequested=false, wakeLock=null, wakeAllowed=false, consentPending=false;
let runWarnings=[],authorizedDuration=null;
let audioLabMetadata=null;

function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function progress(label, percent) {
  $('progress-box').hidden = false; $('progress-label').textContent = label;
  if (Number.isFinite(percent)) { $('progress').value = percent; $('progress-number').textContent = `${Math.round(percent)}%`; }
  else { $('progress').removeAttribute('value'); $('progress-number').textContent = ''; }
}
function updateButtons() {
  $('run').disabled = !file || busy || loading || consentPending || Boolean(recorder);
  for (const id of ['tab-audio', 'tab-image', 'remove-file', 'record', 'url-toggle', 'model', 'device', 'audio-language', 'channel', 'enhance', 'highpass', 'ocr-language', 'ocr-layout', 'ocr-enhance', 'dropzone', 'audio-url']) $(id).disabled = busy || loading || consentPending;
  $('url-form').querySelector('button').disabled = busy || loading || consentPending;
  $('cancel').hidden = !busy; $('pause').hidden = !busy || mode!=='audio'; $('pause').disabled=pauseRequested; $('resume').textContent=checkpoint?`Continuar · Whisper ${checkpoint.options.model} · ${checkpoint.options.device==='webgpu'?'GPU':'CPU'} →`:'Continuar desde el último fragmento →'; $('resume').hidden=busy || !checkpoint || checkpoint.next>=audioPlan(checkpoint.duration,checkpoint.options.model).count; $('result').readOnly=busy; $('recover').disabled=busy||loading||consentPending; $('forget').disabled=busy||loading||consentPending; $('run').textContent = busy ? 'Procesando…' : mode === 'audio' ? 'Transcribir audio →' : 'Extraer texto →';
}
function updateResult() {
  const value = $('result').value.trim();
  $('word-count').textContent = `${value ? value.split(/\s+/u).length : 0} palabras`;
  $('copy').disabled = !value; $('download').disabled = !value;
  $('result-dot').classList.toggle('ready', Boolean(value));
}
function clearResult() {
  $('result').value = ''; $('result').hidden = true; $('empty-result').hidden = false;
  segments = []; checkpoint=null; $('resume').hidden=true; $('session-metrics').hidden=true; $('segments').replaceChildren(); $('segments-box').hidden = true; $('srt').hidden = true;
  updateResult();
}
function showResult(text) {
  $('result').value = text; $('result').hidden = false; $('empty-result').hidden = true; updateResult();
}
function clearFile() {
  clearHandoffTemp(audioLabMetadata?.tempName);audioLabMetadata=null; $('audio-lab-note')?.remove();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null; file = null; duration = 0; $('file-input').value = '';
  $('audio-preview').pause(); $('audio-preview').removeAttribute('src'); $('audio-preview').load();
  $('image-preview').removeAttribute('src');
  for (const id of ['file-card', 'audio-preview', 'image-preview', 'waveform', 'progress-box']) $(id).hidden = true;
  updateButtons();
}
function setMode(next, preserve = false) {
  if (busy || loading || consentPending || recorder) return;
  if (!preserve && next !== mode) { clearFile(); clearResult(); status('Listo cuando tú lo estés.'); }
  mode = next;
  for (const type of ['audio', 'image']) {
    $(`tab-${type}`).classList.toggle('active', type === mode); $(`tab-${type}`).setAttribute('aria-selected', String(type === mode));
    $(`tab-${type}`).tabIndex = type === mode ? 0 : -1;
    $(`${type}-controls`).hidden = type !== mode;
  }
  $('drop-title').textContent = mode === 'audio' ? 'Suelta tu audio aquí' : 'Suelta tu imagen aquí';
  $('formats').textContent = mode === 'audio' ? 'M4A · MP3 · WAV · OGG · FLAC · VIDEO' : 'PNG · JPG · WEBP · BMP · CAPTURAS';
  $('file-input').accept = mode === 'audio' ? 'audio/*,video/*,.m4a,.mp3,.wav,.ogg,.opus,.flac,.aac,.aiff,.webm,.mp4' : 'image/*';
  updateButtons();
}
function acceptFile(candidate) {
  if (busy || loading || consentPending || recorder || !candidate) return;
  const isImage = candidate.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?|avif|heic|heif)$/i.test(candidate.name);
  const isAudio = /^(audio|video)\//.test(candidate.type) || /\.(m4a|mp3|wav|ogg|opus|flac|aac|aiff?|webm|mp4|mov)$/i.test(candidate.name);
  if (!isImage && !isAudio) return status('Elige un archivo de audio, video o imagen. PDF y archivos de texto no son fuentes admitidas.', true);
  if (candidate.size > (isImage ? 300 : 2048) * 1024 * 1024) return status(isImage ? 'La imagen supera 300 MB.' : 'El audio o video supera 2 GB. Divide o extrae su pista de audio.', true);
  if (!candidate.size) return status('El archivo está vacío.', true);
  clearFile(); clearResult(); setMode(isImage ? 'image' : 'audio', true); file = candidate;
  objectUrl = URL.createObjectURL(file); $('file-card').hidden = false;
  $('file-name').textContent = file.name; $('file-meta').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · ${isImage ? 'Imagen' : 'Audio / video'}`;
  $('file-type').textContent = isImage ? '▧' : '◉';
  const preview = $(isImage ? 'image-preview' : 'audio-preview'); preview.src = objectUrl; preview.hidden = false;
  status('Archivo listo. Puedes comenzar.'); updatePlan(); updateButtons();
}
$('tab-audio').onclick = () => setMode('audio'); $('tab-image').onclick = () => setMode('image');
for (const type of ['audio','image']) $(`tab-${type}`).addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); const next = type === 'audio' ? 'image' : 'audio'; setMode(next); $(`tab-${next}`).focus(); }
});
$('dropzone').onclick = () => $('file-input').click(); $('file-input').onchange = e => acceptFile(e.target.files[0]);
$('remove-file').onclick = () => { clearFile(); clearResult(); status('Listo cuando tú lo estés.'); };
for (const event of ['dragenter', 'dragover']) $('dropzone').addEventListener(event, e => { e.preventDefault(); if (!busy && !loading) $('dropzone').classList.add('dragover'); });
for (const event of ['dragleave', 'drop']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.remove('dragover'); if (event === 'drop') acceptFile(e.dataTransfer.files[0]); });
window.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => { e.preventDefault(); if (!e.target.closest('#dropzone')) acceptFile(e.dataTransfer.files[0]); });
document.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); acceptFile(files[0]); }
});
$('url-toggle').onclick = () => { $('url-form').hidden = !$('url-form').hidden; if (!$('url-form').hidden) $('audio-url').focus(); };
$('url-form').onsubmit = async e => {
  e.preventDefault(); if (busy || loading || consentPending || recorder) return;
  const raw = $('audio-url').value.trim();
  try {
    const url = new URL(raw); if (url.protocol !== 'https:') throw new Error('Usa un enlace HTTPS directo al archivo.');
    const ticket = ++currentLoad; loading = true; updateButtons(); status('Cargando archivo del enlace…');
    const response = await fetch(url, { signal: AbortSignal.timeout(120000), credentials: 'omit' });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
    const size = Number(response.headers.get('content-length'));
    if (size > 300 * 1024 * 1024) throw new Error('Desde URL el límite es 300 MB. Descarga el archivo y selecciónalo localmente para audio más grande.');
    const reader=response.body?.getReader();let blob;
    if(reader) {
      const parts=[];let received=0;
      try {while(true) {const {done,value}=await reader.read();if(done) break;received+=value.byteLength;if(received>300*1024*1024) throw new Error('Desde URL el límite es 300 MB. Descarga y selecciona el archivo localmente.');parts.push(value);}}
      catch(error) {await reader.cancel().catch(()=>{});throw error;} finally {reader.releaseLock();}
      blob=new Blob(parts,{type:response.headers.get('content-type')||''});
    } else blob=await response.blob();
    if(blob.size>300*1024*1024) throw new Error('Desde URL el límite es 300 MB.');
    if (ticket !== currentLoad) return;
    loading = false;
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'audio.mp3');
    acceptFile(new File([blob], name, { type: blob.type }));
  } catch (error) { status(`No se pudo cargar el enlace: ${error.message} El servidor debe permitir CORS. Puedes descargar el archivo y subirlo aquí.`, true); }
  finally { loading = false; updateButtons(); }
};
function releaseRecording() {
  stream?.getTracks().forEach(track => track.stop()); stream = null; recorder = null;
  clearInterval(recordingTimer); recordingTimer = null; $('record').textContent = '● Grabar micrófono'; updateButtons();
}
$('record').onclick = async () => {
  if (recorder) { recorder.stop(); return; }
  if (busy || loading || consentPending) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return status('Este navegador no permite grabar. Usa Chrome, Edge o Safari actualizado y una conexión HTTPS.', true);
  loading = true; updateButtons();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { releaseRecording(); status('La grabación falló. Comprueba el micrófono y vuelve a intentar.', true); };
    recorder.onstop = () => {
      const type = recorder?.mimeType || mimeType || 'audio/webm'; const blob = new Blob(chunks, { type });
      releaseRecording(); acceptFile(new File([blob], `grabacion-${new Date().toISOString().replace(/[:.]/g,'-')}.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
    };
    recorder.start(1000); recordingStarted = Date.now(); loading = false;
    $('record').textContent = '■ Detener grabación'; updateButtons();
    status('Grabando. Pulsa Detener cuando termines.');
    recordingTimer = setInterval(() => status(`Grabando ${timestamp((Date.now() - recordingStarted) / 1000).slice(0,8)} · Pulsa Detener.`), 1000);
  } catch (error) { releaseRecording(); status(`No se pudo abrir el micrófono: ${error.message}`, true); }
  finally { loading = false; updateButtons(); }
};

function drawWaveform(samples) {
  const canvas = $('waveform'), context = canvas.getContext('2d'); canvas.hidden = false;
  const step = Math.max(1, Math.floor(samples.length / canvas.width)); const peak = stats(samples).peak || 1;
  context.clearRect(0,0,canvas.width,canvas.height); context.strokeStyle = '#ccf583'; context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 2) {
    let magnitude = 0; for (let i = x * step; i < Math.min((x + 2) * step,samples.length); i++) magnitude = Math.max(magnitude,Math.abs(samples[i]));
    const height = Math.max(1, magnitude / peak * 44); context.beginPath(); context.moveTo(x,50-height); context.lineTo(x,50+height); context.stroke();
  }
}
function updatePlan() {
  const seconds=$('audio-preview').duration;
  if(mode!=='audio'||!Number.isFinite(seconds)||seconds<=0) return;
  try {
    const plan=audioPlan(seconds,$('model').value);
    $('audio-plan').textContent=`${timestamp(seconds).slice(0,8)} · ${plan.count} fragmento${plan.count===1?'':'s'} · Whisper ${plan.model}. ${seconds>60?'Para una junta importante elige mayor precisión si tu equipo tiene memoria suficiente.':'Una sola pasada para clips de hasta 30 segundos.'}`;
  } catch(error) { $('audio-plan').textContent=error.message; }
}
$('audio-preview').addEventListener('loadedmetadata',updatePlan);
$('model').addEventListener('change',updatePlan);
function optionsFromControls() { return {model:$('model').value,device:$('device').value,language:$('audio-language').value,channel:$('channel').value,enhance:$('enhance').checked,highpass:$('highpass').checked}; }
async function requestConsent({resume=false,ocr=false,compatibility=false,mp3=false,durationOverride}={}) {
  const selected=resume?checkpoint.options:optionsFromControls();
  const seconds=durationOverride??(resume?checkpoint.duration:$('audio-preview').duration);
  const known=Number.isFinite(seconds)&&seconds>0;
  const plan=!ocr&&known?audioPlan(seconds,selected.model):null;
  $('consent-plan').textContent=mp3?'El navegador no decodifica esta pista MP3. Puedes autorizar un lector WASM adicional para leerla por partes, sin cargar toda la grabación en memoria.':compatibility?'Esta pista necesita lectura completa en memoria. Solo se permite hasta 3 minutos y 50 MB. No cambia tu archivo.':ocr?'Se descargará el lector OCR y los idiomas seleccionados para extraer texto localmente.':`${resume?'Continuar':'Procesar'} ${known?timestamp(seconds).slice(0,8):'audio de duración por confirmar'} · ${plan?plan.count+' fragmentos · Whisper '+plan.model:selected.model==='auto'?'automático: tiny hasta 1 minuto; base para audio más largo':'Whisper '+selected.model}. CPU y tiempo crecen con la duración.`;
  const model=plan?.model||selected.model;
  const size=selected.device==='webgpu'?({tiny:'120',base:'210',small:'600'}[model]||'120–210'):({tiny:'45',base:'80',small:'250'}[model]||'45–80');
  $('consent-resources').textContent=mp3?'Se cargará mpg123-decoder desde esta misma página. Funciona localmente, también para MP3 largos. No se cambia el modelo ni se sube el audio.':ocr?'Tesseract y datos de idiomas requieren una descarga inicial y memoria.':compatibility?'Autoriza una decodificación completa de este clip corto.':`${selected.device==='webgpu'?'GPU experimental':'CPU compatible'} · descarga de modelo aproximada: ${size} MB más librerías (Mediabunny, Hash WASM y Transformers.js). Puede estar en caché. La memoria de ejecución es mayor que la descarga. Una hora puede tardar bastante; se mostrará una estimación después del primer fragmento.`;
  $('save-choice').hidden=ocr||compatibility||mp3; $('wake-choice').hidden=ocr||compatibility||mp3;
  $('consent-replace').hidden=resume||!$('result').value.trim()||compatibility||mp3;
  const dialog=$('consent'); consentPending=true; updateButtons();
  try {
    let approved;
    if(typeof dialog.showModal!=='function') approved=window.confirm([$('consent-plan').textContent,$('consent-resources').textContent,$('consent-privacy').textContent].join('\n\n'));
    else approved=await new Promise(resolve=>{
      const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='approve');};
      dialog.addEventListener('close',close);dialog.returnValue='cancel';dialog.showModal();
    });
    if(approved&&!ocr&&!compatibility&&!mp3) authorizedDuration=known?seconds:null;
    return approved;
  } finally { consentPending=false;updateButtons(); }
}
function workerRequest(message,id,transfer=[]) {
  return new Promise((resolve,reject)=>{
    if(!asrWorker) asrWorker=new Worker(new URL('./asr-worker.mjs?v=2.0.1',import.meta.url),{type:'module'});
    pendingWorker={reject};
    asrWorker.onmessage=({data})=>{
      if(id!==operation) return;
      if(data.type==='progress') progress(data.label,data.percent);
      else if(data.type==='error') {pendingWorker=null;reject(new Error(data.message));}
      else if(data.type==='ready'||data.type==='partial') {pendingWorker=null;resolve(data);}
    };
    asrWorker.onerror=event=>{pendingWorker=null;reject(new Error(event.message||'El motor no pudo iniciar. Revisa la conexión o cambia a CPU.'));};
    asrWorker.postMessage(message,transfer);
  });
}
function stopWorker() {pendingWorker?.reject(new DOMException('Cancelado','AbortError'));pendingWorker=null;asrWorker?.terminate();asrWorker=null;}
async function acquireWake() {
  if(!wakeAllowed||!busy||document.visibilityState==='hidden'||!navigator.wakeLock?.request) return;
  try {const ticket=operation,lock=await navigator.wakeLock.request('screen');if(!busy||ticket!==operation) await lock.release();else {wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock) wakeLock=null;});}}
  catch { runWarnings.push('No se pudo mantener la pantalla activa.'); }
}
async function releaseWake() {const lock=wakeLock;wakeLock=null;await lock?.release().catch(()=>{});}
async function transcribe(id,resume) {
  controller=new AbortController();const signal=controller.signal;const selectedFile=file;
  const selected=resume?checkpoint.options:optionsFromControls();
  if(selected.device==='webgpu') {
    const adapter=await navigator.gpu?.requestAdapter();
    if(id!==operation) return;
    if(!adapter) throw new Error('La GPU no está disponible. Selecciona CPU y autoriza ese proceso; no se cambia de motor sin tu permiso.');
  }
  progress('Abriendo la pista con lectura por partes…');
  let opened;
  try { opened=await openAudioSource(selectedFile,{signal,previewDuration:$('audio-preview').duration}); }
  catch(error) {
    if((!error.compatibility&&!error.mp3)||id!==operation) throw error;
    if(!await requestConsent({compatibility:Boolean(error.compatibility),mp3:Boolean(error.mp3)})) throw new Error('Lector adicional no autorizado.');
    if(id!==operation) return;
    opened=await openAudioSource(selectedFile,{signal,allowCompatibility:Boolean(error.compatibility),allowMp3:Boolean(error.mp3),previewDuration:$('audio-preview').duration});
  }
  if(id!==operation) {opened.dispose();return;}
  source=opened;duration=source.duration;
  const plan=audioPlan(duration,selected.model);
  if(!resume&&(authorizedDuration===null||Math.abs(authorizedDuration-duration)>2||audioPlan(authorizedDuration,selected.model).count!==plan.count)) {
    if(!await requestConsent({durationOverride:duration})) throw new Error('El plan real de procesamiento no fue autorizado.');
    if(id!==operation) return;
  }
  progress('Verificando el archivo completo para una recuperación segura…');
  const identity=await fileIdentity(selectedFile,{signal});
  if(id!==operation) return;
  if(resume) {
    if(!validateCheckpoint(checkpoint)||checkpoint.identity!==identity||Math.abs(checkpoint.duration-duration)>.02) throw new Error('La recuperación no corresponde a este audio. Selecciona el archivo original.');
  } else {
    checkpoint={version:SESSION_VERSION,identity,name:file.name,duration,options:{...selected,model:plan.model},next:0,history:[],segments:[],text:'',savedAt:Date.now()};
    showResult('');segments=[];renderSegments();
  }
  const options=checkpoint.options;
  $('file-meta').textContent=`${(file.size/1024/1024).toFixed(2)} MB · ${timestamp(duration).slice(0,8)} · ${source.channels} canal(es) · ${source.method}`;
  const sessionStart=checkpoint.next,started=performance.now(),baseline=sessionStart?windowAt(plan,sessionStart-1).completed:0;
  await acquireWake();
  if(id!==operation) return;
  await workerRequest({type:'init',options,history:checkpoint.history},id);
  if(id!==operation) return;
  let workStarted=performance.now();
  for(let index=checkpoint.next;index<plan.count;index++) {
    const window=windowAt(plan,index);
    progress(`Leyendo fragmento ${index+1}/${plan.count} · ${timestamp(window.start).slice(0,8)}…`,window.start/duration*100);
    const audio=await source.read(window.start,window.end,options.channel);
    if(id!==operation) return;
    const samples=await resampleWindow(audio);
    if(id!==operation) return;
    drawWaveform(samples);
    progress(`Transcribiendo ${index+1}/${plan.count} · ${timestamp(window.start).slice(0,8)}–${timestamp(window.end).slice(0,8)}…`,Math.min(99,window.start/duration*100));
    const result=await workerRequest({type:'window',samples,window},id,[samples.buffer]);
    if(id!==operation) return;
    showResult(result.text);segments=result.chunks;renderSegments();
    checkpoint={...checkpoint,next:index+1,history:result.history,text:result.text,segments:result.chunks,savedAt:Date.now()};
    const eta=estimatedRemaining((performance.now()-workStarted)/1000,window.completed-baseline,duration-baseline);
    $('session-metrics').hidden=false;
    $('session-metrics').textContent=`${index+1}/${plan.count} fragmentos · ${timestamp(window.completed).slice(0,8)} de ${timestamp(duration).slice(0,8)} · ${((performance.now()-started)/60000).toFixed(1)} min de proceso${eta>0?' · restante estimado '+Math.ceil(eta/60)+' min':''}${result.low&&!result.silent?' · voz muy baja: revisa el texto':''}`;
    if($('save-recovery').checked) {
      try {const completedRecord=checkpoint;await saveRecovery(completedRecord);if(id!==operation) return;savedRecord=completedRecord;renderRecovery();}
      catch {runWarnings.push('No se pudo guardar la recuperación; descarga el texto antes de cerrar.');$('save-recovery').checked=false;}
    }
    if(id!==operation) return;
    progress(`Fragmento ${index+1}/${plan.count} terminado`,window.completed/duration*100);
    if(pauseRequested&&checkpoint.next<plan.count) {status('Pausado. El texto terminado está disponible; puedes continuar o descargarlo.');return;}
  }
  status(`${checkpoint.text?'Transcripción terminada. Revisa nombres, números y los cortes.':'Audio analizado; no se reconoció voz.'} ${[...new Set(runWarnings)].join(' ')}`);
  checkpoint=null;
}
function renderRecovery() {
  $('recovery-box').hidden=!savedRecord;
  if(savedRecord) $('recovery-info').textContent=`Recuperación local: ${savedRecord.name||'audio'} · ${savedRecord.next} fragmentos terminados. Para continuar selecciona el mismo audio y recupera el texto.`;
}
readRecovery().then(record=>{savedRecord=record;renderRecovery();}).catch(()=>{});
$('recover').onclick=async()=>{
  if(busy||loading||consentPending||!savedRecord) return;
  loading=true;updateButtons();const record=savedRecord,selectedFile=file;
  try {
    const match=Boolean(selectedFile&&mode==='audio'&&selectedFile.size===Number(record.identity.split(':')[0]));
    showResult(record.text);segments=record.segments;duration=record.duration;renderSegments();
    checkpoint=match?structuredClone(record):null;
    if(checkpoint) {
      for(const [id,value] of [['model',checkpoint.options.model],['device',checkpoint.options.device],['audio-language',checkpoint.options.language],['channel',checkpoint.options.channel]]) $(id).value=value;
      $('enhance').checked=checkpoint.options.enhance;$('highpass').checked=checkpoint.options.highpass;
    }
    $('save-recovery').checked=true;
    status(match?'Texto recuperado. Al continuar se verificará el audio completo antes de reanudar.':'Texto recuperado. Para continuar, selecciona el mismo audio y pulsa Recuperar texto otra vez.');
  } catch(error) {status(error.message,true);} finally {loading=false;updateButtons();}
};
$('forget').onclick=async()=>{try {await deleteRecovery();savedRecord=null;renderRecovery();status('Recuperación local borrada. El texto visible sigue disponible.');}catch(error){status(error.message,true);}};
$('pause').onclick=()=>{pauseRequested=true;updateButtons();status('Se pausará al terminar el fragmento actual. Detener lo interrumpe inmediatamente.');};
function renderSegments() {
  $('segments').replaceChildren(); $('segments-box').hidden = !segments.length; $('srt').hidden = !segments.length;
  for (const segment of segments) {
    const row = document.createElement('div'); row.className = 'segment';
    const button = document.createElement('button'); button.textContent = timestamp(segment.timestamp[0]).slice(0,8);
    if(audioLabMetadata)button.title = 'Original '+timestamp(outputToOriginal(segment.timestamp[0]||0,audioLabMetadata.timeMap)).slice(0,8);
    else button.title = 'Escuchar este fragmento'; button.onclick = () => { $('audio-preview').currentTime = segment.timestamp[0] || 0; $('audio-preview').play().catch(() => status('Pulsa reproducir en el audio para escuchar.')); };
    const text = document.createElement('span'); text.textContent = segment.text; row.append(button,text); $('segments').append(row);
  }
}

async function prepareImage(sourceFile) {
  const image = new Image(); const url = URL.createObjectURL(sourceFile);
  try { image.src = url; await image.decode(); }
  catch { throw new Error('No se pudo abrir la imagen. Para HEIC, TIFF u otros formatos no compatibles, guarda una copia en PNG o JPG.'); }
  finally { URL.revokeObjectURL(url); }
  // Preserve long screenshots instead of shrinking their text to a 2600px height.
  const wanted = $('ocr-enhance').checked && image.naturalWidth < 1400 ? 2 : 1;
  const scale = Math.min(wanted, 8000 / Math.max(image.naturalWidth,image.naturalHeight), Math.sqrt(20000000 / (image.naturalWidth * image.naturalHeight)));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true }); context.fillStyle = 'white'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
  if ($('ocr-enhance').checked) {
    const pixels = context.getImageData(0,0,canvas.width,canvas.height); const histogram = new Uint32Array(256);
    for (let i=0;i<pixels.data.length;i+=4) histogram[Math.round(.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2])]++;
    const total = canvas.width*canvas.height; let lower=0,upper=255,count=0;
    while(lower<255 && count<total*.01) count+=histogram[lower++]; count=0;
    while(upper>lower && count<total*.01) count+=histogram[upper--];
    const invert = histogram.slice(0,100).reduce((a,b)=>a+b,0) > total*.6;
    for(let i=0;i<pixels.data.length;i+=4) {
      let gray=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];
      if(upper-lower>20) gray=Math.max(0,Math.min(255,(gray-lower)*255/(upper-lower)));
      if(invert) gray=255-gray;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;
    }
    context.putImageData(pixels,0,0);
  }
  return canvas;
}
async function extractText(id) {
  progress('Preparando la imagen…'); const image = await prepareImage(file); if(id!==operation) return;
  const { default: Tesseract } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js'); if(id!==operation) return;
  const { createWorker } = Tesseract;
  const worker = await createWorker($('ocr-language').value, 1, { logger: message => { if(id===operation) progress(message.status === 'recognizing text' ? 'Leyendo las palabras…' : 'Cargando lector de imágenes…', message.progress * 100); } });
  if(id!==operation) { await worker.terminate(); return; }
  ocrWorker = worker;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: $('ocr-layout').value, preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(image); if(id!==operation) return;
    showResult(data.text.trim()); status(data.text.trim() ? `Texto extraído. Confianza orientativa: ${Math.round(data.confidence)}%. Revisa el resultado.` : 'No se encontró texto legible. Prueba otra distribución o desactiva la mejora de imagen.');
  } finally { if(ocrWorker===worker) { ocrWorker = null; await worker.terminate(); } }
}
async function startProcessing(resume=false) {
  if(!file||busy||loading||recorder||consentPending||resume&&!checkpoint) return;
  try {if(!await requestConsent({resume,ocr:mode==='image'})) return;} catch(error) {status(error.message,true);return;}
  busy=true;const id=++operation;pauseRequested=false;runWarnings=[];wakeAllowed=$('keep-awake').checked;
  updateButtons();status('Procesando en tu navegador…');
  if(mode==='image') clearResult();
  try {if(mode==='audio') await transcribe(id,resume);else await extractText(id);}
  catch(error) {if(id===operation) status(`${error.message}${checkpoint?.next?' El texto parcial se puede descargar o continuar.':''}`,true);}
  finally {
    if(id===operation) {source?.dispose();source=null;controller=null;stopWorker();await releaseWake();if(id!==operation) return;busy=false;$('progress-box').hidden=true;updateButtons();}
  }
}
$('run').onclick=()=>startProcessing(false);$('resume').onclick=()=>startProcessing(true);
$('cancel').onclick=()=>{
  operation++;controller?.abort();source?.dispose();source=null;stopWorker();
  const old=ocrWorker;ocrWorker=null;if(old) old.terminate().catch(()=>{});
  releaseWake();busy=false;$('progress-box').hidden=true;updateButtons();status('Detenido. Conservas el texto y el último fragmento terminado. Puedes continuar o descargarlo.');
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&busy&&!wakeLock) acquireWake();});
$('result').oninput = () => { checkpoint=null; updateButtons(); updateResult(); $('srt').hidden = true; $('segments-box').hidden = true; };
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('result').value); status('Texto copiado.'); }
  catch { $('result').focus(); $('result').select(); status('El navegador bloqueó el portapapeles. El texto quedó seleccionado: usa Ctrl+C o Copiar.'); }
};
function download(content, extension) {
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'})); const anchor=document.createElement('a');
  anchor.href=url; anchor.download=`${(file?.name || 'texto').replace(/\.[^.]+$/,'')}.${extension}`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download').onclick=()=>download($('result').value,'txt'); $('srt').onclick=()=>download(toSrt(segments,duration),'srt');
window.addEventListener('beforeunload', e => { if(busy || recorder) { e.preventDefault(); e.returnValue=''; } });
setMode('audio');

// Only receives a same-origin, nonce-bound File after Audio Lab's explicit handoff consent.
clearStaleHandoffs();window.addEventListener('pagehide',()=>clearHandoffTemp(audioLabMetadata?.tempName));
receiveAudioHandoff({
  onStart(){if(busy||loading||consentPending||recorder)return false;loading=true;updateButtons();status('Recibiendo WAV local de Audio Lab…');return true;},
  onProgress(percent){status('Recibiendo audio local · '+Math.round(percent)+'%. No se sube a servidores.');},
  onFinish(){loading=false;updateButtons();},
  accept(candidate){if(busy||loading||consentPending||recorder)return false;acceptFile(candidate);return file===candidate;},
  onMetadata(metadata){audioLabMetadata=metadata;const note=document.createElement('p');note.id='audio-lab-note';note.className='plan-note';note.textContent='Recibido de Audio Lab · WAV limpio. Las marcas y SRT usan el tiempo procesado; pasa sobre una marca para ver el tiempo original. ';const button=document.createElement('button');button.className='secondary';button.textContent='Descargar mapa original';button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,originalDuration:metadata.originalDuration,timeMap:metadata.timeMap},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='audio-lab-time-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};note.append(button);$('file-card').after(note);$('enhance').checked=false;$('highpass').checked=false;status('Audio limpio recibido. Elige modelo e idioma y autoriza Transcribe para empezar.');},
  onError(error){status(error.message,true);}
});
