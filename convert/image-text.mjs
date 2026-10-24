import {engines,optional} from './engines.mjs';

const IMAGE_EXT=new Set(['png','jpg','jpeg','jfif','pjpeg','pjp','webp','gif','bmp','svg','avif','heic','heif','tif','tiff','ico']);
const MAX_IMAGE_SIZE=300*1024*1024;
const MAX_CAPTURED_IMAGES=40;
const MAX_PIXELS=24_000_000;
const MAX_DIMENSION=8000;
const captured=[];
const results=new Map();
let running=null;
let worker=null;
let workerLanguage='';
let tiffPromise=null;

const ext=name=>(String(name||'').split('.').pop()||'').toLowerCase();
const base=name=>String(name||'imagen').replace(/\.[^.]+$/,'');
const fmtBytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
const identity=file=>`${file.name}\u0000${file.size}\u0000${file.lastModified}`;
const isImage=file=>Boolean(file&&(file.type?.startsWith('image/')||IMAGE_EXT.has(ext(file.name))));
const icon=body=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const scanIcon=icon('<path d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4"/><path d="M7 12h10M8 9h8M9 15h6"/>');
const copyIcon=icon('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>');
const downloadIcon=icon('<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>');

function ensurePanel(){
  let panel=document.getElementById('image-text-panel');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.id='image-text-panel';
  panel.className='image-text-panel glass';
  panel.innerHTML=`<div class="image-text-head"><div><p class="section-kicker">TEXTO DE IMAGEN</p><h2>Lee el texto sin convertir el archivo.</h2><p>Carga una imagen y pulsa <strong>Extraer texto</strong>. El resultado aparece aquí para revisar, editar o copiar; descargar TXT es opcional.</p></div><div class="image-text-options"><label>Idioma<select id="image-text-language"><option value="spa+eng">Español + English</option><option value="spa">Español</option><option value="eng">English</option></select></label><label class="image-text-check"><input id="image-text-enhance" type="checkbox" checked><span>Mejorar contraste</span></label></div></div><div class="image-text-progress" aria-hidden="true"><i id="image-text-progress-bar"></i></div><p id="image-text-status" class="image-text-status" role="status" aria-live="polite">Agrega una imagen para habilitar la extracción.</p><div class="image-text-layout"><div><p class="image-text-label">IMÁGENES</p><div id="image-text-sources" class="image-text-sources"><p class="queue-empty">Las imágenes cargadas aparecerán aquí.</p></div></div><div><p class="image-text-label">TEXTO EXTRAÍDO</p><div id="image-text-results" class="image-text-results"><p class="queue-empty">El texto aparecerá aquí sin obligarte a descargar un archivo.</p></div></div></div>`;
  const resultsPanel=document.querySelector('.results-panel');
  if(resultsPanel)resultsPanel.insertAdjacentElement('afterend',panel);
  else document.querySelector('.converter-grid')?.append(panel);
  return panel;
}

function setStatus(text,bad=false){
  const el=document.getElementById('image-text-status');
  if(!el)return;
  el.textContent=text;
  el.classList.toggle('danger-text',bad);
}
function setProgress(value){
  const bar=document.getElementById('image-text-progress-bar');
  if(bar)bar.style.width=`${Math.max(0,Math.min(100,Number(value)||0))}%`;
}
function captureFiles(files){
  let added=0;
  for(const file of Array.from(files||[])){
    if(captured.length>=MAX_CAPTURED_IMAGES)break;
    if(!isImage(file)||!file.size||file.size>MAX_IMAGE_SIZE)continue;
    const key=identity(file);
    const existing=captured.findIndex(entry=>entry.key===key);
    if(existing>=0)captured.splice(existing,1);
    captured.push({key,file});
    added++;
  }
  if(added){renderSources();setStatus(`${captured.length} imagen${captured.length===1?'':'es'} lista${captured.length===1?'':'s'}. Pulsa Extraer texto.`);}
}

function renderSources(){
  ensurePanel();
  const box=document.getElementById('image-text-sources');
  box.replaceChildren();
  if(!captured.length){const empty=document.createElement('p');empty.className='queue-empty';empty.textContent='Las imágenes cargadas aparecerán aquí.';box.append(empty);return;}
  for(const {key,file} of captured){
    const row=document.createElement('article');row.className='image-text-source';row.dataset.key=key;
    const badge=document.createElement('span');badge.className='image-text-source-icon';badge.innerHTML=scanIcon;
    const copy=document.createElement('div');copy.className='image-text-source-copy';
    const name=document.createElement('strong');name.textContent=file.name;
    const meta=document.createElement('small');meta.textContent=`${(ext(file.name)||file.type?.split('/')[1]||'imagen').toUpperCase()} · ${fmtBytes(file.size)}`;
    copy.append(name,meta);
    const button=document.createElement('button');button.type='button';button.className='image-text-run';button.dataset.extractImageText=key;button.innerHTML=`${scanIcon}<span>${running?.key===key?'Procesando…':results.has(key)?'Volver a leer':'Extraer texto'}</span>`;button.disabled=Boolean(running);
    row.append(badge,copy,button);box.append(row);
  }
}

