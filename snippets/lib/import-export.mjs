import { normalizeSnippet } from './model.mjs';
export const MAX_IMPORT_BYTES=4*1024*1024;
export function exportLibrary(snippets) {return JSON.stringify({app:'reynoso-snippets',version:1,exportedAt:new Date().toISOString(),snippets:snippets.map(normalizeSnippet)},null,2);}
export function parseLibrary(text) {
  if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES) throw new Error('El JSON supera 4 MB.');
  let payload;try{payload=JSON.parse(text);}catch{throw new Error('El archivo no contiene JSON válido.');}
  if(payload?.app!=='reynoso-snippets'||payload.version!==1||!Array.isArray(payload.snippets)||payload.snippets.length>2000) throw new Error('Usa un archivo exportado por Snippets (versión 1, máximo 2000 registros).');
  const records=payload.snippets.map(normalizeSnippet);
  if(new Set(records.map(s=>s.id)).size!==records.length) throw new Error('El archivo tiene IDs duplicados.');
  return records;
}
export function planImport(existing,incoming,newId=()=>`custom:${crypto.randomUUID()}`) {
  const byId=new Map(existing.map(s=>[s.id,s]));const occupied=new Set(byId.keys());let duplicates=0,collisions=0;
  const records=[];
  for(const s of incoming) {
    const previous=byId.get(s.id);
    if(previous&&JSON.stringify(normalizeSnippet(previous))===JSON.stringify(normalizeSnippet(s))){duplicates++;continue;}
    let id=s.id;
    if(occupied.has(id)||id.startsWith('default:')){do{id=newId();}while(occupied.has(id));collisions++;}
    occupied.add(id);records.push({...s,id,custom:true});
  }
  return {records,duplicates,collisions};
}
