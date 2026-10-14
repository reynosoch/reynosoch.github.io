import {KEY,MAX_DRAFTS,fields,newDraft,validateDraft,decode,encode,buildBrief,templates} from './model.mjs';
import {icon} from '../shared/icons.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
let drafts=[],active,persistent=true;
for(const e of document.querySelectorAll('[data-icon]'))e.innerHTML=icon(e.dataset.icon);
try{const saved=localStorage.getItem(KEY);if(saved)drafts=decode(saved);}catch{persistent=false;status('No se pudo leer el almacenamiento. El original no se reemplazará; exporte un respaldo de los cambios de esta sesión.');}
if(!drafts.length)drafts=[newDraft()];
active=[...drafts].sort((a,b)=>b.updatedAt-a.updatedAt)[0].id;
const current=()=>drafts.find(d=>d.id===active);
function persist(){
  if(!persistent){$('saved').textContent='Solo en esta sesión';return false;}
  try{localStorage.setItem(KEY,encode(drafts));$('saved').textContent='Guardado local';return true;}
  catch{persistent=false;$('saved').textContent='Solo en esta sesión';status('El navegador no pudo guardar. Exporte el respaldo antes de cerrar.');return false;}
}
function list(){
  $('draft-list').replaceChildren();
  for(const d of [...drafts].sort((a,b)=>b.updatedAt-a.updatedAt)){
    const b=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('small');
    b.className='draft-row';b.setAttribute('aria-pressed',String(d.id===active));b.dataset.draft=d.id;
    title.textContent=d.title.trim()||'Sin título';meta.textContent=d.project.trim()||new Date(d.updatedAt).toLocaleDateString('es-MX');
    b.append(title,meta);b.onclick=()=>{active=d.id;render();};$('draft-list').append(b);
  }
}
function preview(){
  const d=current(),text=buildBrief(d);$('preview').value=text;$('preview').hidden=!text;$('preview-empty').hidden=!!text;
  $('copy').disabled=$('download').disabled=!text;
  const essential=['goal','changes','constraints','checks','delivery'];
  $('completion').textContent=`${essential.filter(f=>d[f].trim()).length}/5 campos clave`;
}
function render(){for(const f of fields)$(f).value=current()[f];$('template').value='';list();preview();$('saved').textContent=persistent?'Guardado local':'Solo en esta sesión';}
function update(){for(const f of fields)current()[f]=$(f).value;current().updatedAt=Date.now();persist();list();preview();}
function run(fn){return async()=>{try{await fn();}catch(e){status(e.message||'No se completó la acción.');}};}
function add(d){if(drafts.length>=MAX_DRAFTS)throw Error('Se permiten hasta 30 borradores. Exporte o elimine uno antes de crear otro.');drafts.push(validateDraft(d));active=d.id;persist();render();}
$('fields').onsubmit=e=>e.preventDefault();$('fields').oninput=update;
$('new').onclick=run(()=>add(newDraft()));
$('duplicate').onclick=run(()=>{const d={...current(),id:crypto.randomUUID(),title:(current().title.trim()||'Encargo')+' · copia',createdAt:Date.now(),updatedAt:Date.now()};d.title=d.title.slice(0,160);add(d);});
$('delete').onclick=run(()=>{
  if(!confirm('¿Eliminar este borrador local? Exporte un respaldo si necesita conservarlo.'))return;
  drafts=drafts.filter(d=>d.id!==active);if(!drafts.length)drafts=[newDraft()];active=drafts[0].id;persist();render();status('Borrador eliminado.');
});
$('template').onchange=()=>{
  const t=templates[$('template').value];if(!t)return;
  if(['constraints','checks','delivery'].some(f=>current()[f].trim())&&!confirm('La plantilla reemplazará restricciones, criterios de aceptación y entrega. Los demás campos se conservan. ¿Continuar?')){$('template').value='';return;}
  for(const f of ['constraints','checks','delivery'])$(f).value=t[f];update();status('Plantilla aplicada. Revise las condiciones antes de compartir.');
};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
const name=()=>((current().title||'brief').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/ig,'-').slice(0,70)||'brief');
$('copy').onclick=run(async()=>{
  const text=buildBrief(current());if(!text)return;
  try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text);}
  catch{$('preview').focus();$('preview').select();if(!document.execCommand('copy'))throw Error('No se pudo copiar. Seleccione el texto o descargue el Markdown.');}
  status('Encargo completo copiado.');
});
$('download').onclick=run(()=>{const text=buildBrief(current());if(text){download(text,name()+'.md','text/markdown;charset=utf-8');status('Markdown descargado.');}});
$('backup').onclick=run(()=>{download(encode(drafts),'brief-respaldo.json','application/json');status('Respaldo exportado. Contiene el texto de todos los borradores; consérvelo en una ubicación adecuada.');});
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=run(async()=>{
  const file=$('import-file').files[0];$('import-file').value='';if(!file)return;
  if(file.size>1_000_000)throw Error('El respaldo supera 1 MB.');
  const incoming=decode(await file.text());if(!incoming.length)throw Error('El respaldo no contiene borradores.');
  const existing=drafts.filter(d=>fields.some(f=>f!=='branch'&&d[f].trim())||(d.branch.trim()&&d.branch!=='main'));
  if(existing.length+incoming.length>MAX_DRAFTS)throw Error('La importación superaría 30 borradores.');
  // Add independent copies; imports never replace existing text or identifiers.
  const copies=incoming.map(d=>({...d,id:crypto.randomUUID(),updatedAt:Date.now()}));
  const next=[...existing,...copies];encode(next);drafts=next;active=copies[0].id;persist();render();status(`${copies.length} borradores importados sin reemplazar los existentes.`);
});
window.addEventListener('storage',e=>{if(e.key!==KEY||!persistent)return;try{const next=e.newValue?decode(e.newValue):[];if(!next.length)return;drafts=next;if(!drafts.some(d=>d.id===active))active=drafts[0].id;render();status('Borradores actualizados desde otra pestaña.');}catch{status('El cambio de otra pestaña no pudo leerse. La edición actual se conserva.');}});
render();if(persistent)persist();document.body.dataset.ready='true';
