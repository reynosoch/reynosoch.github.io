import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCode,newRoomCode,parseCode,formatCode,deviceName,trustedReconnect,validOffer,safeName,digest,FileReceiver,CHUNK_SIZE,MAX_FILE,MAX_MEMORY} from '../protocol.js';
test('códigos aleatorios y enlaces conservan la sala sin aceptar contenido arbitrario', () => {
  const code = newCode(); assert.match(code,/^[a-f0-9]{24}$/); assert.notEqual(code,newCode());
  assert.equal(parseCode(formatCode(code).toUpperCase()),code); assert.equal(parseCode(`https://reynosoch.github.io/drop/#${code}`),code);
  assert.equal(parseCode('<script>alert(1)</script>'),null);
});
test('salas de cuatro números conservan ceros, admiten escritura manual y enlaces', () => {
  for(let i=0;i<100;i++) assert.match(newRoomCode(), /^\d{4}$/);
  assert.equal(formatCode('0012'),'0012'); assert.equal(parseCode('00 12'),'0012');
  assert.equal(parseCode('00-12'),'0012'); assert.equal(parseCode('https://reynosoch.github.io/drop/#0012'),'0012');
  for(const bad of ['123','12345','123456','12a4','00000000']) assert.equal(parseCode(bad),null);
});
test('la reconexión solo confía en la identidad larga aprobada, no en el código corto', () => {
  const token=newCode(); assert.equal(trustedReconnect(token,token),true);
  assert.equal(trustedReconnect(token,newCode()),false); assert.equal(trustedReconnect(null,token),false);
  assert.equal(trustedReconnect('123456','123456'),false);
  assert.equal(deviceName('  Laptop personal\n\u0000  '),'Laptop personal'); assert.equal(deviceName(null),'Otro dispositivo');
  assert.equal(deviceName('a'.repeat(100)).length,40);
});
test('ofertas limitan memoria, tamaños e identificadores; nombres no atraviesan rutas', async () => {
  const base = {id:newCode(),name:'demo.txt',size:0,hash:await digest(new ArrayBuffer(0))};
  assert.equal(validOffer(base),true);
  for (const size of [-1,NaN,Infinity,MAX_FILE+1,1.5]) assert.equal(validOffer({...base,size}),false);
  assert.equal(validOffer({...base,size:1},MAX_MEMORY),false); assert.equal(validOffer({...base,id:'bad'}),false);
  assert.equal(safeName('../a\\b\u0000.txt'),'.._a_b_.txt');
});
test('transferencia binaria en bloques devuelve exactamente los bytes originales', async () => {
  const bytes = new Uint8Array(CHUNK_SIZE*2+31); for (let i=0;i<bytes.length;i++) bytes[i]=i%251;
  const offer = {id:newCode(),name:'test.bin',size:bytes.length,hash:await digest(bytes.buffer)};
  const receiver = new FileReceiver(offer);
  let index=0; for(let i=0;i<bytes.length;i+=CHUNK_SIZE) receiver.append({id:offer.id,index:index++,bytes:bytes.slice(i,i+CHUNK_SIZE).buffer});
  assert.deepEqual(new Uint8Array(await (await receiver.finish()).arrayBuffer()),bytes);
});
test('rechaza bloques fuera de orden, corruptos, extra y archivos incompletos', async () => {
  const bytes = new Uint8Array([1,2,3]); const offer={id:newCode(),name:'test',size:3,hash:await digest(bytes.buffer)};
  const r = new FileReceiver(offer); assert.throws(()=>r.append({id:offer.id,index:1,bytes:bytes.buffer}));
  await assert.rejects(r.finish(),/incompleto/);
  assert.throws(()=>r.append({id:offer.id,index:0,bytes:new ArrayBuffer(4)}));
  r.append({id:offer.id,index:0,bytes:new Uint8Array([4,5,6]).buffer}); await assert.rejects(r.finish(),/dañado/);
  assert.throws(()=>r.append({id:offer.id,index:1,bytes:bytes.buffer}));
});
test('archivos vacíos también se verifican', async () => {
  const r=new FileReceiver({id:newCode(),name:'empty.txt',size:0,hash:await digest(new ArrayBuffer(0))}); assert.equal((await r.finish()).size,0);
});

test('la captura viaja por BinaryPack de PeerJS y conserva los bytes en bloques grandes', async () => {
  const {peerRoundTrip}=await import('./helpers/peer-codec.js');
  const bytes=new Uint8Array(CHUNK_SIZE*2+19); for(let i=0;i<bytes.length;i++) bytes[i]=i%251;
  bytes.set([137,80,78,71,13,10,26,10]);
  const offer={id:newCode(),name:'captura.png',size:bytes.length,hash:await digest(bytes.buffer)};
  const receiver=new FileReceiver(await peerRoundTrip(offer));
  let index=0;
  for(let offset=0;offset<bytes.length;offset+=CHUNK_SIZE){
    const decoded=await peerRoundTrip({id:offer.id,index:index++,bytes:bytes.slice(offset,offset+CHUNK_SIZE).buffer});
    assert.equal(ArrayBuffer.isView(decoded.bytes),true); receiver.append(decoded);
  }
  assert.deepEqual(new Uint8Array(await (await receiver.finish()).arrayBuffer()),bytes);
});
test('solo conserva la porción de una vista binaria y acepta ArrayBuffer de otro contexto', async () => {
  const {runInNewContext}=await import('node:vm');
  const bytes=new Uint8Array([1,2,3]), offer={id:newCode(),name:'archivo',size:3,hash:await digest(bytes.buffer)};
  for(const view of [new Uint8Array([99,1,2,3,99]).subarray(1,4),new DataView(new Uint8Array([99,1,2,3,99]).buffer,1,3),runInNewContext('new Uint8Array([1,2,3]).buffer')]){
    const r=new FileReceiver(offer); r.append({id:offer.id,index:0,bytes:view});
    assert.deepEqual(new Uint8Array(await (await r.finish()).arrayBuffer()),bytes);
  }
  for(const invalid of [null,[1,2,3],{byteLength:3},'123',new Uint8Array(2),new Uint8Array(4)]){
    assert.throws(()=>new FileReceiver(offer).append({id:offer.id,index:0,bytes:invalid}),/Bloque/);
  }
  const source=new Uint8Array([1,2,3]), owned=new FileReceiver(offer);owned.append({id:offer.id,index:0,bytes:source});source.fill(0);
  assert.deepEqual(new Uint8Array(await (await owned.finish()).arrayBuffer()),bytes);
});
