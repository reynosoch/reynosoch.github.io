import { matchesTool } from './shared/search.mjs';
const search=document.getElementById('tool-search');
const cards=[...document.querySelectorAll('[data-tool]')];
const groups=[...document.querySelectorAll('[data-tool-group]')];
const buttons=[...document.querySelectorAll('[data-state-filter]')];
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
