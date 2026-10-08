import { mixChannels, SAMPLE_RATE } from './audio.mjs';
// Keep the reader on Pages: a blocked CDN must not prevent opening local audio.
export const MEDIA_URL='./vendor/mediabunny-1.61.3.min.mjs';
export async function openAudioSource(file,{library,allowCompatibility=false,allowMp3=false,signal,previewDuration}={}) {
  const media=library||await import(MEDIA_URL);
  if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
  const input=new media.Input({formats:[media.MP4,media.QTFF,media.MP3,media.WAVE,media.OGG,media.FLAC,media.WEBM,media.MATROSKA,media.ADTS],source:new media.BlobSource(file,{maxCacheSize:4*1024*1024})});
  try {
    const track=await input.getPrimaryAudioTrack();
    if(!track) throw new Error('El archivo no tiene una pista de audio legible.');
    const duration=await track.computeDuration();
    const rate=await track.getSampleRate(),channels=await track.getNumberOfChannels();
    if(!Number.isFinite(duration)||duration<=0||duration>14400) throw new Error('El audio debe durar hasta cuatro horas.');
    if(channels<1||channels>8||rate<8000||rate>192000) throw new Error('Pista con canales o frecuencia no admitidos. Convierte a WAV o MP3.');
    if(!await track.canDecode() && await track.getCodec()==='mp3') {
      if(allowMp3) {
        const {registerMp3Decoder}=await import('./mp3.mjs?v=2.0.1');
        await registerMp3Decoder(media);
      } else {const error=new Error('Esta pista MP3 necesita un lector adicional por partes.');error.mp3=true;throw error;}
    }
    if(!await track.canDecode()) {
      input.dispose();
      if(!allowCompatibility||duration>180||file.size>50*1024*1024) {
        const error=new Error('Este navegador no puede decodificar esta pista por partes. Abre Chrome/Edge actualizado o convierte el audio a WAV PCM. La lectura completa solo se ofrece, con permiso, hasta 3 minutos y 50 MB.');
        error.compatibility=duration<=180&&file.size<=50*1024*1024;throw error;
      }
      return compatibilitySource(file,duration,signal);
    }
    if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
    const sink=new media.AudioSampleSink(track);
    return {duration,rate,channels,method:'Lectura por partes',dispose:()=>input.dispose(),
      async read(start,end,channel='mix') {
        if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
        if(!(start>=0&&end>start&&end-start<=31)) throw new Error('Ventana de audio no válida.');
        const length=Math.ceil((end-start)*rate);
        const planes=Array.from({length:channels},()=>new Float32Array(length));
        let frames=0;
        for await(const sample of sink.samples(start,end)) {
          try {
            if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
            if(sample.sampleRate!==rate||sample.numberOfChannels!==channels) throw new Error('La pista cambia de formato; conviértela a WAV PCM.');
            const offset=Math.round((sample.timestamp-start)*rate);
            const skip=Math.max(0,-offset),at=Math.max(0,offset),count=Math.min(sample.numberOfFrames-skip,length-at);
            if(count<=0) continue;
            for(let plane=0;plane<channels;plane++) sample.copyTo(planes[plane].subarray(at,at+count),{planeIndex:plane,format:'f32-planar',frameOffset:skip,frameCount:count});
            frames+=count;
          } finally { sample.close(); }
        }
        if(!frames) throw new Error('No se pudo leer este fragmento. No se sustituye un error de decodificación por silencio.');
        return {mono:mixChannels(planes,channel),rate,duration:end-start};
      }};
  } catch(error) {
    input.dispose();
    if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
    if(error.name==='UnsupportedInputFormatError'&&previewDuration>0&&previewDuration<=180&&file.size<=50*1024*1024) {
      if(allowCompatibility) return compatibilitySource(file,previewDuration,signal);
      error.compatibility=true;error.message='Este formato necesita lectura de compatibilidad para el clip corto.';
    }
    throw error;
  }
}
async function compatibilitySource(file,duration,signal) {
  const AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioContextClass) throw new Error('No hay un decodificador compatible. Convierte a WAV PCM.');
  const context=new AudioContextClass();let buffer;
  try {buffer=await context.decodeAudioData(await file.arrayBuffer());} finally {await context.close();}
  if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
  if(buffer.duration>180) throw new Error('La duración real supera el límite de compatibilidad de 3 minutos.');
  return {duration:buffer.duration,rate:buffer.sampleRate,channels:buffer.numberOfChannels,method:'Compatibilidad · lectura completa autorizada',dispose:()=>{buffer=null;},
    async read(start,end,channel) {
      if(signal?.aborted) throw new DOMException('Cancelado','AbortError');
      const first=Math.round(start*buffer.sampleRate),last=Math.round(end*buffer.sampleRate);
      const planes=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).subarray(first,last));
      return {mono:mixChannels(planes,channel),rate:buffer.sampleRate,duration:end-start};
    }};
}
export async function resampleWindow({mono,rate,duration}) {
  const length=Math.round(duration*SAMPLE_RATE);
  if(rate===SAMPLE_RATE) return mono.length===length?mono:mono.slice(0,length);
  const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Offline) throw new Error('No hay remuestreador de audio. Usa Chrome/Edge actualizado.');
  const context=new Offline(1,length,SAMPLE_RATE),buffer=context.createBuffer(1,mono.length,rate);
  buffer.copyToChannel(mono,0);
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();
  return (await context.startRendering()).getChannelData(0).slice();
}
