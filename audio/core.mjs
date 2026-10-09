// Pure, bounded DSP and timeline contracts. All times are seconds, amplitudes [-1,1].
export const RATE=16000, BLOCK=10, FRAME=512;
export const PRESETS={fast:{denoise:false,highpass:false,normalize:true,compress:false},balanced:{denoise:true,highpass:true,normalize:true,compress:true},quality:{denoise:true,highpass:true,normalize:true,compress:true}};
export function settingsFor(preset='balanced',extra={}) {
  return {...PRESETS[preset]||PRESETS.balanced,preset,channel:'auto',silence:'balanced',intensity:.65,...extra};
}
export function measure(samples) {
  let sum=0,peak=0,clipped=0;
  for(const x of samples){sum+=x*x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=.999)clipped++;}
  return {energy:sum,samples:samples.length,peak,clipped,rms:Math.sqrt(sum/Math.max(1,samples.length))};
}
export const db=value=>value>0?20*Math.log10(value):-120;
// Windowed-sinc anti-aliasing, bounded to the current block. Kernel reused by phase.
export function resample(input,from,to=RATE) {
  if(from===to)return input;
  const ratio=from/to,length=Math.round(input.length/ratio),out=new Float32Array(length);
  const radius=Math.ceil(12*Math.max(1,ratio)),cutoff=.92/Math.max(1,ratio),cache=new Map();
  for(let i=0;i<length;i++) {
    const position=i*ratio,center=Math.floor(position),fraction=Math.round((position-center)*1024)/1024;
    let weights=cache.get(fraction);
    if(!weights){weights=new Float32Array(radius*2+1);let sum=0;
      for(let k=-radius;k<=radius;k++){const x=k-fraction,y=Math.PI*x*cutoff,w=Math.abs(x)<=radius?.5+.5*Math.cos(Math.PI*x/radius):0;const v=(Math.abs(y)<1e-9?1:Math.sin(y)/y)*w*cutoff;weights[k+radius]=v;sum+=v;}
      for(let j=0;j<weights.length;j++)weights[j]/=sum;cache.set(fraction,weights);
    }
    let sum=0;for(let k=-radius;k<=radius;k++)sum+=(input[Math.max(0,Math.min(input.length-1,center+k))]||0)*weights[k+radius];out[i]=sum;
  }
  return out;
}
export function mergeSegments(segments,duration,pre=.35,tail=.65) {
  const result=[];
  for(const s of [...segments].sort((a,b)=>a.start-b.start)) {
    if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<=s.start)continue;
    const next={start:Math.max(0,s.start-pre),end:Math.min(duration,s.end+tail),confidence:Math.max(0,Math.min(1,s.confidence??0))};
    if(next.end<=next.start)continue;
    const last=result.at(-1);
    if(last&&next.start<=last.end+.08){last.end=Math.max(last.end,next.end);last.confidence=Math.max(last.confidence,next.confidence);}else result.push(next);
  }
  return result;
}
export class SpeechTracker {
  constructor(){this.segments=[];this.active=null;this.pending=null;}
  push(probability,start,end) {
    if(probability>=.35){if(!this.active)this.active={start,end,confidence:probability};this.active.end=end;this.active.confidence=Math.max(this.active.confidence,probability);this.pending=null;}
    else if(this.active&&probability<.2){this.pending??=start;if(end-this.pending>=.48){this.close();}}
    else if(this.active){this.active.end=end;this.pending=null;}
  }
  close(){if(this.active){if(this.active.end-this.active.start>=.096)this.segments.push(this.active);this.active=null;this.pending=null;}}
  finish(){this.close();return this.segments;}
}
export function makeTimeMap(speech,duration,mode='balanced') {
  if(!(duration>0&&duration<=14400))throw new Error('Duración no válida.');
  const rules={off:[Infinity,0],conservative:[3,.8],balanced:[1.5,.5],aggressive:[.9,.3]};
  const [threshold,keep]=rules[mode]||rules.balanced,regions=mergeSegments(speech,duration);
  // No confident speech: preserve everything rather than destroying a quiet meeting.
  if(!regions.length||mode==='off')return [{outputStart:0,outputEnd:duration,originalStart:0,originalEnd:duration,type:'preserved'}];
  const spans=[];let original=0,output=0;
  function add(start,end,type){if(end-start<1/RATE)return;const length=Math.round((end-start)*RATE)/RATE;spans.push({outputStart:output,outputEnd:output+length,originalStart:start,originalEnd:start+length,type});output+=length;}
  function gap(start,end){if(end-start<=threshold){add(start,end,'pause');return;}add(start,start+keep/2,'pause');add(end-keep/2,end,'pause');}
  for(const segment of regions){gap(original,segment.start);add(segment.start,segment.end,'speech');original=segment.end;}gap(original,duration);
  validateTimeMap(spans,duration);return spans;
}
export function validateTimeMap(map,duration=14400) {
  if(!Array.isArray(map)||!map.length||map.length>100000)throw new Error('Mapa vacío o demasiado grande.');
  let output=0,original=0;
  for(const s of map){if(![s.outputStart,s.outputEnd,s.originalStart,s.originalEnd].every(Number.isFinite)||Math.abs(s.outputStart-output)>2/RATE||s.originalStart<original-2/RATE||s.originalStart<0||s.originalEnd>duration+2/RATE||s.outputEnd<=s.outputStart||s.originalEnd<=s.originalStart||Math.abs((s.outputEnd-s.outputStart)-(s.originalEnd-s.originalStart))>2/RATE)throw new Error('Mapa de tiempo no monotónico.');output=s.outputEnd;original=s.originalEnd;}
  return output;
}
export function outputToOriginal(time,map){validateTimeMap(map);const s=map.find(s=>time<s.outputEnd)||map.at(-1);return Math.max(s.originalStart,Math.min(s.originalEnd,s.originalStart+time-s.outputStart));}
export function originalToOutput(time,map){validateTimeMap(map);const s=map.find(s=>time<s.originalEnd)||map.at(-1);return Math.max(s.outputStart,Math.min(s.outputEnd,s.outputStart+time-s.originalStart));}
export function channelScore(c){const speechRms=Math.sqrt(c.speechEnergy/Math.max(1,c.speechSamples));const noiseRms=c.noiseFloorRms??Math.sqrt(c.noiseEnergy/Math.max(1,c.noiseSamples));return c.speechSeconds*(1-Math.min(.8,c.clipped/Math.max(1,c.samples)*20))*(1+Math.max(0,Math.min(30,db(speechRms)-db(noiseRms)))/30);}
export function chooseChannel(channels){const scores=channels.map(channelScore);let best=scores.indexOf(Math.max(...scores));if(scores[best]<(scores[0]||0)*1.2)best=0;return best;}
export function safeMix(planes){if(planes.length===1)return planes[0];let a=0,b=0,c=0;for(let i=0;i<planes[0].length;i++){a+=planes[0][i]**2;b+=planes[1][i]**2;c+=planes[0][i]*planes[1][i];}if(c/(Math.sqrt(a*b)||1)<-.5)return planes[a>=b?0:1];const result=new Float32Array(planes[0].length);for(const plane of planes)for(let i=0;i<result.length;i++)result[i]+=plane[i]/planes.length;return result;}
export function gainFor(rms){return Math.min(12.59,Math.max(.25,.115/Math.max(rms,.0001)));}
export const limit=x=>Math.max(-.89125,Math.min(.89125,Number.isFinite(x)?x:0));
export class VoiceDSP {
  constructor(settings){this.settings=settings;this.x=0;this.y=0;this.gain=1;this.envelope=0;}
  process(samples,voiced=true) {
    const out=new Float32Array(samples.length),alpha=RATE/(RATE+2*Math.PI*70);
    const filtered=new Float32Array(samples.length);
    for(let i=0;i<samples.length;i++){const x=samples[i];this.y=alpha*(this.y+x-this.x);this.x=x;filtered[i]=this.settings.highpass?this.y:x;}
    for(let at=0;at<filtered.length;at+=1600){const frame=filtered.subarray(at,at+1600);const target=this.settings.normalize&&voiced?gainFor(measure(frame).rms):1;
      for(let j=0;j<frame.length;j++){this.gain+=(target-this.gain)*.00025;let x=frame[j]*this.gain;
        if(this.settings.compress){this.envelope+=(Math.abs(x)-this.envelope)*(Math.abs(x)>this.envelope?.008:.0003);const reduction=this.envelope>.22?Math.pow(.22/this.envelope,.65):1;x*=reduction;}out[at+j]=limit(x);}
    }
    return out;
  }
}
export function pcm16(samples,fadeIn=false,fadeOut=false){const bytes=new Uint8Array(samples.length*2),v=new DataView(bytes.buffer),fade=80;for(let i=0;i<samples.length;i++){const edge=Math.min(fadeIn?i/fade:1,fadeOut?(samples.length-1-i)/fade:1,1);v.setInt16(i*2,Math.round(limit(samples[i])*Math.max(0,edge)*32767),true);}return bytes;}
export function wavHeader(samples,rate=RATE){const b=new Uint8Array(44),v=new DataView(b.buffer),t=(at,s)=>{for(let i=0;i<s.length;i++)b[at+i]=s.charCodeAt(i);};t(0,'RIFF');v.setUint32(4,36+samples*2,true);t(8,'WAVE');t(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);t(36,'data');v.setUint32(40,samples*2,true);return b;}
export function longAudioPlan(duration,channels=2){return {blocks:Math.ceil(duration/BLOCK),maxPcmSamples:Math.ceil((BLOCK+.5)*192000)*Math.min(channels,8),outputBytes:Math.ceil(duration*RATE)*2+44};}
