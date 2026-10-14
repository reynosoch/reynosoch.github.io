import {planParts,partBlob,partTimeMap,assertArchiveSize} from './split.mjs';
const $=id=>document.getElementById(id);
const clock=s=>{const ms=Math.round(s*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');};
const size=n=>(n/1048576).toFixed(2)+' MB';
export function createSplitter({prepare,download,basename,exportLock}){
  let result=null,parts=[],selected=new Set(),locked=false,exporting=false,url=null;
  const notice=text=>{$('split-status').textContent=text;};
  function stop(){const player=$('part-player');player.pause();player.removeAttribute('src');player.load();player.hidden=true;if(url)URL.revokeObjectURL(url);url=null;}
  function controls(){
    const disabled=locked||exporting;
    $('split-prepare').disabled=disabled||!ready;
    $('split-create').disabled=disabled||!result;
    for(const id of ['split-minutes','split-select-all','split-select-none'])$(id).disabled=disabled;
    $('split-download-all').disabled=disabled||!parts.length;
    $('split-download-selected').disabled=disabled||!selected.size;
    for(const el of document.querySelectorAll('#split-parts button,#split-parts input,#split-overview button'))el.disabled=disabled;
    $('split-selection').textContent=`${selected.size} de ${parts.length} seleccionadas · ${size(parts.filter(p=>selected.has(p.number)).reduce((n,p)=>n+p.bytes,0))}`;
  }
  let ready=false;
  function reset(){stop();result=null;parts=[];selected.clear();$('split-parts').replaceChildren();$('split-overview').replaceChildren();$('split-filters').textContent='Prepare con los ajustes recomendados o divida el resultado actual.';notice('Los tiempos de las partes corresponden al audio procesado.');controls();}
  function render(){
    $('split-parts').replaceChildren();$('split-overview').replaceChildren();
    for(const p of parts){
      const card=document.createElement('article');card.className='audio-part';
      const label=document.createElement('label');label.className='part-label';
      const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(p.number);check.setAttribute('aria-label',`Seleccionar parte ${p.number}`);check.onchange=()=>{check.checked?selected.add(p.number):selected.delete(p.number);controls();};
      const title=document.createElement('strong');title.textContent=`Parte ${String(p.number).padStart(2,'0')}`;label.append(check,title);
      const times=document.createElement('p');times.textContent=`${clock(p.start)} — ${clock(p.end)}`;
      const details=document.createElement('small');details.textContent=`${((p.end-p.start)/60).toFixed(2)} min · ${size(p.bytes)}`;
      const actions=document.createElement('div');actions.className='part-actions';
      const listen=document.createElement('button');listen.className='secondary';listen.textContent='Escuchar';listen.onclick=()=>{stop();url=URL.createObjectURL(partBlob(result.blob,p));$('part-player').src=url;$('part-player').hidden=false;$('part-player').play().catch(()=>notice('Pulse reproducir para escuchar.'));notice(`Escuchando parte ${p.number} · ${clock(p.start)} — ${clock(p.end)} del resultado.`);};
      const save=document.createElement('button');save.className='secondary';save.textContent='Descargar WAV';save.onclick=()=>download(partBlob(result.blob,p),filename(p));actions.append(listen,save);card.append(label,times,details,actions);$('split-parts').append(card);
      const segment=document.createElement('button');segment.className='part-segment';segment.style.flexGrow=String(p.end-p.start);segment.textContent=String(p.number);segment.title=`Parte ${p.number}: ${clock(p.start)} — ${clock(p.end)}`;segment.setAttribute('aria-label',segment.title);segment.onclick=()=>{card.scrollIntoView({behavior:'smooth',block:'center'});check.focus();};$('split-overview').append(segment);
    }
    controls();
  }
  function filename(p){return `${basename()}-parte-${String(p.number).padStart(3,'0')}.wav`;}
  function generate(){
    if(!result||locked||exporting)return;
    try{const minutes=Number($('split-minutes').value);const next=planParts(result.samples,minutes*60);stop();parts=next;selected=new Set(parts.map(p=>p.number));render();notice(`${parts.length} partes listas. Los filtros ya están aplicados a todas; no se vuelve a procesar el audio.`);}catch(error){notice(error.message);}
  }
  async function archive(all){
    if(locked||exporting)return;
    const chosen=parts.filter(p=>all||selected.has(p.number));
    try{
      assertArchiveSize(chosen);exporting=true;exportLock(true);controls();
      const {default:JSZip}=await import('../shot/vendor/jszip-3.10.2.mjs');const zip=new JSZip();
      const manifest={version:1,source:basename(),format:'WAV PCM16 mono 16000 Hz',settings:result.settings,actualDenoise:result.metrics.denoise,outputDuration:result.metrics.outputDuration,parts:[]};
      for(const p of chosen){notice(`Preparando ZIP · parte ${p.number}`);const name=filename(p);zip.file(name,await partBlob(result.blob,p).arrayBuffer());manifest.parts.push({file:name,start:p.start,end:p.end,bytes:p.bytes,timeMap:partTimeMap(result.timeMap,p)});await new Promise(r=>setTimeout(r,0));}
      zip.file('partes.json',JSON.stringify(manifest,null,2));
      const blob=await zip.generateAsync({type:'blob',compression:'STORE'},m=>notice(`Creando ZIP · ${Math.round(m.percent)}%`));
      download(blob,basename()+'-partes.zip');notice(`ZIP listo: ${chosen.length} partes y mapa de tiempos al original.`);
    }catch(error){notice(error.message||'No se pudo crear el ZIP. Descargue las partes individualmente.');}
    finally{exporting=false;exportLock(false);controls();}
  }
  $('split-prepare').onclick=()=>{try{planParts(1,Number($('split-minutes').value)*60);prepare();}catch(error){notice(error.message);}};$('split-create').onclick=generate;
  $('split-select-all').onclick=()=>{selected=new Set(parts.map(p=>p.number));render();};$('split-select-none').onclick=()=>{selected.clear();render();};
  $('split-download-all').onclick=()=>archive(true);$('split-download-selected').onclick=()=>archive(false);
  reset();
  return {reset,generate,setState(isReady,isLocked){ready=isReady;locked=isLocked;controls();},setResult(value){reset();result=value;const s=value.settings;const filters=[value.metrics.denoise?'Reducción de ruido':'Sin reducción de ruido',s.highpass?'Filtro de graves':null,s.normalize?'Nivelado de voz':null,s.compress?'Compresión de volumen':null,'Limitador',s.silence==='off'?'Pausas conservadas':'Pausas comprimidas'].filter(Boolean);$('split-filters').textContent='Aplicado a todas las partes: '+filters.join(' · ')+'.';controls();}};
}
