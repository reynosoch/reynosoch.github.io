import test from 'node:test';
import assert from 'node:assert/strict';
import {createWriter,removeTemp} from '../output.mjs';
import {wavHeader} from '../core.mjs';
test('bounded Blob fallback generates WAV without OPFS and refuses unsafe memory plans',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:{storage:{}},configurable:true});
  try{const writer=await createWriter(32044,{forceBlob:true});await writer.write(new Uint8Array(32000));const result=await writer.finish();assert.equal(result.blob.size,32044);const header=new Uint8Array(await result.blob.slice(0,44).arrayBuffer());assert.deepEqual(header,wavHeader(16000));await assert.rejects(()=>createWriter(200*1024*1024),/160 MB/);await writer.abort();}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('cancellation aborts OPFS writer and removes only its own temporal WAV',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),calls=[];const sync={write:bytes=>bytes.length,close:()=>calls.push('close'),flush:()=>calls.push('flush')};const directory={getFileHandle:async(name)=>{calls.push(name);return{createSyncAccessHandle:async()=>sync};},removeEntry:async name=>calls.push('remove:'+name)};
  Object.defineProperty(globalThis,'navigator',{value:{storage:{estimate:async()=>({quota:1e6,usage:0}),getDirectory:async()=>directory}},configurable:true});
  try{const writer=await createWriter(32044);await writer.write(new Uint8Array(32));const name=writer.tempName;await writer.abort();assert(calls.includes('close'));assert(calls.includes('remove:'+name));const before=calls.length;await removeTemp('other-tool.wav');assert.equal(calls.length,before);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('quota rejection happens before writing audio',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let opened=false;Object.defineProperty(globalThis,'navigator',{value:{storage:{estimate:async()=>({quota:100,usage:90}),getDirectory:async()=>{opened=true;}}},configurable:true});try{await assert.rejects(()=>createWriter(1000),/espacio/);assert.equal(opened,false);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
