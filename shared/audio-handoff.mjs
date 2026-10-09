import {materializeAudio,clearHandoffTemp} from './handoff-transfer.mjs';
import {validateTimeMap,outputToOriginal} from '../audio/core.mjs';
export const HANDOFF_VERSION=1,HANDOFF_KIND='reynoso.audio-lab';
export function validateHandoff(payload,token){
  if(!payload||payload.kind!==HANDOFF_KIND||payload.version!==HANDOFF_VERSION||payload.token!==token||!(payload.file instanceof Blob)||payload.file.type!=='audio/wav'||!payload.file.size||payload.file.size>512*1024*1024||typeof payload.name!=='string'||payload.name.length>255||!(payload.originalDuration>0&&payload.originalDuration<=14400))throw new Error('Transferencia de Audio Lab no válida.');
  const duration=validateTimeMap(payload.timeMap,payload.originalDuration);
  if(Math.abs((payload.file.size-44)/32000-duration)>.01)throw new Error('El WAV y el mapa de tiempos no coinciden.');
  return {file:new File([payload.file],payload.name,{type:'audio/wav'}),timeMap:payload.timeMap,originalDuration:payload.originalDuration,version:1};
}
export function receiveAudioHandoff({accept,onMetadata,onError,onStart=()=>true,onFinish=()=>{},onProgress=()=>{},materialize=materializeAudio,browser=window}){
  const prefix='#audio-lab=',token=browser.location.hash.startsWith(prefix)?browser.location.hash.slice(prefix.length):'';
  if(!/^[a-f0-9-]{36}$/.test(token)||!browser.opener)return ()=>{};
  const origin=browser.location.origin,opener=browser.opener;let done=false,receiving=false,timer,deadline;
  const ready=()=>{if(!done)opener.postMessage({kind:HANDOFF_KIND,type:'ready',version:1,token},origin);};
  function cleanup(){clearInterval(timer);clearTimeout(deadline);browser.removeEventListener('message',receive);}
  async function receive(event){if(receiving||event.origin!==origin||event.source!==opener||event.data?.token!==token||event.data?.kind!==HANDOFF_KIND||event.data?.type!=='file')return;
    let copied,started=false;try{const result=validateHandoff(event.data,token);if(!onStart())throw new Error('Transcribe está ocupado. Descarga el WAV desde Audio Lab.');started=true;receiving=true;copied=await materialize(result.file,{onProgress});onFinish();result.file=new File([copied.blob],result.file.name,{type:'audio/wav'});result.tempName=copied.tempName;if(!accept(result.file))throw new Error('Transcribe está ocupado. Descarga el WAV desde Audio Lab.');onMetadata(result);done=true;opener.postMessage({kind:HANDOFF_KIND,type:'accepted',version:1,token},origin);browser.history.replaceState(null,'',browser.location.pathname+browser.location.search);cleanup();}
    catch(error){if(started)onFinish();await clearHandoffTemp(copied?.tempName);onError(error);opener.postMessage({kind:HANDOFF_KIND,type:'rejected',version:1,token},origin);cleanup();}
  }
  browser.addEventListener('message',receive);ready();timer=setInterval(ready,700);deadline=setTimeout(cleanup,60000);return cleanup;
}
export function sendAudioHandoff(payload,{browser=window,onStatus=()=>{}}={}){
  const token=crypto.randomUUID(),url=new URL('../transcribe/',browser.location.href);url.hash='audio-lab='+token;
  // Caller invokes synchronously from the explicit consent button, preserving popup permission.
  const target=browser.open(url.href,'_blank');if(!target){onStatus('El navegador bloqueó la ventana. Descarga el WAV y abre Transcribe.');return ()=>{};}
  let sent=false;const origin=browser.location.origin;
  function cleanup(){clearTimeout(timer);browser.removeEventListener('message',receive);}
  function receive(event){if(event.origin!==origin||event.source!==target||event.data?.kind!==HANDOFF_KIND||event.data?.version!==1||event.data?.token!==token)return;
    if(event.data.type==='ready'&&!sent){sent=true;target.postMessage({...payload,kind:HANDOFF_KIND,version:1,type:'file',token},origin);}
    if(event.data.type==='accepted'){onStatus('WAV recibido en Transcribe. Elige modelo e idioma y autoriza la transcripción allí.');cleanup();}
    if(event.data.type==='rejected'){onStatus('Transcribe no pudo recibirlo. Tu resultado sigue aquí: descarga el WAV y ábrelo manualmente.');cleanup();}
  }
  browser.addEventListener('message',receive);const timer=setTimeout(()=>{onStatus('No se confirmó la transferencia. Conservamos tu resultado: descarga el WAV y abre Transcribe.');cleanup();},45000);return cleanup;
}
export {outputToOriginal};
