import { CHUNK_SIZE, MAX_TEXT, MAX_FILE, validId, validOffer } from './protocol.js';

export const MAX_HEADER = 8192;
export const MAX_FRAME = MAX_TEXT + MAX_HEADER + 4;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
const bytes = value => ArrayBuffer.isView(value)
  ? new Uint8Array(value.buffer,value.byteOffset,value.byteLength)
  : new Uint8Array(value);

// The same binary framing runs in browsers and Node. Payloads stay binary; no
// base64 copies, arbitrary object deserialization, or second file protocol.
export function encodeFrame(packet) {
  const header={...packet};let payload=new Uint8Array();
  if(packet.message){
    header.message={...packet.message};
    if(packet.message.type==='file-chunk'){
      payload=bytes(packet.message.bytes);delete header.message.bytes;header.binary='chunk';
    }else if(packet.message.type==='text'){
      payload=encoder.encode(packet.message.text);delete header.message.text;header.binary='text';
    }
  }
  const json=encoder.encode(JSON.stringify(header));
  if(json.byteLength>MAX_HEADER||json.byteLength+payload.byteLength+4>MAX_FRAME)throw new Error('Mensaje demasiado grande');
  const result=new Uint8Array(4+json.byteLength+payload.byteLength);
  new DataView(result.buffer).setUint32(0,json.byteLength);result.set(json,4);result.set(payload,4+json.byteLength);
  return result;
}
export function decodeFrame(value) {
  const data=bytes(value);
  if(data.byteLength<6||data.byteLength>MAX_FRAME)throw new Error('Trama no válida');
  const size=new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(0);
  if(size>MAX_HEADER||size+4>data.byteLength)throw new Error('Cabecera no válida');
  const packet=JSON.parse(decoder.decode(data.subarray(4,4+size)));
  if(!packet||typeof packet!=='object'||Array.isArray(packet))throw new Error('Trama no válida');
  const payload=data.subarray(4+size);
  if(packet.binary==='chunk'&&packet.message?.type==='file-chunk')packet.message.bytes=payload.slice();
  else if(packet.binary==='text'&&packet.message?.type==='text')packet.message.text=decoder.decode(payload);
  else if(packet.binary||payload.byteLength)throw new Error('Contenido no válido');
  return packet;
}
export function validMessage(message) {
  if(!message||typeof message!=='object')return false;
  switch(message.type){
    case 'text':return validId(message.id)&&typeof message.text==='string'&&Boolean(message.text.trim())&&encoder.encode(message.text).byteLength<=MAX_TEXT;
    case 'file-offer':return validOffer(message);
    case 'file-chunk':return validId(message.id)&&Number.isSafeInteger(message.index)&&message.index>=0&&message.index<Math.ceil(MAX_FILE/CHUNK_SIZE)&&ArrayBuffer.isView(message.bytes)&&message.bytes.byteLength>0&&message.bytes.byteLength<=CHUNK_SIZE;
    case 'file-end':return validId(message.id);
    case 'failed':return validId(message.id)&&typeof message.reason==='string'&&message.reason.length<=180;
    case 'ack':return typeof message.key==='string'&&/^(?:text|offer|end):[a-f0-9-]{24,40}$|^chunk:[a-f0-9-]{24,40}:\d{1,4}$/.test(message.key);
    case 'ping':case 'pong':case 'health-ready':return true;
    default:return false;
  }
}
