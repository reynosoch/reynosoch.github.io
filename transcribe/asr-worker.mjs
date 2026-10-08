import { prepareSamples, stats } from './audio.mjs';
let transcriber, selectedModel;
const send = (type, data = {}) => self.postMessage({ type, ...data });
self.onmessage = async ({ data }) => {
  try {
    const { samples, model, language, enhance, highpass } = data;
    send('progress', { label: 'Preparando el audio completo…' });
    const prepared = prepareSamples(samples, { enhance, highpass });
    const originalStats = stats(samples);
    if (originalStats.peak < 1e-8) {
      send('done', { text: '', chunks: [], note: 'El archivo contiene silencio digital. No hay señal de voz que recuperar.' });
      return;
    }
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    const modelId = `Xenova/whisper-${model}`;
    if (!transcriber || selectedModel !== modelId) {
      if (transcriber) await transcriber.dispose();
      transcriber = null; selectedModel = null;
      send('progress', { label: 'Descargando modelo de voz (solo la primera vez)…' });
      transcriber = await pipeline('automatic-speech-recognition', modelId, {
        device: 'wasm', dtype: 'q8',
        progress_callback: p => {
          if (p.status === 'progress') send('progress', { label: `Descargando ${p.file}`, percent: p.progress });
          else if (p.status === 'ready') send('progress', { label: 'Modelo listo. Analizando voz…' });
        },
      });
      selectedModel = modelId;
    }
    send('progress', { label: 'Transcribiendo el audio completo. Puede tardar varios minutos…' });
    const options = { task: 'transcribe', return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, do_sample: false,
      chunk_callback: () => send('progress', { label: 'Analizando el siguiente fragmento, con solapamiento…' }),
    };
    if (language !== 'auto') options.language = language;
    const result = await transcriber(prepared, options);
    send('done', { text: result.text, chunks: result.chunks || [],
      note: originalStats.db < -45 ? 'El volumen original era muy bajo. Revisa las partes dudosas: amplificar también aumenta el ruido.' : '',
    });
  } catch (error) {
    send('error', { message: `No se pudo transcribir: ${error.message}. Revisa la conexión a Hugging Face / jsDelivr o prueba el modelo Ligero si falta memoria.` });
  }
};
