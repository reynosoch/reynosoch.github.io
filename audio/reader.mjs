// Reuses Transcribe's fixed, licensed readers; keeps Audio Lab's decoder independent.
import * as media from '../transcribe/vendor/mediabunny-1.61.3.min.mjs';
export async function openReader(file,{allowMp3=false}={}) {
  const input=new media.Input({formats:[media.MP4,media.QTFF,media.MP3,media.WAVE,media.OGG,media.FLAC,media.WEBM,media.MATROSKA,media.ADTS],source:new media.BlobSource(file,{maxCacheSize:4*1024*1024})});
  try {
    const track=await input.getPrimaryAudioTrack();if(!track)throw new Error('No hay pista de audio.');
    const duration=await track.computeDuration(),rate=await track.getSampleRate(),channels=await track.getNumberOfChannels(),codec=await track.getCodec();
    if(!(duration>0&&duration<=14400&&rate>=8000&&rate<=192000&&channels>=1&&channels<=8))throw new Error('Admitimos hasta 4 horas, 8 canales y 192 kHz.');
    if(!await track.canDecode()&&codec==='mp3'&&allowMp3){const {registerMp3Decoder}=await import('../transcribe/mp3.mjs?v=2.0.1');await registerMp3Decoder(media);}
    if(!await track.canDecode()){const error=new Error(codec==='mp3'?'Autoriza el lector MP3 adicional.':'Este navegador no lee ese códec por partes. Prueba Chrome/Edge actualizado o convierte a WAV PCM.');error.mp3=codec==='mp3';throw error;}
    const sink=new media.AudioSampleSink(track);
    return {duration,rate,channels,codec,dispose:()=>input.dispose(),async read(start,end){
      if(end-start>31||start<0||end<=start)throw new Error('Bloque inválido.');
      const length=Math.round((end-start)*rate),planes=Array.from({length:channels},()=>new Float32Array(length));let frames=0;
      for await(const sample of sink.samples(start,end)) {
        try {if(sample.sampleRate!==rate||sample.numberOfChannels!==channels)throw new Error('La pista cambia de formato. Convierte a WAV PCM.');
          const offset=Math.round((sample.timestamp-start)*rate),skip=Math.max(0,-offset),at=Math.max(0,offset),count=Math.min(sample.numberOfFrames-skip,length-at);
          if(count<=0)continue;for(let plane=0;plane<channels;plane++)sample.copyTo(planes[plane].subarray(at,at+count),{planeIndex:plane,format:'f32-planar',frameOffset:skip,frameCount:count});frames+=count;
        }finally{sample.close();}
      }
      if(!frames)throw new Error('No se pudo decodificar este bloque. No lo sustituimos por silencio.');return planes;
    }};
  }catch(error){input.dispose();throw error;}
}
