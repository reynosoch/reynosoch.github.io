import { validateCheckpoint } from './session.mjs';
const NAME='reynoso-transcribe', STORE='recovery';
async function database() {
  if (!globalThis.indexedDB) throw new Error('Este navegador no permite recuperación local.');
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Cierra otra pestaña de Transcribe para abrir la recuperación.'));
  });
}
async function transaction(mode,action) {
  const db=await database();
  try { return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),request=action(tx.objectStore(STORE));let result;
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No se guardó la recuperación.'));
  }); } finally { db.close(); }
}
export async function readRecovery() {
  const record=await transaction('readonly',store=>store.get('latest'));
  return validateCheckpoint(record)?record:null;
}
export async function saveRecovery(record) {
  if(!validateCheckpoint(record)) throw new Error('La recuperación no tiene un formato válido.');
  await transaction('readwrite',store=>store.put(record,'latest'));
}
export async function deleteRecovery() { await transaction('readwrite',store=>store.delete('latest')); }
