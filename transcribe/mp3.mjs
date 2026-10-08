const registered=new WeakSet();
export async function registerMp3Decoder(media,decoderModule) {
  if(registered.has(media)) return;
  const {MPEGDecoder}=decoderModule||await import('https://cdn.jsdelivr.net/npm/mpg123-decoder@1.0.3/+esm');
  class Mp3Decoder extends media.CustomAudioDecoder {
    static supports(codec) {return codec==='mp3';}
    async init() {this.decoder=new MPEGDecoder();await this.decoder.ready;this.time=null;}
    decode(packet) {
      if(this.time===null) this.time=packet.timestamp;
      const result=this.decoder.decode(packet.data);
      if(result.errors.length) throw new Error('El MP3 tiene errores de decodificación. Convierte una copia a WAV PCM.');
      if(!result.samplesDecoded) return;
      const data=new Float32Array(result.samplesDecoded*result.channelData.length);
      result.channelData.forEach((channel,index)=>data.set(channel,index*result.samplesDecoded));
      const sample=new media.AudioSample({format:'f32-planar',sampleRate:result.sampleRate,numberOfChannels:result.channelData.length,
        numberOfFrames:result.samplesDecoded,timestamp:this.time,data});
      this.time+=result.samplesDecoded/result.sampleRate;this.onSample(sample);
    }
    flush() {}
    close() {this.decoder?.free();}
  }
  media.registerDecoder(Mp3Decoder);registered.add(media);
}
