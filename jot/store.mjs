const DB_NAME='reynoso-jot',DB_VERSION=1;
let dbPromise;

export function db(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
      if(!d.objectStoreNames.contains('notes')){const s=d.createObjectStore('notes',{keyPath:'id'});s.createIndex('updated','updated');}
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}

function tx(store,mode='readonly'){return db().then(d=>d.transaction(store,mode).objectStore(store));}
function reqPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function getMeta(){return reqPromise((await tx('meta')).get('vault'));}
export async function setMeta(meta){return reqPromise((await tx('meta','readwrite')).put(meta,'vault'));}
export async function rows(){return reqPromise((await tx('notes')).getAll());}
export async function putRow(row){return reqPromise((await tx('notes','readwrite')).put(row));}
export async function deleteRow(id){return reqPromise((await tx('notes','readwrite')).delete(id));}
export async function clearRows(){return reqPromise((await tx('notes','readwrite')).clear());}

export async function exportVault(){return {format:'reynoso-jot-v1',exportedAt:Date.now(),meta:await getMeta(),notes:await rows()};}
export async function importVault(payload){
  if(payload?.format!=='reynoso-jot-v1'||!payload.meta?.salt||!payload.meta?.verifier||!Array.isArray(payload.notes))throw new Error('El respaldo no es una bóveda Jot válida.');
  const d=await db(),transaction=d.transaction(['meta','notes'],'readwrite');
  transaction.objectStore('meta').put(payload.meta,'vault');transaction.objectStore('notes').clear();
  for(const row of payload.notes)if(row?.id&&row?.blob?.iv&&row?.blob?.data)transaction.objectStore('notes').put(row);
  await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('Importación cancelada.'));});
}
