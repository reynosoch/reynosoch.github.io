import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeFrame,decodeFrame,MAX_FRAME} from '../relay-codec.js';
import {relayAddress,RelaySession} from '../relay-transport.js';
import {newCode} from '../protocol.js';
import {readFile} from 'node:fs/promises';

const wireFixtures=JSON.parse(await readFile(new URL('./fixtures/relay-wire-v1.json',import.meta.url)));
test('el contrato v1 conserva los mismos bytes que las fixtures del backend privado',()=>{
  for(const fixture of wireFixtures){
    const packet=structuredClone(fixture.packet);
    if(packet.message?.type==='file-chunk')packet.message.bytes=Uint8Array.from(packet.message.bytes);
    const encoded=encodeFrame(packet);
    assert.equal(Buffer.from(encoded).toString('hex'),fixture.hex,fixture.name);
    const decoded=decodeFrame(encoded);delete decoded.binary;
    assert.deepEqual(decoded,packet);
  }
});

test('codec compartido conserva Unicode y la porción binaria sin base64',()=>{
  const packet={type:'data',to:'device',message:{type:'text',id:newCode(),text:'PDF de la uni → ñ 😊\n\u0000'}};
  assert.deepEqual(decodeFrame(encodeFrame(packet)).message,packet.message);
  const buffer=new Uint8Array([99,1,2,3,88]);const decoded=decodeFrame(encodeFrame({type:'data',to:'device',message:{type:'file-chunk',id:newCode(),index:0,bytes:buffer.subarray(1,4)}}));
  assert.deepEqual([...decoded.message.bytes],[1,2,3]);assert(encodeFrame(packet).length<200);
});
test('frames inválidos, enormes o payloads sin tipo se rechazan',()=>{
  assert.throws(()=>decodeFrame(new Uint8Array(4)));
  assert.throws(()=>decodeFrame(new Uint8Array(MAX_FRAME+1)));
  const frame=encodeFrame({type:'join'});new DataView(frame.buffer).setUint32(0,10000);assert.throws(()=>decodeFrame(frame));
  const good=encodeFrame({type:'join'}),extra=new Uint8Array(good.length+1);extra.set(good);assert.throws(()=>decodeFrame(extra));
});
test('producción requiere HTTPS/WSS sin credenciales en URL; HTTP solo en loopback',()=>{
  assert.equal(relayAddress('https://drop.example/relay'),'wss://drop.example/relay');
  assert.equal(relayAddress('http://127.0.0.1:8787/relay'),'ws://127.0.0.1:8787/relay');
  for(const url of ['http://public.example/relay','ws://public.example/relay','https://user:secret@drop.example/relay','https://drop.example/relay?token=secret'])assert.throws(()=>relayAddress(url));
});
test('un relay que no abre termina el intento por timeout y no finge conexión',()=>{
  let timeout,closed=0;const errors=[];
  class Socket{addEventListener(){}close(){closed++;}}
  const session=new RelaySession({url:'wss://drop.example/relay',WebSocket:Socket,timers:{setTimeout(fn){timeout=fn;},clearTimeout(){}},onError:reason=>errors.push(reason)});
  session.connect({room:'0012'});timeout();assert.equal(session.open,false);assert.equal(session.closed,true);assert.deepEqual(errors,['timeout']);assert.equal(closed,1);
});
