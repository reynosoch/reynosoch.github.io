import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// The production PeerJS codec, without network connections or browser mocks of serialization.
const context = {window:{},navigator:{userAgent:'Mozilla/5.0'},location:{protocol:'https:'},Object,Array,TextEncoder,TextDecoder,ArrayBuffer,Uint8Array,Blob,setTimeout,clearTimeout};
runInNewContext(readFileSync(new URL('../../vendor/peerjs.min.js',import.meta.url),'utf8'),context);
export async function peerRoundTrip(message) {
  const codec=context.window.peerjs.util;
  // DataConnection passes an Uint8Array into BinaryPack on receipt.
  return codec.unpack(new Uint8Array(await codec.pack(structuredClone(message))));
}
