import { frequentDefaults } from '../data/default-snippets.mjs';
export const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop=new Set(['de','del','la','el','los','las','un','una','en','para','que','quiero','como','a','y']);
const aliases={traer:'pull',descargar:'pull',bajar:'pull',levantar:'iniciar',arrancar:'iniciar',correr:'ejecutar',csharp:'c#',entorno:'venv'};
function words(text) { return normalize(text).split(/\s+/).filter(x=>x&&!stop.has(x)).map(x=>aliases[x]||x); }
export function searchScore(snippet,query) {
  const tokens=words(query); if(!tokens.length) return 1;
  const title=normalize(snippet.name+' '+snippet.command);
  const haystack=normalize([snippet.name,snippet.command,snippet.description,...snippet.useCases,...snippet.tags,snippet.technology,snippet.platform].join(' '));
  const expanded=haystack+' '+words(haystack).join(' ');
  if(!tokens.every(token=>expanded.includes(token))) return 0;
  return 1+tokens.reduce((n,token)=>n+(title.includes(token)?3:0),0);
}
export function selectSnippets(snippets,{query='',technology='Todas',filter='all'}={}) {
  const selected=snippets.filter(s=>(technology==='Todas'||s.technology===technology)&&(filter!=='favorites'||s.favorite)&&(filter!=='recent'||s.lastUsed)&&(filter!=='used'||s.usageCount>0)&&searchScore(s,query)>0);
  selected.sort((a,b)=>filter==='recent'?Date.parse(b.lastUsed)-Date.parse(a.lastUsed):filter==='used'?b.usageCount-a.usageCount:searchScore(b,query)-searchScore(a,query)||a.name.localeCompare(b.name,'es'));
  return filter==='recent'?selected.slice(0,20):selected;
}
export function frequentSnippets(snippets) {
  const used=snippets.filter(s=>s.usageCount>0).sort((a,b)=>b.usageCount-a.usageCount||(Date.parse(b.lastUsed)||0)-(Date.parse(a.lastUsed)||0));
  return [...used,...frequentDefaults.map(id=>snippets.find(s=>s.id===id)).filter(s=>s&&!used.some(u=>u.id===s.id))].slice(0,6);
}
