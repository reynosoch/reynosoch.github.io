import {workspaceTools} from './workspace-tools.mjs';

const current=document.body.dataset.portal;
const root=new URL('../',import.meta.url);
const gate=document.querySelector('#gate');
const appHeader=document.querySelector('header');
const header=gate&&!gate.hidden?gate.querySelector('.gate-copy'):appHeader;
if(header&&!document.getElementById('workspace-open')){
  const trigger=document.createElement('button');
  trigger.id='workspace-open';trigger.type='button';trigger.className='workspace-trigger';
  trigger.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Herramientas</span><kbd>Alt K</kbd>';
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','workspace-dialog');
  trigger.setAttribute('aria-expanded','false');
  header.append(trigger);
  if(gate)new MutationObserver(()=>{const target=gate.hidden?(appHeader.querySelector('.header-actions')||appHeader):gate.querySelector('.gate-copy');target.append(trigger);}).observe(gate,{attributes:true,attributeFilter:['hidden']});
  const dialog=document.createElement('dialog');dialog.id='workspace-dialog';dialog.setAttribute('aria-labelledby','workspace-title');
  dialog.innerHTML='<div class="workspace-dialog-head"><div><p class="section-kicker">REYNOSO / ESPACIO DE TRABAJO</p><h2 id="workspace-title">Cambiar de herramienta</h2></div><button type="button" id="workspace-close" aria-label="Cerrar selector">×</button></div><label class="workspace-search-label" for="workspace-search">Buscar por herramienta o tarea</label><input id="workspace-search" type="search" autocomplete="off" placeholder="Audio, capturas, archivos, notas…"><p id="workspace-count" role="status" aria-live="polite"></p><nav id="workspace-list" aria-label="Herramientas disponibles"></nav><p id="workspace-empty" hidden>No hay coincidencias. Pruebe con otra tarea.</p><div class="workspace-dialog-foot"><a id="workspace-catalog" target="_blank" rel="noopener noreferrer">Catálogo completo</a><a id="workspace-lab" target="_blank" rel="noopener noreferrer">Explorar LAB ↗</a></div><p class="workspace-note">Los accesos se abren en otra pestaña para conservar su trabajo.</p>';
  document.body.append(dialog);
  const search=dialog.querySelector('#workspace-search'),list=dialog.querySelector('#workspace-list');
  dialog.querySelector('#workspace-catalog').href=root.href;
  dialog.querySelector('#workspace-lab').href=new URL('reynoso-lab/',root).href;
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function render(){
    let recents=[];try{const value=JSON.parse(localStorage.getItem('reynoso-toolchain:recent:v1')||'[]');if(Array.isArray(value))recents=value.filter(r=>r&&typeof r.id==='string'&&Number.isFinite(r.at)).sort((a,b)=>b.at-a.at).map(r=>r.id);}catch{}
    const ordered=[...workspaceTools].sort((a,b)=>{const ai=recents.indexOf(a.id),bi=recents.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi);});
    const words=normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const matches=ordered.filter(t=>words.every(w=>normalize(t.name+' '+t.summary+' '+t.keywords).includes(w)));
    list.replaceChildren();
    for(const tool of matches){
      const active=tool.id===current,link=document.createElement(active?'div':'a');link.className='workspace-item';link.dataset.family=tool.family;
      if(active){link.setAttribute('aria-current','page');}else{link.href=new URL(tool.id+'/',root).href;link.target='_blank';link.rel='noopener noreferrer';}
      const mark=document.createElement('span');mark.className='workspace-tool-mark';mark.textContent=tool.name.slice(0,2);
      const copy=document.createElement('span'),name=document.createElement('strong'),summary=document.createElement('small');name.textContent=tool.name;summary.textContent=tool.summary;copy.append(name,summary);
      const tail=document.createElement('span');tail.className='workspace-item-tail';tail.textContent=active?'Actual':'↗';link.append(mark,copy,tail);list.append(link);
    }
    dialog.querySelector('#workspace-count').textContent=`${matches.length} herramientas disponibles`;
    dialog.querySelector('#workspace-empty').hidden=matches.length>0;
  }
  function open(){if(document.querySelector('dialog[open]'))return;search.value='';render();dialog.showModal();trigger.setAttribute('aria-expanded','true');search.focus();}
  trigger.addEventListener('click',open);
  dialog.querySelector('#workspace-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}});
  dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  search.addEventListener('input',render);
  search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const first=list.querySelector('a');if(first){e.preventDefault();first.focus();}}});
  list.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const links=[...list.querySelectorAll('a')],at=links.indexOf(document.activeElement);if(at<0)return;e.preventDefault();const next=at+(e.key==='ArrowDown'?1:-1);if(next<0)search.focus();else links[Math.min(next,links.length-1)]?.focus();});
  document.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.key.toLowerCase()==='k'){e.preventDefault();dialog.open?dialog.close():open();}});
}
