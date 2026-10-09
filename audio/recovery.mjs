export const RECOVERY_DB='reynoso-audio-lab';
async function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(RECOVERY_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('metadata');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function operation(mode,run){const database=await db();try{return await new Promise((resolve,reject)=>{const t=database.transaction('metadata',mode),r=run(t.objectStore('metadata'));let result;r.onsuccess=()=>{result=r.result;};t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}finally{database.close();}}
export const readRecovery=()=>operation('readonly',s=>s.get('analysis'));
export const saveRecovery=record=>operation('readwrite',s=>s.put(record,'analysis'));
export const deleteRecovery=()=>operation('readwrite',s=>s.delete('analysis'));
export function validRecovery(r){return r?.version===1&&typeof r.identity==='string'&&r.identity.length<100&&r.analysis?.duration>0&&r.analysis.duration<=14400&&Array.isArray(r.analysis.channelStats)&&r.analysis.channelStats.length<=8&&r.analysis.channelStats.every(c=>Array.isArray(c.segments)&&c.segments.length<=50000&&Array.isArray(c.peaks)&&c.peaks.length<=144001);}
