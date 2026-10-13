import { matchesTool } from './shared/search.mjs';
const search=document.getElementById('tool-search');
const cards=[...document.querySelectorAll('[data-tool]')];
const groups=[...document.querySelectorAll('[data-tool-group]')];
const buttons=[...document.querySelectorAll('[data-state-filter]')];
import {readRecents,recordUse,RECENT_KEY} from './shared/recents.mjs';
const origins=new Map(cards.map(card=>[card,card.parentElement]));
function reorder(){
 const recent=readRecents(),container=document.getElementById('recent-tools');
 for(const card of cards)origins.get(card).append(card);
 for(const entry of recent){const card=cards.find(c=>c.dataset.tool===entry.id);if(card)container.append(card);}
 for(const group of document.querySelectorAll('.category-group')){const label=group.querySelector('.category-count');if(label)label.textContent=String(group.querySelectorAll('[data-tool]').length);}
 filter();
}
for(const card of cards)card.addEventListener('click',()=>recordUse(card.dataset.tool));
window.addEventListener('storage',e=>{if(e.key===RECENT_KEY)reorder();});
window.addEventListener('pageshow',reorder);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reorder();});
let state='all';
function filter() {
  let count=0;
  for(const card of cards) {
    card.hidden=!matchesTool(card.dataset.search,search.value,card.dataset.ready==='true',state);
    if(!card.hidden) count++;
  }
  for(const group of groups) group.hidden=![...group.querySelectorAll('[data-tool]')].some(card=>!card.hidden);
  document.querySelector('.catalog-heading').hidden=!groups.some(group=>group.id!=='daily' && group.id!=='recent' && !group.hidden);
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
reorder();
