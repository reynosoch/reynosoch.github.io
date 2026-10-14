import {RATE,wavHeader} from './core.mjs';

export const ZIP_LIMIT=128*1024**2;
export function planParts(samples,seconds){
  if(!Number.isSafeInteger(samples)||samples<1||!Number.isFinite(seconds)||seconds<1||seconds>3600)throw new Error('Seleccione una duración entre 1 segundo y 60 minutos.');
  const step=Math.round(seconds*RATE),count=Math.ceil(samples/step);
  if(count>200)throw new Error('El resultado supera 200 partes. Aumente la duración por parte.');
  return Array.from({length:count},(_,i)=>{const startSample=i*step,endSample=Math.min(samples,startSample+step);return {number:i+1,startSample,endSample,start:startSample/RATE,end:endSample/RATE,bytes:44+(endSample-startSample)*2};});
}
export function partTimeMap(map,part){
  return map.filter(s=>s.outputEnd>part.start&&s.outputStart<part.end).map(s=>{
    const start=Math.max(s.outputStart,part.start),end=Math.min(s.outputEnd,part.end);
    return {...s,outputStart:start-part.start,outputEnd:end-part.start,originalStart:s.originalStart+start-s.outputStart,originalEnd:s.originalStart+end-s.outputStart};
  });
}
export function partBlob(blob,part){
  if(blob.size<44+part.endSample*2)throw new Error('El WAV preparado está incompleto. Prepare nuevamente la grabación.');
  return new Blob([wavHeader(part.endSample-part.startSample),blob.slice(44+part.startSample*2,44+part.endSample*2)],{type:'audio/wav'});
}
export function assertArchiveSize(parts){
  if(!parts.length)throw new Error('Seleccione al menos una parte.');
  if(parts.reduce((n,p)=>n+p.bytes,0)>ZIP_LIMIT)throw new Error('El ZIP supera 128 MB. Seleccione menos partes o descargue los archivos individualmente.');
}
