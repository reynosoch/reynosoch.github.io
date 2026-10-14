const imageType=type=>typeof type==='string'&&type.startsWith('image/');
const extension=type=>({
 'image/jpeg':'jpg','image/jpg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/bmp':'bmp'
}[type]||'png');
const namedFile=(blob,type,index=0)=>new File([blob],`shot-${Date.now()}${index?'-'+index:''}.${extension(type)}`,{type:type||blob.type||'image/png'});
function pastedFiles(data){
 const direct=Array.from(data?.files||[]).filter(file=>imageType(file.type));
 if(direct.length)return direct;
 return Array.from(data?.items||[]).filter(item=>imageType(item.type)).map(item=>item.getAsFile()).filter(Boolean);
}
async function fileFromInsertedImage(target){
 await new Promise(resolve=>setTimeout(resolve));
 const image=target.querySelector('img');
 if(!image?.src||(!image.src.startsWith('data:image/')&&!image.src.startsWith('blob:')))return null;
 try{const blob=await (await fetch(image.src)).blob();return imageType(blob.type)?namedFile(blob,blob.type):null;}catch{return null;}
}
function touchDevice(){return navigator.maxTouchPoints>0||globalThis.matchMedia?.('(pointer: coarse)').matches;}
function mobilePasteFallback(){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='glass';dialog.setAttribute('aria-label','Pegar captura en móvil');
  const title=document.createElement('h2');title.textContent='Pegue una captura.';
  const help=document.createElement('p');help.textContent='En iPhone/iPad el navegador puede bloquear el pegado directo. Mantén pulsado el recuadro y toca Pegar.';
  const target=document.createElement('div');target.contentEditable='true';target.inputMode='none';target.setAttribute('role','textbox');target.setAttribute('aria-label','Mantén pulsado aquí y toca Pegar');target.textContent='Mantén pulsado aquí y toca Pegar';
  Object.assign(target.style,{minHeight:'104px',display:'grid',placeItems:'center',padding:'18px',margin:'16px 0',border:'1px dashed #ff9b4a',borderRadius:'18px',textAlign:'center',outline:'none',fontWeight:'700',WebkitUserSelect:'text',userSelect:'text'});
  const note=document.createElement('p');note.textContent='Si lo abriste dentro de otra app y no aparece Pegar, usa Fotos / Archivos.';
  const actions=document.createElement('div');actions.className='dialog-actions';
  const choose=document.createElement('button');choose.type='button';choose.className='primary';choose.textContent='Fotos / Archivos';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=true;input.hidden=true;
  actions.append(choose,cancel);dialog.append(title,help,target,note,actions,input);document.body.append(dialog);
  let settled=false;
  const cleanup=()=>{dialog.close?.();dialog.remove();};
  const done=files=>{if(settled)return;settled=true;cleanup();resolve(files);};
  const stop=()=>{if(settled)return;settled=true;cleanup();reject(Error('Pegado cancelado.'));};
  target.addEventListener('focus',()=>{if(target.textContent==='Mantén pulsado aquí y toca Pegar')target.textContent='';},{once:true});
  target.addEventListener('paste',event=>{
   const files=pastedFiles(event.clipboardData);
   if(files.length){event.preventDefault();event.stopPropagation();done(files);return;}
   event.stopPropagation();fileFromInsertedImage(target).then(file=>{if(file)done([file]);else{target.textContent='No vimos una imagen. Copia la captura otra vez o usa Fotos / Archivos.';}});
  },true);
  choose.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{const files=Array.from(input.files||[]);if(files.length)done(files);});
  cancel.addEventListener('click',stop);dialog.addEventListener('cancel',event=>{event.preventDefault();stop();});
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  requestAnimationFrame(()=>target.focus({preventScroll:true}));
 });
}
export async function readImages(){
 let failure;
 if(navigator.clipboard?.read){
  try{
   const items=await navigator.clipboard.read(),files=[];
   for(const item of items){const type=item.types.find(imageType);if(type)files.push(namedFile(await item.getType(type),type,files.length));}
   if(files.length)return files;
   failure=Error('No encontramos una imagen en el portapapeles.');
  }catch(error){failure=error;}
 }else failure=Error('Este navegador no permite leer el portapapeles directamente.');
 if(touchDevice())return mobilePasteFallback();
 throw Error(failure?.message||'Usa Ctrl+V o Abrir capturas en este navegador.');
}
export function writeImage(makeBlob){if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error('Este navegador no permite copiar imágenes. Descarga el PNG.');return navigator.clipboard.write([new ClipboardItem({'image/png':makeBlob()})]);}
export async function writeText(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const area=document.createElement('textarea');area.value=text;document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('No se pudo copiar. Descargue las instrucciones desde Preparar revisión.');}
