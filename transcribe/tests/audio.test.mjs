import test from 'node:test';
import assert from 'node:assert/strict';
import { mixChannels, prepareSamples, stats, toSrt, timestamp } from '../audio.mjs';
const wave = (seconds, amplitude, frequency=440) => Float32Array.from({ length:16000*seconds },(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*i/16000));
test('rescues faint speech-band signal without removing samples',()=>{
  const source=wave(2,.003), result=prepareSamples(source);
  assert.equal(result.length,source.length);
  assert.ok(stats(result).rms>stats(source).rms*20);
  assert.ok(stats(result).peak<=.98);
  assert.equal(stats(source).peak,stats(wave(2,.003)).peak);
});
test('preserves pure silence without manufacturing a signal',()=>{
  const result=prepareSamples(new Float32Array(48000));
  assert.equal(stats(result).peak,0); assert.equal(result.length,48000);
});
test('stereo anti-phase does not cancel voices',()=>{
  const left=wave(1,.25), right=Float32Array.from(left,x=>-x);
  assert.ok(stats(mixChannels([left,right])).rms>.1);
});
test('both stereo channels survive normal mixing and manual selection',()=>{
  const left=wave(1,.2), right=wave(1,.2,700);
  assert.ok(stats(mixChannels([left,right])).rms>.09);
  assert.deepEqual(mixChannels([left,right],'right'),right);
});
test('highpass attenuates rumble while retaining voice frequencies',()=>{
  const rumble=wave(1,.2,15), voice=wave(1,.2,1000);
  assert.ok(stats(prepareSamples(rumble,{enhance:false})).rms<stats(rumble).rms*.3);
  assert.ok(stats(prepareSamples(voice,{enhance:false})).rms>stats(voice).rms*.9);
});
test('gain transition stays finite and bounds loud peaks',()=>{
  const source=wave(3,.001); source.set(wave(1,.99),16000);
  const output=prepareSamples(source);
  assert.ok(output.every(Number.isFinite)); assert.ok(stats(output).peak<=.981);
});
test('SRT uses exact timestamps, supports hour-long audio and missing final end',()=>{
  assert.equal(timestamp(3601.125,true),'01:00:01,125');
  assert.equal(toSrt([{timestamp:[0,1.5],text:' Hola '},{timestamp:[1.5,null],text:'Adiós'}],4),'1\n00:00:00,000 --> 00:00:01,500\nHola\n\n2\n00:00:01,500 --> 00:00:04,000\nAdiós\n');
});
