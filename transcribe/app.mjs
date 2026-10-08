import { mixChannels, SAMPLE_RATE, stats, timestamp, toSrt } from './audio.mjs';
const $ = id => document.getElementById(id);
let mode = 'audio', file = null, objectUrl = null, busy = false, asrWorker = null, ocrWorker = null;
let segments = [], duration = 0, recorder = null, stream = null, recordingTimer = null, recordingStarted = 0;
let operation = 0, loading = false, currentLoad = 0;

function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function progress(label, percent) {
  $('progress-box').hidden = false; $('progress-label').textContent = label;
  if (Number.isFinite(percent)) { $('progress').value = percent; $('progress-number').textContent = `${Math.round(percent)}%`; }
  else { $('progress').removeAttribute('value'); $('progress-number').textContent = ''; }
}
function updateButtons() {
  $('run').disabled = !file || busy || loading || Boolean(recorder);
  for (const id of ['tab-audio', 'tab-image', 'remove-file', 'record', 'url-toggle', 'model', 'audio-language', 'channel', 'enhance', 'highpass', 'ocr-language', 'ocr-layout', 'ocr-enhance', 'dropzone', 'audio-url']) $(id).disabled = busy || loading;
  $('url-form').querySelector('button').disabled = busy || loading;
  $('cancel').hidden = !busy; $('run').textContent = busy ? 'Procesando…' : mode === 'audio' ? 'Transcribir audio →' : 'Extraer texto →';
}
function updateResult() {
  const value = $('result').value.trim();
  $('word-count').textContent = `${value ? value.split(/\s+/u).length : 0} palabras`;
  $('copy').disabled = !value; $('download').disabled = !value;
  $('result-dot').classList.toggle('ready', Boolean(value));
}
function clearResult() {
  $('result').value = ''; $('result').hidden = true; $('empty-result').hidden = false;
  segments = []; $('segments').replaceChildren(); $('segments-box').hidden = true; $('srt').hidden = true;
  updateResult();
}
function showResult(text) {
  $('result').value = text; $('result').hidden = false; $('empty-result').hidden = true; updateResult();
}
function clearFile() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null; file = null; duration = 0; $('file-input').value = '';
  $('audio-preview').pause(); $('audio-preview').removeAttribute('src'); $('audio-preview').load();
  $('image-preview').removeAttribute('src');
  for (const id of ['file-card', 'audio-preview', 'image-preview', 'waveform', 'progress-box']) $(id).hidden = true;
  updateButtons();
}
function setMode(next, preserve = false) {
  if (busy || loading || recorder) return;
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
  if (busy || loading || recorder || !candidate) return;
  const isImage = candidate.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?|avif|heic|heif)$/i.test(candidate.name);
  const isAudio = /^(audio|video)\//.test(candidate.type) || /\.(m4a|mp3|wav|ogg|opus|flac|aac|aiff?|webm|mp4|mov)$/i.test(candidate.name);
  if (!isImage && !isAudio) return status('Elige un archivo de audio, video o imagen. PDF y archivos de texto no son fuentes admitidas.', true);
  if (candidate.size > 300 * 1024 * 1024) return status('El archivo supera 300 MB. Divide la grabación para evitar agotar la memoria del navegador.', true);
  if (!candidate.size) return status('El archivo está vacío.', true);
  clearFile(); clearResult(); setMode(isImage ? 'image' : 'audio', true); file = candidate;
  objectUrl = URL.createObjectURL(file); $('file-card').hidden = false;
  $('file-name').textContent = file.name; $('file-meta').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · ${isImage ? 'Imagen' : 'Audio / video'}`;
  $('file-type').textContent = isImage ? '▧' : '◉';
  const preview = $(isImage ? 'image-preview' : 'audio-preview'); preview.src = objectUrl; preview.hidden = false;
  status('Archivo listo. Puedes comenzar.'); updateButtons();
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
  e.preventDefault(); if (busy || loading || recorder) return;
  const raw = $('audio-url').value.trim();
  try {
    const url = new URL(raw); if (url.protocol !== 'https:') throw new Error('Usa un enlace HTTPS directo al archivo.');
    const ticket = ++currentLoad; loading = true; updateButtons(); status('Cargando archivo del enlace…');
    const response = await fetch(url, { signal: AbortSignal.timeout(120000), credentials: 'omit' });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
    const size = Number(response.headers.get('content-length'));
    if (size > 300 * 1024 * 1024) throw new Error('El archivo supera 300 MB.');
    const blob = await response.blob(); if (ticket !== currentLoad) return;
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
  if (busy || loading) return;
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

async function decodeAudio(sourceFile) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('El navegador no admite decodificación de audio.');
  const context = new AudioContextClass();
  let buffer;
  try { buffer = await context.decodeAudioData(await sourceFile.arrayBuffer()); }
  catch { throw new Error('No se pudo leer este formato o códec. Prueba convertir el archivo a WAV o MP3, o abrirlo en Chrome / Edge actualizado.'); }
  finally { await context.close(); }
  duration = buffer.duration;
  // Bound allocations before creating a second copy and the inference tensor.
  if (duration > 3600) throw new Error('La grabación supera una hora. Divídela en partes para procesarla sin agotar la memoria.');
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const mono = mixChannels(channels, $('channel').value);
  const offline = new OfflineAudioContext(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const monoBuffer = offline.createBuffer(1, mono.length, buffer.sampleRate); monoBuffer.copyToChannel(mono, 0);
  const source = offline.createBufferSource(); source.buffer = monoBuffer; source.connect(offline.destination); source.start();
  const rendered = await offline.startRendering(); const samples = rendered.getChannelData(0).slice();
  $('file-meta').textContent = `${(sourceFile.size / 1024 / 1024).toFixed(2)} MB · ${timestamp(duration).slice(0,8)} · ${buffer.numberOfChannels} canal(es)`;
  drawWaveform(samples); return samples;
}
function drawWaveform(samples) {
  const canvas = $('waveform'), context = canvas.getContext('2d'); canvas.hidden = false;
  const step = Math.max(1, Math.floor(samples.length / canvas.width)); const peak = stats(samples).peak || 1;
  context.clearRect(0,0,canvas.width,canvas.height); context.strokeStyle = '#ccf583'; context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 2) {
    let magnitude = 0; for (let i = x * step; i < Math.min((x + 2) * step,samples.length); i++) magnitude = Math.max(magnitude,Math.abs(samples[i]));
    const height = Math.max(1, magnitude / peak * 44); context.beginPath(); context.moveTo(x,50-height); context.lineTo(x,50+height); context.stroke();
  }
}
async function transcribe(id) {
  progress('Leyendo y preparando el audio…');
  const samples = await decodeAudio(file); if (id !== operation) return;
  if (!asrWorker) asrWorker = new Worker(new URL('./asr-worker.mjs', import.meta.url), { type: 'module' });
  await new Promise((resolve, reject) => {
    asrWorker.onmessage = ({ data }) => {
      if (id !== operation) return;
      if (data.type === 'progress') progress(data.label, data.percent);
      else if (data.type === 'error') reject(new Error(data.message));
      else if (data.type === 'done') {
        showResult(data.text?.trim() || ''); segments = data.chunks || []; renderSegments();
        status(data.text?.trim() ? `Transcripción lista. ${data.note || 'Revisa el texto antes de usarlo.'}` : data.note || 'No se reconoció voz. Prueba el modelo Más preciso, otro canal o desactiva la mejora.');
        resolve();
      }
    };
    asrWorker.onerror = e => reject(new Error(e.message || 'El motor de voz no pudo cargar. Comprueba la conexión y la memoria disponible.'));
    asrWorker.postMessage({ samples, model: $('model').value, language: $('audio-language').value, enhance: $('enhance').checked, highpass: $('highpass').checked }, [samples.buffer]);
  });
}
function renderSegments() {
  $('segments').replaceChildren(); $('segments-box').hidden = !segments.length; $('srt').hidden = !segments.length;
  for (const segment of segments) {
    const row = document.createElement('div'); row.className = 'segment';
    const button = document.createElement('button'); button.textContent = timestamp(segment.timestamp[0]).slice(0,8);
    button.title = 'Escuchar este fragmento'; button.onclick = () => { $('audio-preview').currentTime = segment.timestamp[0] || 0; $('audio-preview').play().catch(() => status('Pulsa reproducir en el audio para escuchar.')); };
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
$('run').onclick = async () => {
  if (!file || busy || loading || recorder) return;
  busy=true; const id=++operation; clearResult(); updateButtons(); status('Procesando en tu navegador…');
  try { if(mode==='audio') await transcribe(id); else await extractText(id); }
  catch(error) {
    if(id===operation) { status(error.message, true); asrWorker?.terminate(); asrWorker=null; }
  } finally { if(id===operation) { busy=false; $('progress-box').hidden=true; updateButtons(); } }
};
$('cancel').onclick = () => {
  operation++; asrWorker?.terminate(); asrWorker=null;
  const old=ocrWorker; ocrWorker=null; if(old) old.terminate().catch(()=>{});
  busy=false; $('progress-box').hidden=true; updateButtons(); status('Proceso cancelado. Tu archivo sigue disponible.');
};
$('result').oninput = () => { updateResult(); $('srt').hidden = true; $('segments-box').hidden = true; };
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