function renderResults(){
  ensurePanel();
  const box=document.getElementById('image-text-results');box.replaceChildren();
  const ordered=captured.map(entry=>[entry,results.get(entry.key)]).filter(([,result])=>result);
  if(!ordered.length){const empty=document.createElement('p');empty.className='queue-empty';empty.textContent='El texto aparecerá aquí sin obligarte a descargar un archivo.';box.append(empty);return;}
  for(const [{key,file},result] of ordered){
    const card=document.createElement('article');card.className='image-text-result';card.dataset.key=key;
    const head=document.createElement('div');head.className='image-text-result-head';
    const title=document.createElement('div');const strong=document.createElement('strong');strong.textContent=file.name;
    const small=document.createElement('small');small.textContent=result.error?result.error:`${result.words.toLocaleString('es-MX')} palabras${Number.isFinite(result.confidence)?` · confianza ${Math.round(result.confidence)}%`:''}`;small.classList.toggle('danger-text',Boolean(result.error));title.append(strong,small);head.append(title);
    if(result.error){card.append(head);box.append(card);continue;}
    const area=document.createElement('textarea');area.className='image-text-output';area.value=result.text;area.placeholder='No se encontró texto legible.';area.spellcheck=true;area.setAttribute('aria-label',`Texto extraído de ${file.name}`);area.addEventListener('input',()=>{result.text=area.value;result.words=area.value.trim()?area.value.trim().split(/\s+/u).length:0;small.textContent=`${result.words.toLocaleString('es-MX')} palabras${Number.isFinite(result.confidence)?` · confianza ${Math.round(result.confidence)}%`:''}`;});
    const actions=document.createElement('div');actions.className='image-text-result-actions';
    const copy=document.createElement('button');copy.type='button';copy.dataset.imageTextCopy=key;copy.innerHTML=`${copyIcon}<span>Copiar</span>`;copy.disabled=!result.text;copy.addEventListener('click',()=>copyText(area));
    const save=document.createElement('button');save.type='button';save.dataset.imageTextDownload=key;save.innerHTML=`${downloadIcon}<span>Descargar .txt</span>`;save.disabled=!result.text;save.addEventListener('click',()=>downloadText(area.value,`${base(file.name)}-texto.txt`));
    actions.append(copy,save);card.append(head,area,actions);box.append(card);
  }
}

async function copyText(area){
  try{await navigator.clipboard.writeText(area.value);setStatus('Texto copiado al portapapeles.');}
  catch{area.focus();area.select();setStatus('El navegador bloqueó el portapapeles. El texto quedó seleccionado para copiarlo manualmente.');}
}
function downloadText(text,name){
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

async function loadTiff(){
  if(globalThis.UTIF)return globalThis.UTIF;
  if(tiffPromise)return tiffPromise;
  tiffPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js';script.crossOrigin='anonymous';
    script.onload=()=>globalThis.UTIF?resolve(globalThis.UTIF):reject(Error('El lector TIFF no inició.'));
    script.onerror=()=>reject(Error('Esta red bloqueó el lector TIFF.'));
    document.head.append(script);
  }).catch(error=>{tiffPromise=null;throw error;});
  return tiffPromise;
}
async function tiffCanvas(file){
  const UTIF=await loadTiff(),buffer=await file.arrayBuffer(),pages=UTIF.decode(buffer);
  if(!pages?.length)throw Error('TIFF sin páginas legibles.');
  const page=pages[0];UTIF.decodeImage(buffer,page);const rgba=UTIF.toRGBA8(page),canvas=document.createElement('canvas');
  canvas.width=page.width;canvas.height=page.height;const context=canvas.getContext('2d');context.putImageData(new ImageData(new Uint8ClampedArray(rgba),page.width,page.height),0,0);return canvas;
}
async function heicBlob(file){
  const mod=await optional(engines.heic,'HEIC/HEIF'),heic2any=mod.default||mod,out=await heic2any({blob:file,toType:'image/png',quality:.96});return Array.isArray(out)?out[0]:out;
}
async function drawable(blob){
  if('createImageBitmap'in window){try{const bitmap=await createImageBitmap(blob);return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};}catch{}}
  return await new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(blob);image.onload=()=>{URL.revokeObjectURL(url);resolve({source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>{}})};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('El navegador no pudo decodificar esta imagen.'))};image.src=url;});
}
function processCanvas(source,width,height,close){
  if(!width||!height){close?.();throw Error('La imagen no tiene dimensiones válidas.');}
  const wanted=Math.max(width,height)<1800?2:1,scale=Math.min(wanted,MAX_DIMENSION/Math.max(width,height),Math.sqrt(MAX_PIXELS/(width*height))),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);close?.();
  if(!document.getElementById('image-text-enhance')?.checked)return canvas;
  const pixels=context.getImageData(0,0,canvas.width,canvas.height),histogram=new Uint32Array(256);
  for(let i=0;i<pixels.data.length;i+=4)histogram[Math.round(.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2])]++;
  const total=canvas.width*canvas.height;let lower=0,upper=255,count=0;
  while(lower<255&&count<total*.01){count+=histogram[lower];lower++;}count=0;
  while(upper>lower&&count<total*.01){count+=histogram[upper];upper--;}
  const dark=histogram.slice(0,100).reduce((sum,value)=>sum+value,0)>total*.6;
  for(let i=0;i<pixels.data.length;i+=4){let gray=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];if(upper-lower>20)gray=Math.max(0,Math.min(255,(gray-lower)*255/(upper-lower)));if(dark)gray=255-gray;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;pixels.data[i+3]=255;}
  context.putImageData(pixels,0,0);return canvas;
}
async function prepareImage(file){
  const extension=ext(file.name);
  if(extension==='tif'||extension==='tiff'){const canvas=await tiffCanvas(file);return processCanvas(canvas,canvas.width,canvas.height,()=>{});}
  let blob=file;if(extension==='heic'||extension==='heif')blob=await heicBlob(file);
  const decoded=await drawable(blob);return processCanvas(decoded.source,decoded.width,decoded.height,decoded.close);
}

