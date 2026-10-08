import { WhisperSession } from './asr-engine.mjs';
let transcriber, session;
const send=(type,data={})=>self.postMessage({type,...data});
self.onmessage=async({data})=>{
  try {
    if(data.type==='init') {
      if(transcriber) await transcriber.dispose();
      transcriber=null;session=null;
      const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
      env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
      const gpu=data.options.device==='webgpu';
      const modelId=`${gpu?'onnx-community':'Xenova'}/whisper-${data.options.model}`;
      send('progress',{label:'Cargando el modelo autorizado…'});
      transcriber=await pipeline('automatic-speech-recognition',modelId,{
        device:gpu?'webgpu':'wasm',dtype:gpu?{encoder_model:'fp32',decoder_model_merged:'q4'}:'q8',
        progress_callback:p=>{
          if(p.status==='progress') send('progress',{label:`Modelo · ${p.file}`,percent:p.progress});
        },
      });
      session=new WhisperSession(transcriber,data.options,data.history||[]);
      send('ready');
    } else if(data.type==='window') {
      if(!session) throw new Error('El modelo todavía no está listo.');
      const result=await session.process(data.samples,data.window);
      send('partial',{...result,index:data.window.index});
    } else throw new Error('Acción de voz no reconocida.');
  } catch(error) {
    send('error',{message:`No se pudo transcribir: ${error.message}. Se conserva el último fragmento terminado. Puedes reanudar o empezar con un modelo más ligero.`,device:data.options?.device});
  }
};
