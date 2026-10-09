import { defaultSnippets } from '../data/default-snippets.mjs';
import { normalizeSnippet } from './model.mjs';
export const DB_NAME='reynoso-snippets';
export function createLibrary(factory=globalThis.indexedDB) {
  async function open() {
    if(!factory) throw new Error('IndexedDB no está disponible. Habilita el almacenamiento del navegador para guardar tu biblioteca.');
    return new Promise((resolve,reject)=>{
      const req=factory.open(DB_NAME,1);
      req.onupgradeneeded=()=>{req.result.createObjectStore('snippets',{keyPath:'id'});req.result.createObjectStore('meta');};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Cierra otras pestañas de Snippets y vuelve a intentar.'));
    });
  }
  async function transact(mode,action) {
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['snippets','meta'],mode);let result;
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No se guardó el cambio.'));
      try{action(tx.objectStore('snippets'),tx.objectStore('meta'),value=>{result=value;});}catch(error){tx.abort();reject(error);}
    });}finally{db.close();}
  }
  return {
    async initialize(){await transact('readwrite',(store,meta)=>{const req=meta.get('initialized');req.onsuccess=()=>{if(!req.result){for(const s of defaultSnippets)store.put(normalizeSnippet(s));meta.put(true,'initialized');}};});},
    async all(){return transact('readonly',(store,_meta,done)=>{store.getAll().onsuccess=e=>done(e.target.result);});},
    async put(value){const record=normalizeSnippet(value);await transact('readwrite',store=>store.put(record));return record;},
    async remove(id){await transact('readwrite',store=>store.delete(id));},
    async update(id,action){return transact('readwrite',(store,_meta,done)=>{store.get(id).onsuccess=e=>{if(!e.target.result)return;const record=normalizeSnippet(action(e.target.result));store.put(record);done(record);};});},
    async import(records){const checked=records.map(normalizeSnippet);await transact('readwrite',store=>{for(const s of checked){store.add(s);}});},
    async restore(){await transact('readwrite',store=>{for(const s of defaultSnippets){store.get(s.id).onsuccess=e=>{const old=e.target.result;store.put(normalizeSnippet({...s,favorite:old?.favorite??false,usageCount:old?.usageCount??0,lastUsed:old?.lastUsed??null}));};}});}
  };
}
