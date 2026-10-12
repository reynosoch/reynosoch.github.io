const cache=new Map();

async function load(key,url){
  if(cache.has(key)) return cache.get(key);
  const promise=import(url).catch(error=>{cache.delete(key);throw error;});
  cache.set(key,promise);
  return promise;
}

export const engines={
  sheet:()=>load('sheet','https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'),
  yaml:()=>load('yaml','https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm'),
  marked:()=>load('marked','https://cdn.jsdelivr.net/npm/marked@15.0.12/+esm'),
  docx:()=>load('docx','https://cdn.jsdelivr.net/npm/docx@9.5.1/+esm'),
  pptx:()=>load('pptx','https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm'),
  heic:()=>load('heic','https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm'),
  pdfLib:()=>load('pdf-lib','https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm'),
  pdfEncrypt:()=>load('pdf-lib-plus-encrypt','https://cdn.jsdelivr.net/npm/pdf-lib-plus-encrypt@1.1.0/+esm'),
  pdfjs:async()=>{
    const pdfjs=await load('pdfjs','https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
    return pdfjs;
  },
  tesseract:()=>load('tesseract','https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm')
};

export async function optional(engine,label){
  try{return await engine();}
  catch(error){throw Error(`${label} necesita su motor web y esta red no pudo cargarlo. Intenta otra red o convierte a un formato intermedio.`,{cause:error});}
}
