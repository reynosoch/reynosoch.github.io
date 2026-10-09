export const HANDOFF_TEMP_PREFIX='reynoso-transcribe-handoff-';
export function materializeAudio(file,{onProgress=()=>{}}={}){
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./handoff-worker.mjs',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(new Error('La copia tardó demasiado. Descarga el WAV desde Audio Lab.'));},120000);
    const stop=()=>{clearTimeout(timer);worker.terminate();};worker.onerror=e=>{stop();reject(new Error(e.message||'No se pudo copiar el audio localmente.'));};worker.onmessage=({data})=>{if(data.type==='progress')onProgress(data.percent);if(data.type==='ready'){stop();resolve(data);}if(data.type==='error'){stop();reject(new Error(data.message));}};worker.postMessage({file});
  });
}
export async function clearHandoffTemp(name){if(!name?.startsWith(HANDOFF_TEMP_PREFIX)||!navigator.storage?.getDirectory)return;try{await(await navigator.storage.getDirectory()).removeEntry(name);}catch{}}
export async function clearStaleHandoffs(){if(!navigator.storage?.getDirectory)return;try{const root=await navigator.storage.getDirectory();for await(const [name]of root.entries())if(name.startsWith(HANDOFF_TEMP_PREFIX)){const file=await(await root.getFileHandle(name)).getFile();if(Date.now()-file.lastModified>86400000)await root.removeEntry(name).catch(()=>{});}}catch{}}
