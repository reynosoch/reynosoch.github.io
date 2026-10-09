import {openReader} from './reader.mjs';
import {loadVad,loadDenoise,denoiseContext} from './engines.mjs';
import {RATE,BLOCK,FRAME,SpeechTracker,measure,resample,chooseChannel,safeMix,makeTimeMap,validateTimeMap,VoiceDSP,pcm16,db} from './core.mjs';
import {fileIdentity} from '../transcribe/session.mjs?v=2.0.1';
import {createWriter} from './output.mjs';
let source=null,vad=null,noise=null,analysis=null,file=null,writer=null,sessionScope='';
const send=(type,data={})=>postMessage({type,...data});
function channelStats(){return {energy:0,samples:0,peak:0,clipped:0,speechEnergy:0,speechSamples:0,noiseEnergy:0,noiseSamples:0,speechSeconds:0,peaks:[],segments:[]};}
async function analyze(settings){
  send('progress',{stage:'Cargando detector de voz',percent:0,completed:0,duration:source.duration});vad=await loadVad();
  const count=source.channels,states=Array.from({length:count},()=>vad.makeState()),tails=Array.from({length:count},()=>new Float32Array()),trackers=Array.from({length:count},()=>new SpeechTracker()),totals=Array.from({length:count},channelStats),positions=new Array(count).fill(0),lastGains=new Array(count).fill(1);
  for(let start=0;start<source.duration;start+=BLOCK){const end=Math.min(source.duration,start+BLOCK),planes=await source.read(start,end);
    for(let c=0;c<count;c++){const samples=resample(planes[c],source.rate);const stats=measure(samples),total=totals[c];total.energy+=stats.energy;total.samples+=stats.samples;total.peak=Math.max(total.peak,stats.peak);total.clipped+=stats.clipped;const detectorGain=Math.min(31.62,.1/Math.max(stats.rms,.0001));lastGains[c]=detectorGain;
      for(let at=0;at<samples.length;at+=1600){const p=measure(samples.subarray(at,at+1600));total.peaks.push({time:start+at/RATE,peak:p.peak,rms:p.rms});}
      const joined=new Float32Array(tails[c].length+samples.length);joined.set(tails[c]);joined.set(samples,tails[c].length);
      let at=0;for(;at+FRAME<=joined.length;at+=FRAME){const raw=joined.subarray(at,at+FRAME),frame=raw.slice(),r=measure(raw),boost=detectorGain;for(let j=0;j<frame.length;j++)frame[j]=Math.max(-1,Math.min(1,frame[j]*boost));
        const result=await vad.predict(frame,states[c]);states[c]=result.state;const time=positions[c]/RATE;trackers[c].push(result.probability,time,time+FRAME/RATE);positions[c]+=FRAME;
        if(result.probability>=.35){total.speechEnergy+=r.energy;total.speechSamples+=FRAME;total.speechSeconds+=FRAME/RATE;}else if(result.probability<.2){total.noiseEnergy+=r.energy;total.noiseSamples+=FRAME;}
      }tails[c]=joined.slice(at);
    }
    send('progress',{stage:'Analizando canales y voz · Silero',percent:end/source.duration*100,completed:end,duration:source.duration,segments:trackers.reduce((n,t)=>n+t.segments.length,0)});
  }
  for(let c=0;c<count;c++){if(tails[c].length){const f=new Float32Array(FRAME);f.set(tails[c]);const r=measure(f);const boost=lastGains[c];for(let j=0;j<f.length;j++)f[j]*=boost;const p=await vad.predict(f,states[c]);trackers[c].push(p.probability,positions[c]/RATE,source.duration);}totals[c].segments=trackers[c].finish();totals[c].rms=Math.sqrt(totals[c].energy/Math.max(1,totals[c].samples));totals[c].speechSeconds=totals[c].segments.reduce((n,s)=>n+s.end-s.start,0);const quiet=totals[c].peaks.map(p=>p.rms).sort((a,b)=>a-b);totals[c].noiseFloorRms=quiet[Math.floor(quiet.length*.15)]||0;totals[c].noiseDb=db(totals[c].noiseFloorRms);}
  await vad.dispose();vad=null;
  const recommended=chooseChannel(totals);analysis={version:1,duration:source.duration,rate:source.rate,channels:count,codec:source.codec,recommended,channelStats:totals,speakers:{available:false,reason:'Diarización no validada en navegador'},method:'Silero V5 · 512 muestras · 16 kHz; RMS y ruido orientativos, no LUFS'};send('progress',{stage:'Verificando identidad del archivo',percent:100,completed:source.duration,duration:source.duration});const identity=await fileIdentity(file);send('analysis',{analysis,settings,identity});
}
async function prepare(settings,range){
  if(!analysis)throw new Error('Analiza primero el archivo.');
  const channel=settings.channel==='right'?Math.min(1,source.channels-1):settings.channel==='left'?0:analysis.recommended;
  // Mixing uses the union of actual speech in all channels, never one channel's cuts.
  const speech=settings.channel==='mix'?analysis.channelStats.flatMap(c=>c.segments):analysis.channelStats[channel].segments;
  const start=range?.start??0,end=range?.end??source.duration;
  let map=makeTimeMap(speech,source.duration,range?'off':settings.silence);
  if(range)map=[{outputStart:0,outputEnd:end-start,originalStart:start,originalEnd:end,type:'preview'}];
  const outputDuration=range?end-start:validateTimeMap(map,source.duration);
  let denoise=settings.denoise,warnings=[];
  if(denoise&&!noise){send('progress',{stage:'Cargando reducción de ruido · RNNoise',percent:0,completed:0,duration:end-start});try{noise=await loadDenoise();}catch(error){denoise=false;warnings.push('RNNoise no disponible. Continuamos con nivelado, filtros y silencios. '+error.message);send('warning',{message:warnings.at(-1)});}}
  writer=await createWriter(Math.ceil(outputDuration*RATE)*2+44,{scope:sessionScope});send('tempfile',{name:writer.tempName});const storage=writer.storage,dsp=new VoiceDSP(settings);let outputPeak=0,totalSamples=0,mapAt=0;const outputPeaks=[];let peakCarry=[],peakTime=0;
  for(let blockStart=start;blockStart<end;blockStart+=BLOCK){const blockEnd=Math.min(end,blockStart+BLOCK);const contextStart=denoise?Math.max(0,blockStart-.25):blockStart,contextEnd=denoise?Math.min(source.duration,blockEnd+.04):blockEnd;
    const planes=await source.read(contextStart,contextEnd),mono=settings.channel==='mix'?safeMix(planes):planes[channel];let samples;
    if(denoise){const clean=denoiseContext(mono,source.rate,noise,settings.intensity);samples=clean.samples;}else samples=resample(mono,source.rate);
    const offset=Math.round((blockStart-contextStart)*RATE),length=Math.round((blockEnd-blockStart)*RATE);samples=samples.subarray(offset,offset+length);
    // DSP covers all decoded time, keeping envelope/filter state across source blocks.
    // Adaptive gain is gated by padded speech: no gain boost in unrelated background.
    const processed=new Float32Array(samples.length);
    for(let at=0;at<samples.length;at+=1600){const t=blockStart+at/RATE,voiced=speech.some(s=>t+.1>=s.start-.35&&t<=s.end+.65);processed.set(dsp.process(samples.subarray(at,at+1600),voiced),at);}
    while(mapAt<map.length&&map[mapAt].originalEnd<=blockStart+.000001)mapAt++;
    for(let i=mapAt;i<map.length&&map[i].originalStart<blockEnd;i++){const span=map[i],a=Math.max(blockStart,span.originalStart),b=Math.min(blockEnd,span.originalEnd);if(b<=a)continue;
      const segment=processed.subarray(Math.round((a-blockStart)*RATE),Math.round((b-blockStart)*RATE));
      const cutBefore=i>0&&span.originalStart-map[i-1].originalEnd>1/RATE,cutAfter=i<map.length-1&&map[i+1].originalStart-span.originalEnd>1/RATE;
      const encoded=pcm16(segment,cutBefore&&Math.abs(a-span.originalStart)<1/RATE,cutAfter&&Math.abs(b-span.originalEnd)<1/RATE);await writer.write(encoded);totalSamples+=segment.length;
      for(let j=0;j<segment.length;j++){outputPeak=Math.max(outputPeak,Math.abs(segment[j]));peakCarry.push(segment[j]);if(peakCarry.length===1600){const p=measure(peakCarry);outputPeaks.push({time:peakTime,peak:p.peak,rms:p.rms});peakTime+=.1;peakCarry=[];}}
    }
    send('progress',{stage:denoise?'Reduciendo ruido · nivelando voces · comprimiendo pausas':'Nivelando voces · comprimiendo pausas',percent:(blockEnd-start)/(end-start)*100,completed:blockEnd-start,duration:end-start,resultDuration:outputDuration,segments:speech.length});
  }
  if(peakCarry.length){const p=measure(peakCarry);outputPeaks.push({time:peakTime,peak:p.peak,rms:p.rms});}
  const result=await writer.finish();writer=null;
  send(range?'preview':'result',{...result,timeMap:map,analysis:range?undefined:analysis,metrics:{originalDuration:end-start,outputDuration:totalSamples/RATE,removed:end-start-totalSamples/RATE,outputPeak,inputPeak:analysis.channelStats[channel].peak,channel:settings.channel==='mix'?'Mono combinado · protección de contrafase':channel===0?'Izquierdo / mono':'Canal '+(channel+1),denoise,storage,warnings},peaks:outputPeaks,settings});
}
onmessage=async({data})=>{try{if(data.scope)sessionScope=data.scope;if(data.type==='open'){file=data.file;source=await openReader(file,{allowMp3:data.allowMp3});send('metadata',{metadata:{duration:source.duration,rate:source.rate,channels:source.channels,codec:source.codec}});await analyze(data.settings);}else if(data.type==='prepare')await prepare(data.settings);else if(data.type==='preview')await prepare(data.settings,data.range);else if(data.type==='restore'){file=data.file;const identity=await fileIdentity(file);if(data.identity&&identity!==data.identity)throw new Error('El archivo no coincide con el análisis guardado. Selecciona el original o vuelve a analizar.');source=await openReader(file,{allowMp3:data.allowMp3});analysis=data.analysis;send('analysis',{analysis,identity,restored:true});}else if(data.type==='dispose'){source?.dispose();await vad?.dispose();await writer?.abort();close();}}
catch(error){await writer?.abort();writer=null;source?.dispose();source=null;await vad?.dispose().catch(()=>{});vad=null;send('error',{message:error.message,mp3:error.mp3,name:error.name});}};
