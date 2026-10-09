import { FRAME, RATE, measure, resample } from './core.mjs';
export async function loadVad() {
  const ort=await import('./vendor/ort.wasm-1.22.0.min.mjs');
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
  const session=await ort.InferenceSession.create(new URL('./vendor/silero_vad_v5.onnx',import.meta.url).href,{executionProviders:['wasm'],intraOpNumThreads:1});
  const sr=new ort.Tensor('int64',BigInt64Array.from([16000n]),[]);
  return {makeState:()=>({memory:new Float32Array(256),context:new Float32Array(64)}),async predict(frame,state){
    const withContext=new Float32Array(FRAME+64);withContext.set(state.context);withContext.set(frame,64);const t=new ort.Tensor('float32',withContext,[1,FRAME+64]),s=new ort.Tensor('float32',state.memory,[2,1,128]);let out;
    try{out=await session.run({input:t,state:s,sr});return {probability:Number(out.output.data[0]),state:{memory:Float32Array.from(out.stateN.data),context:frame.slice(-64)}};}
    finally{t.dispose();s.dispose();if(out)for(const tensor of Object.values(out))tensor.dispose();}
  },async dispose(){sr.dispose();await session.release();}};
}
export async function loadDenoise(){const {Rnnoise}=await import('./vendor/rnnoise-2025.1.5.mjs');return Rnnoise.load();}
// RNNoise expects 48 kHz / 480 samples and 16-bit-scaled floats. It has one-frame latency.
// Context on both sides warms each block, then we compensate delay before cropping.
export function denoiseContext(input,rate,engine,intensity=.65){
  const signal=resample(input,rate,48000),state=engine.createDenoiseState(),frame=new Float32Array(480),clean=new Float32Array(signal.length+480);
  try{for(let at=0;at<signal.length+480;at+=480){frame.fill(0);for(let j=0;j<480&&at+j<signal.length;j++)frame[j]=signal[at+j]*32768;state.processFrame(frame);for(let j=0;j<480&&at+j<clean.length;j++)clean[at+j]=frame[j]/32768;}}
  finally{state.destroy();}
  const delayed=clean.subarray(480,480+signal.length),out=new Float32Array(signal.length);
  for(let i=0;i<out.length;i++)out[i]=signal[i]*(1-intensity)+delayed[i]*intensity;
  // Don't silently substitute complete suppression for a nonzero voiced input.
  return {samples:resample(out,48000,RATE),inputRms:measure(signal).rms,outputRms:measure(out).rms};
}