async function getWorker(language){
  if(worker&&workerLanguage===language)return worker;
  if(worker){await worker.terminate().catch(()=>{});worker=null;workerLanguage='';}
  const T=await optional(engines.tesseract,'Lectura de texto'),createWorker=T.createWorker||T.default?.createWorker;
  if(!createWorker)throw Error('El lector de texto no está disponible.');
  worker=await createWorker(language,1,{logger:event=>{
    if(!running)return;
    const value=Number.isFinite(event.progress)?Math.round(event.progress*100):0;setProgress(value);
    if(event.status==='recognizing text')setStatus(`Leyendo ${running.file.name}… ${value}%`);
    else if(event.status)setStatus(`Preparando lector · ${event.status}`);
  }});
  workerLanguage=language;await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});return worker;
}
async function extract(entry){
  if(running)return;
  running={...entry};renderSources();setProgress(3);setStatus(`Preparando ${entry.file.name}…`);
  try{
    const canvas=await prepareImage(entry.file);setProgress(8);
    const language=document.getElementById('image-text-language')?.value||'spa+eng',reader=await getWorker(language),{data}=await reader.recognize(canvas),text=String(data?.text||'').trim(),words=text?text.split(/\s+/u).length:0;
    results.set(entry.key,{text,words,confidence:Number(data?.confidence)});renderResults();setProgress(100);setStatus(text?`Texto extraído de ${entry.file.name}. Puedes editarlo o copiarlo directamente.`:`No se encontró texto legible en ${entry.file.name}. Prueba desactivar la mejora de contraste o usa una imagen con mayor resolución.`);
  }catch(error){results.set(entry.key,{error:error?.message||String(error),text:'',words:0});renderResults();setProgress(0);setStatus(error?.message||String(error),true);}
  finally{running=null;renderSources();}
}

function removeCapturedForRow(row){
  const name=row?.querySelector('.file-copy strong')?.textContent;if(!name)return;
  const meta=row.querySelector('.file-copy small')?.textContent||'',index=captured.findIndex(({file})=>file.name===name&&meta.startsWith(fmtBytes(file.size)));
  if(index<0)return;const [{key}]=captured.splice(index,1);results.delete(key);renderSources();renderResults();if(!captured.length)setStatus('Agrega una imagen para habilitar la extracción.');
}

function boot(){
  ensurePanel();renderSources();renderResults();
  for(const id of ['file-input','folder-input'])document.getElementById(id)?.addEventListener('change',event=>captureFiles(event.target.files),true);
  document.addEventListener('drop',event=>captureFiles(event.dataTransfer?.files),true);
  document.addEventListener('paste',event=>captureFiles(event.clipboardData?.files),true);
  document.getElementById('image-text-sources')?.addEventListener('click',event=>{const button=event.target.closest('[data-extract-image-text]');if(!button)return;const entry=captured.find(item=>item.key===button.dataset.extractImageText);if(entry)extract(entry);});
  document.getElementById('queue')?.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.matches('[data-extract-image-text]'))return;const row=button.closest('.file-row');if(row)removeCapturedForRow(row);},true);
  document.getElementById('clear')?.addEventListener('click',()=>{captured.splice(0);results.clear();renderSources();renderResults();setProgress(0);setStatus('Agrega una imagen para habilitar la extracción.');});
  document.getElementById('image-text-language')?.addEventListener('change',async()=>{if(worker){const old=worker;worker=null;workerLanguage='';await old.terminate().catch(()=>{});}setStatus(captured.length?'Idioma actualizado. Pulsa Extraer texto.':'Agrega una imagen para habilitar la extracción.');});
  window.addEventListener('pagehide',()=>{worker?.terminate().catch(()=>{});worker=null;});
  document.body.dataset.imageTextReady='true';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
