import {backgroundColor,colorMask,refine} from './mask.mjs';
let segment;let rgba,base,w,h,bg;
self.onmessage=async({data:m})=>{try{
 if(m.type==='adjust'){rgba=new Uint8ClampedArray(m.rgba);base=new Uint8Array(m.base);w=m.width;h=m.height;bg=backgroundColor(rgba,w,h);}
 if(m.type==='process'){
  rgba=new Uint8ClampedArray(m.rgba);w=m.width;h=m.height;bg=backgroundColor(rgba,w,h);
  if(m.settings.method==='solid')base=colorMask(rgba,m.settings.color||bg.color,m.settings.tolerance);
  else {
   segment||=(await import('./vendor/segment-1.7.0.mjs')).segmentForeground;
   const canvas=new OffscreenCanvas(w,h);canvas.getContext('2d').putImageData(new ImageData(rgba,w,h),0,0);
   const input=await canvas.convertToBlob({type:'image/png'});
   const blob=await segment(input,{model:'isnet_fp16',device:'cpu',proxyToWorker:false,output:{format:'image/x-alpha8'},progress:(key,current,total)=>self.postMessage({type:'progress',key,current,total})});
   const raw=new Uint8Array(await blob.arrayBuffer());base=raw.length===w*h*4?Uint8Array.from({length:w*h},(_,i)=>raw[i*4+3]):raw;if(base.length!==w*h)throw Error('La máscara tiene un tamaño inesperado.');
   // For flat artwork preserve all contrasting letters and enclosed counters.
   if(bg.solid&&m.settings.preset!=='photo')base=colorMask(rgba,bg.color,m.settings.tolerance);
  }
 }
 if(m.type==='process'||m.type==='adjust'){
  if(!base)throw Error('Primero quita el fondo.');
  const output=refine(rgba,base,w,h,m.settings,bg.color);self.postMessage({type:'result',rgba:output.buffer,width:w,height:h,solid:bg.solid,base:base.slice().buffer},[output.buffer]);
 }
}catch(error){self.postMessage({type:'error',message:error.message});}};
