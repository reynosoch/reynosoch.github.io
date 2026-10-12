import { matchesTool } from './shared/search.mjs';
const search=document.getElementById('tool-search');
const cards=[...document.querySelectorAll('[data-tool]')];
const groups=[...document.querySelectorAll('[data-tool-group]')];
const buttons=[...document.querySelectorAll('[data-state-filter]')];
const runtimeReady=new Set(['convert']);
for(const card of cards){
  if(!runtimeReady.has(card.dataset.tool))continue;
  card.dataset.ready='true';
  card.dataset.search+=' PDF Word DOCX Excel XLSX CSV documentos archivos imagenes convertir conversion';
  card.classList.remove('planned');
  card.classList.add('available');
  const badge=card.querySelector('.state');
  if(badge){badge.className='state is-ready';badge.innerHTML='<i aria-hidden="true"></i>LISTO';}
  const action=card.querySelector('.card-action');
  if(action?.firstChild)action.firstChild.textContent='Abrir herramienta ';
  const summary=card.querySelector('.row-copy p');
  if(summary)summary.textContent='PDF, Word, Excel, imágenes y texto entre formatos.';
  const filesRows=document.querySelector('[aria-labelledby="category-files"] .tool-rows');
  if(filesRows&&card.closest('.tool-rows')!==filesRows)filesRows.append(card);
}
for(const group of document.querySelectorAll('.category-group')){
  const count=group.querySelectorAll('.tool-row').length;
  const label=group.querySelector('.category-count');
  if(label)label.textContent=String(count);
}
let state='all';
function filter() {
  let count=0;
  for(const card of cards) {
    card.hidden=!matchesTool(card.dataset.search,search.value,card.dataset.ready==='true',state);
    if(!card.hidden) count++;
  }
  for(const group of groups) group.hidden=![...group.querySelectorAll('[data-tool]')].some(card=>!card.hidden);
  document.querySelector('.catalog-heading').hidden=!groups.some(group=>group.id!=='daily' && !group.hidden);
  document.getElementById('empty-search').hidden=count>0;
  document.getElementById('search-count').textContent=search.value.trim() || state!=='all' ? `${count} herramienta${count===1?'':'s'}` : `${cards.length} herramientas · ${cards.filter(card=>card.dataset.ready==='true').length} listas para usar`;
}
search.addEventListener('input',filter);
for(const button of buttons) button.addEventListener('click',()=>{
  state=button.dataset.stateFilter;
  for(const other of buttons) other.setAttribute('aria-pressed',String(other===button));
  filter();
});
document.getElementById('clear-search').addEventListener('click',()=>{
  search.value=''; state='all'; for(const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.stateFilter==='all'));
  filter(); search.focus();
});
filter();
