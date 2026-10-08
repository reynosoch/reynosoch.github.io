import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openAudioSource } from '../media.mjs';
import { fileIdentity } from '../session.mjs';

test('Pages audio reader opens PCM and seeks without CDN or whole-file decoding', async () => {
  const rate=16000, seconds=40;
  const bytes=new Uint8Array(44+rate*seconds*2), view=new DataView(bytes.buffer);
  const text=(at,value)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};
  text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,bytes.length-44,true);
  for(let i=0;i<rate*seconds;i++)view.setInt16(44+i*2,i<rate*20?8192:-8192,true);
  const file=new File([bytes],'meeting.wav',{type:'audio/wav'});
  file.arrayBuffer=()=>{throw new Error('Whole-file decoding forbidden');};
  const source=await openAudioSource(file);
  try {
    assert.equal(source.duration,seconds);
    const first=await source.read(0,20),last=await source.read(20,40);
    assert.equal(first.mono.length,320000);assert.equal(last.mono.length,320000);
    assert.ok(Math.abs(first.mono[100]-.25)<.001);assert.ok(Math.abs(last.mono[100]+.25)<.001);
  } finally {source.dispose();}
});

test('Pages SHA-256 WASM hashes all file chunks without a CDN', async () => {
  const bytes=new Uint8Array(2*1024*1024+17);bytes[0]=67;bytes[bytes.length-1]=7;
  const file=new File([bytes],'meeting.m4a');
  file.arrayBuffer=()=>{throw new Error('Whole-file allocation forbidden');};
  assert.equal(await fileIdentity(file),`${bytes.length}:${createHash('sha256').update(bytes).digest('hex')}`);
});

test('Pages MP3 decoder initializes its embedded WASM and keeps the public decode contract', async () => {
  const { MPEGDecoder }=await import('../vendor/mpg123-decoder-1.0.3.min.mjs');
  const decoder=new MPEGDecoder();await decoder.ready;
  try {
    const result=decoder.decode(new Uint8Array());
    assert.deepEqual(result.errors,[]);assert.equal(result.samplesDecoded,0);
    assert.equal(result.channelData.length,2);
  } finally {decoder.free();}
});
