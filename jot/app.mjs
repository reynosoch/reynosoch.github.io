import {createVaultMeta,unlockVault,seal,open} from './crypto.mjs';
import {getMeta,setMeta,rows,putRow,deleteRow,exportVault,importVault} from './store.mjs';

const $=id=>document.getElementById(id);
const icons={
  jot:'<path d="M5 3h11l3 3v15H5z"/><path d="M16 3v4h4M8 11h8M8 15h6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  notes:'<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
  pin:'<path d="m14 4 6 6-3 1-4 4-1 5-2-2-2-2 5-1 4-4 1-3-6-6z"/><path d="m9 15-5 5"/>',
  archive:'<path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.jot}</svg>`;
for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=svg(el.dataset.icon);
for(const el of document.querySelectorAll('[data-icon-button]'))el.insertAdjacentHTML('afterbegin',svg(el.dataset.iconButton));
for(const el of document.querySelectorAll('[data-icon-only]'))el.innerHTML=svg(el.dataset.iconOnly);

const state={meta:null,key:null,notes:[],section:'all',query:'',view:'grid',current:null,saveTimer:null,saving:false};
const now=()=>Date.now();
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const parseLabels=value=>[...new Set(String(value||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,12);
const emptyNote=type=>({id:uid(),type,title:'',body:'',items:type==='checklist'?[{id:uid(),text:'',done:false}]:[],labels:[],color:'slate',pinned:false,archived:false,trashed:false,created:now(),updated:now()});
const fmtTime=value=>new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(value);

function gateMode(meta){
  const setup=!meta;
  $('gate-title').innerHTML=setup?'Crea tu Jot<span>.</span>':'Jot<span>.</span>';
  $('gate-subtitle').textContent=setup?'Primera vez en este navegador: crea una bóveda local para tus notas.':'Desbloquea tus notas de este dispositivo.';
  $('confirm-wrap').hidden=!setup;$('password-confirm').required=setup;
  $('access-submit').textContent=setup?'Crear bóveda':'Desbloquear';
  $('username').value=meta?.username||'admin';
  $('password').value='';$('password-confirm').value='';$('access-status').textContent='';
}

async function boot(){
  try{state.meta=await getMeta();gateMode(state.meta);document.body.dataset.ready='true';}
  catch(error){$('access-status').textContent='No se pudo abrir el almacenamiento local de este navegador.';console.error(error);document.body.dataset.ready='true';}
}

$('access-form').addEventListener('submit',async event=>{
  event.preventDefault();const username=$('username').value.trim(),password=$('password').value;
  $('access-submit').disabled=true;$('access-status').textContent='Abriendo bóveda…';
  try{
    if(!state.meta){
      if(password!==$('password-confirm').value)throw new Error('Las contraseñas no coinciden.');
      const created=await createVaultMeta(username,password);state.meta=created.meta;state.key=created.key;await setMeta(created.meta);
    }else state.key=await unlockVault(state.meta,username,password);
    await navigator.storage?.persist?.();
    await openApp();
  }catch(error){$('access-status').textContent=error.message||'No se pudo desbloquear la bóveda.';}
  finally{$('access-submit').disabled=false;}
});

async function openApp(){
  const encrypted=await rows(),notes=[];
  for(const row of encrypted){try{const note=await open(state.key,row.blob);if(note?.id)notes.push(note);}catch{}}
  state.notes=notes;state.current=null;state.section='all';state.query='';$('search').value='';
  $('gate').hidden=true;$('app').hidden=false;setSection('all');render();
}

function lock(){
  clearTimeout(state.saveTimer);state.key=null;state.notes=[];state.current=null;$('editor').hidden=true;$('app').hidden=true;$('gate').hidden=false;gateMode(state.meta);$('password').focus();
}
$('lock-vault').addEventListener('click',lock);

async function persist(note){
  if(!state.key||!note)return;state.saving=true;$('saved-state').textContent='Guardando…';
  note.updated=now();const blob=await seal(state.key,note);await putRow({id:note.id,created:note.created,updated:note.updated,blob});
  state.saving=false;$('saved-state').textContent='Guardado local';render(false);
}
function scheduleSave(){clearTimeout(state.saveTimer);$('saved-state').textContent='Pendiente…';state.saveTimer=setTimeout(()=>persist(state.current).catch(console.error),420);}

function visibleNotes(){
  const q=state.query.trim().toLowerCase();let items=state.notes.filter(n=>{
    if(state.section==='all'&&(n.archived||n.trashed))return false;
    if(state.section==='pinned'&&(!n.pinned||n.archived||n.trashed))return false;
    if(state.section==='archive'&&(!n.archived||n.trashed))return false;
    if(state.section==='trash'&&!n.trashed)return false;
    if(state.section.startsWith('label:')&&!n.labels.includes(state.section.slice(6)))return false;
    if(!q)return true;const hay=[n.title,n.body,...n.labels,...(n.items||[]).map(x=>x.text)].join(' ').toLowerCase();return hay.includes(q);
  });
  return items.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated-a.updated);
}

function render(updateEditor=true){
  const all=state.notes.filter(n=>!n.archived&&!n.trashed),pinned=all.filter(n=>n.pinned),archive=state.notes.filter(n=>n.archived&&!n.trashed),trash=state.notes.filter(n=>n.trashed);
  $('count-all').textContent=all.length;$('count-pinned').textContent=pinned.length;$('count-archive').textContent=archive.length;$('count-trash').textContent=trash.length;
  const labels=[...new Set(state.notes.filter(n=>!n.trashed).flatMap(n=>n.labels))].sort((a,b)=>a.localeCompare(b,'es'));
  const labelNav=$('label-nav');labelNav.replaceChildren();
  if(!labels.length){const p=document.createElement('p');p.textContent='Se crean al escribirlas en una nota.';labelNav.append(p);}else for(const label of labels){const b=document.createElement('button');b.type='button';b.className='label-button';b.dataset.section=`label:${label}`;b.innerHTML=svg('notes');const span=document.createElement('span');span.textContent=label;b.append(span);b.addEventListener('click',()=>setSection(b.dataset.section));labelNav.append(b);}
  const list=visibleNotes(),container=$('notes');container.className=state.view==='list'?'notes-grid list-view':'notes-grid';container.replaceChildren();
  for(const note of list)container.append(noteCard(note));
  $('empty-notes').hidden=list.length>0;$('result-count').textContent=`${list.length} ${list.length===1?'nota':'notas'}`;
  if(updateEditor&&state.current)fillEditor(state.current);
}

function noteCard(note){
  const card=document.createElement('article');card.className='note-card';card.dataset.color=note.color||'slate';card.tabIndex=0;
  const top=document.createElement('div');top.className='card-top';
  const type=document.createElement('span');type.className='card-type';type.innerHTML=svg(note.type==='checklist'?'check':'notes');top.append(type);
  if(note.pinned){const pin=document.createElement('span');pin.className='pin-mark';pin.innerHTML=svg('pin');top.append(pin);}card.append(top);
  if(note.title){const h=document.createElement('h3');h.textContent=note.title;card.append(h);}
  if(note.type==='checklist'){
    const ul=document.createElement('ul');ul.className='card-checks';for(const item of note.items.slice(0,5)){if(!item.text)continue;const li=document.createElement('li');li.className=item.done?'done':'';li.innerHTML=svg('check');const t=document.createElement('span');t.textContent=item.text;li.append(t);ul.append(li);}card.append(ul);
  }else if(note.body){const p=document.createElement('p');p.textContent=note.body;card.append(p);}
  if(note.labels.length){const labels=document.createElement('div');labels.className='card-labels';for(const value of note.labels.slice(0,4)){const s=document.createElement('span');s.textContent=value;labels.append(s);}card.append(labels);}
  const time=document.createElement('small');time.textContent=fmtTime(note.updated);card.append(time);
  const openCard=()=>openEditor(note);card.addEventListener('click',openCard);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCard();}});return card;
}

