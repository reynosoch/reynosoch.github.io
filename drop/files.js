import { MAX_FILE, MAX_MEMORY } from './protocol.js?v=1.7';
export function fileKind(name) {
  const ext = String(name).split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','avif','heic','heif','bmp','tif','tiff'].includes(ext)) return 'Foto';
  if (['xlsx','xls','xlsm','xlsb','csv','tsv','ods'].includes(ext)) return 'Excel / datos';
  if (['doc','docx','odt','rtf'].includes(ext)) return 'Documento';
  if (['ppt','pptx','odp'].includes(ext)) return 'Presentación';
  if (ext === 'pdf') return 'PDF';
  if (['zip','7z','rar','tar','gz'].includes(ext)) return 'Comprimido';
  if (['txt','log','md','json','xml','js','jsx','ts','tsx','py','cs','sql','html','css'].includes(ext)) return 'Texto / código';
  if (['mp4','mov','webm','mkv','avi'].includes(ext)) return 'Video';
  return 'Archivo';
}
export function extendQueue(current, additions) {
  const files = [...current], rejected = []; let bytes = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of additions) {
    if (file.size > MAX_FILE) { rejected.push({name:file.name,reason:'Supera 50 MB'}); continue; }
    if (files.length >= 30 || bytes + file.size > MAX_MEMORY) { rejected.push({name:file.name,reason:'La selección admite 30 archivos y 100 MB en total'}); continue; }
    files.push(file); bytes += file.size;
  }
  return { files, rejected };
}
// Only binary raster formats can be previewed. SVG/HTML are never rendered.
export async function imageMime(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = (offset, count) => String.fromCharCode(...bytes.slice(offset, offset + count));
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (['GIF87a','GIF89a'].includes(ascii(0,6))) return 'image/gif';
  if (ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') return 'image/webp';
  if (ascii(4,4) === 'ftyp') {
    const brand = ascii(8,4);
    if (['avif','avis'].includes(brand)) return 'image/avif';
    if (['heic','heix','hevc','hevx'].includes(brand)) return 'image/heic';
    if (['mif1','msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}
