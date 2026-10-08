import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import { audioPlan, windowAt, estimatedRemaining, fileIdentity, validateCheckpoint, SESSION_VERSION } from '../session.mjs';
import { WhisperSession, decodeHistory } from '../asr-engine.mjs';
test('short clips use a small plan; every frame of an hour is covered with consistent strides',()=>{
  assert.equal(audioPlan(30).model,'tiny');assert.equal(audioPlan(30).count,1);
  assert.equal(audioPlan(3600).model,'base');assert.equal(audioPlan(3600).count,180);
  for(const duration of [0.5,30,30.0001,60,3600,3601,14400]) {
    const plan=audioPlan(duration);let covered=0;
    for(let index=0;index<plan.count;index++) {
      const part=windowAt(plan,index);
      assert.ok(Math.abs(part.start+part.left-covered)<1e-8);
      assert.ok(part.end-part.start<=30);covered=part.completed;
    }
    assert.equal(covered,duration);
  }
  assert.equal(audioPlan(3600,'small').model,'small');assert.throws(()=>audioPlan(14401));
});
test('ETA measures work since resume without counting time spent paused',()=>{
  assert.equal(estimatedRemaining(10,25,3600),1430);
  assert.equal(estimatedRemaining(10,20,100),40);
  assert.equal(estimatedRemaining(0,0,3600),null);
});
test('file recovery hashes all bytes in bounded blocks and rejects a changed middle',async()=>{
  const file=new File([new Uint8Array(200000)],'junta.m4a');
  file.arrayBuffer=()=>{throw new Error('Whole-file allocation forbidden');};
  const key=await fileIdentity(file,{hasher:createHash('sha256')});
  assert.equal(key,await fileIdentity(new File([new Uint8Array(200000)],'renamed.m4a'),{hasher:createHash('sha256')}));
  const bytes=new Uint8Array(200000);bytes[100000]=1;
  assert.notEqual(key,await fileIdentity(new File([bytes],'junta.m4a'),{hasher:createHash('sha256')}));
});
test('checkpoint validates model, window ordering and token history before resuming',()=>{
  const record={version:SESSION_VERSION,identity:'123:hash',duration:60,next:1,text:'Hola',options:{model:'base',device:'wasm',language:'spanish',channel:'mix'},segments:[],history:[{tokens:[1,2],stride:[30,0,5]}]};
  assert.equal(validateCheckpoint(record),true);
  for(const change of [{next:2},{version:99},{options:{...record.options,model:'unknown'}},{history:[{tokens:[1],stride:[30,5,5]}]}]) assert.equal(validateCheckpoint({...record,...change}),false);
});
test('failed inference never commits a partial window; digital silence still advances timestamps',async()=>{
  let allocations=0;
  const pipe={processor:async()=>{allocations++;throw new Error('Out of memory');},model:{config:{max_source_positions:1500}},tokenizer:{_decode_asr:history=>['',{chunks:[],elapsed:history.reduce((sum,c)=>sum+c.stride[0]-c.stride[1]-c.stride[2],0)}]}};
  pipe.processor.feature_extractor={config:{chunk_length:30,hop_length:160}};
  const session=new WhisperSession(pipe,{language:'spanish',enhance:true,highpass:true});
  const first=windowAt(audioPlan(60),0);
  await assert.rejects(session.process(new Float32Array(480000).fill(.001),first),/Out of memory/);
  assert.equal(session.history.length,0);
  const result=await session.process(new Float32Array(480000),first);
  assert.equal(result.silent,true);assert.equal(result.history.length,1);assert.equal(allocations,1);
  await assert.rejects(session.process(new Float32Array(480000),first),/fuera de orden/);
  const restored=new WhisperSession(pipe,{language:'spanish'},result.history);
  assert.equal(restored.history.length,1);assert.notEqual(restored.history,result.history);
});
test('digital gaps separate repeated phrases and keep their real global times',()=>{
  const calls=[];
  const pipe={processor:{feature_extractor:{config:{chunk_length:30}}},model:{config:{max_source_positions:1500}},tokenizer:{_decode_asr:history=>{
    calls.push(history);return ['Hola otra vez',{chunks:[{text:'Hola otra vez',timestamp:[0,10]}]}];
  }}};
  const voiced={tokens:[1],stride:[30,0,5],silent:false};
  const silent={tokens:[],stride:[30,5,5],silent:true};
  const resumed={tokens:[1],stride:[20,5,0],is_last:true,silent:false};
  const output=decodeHistory(pipe,[voiced,silent,resumed]);
  assert.equal(output.text,'Hola otra vez Hola otra vez');
  assert.deepEqual(output.chunks.map(segment=>segment.timestamp),[[0,10],[40,50]]);
  assert.equal(calls[0][0].stride[2],0);
  assert.equal(calls[1][0].stride[1],0);
  assert.deepEqual(voiced.stride,[30,0,5]);
});
