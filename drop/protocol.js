export const MAX_FILE = 50 * 1024 * 1024;
export const MAX_MEMORY = 100 * 1024 * 1024;
export const MAX_TEXT = 512 * 1024;
export const CHUNK_SIZE = 64 * 1024;
const RESUME_HOST_KEY = 'reynoso-drop:resume-host-room';
export function newCode() { return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); }
function resumedRoomCode() {
  try {
    const value = globalThis.localStorage?.getItem(RESUME_HOST_KEY) || '';
    if (!/^\d{4}$/.test(value)) return null;
    globalThis.localStorage.removeItem(RESUME_HOST_KEY);
    return value;
  } catch { return null; }
}
// Rejection sampling keeps all ten thousand four-digit room codes equally likely.
export function newRoomCode() {
  const resumed = resumedRoomCode();
  if (resumed) return resumed;
  const limit = Math.floor(2 ** 32 / 10000) * 10000;
  let value;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  return String(value % 10000).padStart(4, '0');
}
export function formatCode(code) { return /^\d{4}$/.test(code) ? code : code.match(/.{1,4}/g)?.join('-') || ''; }
export function parseCode(value) {
  let raw = String(value).trim();
  if (/^https?:\/\//i.test(raw)) { try { raw = new URL(raw).hash.slice(1); } catch { return null; } }
  raw = raw.replace(/[-\s]/g, '').toLowerCase();
  return /^(?:\d{4}|[a-f0-9]{24})$/.test(raw) ? raw : null;
}
export function deviceName(value, fallback = 'Otro dispositivo') { return typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 40) || fallback : fallback; }
export function validId(id) { return typeof id === 'string' && /^[a-f0-9-]{24,40}$/.test(id); }
export function trustedReconnect(trusted, candidate) { return validId(trusted) && typeof candidate === 'string' && candidate === trusted; }
export function safeName(name) { return String(name).replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180) || 'archivo'; }
export function sizeLabel(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
export function validOffer(msg, used = 0) {
  return msg && validId(msg.id) && typeof msg.name === 'string' && msg.name.length > 0 && msg.name.length <= 255 && Number.isSafeInteger(msg.size) && msg.size >= 0 && msg.size <= MAX_FILE && used + msg.size <= MAX_MEMORY && typeof msg.hash === 'string' && /^[a-f0-9]{64}$/.test(msg.hash);
}
export async function digest(buffer) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join(''); }
const arrayBufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
function chunkBytes(value) {
  // PeerJS BinaryPack decodes binary payloads as Uint8Array, not ArrayBuffer.
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  try { return new Uint8Array(value, 0, arrayBufferLength.call(value)); }
  catch { throw new Error('Bloque de archivo no válido'); }
}
export class FileReceiver {
  constructor(offer) { if (!validOffer(offer)) throw new Error('Archivo no válido'); this.offer = offer; this.chunks = []; this.size = 0; this.index = 0; }
  append(msg) {
    if (msg.id !== this.offer.id || msg.index !== this.index) throw new Error('Bloque de archivo no válido');
    const data = chunkBytes(msg.bytes);
    if (data.byteLength !== Math.min(CHUNK_SIZE, this.offer.size - this.size) || data.byteLength === 0) throw new Error('Bloque de archivo no válido');
    // Own only the view's bytes, excluding envelope prefixes/suffixes or later mutations.
    this.chunks.push(data.slice()); this.index++; this.size += data.byteLength;
  }
  async finish() {
    if (this.size !== this.offer.size) throw new Error('Archivo incompleto');
    // Generic MIME prevents treating untrusted received HTML/SVG as executable previews.
    const blob = new Blob(this.chunks, { type: 'application/octet-stream' });
    if (await digest(await blob.arrayBuffer()) !== this.offer.hash) throw new Error('El archivo llegó dañado');
    this.chunks = []; return blob;
  }
}