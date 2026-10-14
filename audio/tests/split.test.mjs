import test from 'node:test';
import assert from 'node:assert/strict';
import {RATE,wavHeader} from '../core.mjs';
import {planParts,partBlob,partTimeMap,assertArchiveSize,ZIP_LIMIT} from '../split.mjs';

test('split covers every PCM sample exactly once and creates valid standalone WAVs',async()=>{
  const samples=RATE*13+7,pcm=new Uint8Array(samples*2);for(let i=0;i<pcm.length;i++)pcm[i]=i%251;
  const source=new Blob([wavHeader(samples),pcm]),parts=planParts(samples,6),chunks=[];
  assert.equal(parts.length,3);assert.equal(parts[0].startSample,0);assert.equal(parts.at(-1).endSample,samples);
  for(let i=0;i<parts.length;i++){
    const p=parts[i],bytes=new Uint8Array(await partBlob(source,p).arrayBuffer()),v=new DataView(bytes.buffer);
    assert.equal(bytes.length,p.bytes);assert.equal(v.getUint32(40,true),(p.endSample-p.startSample)*2);assert.equal(v.getUint32(24,true),RATE);assert.equal(v.getUint16(22,true),1);
    if(i)assert.equal(parts[i-1].endSample,p.startSample);chunks.push(Buffer.from(bytes.subarray(44)));
  }
  assert.deepEqual(new Uint8Array(Buffer.concat(chunks)),pcm);
});
test('split maps processed boundaries accurately, including removed pauses',()=>{
  const map=[{outputStart:0,outputEnd:5,originalStart:2,originalEnd:7,type:'speech'},{outputStart:5,outputEnd:10,originalStart:20,originalEnd:25,type:'speech'}];
  assert.deepEqual(partTimeMap(map,{start:3,end:5}),[{outputStart:0,outputEnd:2,originalStart:5,originalEnd:7,type:'speech'}]);
  assert.deepEqual(partTimeMap(map,{start:4,end:7}),[{outputStart:0,outputEnd:1,originalStart:6,originalEnd:7,type:'speech'},{outputStart:1,outputEnd:3,originalStart:20,originalEnd:22,type:'speech'}]);
});
test('rejects invalid duration, too many parts and oversized ZIPs',()=>{
  for(const value of [0,NaN,Infinity,3601])assert.throws(()=>planParts(RATE,value));
  assert.throws(()=>planParts(RATE*201,1));assert.throws(()=>planParts(1.5,6));assert.throws(()=>partBlob(new Blob(['short']),planParts(RATE,6)[0]));
  assert.throws(()=>assertArchiveSize([]));assert.throws(()=>assertArchiveSize([{bytes:ZIP_LIMIT+1}]));assert.doesNotThrow(()=>assertArchiveSize([{bytes:ZIP_LIMIT}]));
});
