const DB='reynoso-shot',TTL=7*24*60*60*1000;export const MAX_SESSION=128*1024*1024;
export async function openSession(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{for(const name of ['state','assets','folder'])r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function transaction(db,store,mode,operation){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),s=tx.objectStore(store);let value;operation(s,r=>{r.onsuccess=()=>{value=r.result;};});tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('No se pudo guardar la sesión'));});}
export const readState=db=>transaction(db,'state','readonly',(s,r)=>r(s.get('recent')));
export const readAsset=(db,id)=>transaction(db,'assets','readonly',(s,r)=>r(s.get(id)));
export const writeState=(db,state)=>transaction(db,'state','readwrite',s=>s.put({...state,savedAt:Date.now(),version:1},'recent'));
export const saveAsset=(db,id,blob)=>transaction(db,'assets','readwrite',s=>s.put(blob,id));
export const deleteAsset=(db,id)=>transaction(db,'assets','readwrite',s=>s.delete(id));
export async function clearSession(db){for(const store of ['assets','state'])await transaction(db,store,'readwrite',s=>s.clear());}
export const writeFolder=(db,handle)=>transaction(db,'folder','readwrite',s=>s.put(handle,'handle'));
export const readFolder=db=>transaction(db,'folder','readonly',(s,r)=>r(s.get('handle')));
export const expired=state=>!state||state.version!==1||Date.now()-state.savedAt>TTL;
export async function capacity(bytes){if(bytes>MAX_SESSION)throw Error('La sesión admite hasta 128 MB de archivos. Elimina algunas capturas antes de agregar más.');const q=await navigator.storage?.estimate?.();if(q?.quota&&q.quota-q.usage<bytes*1.2)throw Error('Queda poco espacio en este navegador. Descarga tu paquete y limpia la sesión.');}
