// Versioned plan/checkpoint contract. Audio bytes are never stored here.
export const SESSION_VERSION = 1;
export const WINDOW_SECONDS = 30;
export const OVERLAP_SECONDS = 5;
export function audioPlan(duration, requestedModel = 'auto') {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 14400) throw new Error('La duración debe estar entre un segundo y cuatro horas.');
  if (!['auto','tiny','base','small'].includes(requestedModel)) throw new Error('Modelo no válido.');
  const model = requestedModel === 'auto' ? (duration <= 60 ? 'tiny' : 'base') : requestedModel;
  const step = WINDOW_SECONDS - 2 * OVERLAP_SECONDS;
  const count = Math.max(1, Math.ceil((duration - WINDOW_SECONDS) / step) + 1);
  return { duration, model, count, step, window: WINDOW_SECONDS };
}
export function windowAt(plan, index) {
  if (!Number.isInteger(index) || index < 0 || index >= plan.count) throw new Error('Fragmento fuera del plan.');
  const start = index * plan.step, end = Math.min(plan.duration, start + plan.window);
  const left = index === 0 ? 0 : OVERLAP_SECONDS, right = index === plan.count - 1 ? 0 : OVERLAP_SECONDS;
  return { index, start, end, left, right, completed: end - right, stride: [end - start, left, right] };
}
export function estimatedRemaining(elapsedSeconds, completedSeconds, totalSeconds) {
  if (!(elapsedSeconds > 0 && completedSeconds > 0)) return null;
  return Math.max(0, elapsedSeconds / completedSeconds * (totalSeconds - completedSeconds));
}
export async function fileIdentity(file,{hasher,signal}={}) {
  if(!hasher) {const {createSHA256}=await import('https://cdn.jsdelivr.net/npm/hash-wasm@4.12.0/+esm');hasher=await createSHA256();}
  hasher.init?.();
  for(let offset=0;offset<file.size;offset+=2*1024*1024) {
    if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
    hasher.update(new Uint8Array(await file.slice(offset,offset+2*1024*1024).arrayBuffer()));
  }
  return `${file.size}:${hasher.digest('hex')}`;
}
export function validateCheckpoint(record) {
  if (!record || record.version!==SESSION_VERSION || typeof record.identity!=='string' || typeof record.text!=='string' || record.text.length>2000000) return false;
  try {
    const plan=audioPlan(record.duration,record.options.model);
    return Array.isArray(record.history) && record.history.length===record.next && record.next>=0 && record.next<=plan.count &&
      record.history.every((chunk,index)=>Array.isArray(chunk.tokens) && chunk.tokens.length<=1024 && chunk.tokens.every(token=>Number.isInteger(token)&&token>=0&&token<=60000) &&
        Array.isArray(chunk.stride) && chunk.stride.length===3 && chunk.stride.every((value,i)=>Math.abs(value-windowAt(plan,index).stride[i])<.001)) &&
      Array.isArray(record.segments) && record.segments.length<=50000 && record.segments.every(segment=>typeof segment.text==='string' && Array.isArray(segment.timestamp) && segment.timestamp.length===2 && segment.timestamp.every(time=>time===null||Number.isFinite(time))) &&
      ['wasm','webgpu'].includes(record.options.device) && ['mix','left','right'].includes(record.options.channel) && typeof record.options.language==='string';
  } catch { return false; }
}
