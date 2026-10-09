import {wavHeader} from './core.mjs';
export const TEMP_PREFIX='reynoso-audio-';
export async function createWriter(expectedBytes,{forceBlob=false,scope=''}={}) {
  let directory,handle,sync,name;
  if(!forceBlob&&navigator.storage?.getDirectory) {
    const quota=await navigator.storage.estimate().catch(()=>({}));
    if(quota.quota&&expectedBytes>quota.quota-(quota.usage||0))throw new Error('No queda espacio temporal. Libera almacenamiento o prepara un fragmento.');
    try{directory=await navigator.storage.getDirectory();name=TEMP_PREFIX+(scope?scope+'-':'')+crypto.randomUUID()+'.wav';handle=await directory.getFileHandle(name,{create:true});sync=await handle.createSyncAccessHandle();sync.write(wavHeader(0),{at:0});}
    catch(error){try{sync?.close();if(directory&&name)await directory.removeEntry(name);}catch{}if(error.name==='QuotaExceededError')throw error;sync=null;}
  }
  if(!sync&&expectedBytes>160*1024*1024)throw new Error('Este navegador no ofrece archivos temporales. El resultado supera el límite de memoria de 160 MB; usa escritorio o un fragmento.');
  const parts=[];let bytes=0;
  return {tempName:name,storage:sync?'OPFS temporal':'Blob acotado',async write(part){if(sync){const count=sync.write(part,{at:44+bytes});if(count!==part.byteLength)throw new Error('Escritura temporal incompleta.');}else{if(bytes+part.byteLength>160*1024*1024)throw new Error('Límite de memoria alcanzado.');parts.push(part);}bytes+=part.byteLength;},async finish(){const header=wavHeader(bytes/2);if(sync){sync.write(header,{at:0});sync.flush();sync.close();sync=null;return {blob:await handle.getFile(),tempName:name,samples:bytes/2};}return {blob:new Blob([header,...parts],{type:'audio/wav'}),tempName:null,samples:bytes/2};},async abort(){try{sync?.close();sync=null;if(directory&&name)await directory.removeEntry(name);}catch{}parts.length=0;}};
}
export async function removeTemp(name){if(!name?.startsWith(TEMP_PREFIX)||!navigator.storage?.getDirectory)return;for(let attempt=0;attempt<3;attempt++){try{await(await navigator.storage.getDirectory()).removeEntry(name);return;}catch(error){if(error.name==='NotFoundError')return;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,100));}}}
// Only our scratch WAV files; no permanent archive and no other tool's storage.
export async function cleanupTemps(keep=[],scope=''){if(!navigator.storage?.getDirectory)return;try{const directory=await navigator.storage.getDirectory();for await(const [name]of directory.entries())if(name.startsWith(TEMP_PREFIX)&&!keep.includes(name)){const f=await(await directory.getFileHandle(name)).getFile();if((scope&&name.startsWith(TEMP_PREFIX+scope+'-'))||Date.now()-f.lastModified>86400000)await removeTemp(name);}}catch{}}
