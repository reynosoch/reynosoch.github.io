import { MAX_TEXT, MAX_FILE } from './protocol.js?v=1.7';

export function lineCount(text) {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') { count++; if (text[i + 1] === '\n') i++; }
    else if (text[i] === '\n') count++;
  }
  return count;
}
export function needsTextFile(text) {
  return lineCount(text) > 400 || new TextEncoder().encode(text).byteLength > MAX_TEXT;
}
export function textFile(text) {
  const file = new File([text], `texto-${Date.now()}.txt`, { type: 'text/plain;charset=utf-8' });
  if (file.size > MAX_FILE) throw new Error('El texto supera 50 MB. Divídelo en archivos más pequeños.');
  return file;
}
