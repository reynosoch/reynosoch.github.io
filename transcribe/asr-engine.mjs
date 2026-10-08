import { prepareSamples, stats, SAMPLE_RATE } from './audio.mjs';
// Empty digital windows must close an unfinished phrase. Otherwise Whisper's
// overlap merge can collapse repeated speech across a long silent gap.
export function decodeHistory(pipeline,history) {
  const precision=pipeline.processor.feature_extractor.config.chunk_length/pipeline.model.config.max_source_positions;
  const groups=[];let current=null,covered=0;
  for(let index=0;index<history.length;index++) {
    const chunk=history[index],start=covered-chunk.stride[1];
    covered+=chunk.stride[0]-chunk.stride[1]-chunk.stride[2];
    if(chunk.silent) {if(current) {current.closed=true;groups.push(current);current=null;}continue;}
    if(!current) current={start,covered,chunks:[],firstSignal:start+(chunk.signalStart??0)};
    current.chunks.push(chunk);current.covered=covered;current.lastSignal=start+(chunk.signalEnd??chunk.stride[0]);
    if(chunk.is_last) current.closed=true;
  }
  if(current) groups.push(current);
  const texts=[],chunks=[];
  for(const group of groups) {
    const windows=group.chunks.map(chunk=>({...chunk,stride:[...chunk.stride]}));
    windows[0].stride[1]=0;
    if(group.closed) windows.at(-1).stride[2]=0;
    const [text,extra]=pipeline.tokenizer._decode_asr(windows,{time_precision:precision,return_timestamps:true,force_full_sequences:false});
    if(text.trim()) texts.push(text.trim());
    const last=group.chunks.at(-1);
    const endLimit=Math.min(group.lastSignal,group.covered+(group.closed?last.stride[2]:0));
    for(const segment of extra.chunks||[]) {
      if(!segment.text.trim()) continue;
      const start=Math.max(Math.min(group.firstSignal,endLimit),Math.min(endLimit,group.start+(segment.timestamp[0]??0)));
      const end=Math.max(start,Math.min(endLimit,segment.timestamp[1]===null?endLimit:group.start+segment.timestamp[1]));
      if(end>start) chunks.push({text:segment.text,timestamp:[start,end]});
    }
  }
  return {text:texts.join(' '),chunks};
}
// Follow Transformers.js 3.8.1's Whisper striding/token merge, but allocate
// features for ONE window at a time instead of all windows of an hour.
// _decode_asr is version-bound; upgrade it only with real seam/resume tests.
export class WhisperSession {
  constructor(pipeline,options,history=[]) { this.pipeline=pipeline;this.options=options;this.history=structuredClone(history); }
  async process(samples,window) {
    if(window.index!==this.history.length) throw new Error('Fragmento fuera de orden; reanuda desde el último terminado.');
    if(samples.length===0||samples.length>31*SAMPLE_RATE) throw new Error('Tamaño de fragmento no válido.');
    const signal=stats(samples);
    if(!Number.isFinite(signal.peak)) throw new Error('El fragmento contiene muestras de audio no válidas.');
    let tokens=[];
    if(signal.peak>0) {
      const prepared=prepareSamples(samples,this.options);
      const features=await this.pipeline.processor(prepared);let generated;
      try {
        const options={task:'transcribe',return_timestamps:true,do_sample:false,
          num_frames:Math.floor(samples.length/this.pipeline.processor.feature_extractor.config.hop_length)};
        if(this.options.language!=='auto') options.language=this.options.language;
        generated=await this.pipeline.model.generate({inputs:features.input_features,...options});
        tokens=generated.tolist()[0].map(Number);
      } finally { generated?.dispose?.();features.input_features?.dispose?.(); }
    }
    let first=0,last=samples.length-1;
    if(signal.peak>0) {while(samples[first]===0) first++;while(samples[last]===0) last--;}
    const chunk={tokens,stride:[samples.length/SAMPLE_RATE,window.left,window.right],is_last:window.right===0,silent:signal.peak===0,
      signalStart:signal.peak>0?first/SAMPLE_RATE:null,signalEnd:signal.peak>0?(last+1)/SAMPLE_RATE:null};
    // Commit only after decoding succeeds. Failed windows can be retried exactly.
    const history=[...this.history,chunk];
    const decoded=decodeHistory(this.pipeline,history);
    this.history=history;
    return {...decoded,history,low:signal.db<-45,silent:signal.peak===0};
  }
}
