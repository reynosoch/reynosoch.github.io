import {StaticCanvas,FabricImage,Rect,util} from '../vendor/fabric-7.4.0.mjs';
import './regions.mjs';
import {loadImage} from '../media/files.mjs';
import {boundedSize,safeName,feedback} from './history.mjs';
export async function render(doc,{format='png',scale=1,quality=.92}={}){
 const crop=doc.state?.crop||{left:0,top:0,width:doc.width,height:doc.height},width=Math.ceil(crop.width*scale),height=Math.ceil(crop.height*scale);boundedSize(width,height);
 const element=document.createElement('canvas'),canvas=new StaticCanvas(element,{width,height,enableRetinaScaling:false,renderOnAddRemove:false});
 try{canvas.backgroundImage=new FabricImage(await loadImage(doc.blob),{originX:'left',originY:'top',left:0,top:0});if(format==='jpeg')canvas.backgroundColor='#ffffff';const objects=await util.enlivenObjects(doc.state?.objects||[]);objects.forEach(o=>canvas.add(o));canvas.setViewportTransform([scale,0,0,scale,-crop.left*scale,-crop.top*scale]);canvas.renderAll();const type='image/'+format;const blob=await new Promise((resolve,reject)=>element.toBlob(b=>b?resolve(b):reject(Error('No se pudo exportar esta imagen. Prueba una escala menor.')),type,quality));if(blob.type!==type)throw Error('Este navegador no exporta ese formato. Selecciona PNG.');return blob;}finally{await canvas.dispose();element.width=element.height=0;}
}
export function docFeedback(doc,intro){const markers=doc.state?.objects?.filter(o=>o.shotKind==='number')||[];return feedback(doc.name,markers.map(o=>doc.state.notes?.[o.shotId]||''),intro);}
export async function pack(docs,intro){const {default:JSZip}=await import('../vendor/jszip-3.10.2.mjs');const zip=new JSZip();let md='',bytes=0;for(let i=0;i<docs.length;i++){const doc=docs[i];const blob=await render(doc);bytes+=blob.size;if(bytes>128*1024*1024)throw Error('El paquete supera 128 MB. Exporta menos capturas por sesión.');zip.file(`${String(i+1).padStart(2,'0')}-${safeName(doc.name)}.png`,blob);md+=`## ${i+1}. ${doc.name}\n\n${docFeedback(doc,intro)}\n`;await new Promise(r=>setTimeout(r,0));}zip.file('feedback.md',md);return zip.generateAsync({type:'blob',compression:'STORE'});}
export async function combine(docs,layout){
 const sizes=docs.map(d=>d.state?.crop||d),columns=layout==='horizontal'?docs.length:layout==='grid'?Math.ceil(Math.sqrt(docs.length)):1,rows=Math.ceil(docs.length/columns),cellW=Math.max(...sizes.map(s=>s.width)),cellH=Math.max(...sizes.map(s=>s.height)),gap=20;
 const naturalW=layout==='vertical'?cellW+gap*2:columns*(cellW+gap)+gap,naturalH=layout==='horizontal'?cellH+gap*2:layout==='vertical'?sizes.reduce((n,s)=>n+s.height+gap,0)+gap:rows*(cellH+gap)+gap;
 const ratio=Math.min(1,12000/naturalW,12000/naturalH,Math.sqrt(24_000_000/(naturalW*naturalH))),canvas=document.createElement('canvas');canvas.width=Math.ceil(naturalW*ratio);canvas.height=Math.ceil(naturalH*ratio);const ctx=canvas.getContext('2d');ctx.fillStyle='#17171b';ctx.fillRect(0,0,canvas.width,canvas.height);let verticalY=gap;
 for(let i=0;i<docs.length;i++){const blob=await render(docs[i]),image=await loadImage(blob),x=layout==='vertical'?gap:gap+(i%columns)*(cellW+gap),y=layout==='vertical'?verticalY:gap+Math.floor(i/columns)*(cellH+gap);ctx.drawImage(image,x*ratio,y*ratio,sizes[i].width*ratio,sizes[i].height*ratio);verticalY+=sizes[i].height+gap;}
 return new Promise(r=>canvas.toBlob(r,'image/png'));
}
