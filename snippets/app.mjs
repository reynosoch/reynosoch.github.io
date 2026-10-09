import { defaultSnippets, technologies, platforms } from './data/default-snippets.mjs';
import { createLibrary } from './lib/storage.mjs';
import { selectSnippets, frequentSnippets } from './lib/search.mjs';
import { normalizeSnippet, effectiveSafety, recipeSteps } from './lib/model.mjs';
import { parseLibrary, planImport, exportLibrary, MAX_IMPORT_BYTES } from './lib/import-export.mjs';
import { card, frequentCard, detail, escape } from './lib/ui.mjs';
const $=id=>document.getElementById(id);
const library=createLibrary();let snippets=[],filter='all',detailId=null,editing=null,persistent=true,toastTimer;
function toast(message){([...document.querySelectorAll('dialog[open]')].at(-1)||document.body).append($('toast'));$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},3500);}
function warning(message){$('storage-warning').textContent=message;$('storage-warning').hidden=false;}
function showDialog(id){$(id).showModal();}
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{([...document.querySelectorAll('dialog[open]')].at(-1)||document.body).append($('toast'));});
function confirm(title,message,accept='Continuar') {
  const dialog=$('confirmation');if(dialog.open)return Promise.resolve(false);
  $('confirm-title').textContent=title;$('confirm-message').textContent=message;$('confirm-accept').textContent=accept;dialog.returnValue='';
  return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='accept'),{once:true});dialog.showModal();});
}
async function refresh(){if(persistent)snippets=await library.all();render();}
function render(){
  const focused=document.activeElement;const focus=focused?.dataset.action?{action:focused.dataset.action,id:focused.dataset.id,step:focused.dataset.step}:null;
  const query=$('search').value;const technology=$('technology').value;
  const results=selectSnippets(snippets,{query,technology,filter});
  $('results').innerHTML=results.map(card).join('');$('empty').hidden=results.length>0;
  $('result-count').textContent=`${results.length} ${results.length===1?'resultado':'resultados'}${filter==='recent'?' · últimos 20 como máximo':''}`;
  $('frequent-section').hidden=Boolean(query.trim()||technology!=='Todas'||filter!=='all');
  $('frequent').innerHTML=frequentSnippets(snippets).map(frequentCard).join('');
  $('frequent-note').textContent=snippets.some(s=>s.usageCount)?'Según tus copias en este navegador':'Tus accesos para empezar';
  if($('detail').open){const s=snippets.find(x=>x.id===detailId);if(s)$('detail-content').innerHTML=detail(s);else $('detail').close();}
  if(focus){const scope=$('detail').open?$('detail'):document;[...scope.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focus.action&&el.dataset.id===focus.id&&el.dataset.step===focus.step)?.focus({preventScroll:true});}
}
async function run(button,action){if(button?.disabled)return;const hadFocus=button===document.activeElement;try{if(button)button.disabled=true;await action();}catch(error){toast(error.message||'No se completó la acción.');}finally{if(button)button.disabled=false;if(hadFocus&&['favorite','copy','copy-step'].includes(button?.dataset.action)&&!document.querySelector('#editor[open],#confirmation[open]')){const scope=$('detail').open?$('detail'):document;[...scope.querySelectorAll('[data-action]')].find(el=>el.dataset.action===button.dataset.action&&el.dataset.id===button.dataset.id&&el.dataset.step===button.dataset.step)?.focus({preventScroll:true});}}}
async function copyText(text){
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch{/* iPad and denied Clipboard API: try selection fallback. */}}
  const area=document.createElement('textarea');area.value=text;area.setAttribute('aria-label','Texto para copiar');area.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:.01';
  const active=document.activeElement;const host=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;host.append(area);area.focus();area.select();area.setSelectionRange(0,text.length);
  let success=false;try{success=document.execCommand('copy');}finally{area.remove();active?.focus({preventScroll:true});}
  if(!success)throw new Error('El navegador bloqueó copiar. Abre el detalle y selecciona el comando para copiarlo.');
}
async function copySnippet(s,step){
  const text=step===undefined?s.command:recipeSteps(s)[step];if(text===undefined)return;
  if(effectiveSafety(s,text)==='destructive'&&!await confirm('Revisar comando destructivo','Este comando puede eliminar cambios locales, archivos o datos. Revisa el comando y respalda lo que necesitas antes de usarlo. Snippets solo copia texto.','Copiar de todos modos'))return;
  await copyText(text);
  const update=old=>({...old,usageCount:old.usageCount+1,lastUsed:new Date().toISOString()});
  try{if(persistent)await library.update(s.id,update);else snippets=snippets.map(x=>x.id===s.id?update(x):x);await refresh();toast('Copiado');}
  catch{toast('Copiado · no se pudo guardar el contador.');}
}
function openEditor(s=null){
  if(!persistent){toast('El almacenamiento local no está disponible.');return;}
  editing=s;$('snippet-form').reset();$('form-error').textContent='';$('editor-title').textContent=s?(s.custom?'Editar snippet':'Personalizar snippet'):'Nuevo snippet';
  for(const key of ['name','technology','type','command','description','tags','platform','safety','useCases']){
    const el=$('snippet-form').elements.namedItem(key);el.value=s?(Array.isArray(s[key])?s[key].join(key==='tags'?', ':'\n'):s[key]):({technology:technologies[0],type:'command',platform:'Todos',safety:'safe'}[key]||'');
  }
  showDialog('editor');$('name').focus();
}
for(const id of ['technology','edit-technology'])$(id).insertAdjacentHTML('beforeend',technologies.map(t=>`<option>${escape(t)}</option>`).join(''));
$('platform').innerHTML=platforms.map(t=>`<option>${escape(t)}</option>`).join('');
$('search').addEventListener('input',render);$('technology').addEventListener('change',render);
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;for(const other of document.querySelectorAll('[data-filter]'))other.setAttribute('aria-pressed',String(other===button));render();});
$('clear-filters').addEventListener('click',()=>{$('search').value='';$('technology').value='Todas';document.querySelector('[data-filter="all"]').click();$('search').focus();});
$('new-snippet').addEventListener('click',()=>openEditor());$('settings-open').addEventListener('click',()=>showDialog('settings'));
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const s=snippets.find(x=>x.id===button.dataset.id);if(!s)return;
  run(button,async()=>{
    switch(button.dataset.action){
      case 'detail': detailId=s.id;$('detail-content').innerHTML=detail(s);showDialog('detail');break;
      case 'copy':await copySnippet(s);break;
      case 'copy-step':await copySnippet(s,Number(button.dataset.step));break;
      case 'favorite':if(!persistent)throw new Error('No se pueden guardar favoritos sin almacenamiento local.');await library.update(s.id,old=>({...old,favorite:!old.favorite}));await refresh();break;
      case 'edit':openEditor(s);break;
      case 'delete':if(!persistent)throw new Error('El almacenamiento local no está disponible.');if(await confirm('¿Eliminar este snippet?',`${s.name}. ${s.custom?'Puedes conservarlo exportando la biblioteca.':'Puedes reponerlo con Restaurar snippets incluidos.'}`,'Eliminar')){await library.remove(s.id);$('detail').close();await refresh();toast('Snippet eliminado');}break;
    }
  });
});
$('snippet-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;$('form-error').textContent='';
  try{
    const fields=Object.fromEntries(new FormData(event.target));const now=new Date().toISOString();const personal=editing?.custom?editing:null;
    const record=normalizeSnippet({...personal,...fields,id:personal?.id||`custom:${crypto.randomUUID()}`,tags:fields.tags.split(','),useCases:fields.useCases.split('\n').filter(x=>x.trim()),custom:true,createdAt:personal?.createdAt||now,updatedAt:now});
    await library.put(record);$('editor').close();if($('detail').open)$('detail').close();await refresh();toast(personal?'Snippet actualizado':'Snippet guardado');
  }catch(error){$('form-error').textContent=error.message;}finally{button.disabled=false;}
});
$('export').addEventListener('click',event=>run(event.currentTarget,async()=>{
  if(persistent)snippets=await library.all();const blob=new Blob([exportLibrary(snippets)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`reynoso-snippets-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Biblioteca exportada');
}));
$('import').addEventListener('click',()=>{if(persistent)$('import-file').click();else toast('El almacenamiento local no está disponible.');});
$('import-file').addEventListener('change',event=>run($('import'),async()=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>MAX_IMPORT_BYTES)throw new Error('El JSON supera 4 MB.');
  const incoming=parseLibrary(await file.text());const plan=planImport(await library.all(),incoming);
  if(!plan.records.length){toast('La biblioteca ya contiene estos snippets.');return;}
  if(await confirm('Importar biblioteca',`Se agregarán ${plan.records.length} snippets. ${plan.collisions} IDs en conflicto se guardarán como copias nuevas y ${plan.duplicates} duplicados idénticos se omitirán. No se sobrescribe ningún registro existente.`,'Importar')){await library.import(plan.records);await refresh();toast(`${plan.records.length} snippets importados`);}
}));
$('restore').addEventListener('click',event=>run(event.currentTarget,async()=>{
  if(!persistent)throw new Error('El almacenamiento local no está disponible.');
  if(await confirm('Restaurar snippets incluidos','Se repondrán las definiciones de la biblioteca inicial. Tus snippets personalizados, favoritos y contadores se conservarán.','Restaurar')){await library.restore();await refresh();toast('Biblioteca inicial restaurada');}
}));
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  if(event.key.toLowerCase()==='k'&&!event.shiftKey){event.preventDefault();if(!document.querySelector('dialog[open]'))$('search').focus();}
  if(event.key.toLowerCase()==='s'&&event.shiftKey&&!document.querySelector('dialog[open]')){event.preventDefault();openEditor();}
});
// IndexedDB is authoritative across tabs. Reload when returning to this tab.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&persistent)run(null,refresh);});
try{await library.initialize();await refresh();$('local-status').textContent='Guardado en este navegador · sin cuenta';}
catch(error){persistent=false;snippets=defaultSnippets.map(s=>({...s}));warning(`${error.message} Puedes consultar y copiar los incluidos; los cambios no se guardarán.`);$('local-status').textContent='Almacenamiento no disponible';render();}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{warning('La caché offline no está disponible. La biblioteca local sigue funcionando mientras puedas abrir la página.');});