function setSection(section){
  state.section=section;for(const b of document.querySelectorAll('.nav-item'))b.classList.toggle('active',b.dataset.section===section);
  const titles={all:'Notas',pinned:'Fijadas',archive:'Archivo',trash:'Papelera'};$('section-title').textContent=titles[section]||section.replace('label:','Etiqueta · ');render(false);
}
for(const button of document.querySelectorAll('.nav-item'))button.addEventListener('click',()=>setSection(button.dataset.section));
$('search').addEventListener('input',e=>{state.query=e.target.value;render(false);});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{state.view=button.dataset.view;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));render(false);});

function create(type){const note=emptyNote(type);state.notes.unshift(note);openEditor(note);persist(note).catch(console.error);render(false);}
$('new-note').addEventListener('click',()=>create('note'));$('new-list').addEventListener('click',()=>create('checklist'));$('empty-new').addEventListener('click',()=>create('note'));

function openEditor(note){state.current=note;fillEditor(note);$('editor').hidden=false;if(matchMedia('(max-width:900px)').matches)$('editor').scrollIntoView({block:'start'});setTimeout(()=>$('note-title').focus(),20);}
function fillEditor(note){
  $('note-title').value=note.title||'';$('note-body').value=note.body||'';$('note-body').hidden=note.type==='checklist';$('checklist').hidden=note.type!=='checklist';$('add-check').hidden=note.type!=='checklist';$('note-labels').value=note.labels.join(', ');$('note-time').textContent=`Editada ${fmtTime(note.updated)}`;
  $('pin-note').classList.toggle('active',note.pinned);$('pin-note').lastChild.textContent=note.pinned?' Quitar fijación':' Fijar';
  $('archive-note').lastChild.textContent=note.archived?' Sacar de archivo':' Archivar';$('trash-note').lastChild.textContent=note.trashed?' Restaurar':' Papelera';$('delete-forever').hidden=!note.trashed;
  for(const b of document.querySelectorAll('[data-color]'))b.classList.toggle('active',b.dataset.color===note.color);
  if(note.type==='checklist')renderChecklist(note);
}
function renderChecklist(note){const box=$('checklist');box.replaceChildren();for(const item of note.items){const row=document.createElement('div');row.className='check-row';const check=document.createElement('input');check.type='checkbox';check.checked=item.done;check.ariaLabel='Completar elemento';check.addEventListener('change',()=>{item.done=check.checked;scheduleSave();render(false);});const input=document.createElement('input');input.type='text';input.value=item.text;input.placeholder='Elemento de la lista';input.maxLength=400;input.addEventListener('input',()=>{item.text=input.value;scheduleSave();});const remove=document.createElement('button');remove.type='button';remove.className='icon-only';remove.ariaLabel='Eliminar elemento';remove.innerHTML=svg('x');remove.addEventListener('click',()=>{note.items=note.items.filter(x=>x.id!==item.id);if(!note.items.length)note.items.push({id:uid(),text:'',done:false});renderChecklist(note);scheduleSave();});row.append(check,input,remove);box.append(row);}}
$('add-check').addEventListener('click',()=>{if(!state.current)return;state.current.items.push({id:uid(),text:'',done:false});renderChecklist(state.current);scheduleSave();});
$('note-title').addEventListener('input',e=>{if(state.current){state.current.title=e.target.value;scheduleSave();}});$('note-body').addEventListener('input',e=>{if(state.current){state.current.body=e.target.value;scheduleSave();}});$('note-labels').addEventListener('input',e=>{if(state.current){state.current.labels=parseLabels(e.target.value);scheduleSave();}});
for(const b of document.querySelectorAll('[data-color]'))b.addEventListener('click',()=>{if(!state.current)return;state.current.color=b.dataset.color;for(const x of document.querySelectorAll('[data-color]'))x.classList.toggle('active',x===b);scheduleSave();render(false);});
$('pin-note').addEventListener('click',()=>mutate(n=>n.pinned=!n.pinned));$('archive-note').addEventListener('click',()=>mutate(n=>{n.archived=!n.archived;n.trashed=false;}));$('trash-note').addEventListener('click',()=>mutate(n=>{if(n.trashed)n.trashed=false;else{n.trashed=true;n.archived=false;}}));
async function mutate(fn){if(!state.current)return;fn(state.current);await persist(state.current);fillEditor(state.current);render(false);}
$('close-editor').addEventListener('click',async()=>{clearTimeout(state.saveTimer);if(state.current)await persist(state.current);state.current=null;$('editor').hidden=true;render(false);});
$('delete-forever').addEventListener('click',async()=>{if(!state.current?.trashed)return;const id=state.current.id;await deleteRow(id);state.notes=state.notes.filter(n=>n.id!==id);state.current=null;$('editor').hidden=true;render(false);});

$('export-vault').addEventListener('click',async()=>{const payload=await exportVault(),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`jot-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);});
$('import-vault').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async()=>{const file=$('import-file').files?.[0];if(!file)return;try{const payload=JSON.parse(await file.text());await importVault(payload);state.meta=await getMeta();lock();$('access-status').textContent='Respaldo importado. Desbloquéalo con la contraseña de ese archivo.';}catch(error){alert(error.message||'No se pudo importar el respaldo.');}finally{$('import-file').value='';}});

window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'&&!$('app').hidden){e.preventDefault();create(e.shiftKey?'checklist':'note');}if(e.key==='Escape'&&!$('editor').hidden)$('close-editor').click();});

boot();
