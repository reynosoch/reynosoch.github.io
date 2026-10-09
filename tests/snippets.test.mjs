import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { defaultSnippets } from '../snippets/data/default-snippets.mjs';
import { selectSnippets, frequentSnippets } from '../snippets/lib/search.mjs';
import { createLibrary } from '../snippets/lib/storage.mjs';
import { effectiveSafety, normalizeSnippet, recipeSteps } from '../snippets/lib/model.mjs';
import { exportLibrary, parseLibrary, planImport } from '../snippets/lib/import-export.mjs';
import { card, detail } from '../snippets/lib/ui.mjs';
const get=id=>defaultSnippets.find(s=>s.id===`default:${id}`);
const custom=(fields={})=>({...get('git-status'),id:'custom:test',custom:true,...fields});
async function fresh(){const factory=new IDBFactory();const library=createLibrary(factory);await library.initialize();return {factory,library};}
test('defaults have complete validated records and 40–60 useful entries',()=>{
  assert.ok(defaultSnippets.length>=40&&defaultSnippets.length<=60);
  assert.equal(new Set(defaultSnippets.map(s=>s.id)).size,defaultSnippets.length);
  for(const s of defaultSnippets)assert.deepEqual(normalizeSnippet(s),s);
});
test('task search supports examples, accents, descriptions and tags',()=>{
  for(const [query,id] of [['traer cambios de main','git-pull'],['levantar vite','npm-dev'],['crear entorno python','python-venv'],['traer cambios','git-pull'],['¿',null]]){
    const results=selectSnippets(defaultSnippets,{query});if(id)assert.ok(results.some(s=>s.id===get(id).id));else assert.equal(results.length,0);
  }
  assert.ok(selectSnippets(defaultSnippets,{query:'versión sdk'}).length);
  assert.ok(selectSnippets(defaultSnippets,{query:'puerto ocupado'}).some(s=>s.id===get('ps-port').id));
  assert.equal(selectSnippets(defaultSnippets,{query:'cadena-inexistente'}).length,0);
});
test('technology filter combines with task and favorites filters',()=>{
  const list=defaultSnippets.map(s=>({...s,favorite:s.id===get('git-status').id}));
  assert.ok(selectSnippets(list,{technology:'Python'}).every(s=>s.technology==='Python'));
  assert.deepEqual(selectSnippets(list,{technology:'Git / GitHub',filter:'favorites'}).map(s=>s.id),[get('git-status').id]);
  assert.equal(selectSnippets(list,{technology:'Java',query:'python'}).length,0);
});
test('IndexedDB initialization is idempotent, survives reopening and preserves deletions',async()=>{
  const {library,factory}=await fresh();await library.put(custom());await library.remove(get('git-status').id);
  const reopened=createLibrary(factory);await reopened.initialize();const all=await reopened.all();
  assert.ok(all.some(s=>s.id==='custom:test'));assert.ok(!all.some(s=>s.id===get('git-status').id));assert.equal(all.length,defaultSnippets.length);
});
test('favorites and concurrent usage counters persist across sessions',async()=>{
  const {library,factory}=await fresh();const id=get('git-pull').id;
  await library.update(id,s=>({...s,favorite:!s.favorite}));
  await Promise.all(Array.from({length:8},()=>library.update(id,s=>({...s,usageCount:s.usageCount+1,lastUsed:'2026-10-09T13:00:00.000Z'}))));
  const s=(await createLibrary(factory).all()).find(s=>s.id===id);assert.equal(s.favorite,true);assert.equal(s.usageCount,8);assert.equal(s.lastUsed,'2026-10-09T13:00:00.000Z');
});
test('restore replenishes defaults while preserving custom records and default usage',async()=>{
  const {library}=await fresh();await library.put(custom());await library.remove(get('git-status').id);await library.update(get('git-pull').id,s=>({...s,favorite:true,usageCount:5}));await library.restore();
  const all=await library.all();assert.equal(all.length,defaultSnippets.length+1);assert.ok(all.some(s=>s.id==='custom:test'));assert.ok(all.some(s=>s.id===get('git-status').id));assert.equal(all.find(s=>s.id===get('git-pull').id).usageCount,5);assert.equal(all.find(s=>s.id===get('git-pull').id).favorite,true);
});
test('import is atomic and never silently overwrites an existing ID',async()=>{
  const {library}=await fresh();await assert.rejects(library.import([custom(),get('git-status')]));assert.ok(!(await library.all()).some(s=>s.id==='custom:test'));
  await assert.rejects(library.import([custom(),custom({id:'custom:broken',name:''})]));assert.ok(!(await library.all()).some(s=>s.id==='custom:test'));
});
test('frequent defaults learn from actual counters; recent lists are bounded and sorted',()=>{
  assert.equal(frequentSnippets(defaultSnippets)[0].id,get('git-status').id);
  const used=defaultSnippets.map((s,i)=>({...s,usageCount:i,lastUsed:new Date(1000+i*1000).toISOString()}));
  assert.equal(frequentSnippets(used)[0].usageCount,used.length-1);
  const recent=selectSnippets(used,{filter:'recent'});assert.equal(recent.length,20);assert.equal(recent[0].id,used.at(-1).id);
  assert.equal(selectSnippets(defaultSnippets,{filter:'recent'}).length,0);
});
test('known destructive commands cannot be downgraded by custom/imported safety',()=>{
  for(const command of ['git reset --hard HEAD','git restore .','git clean -fd','Stop-Process -Id 123','DROP TABLE sample;','DELETE FROM t;','Remove-Item . -Recurse','rm -rf folder'])assert.equal(normalizeSnippet(custom({command,safety:'safe'})).safety,'destructive');
  assert.equal(effectiveSafety(get('git-clean-preview')),'safe');assert.equal(effectiveSafety(get('git-status')),'safe');assert.equal(get('git-push').safety,'caution');
});
test('recipes retain ordered steps and multiline SQL stays one command',()=>{
  assert.deepEqual(recipeSteps(get('recipe-update')),['git status','git pull origin main','npm install','npm run dev']);
  assert.equal(recipeSteps(get('sql-group')).length,1);
  assert.throws(()=>normalizeSnippet(custom({type:'recipe',command:'git status'})),/dos pasos/);
});
test('export/import preserves full metadata and rejects malformed or oversized payloads',()=>{
  assert.deepEqual(parseLibrary(exportLibrary(defaultSnippets)),defaultSnippets);
  for(const text of ['{}','invalid',JSON.stringify({app:'reynoso-snippets',version:2,snippets:[]}),JSON.stringify({app:'reynoso-snippets',version:1,snippets:[custom(),custom()]})])assert.throws(()=>parseLibrary(text));
  assert.throws(()=>parseLibrary(' '.repeat(4*1024*1024+1)),/4 MB/);
  assert.throws(()=>parseLibrary(exportLibrary([custom({tags:['x'.repeat(81)]})])));
});
test('collisions become new custom records, identical copies skip, new defaults cannot replace restore targets',()=>{
  let i=0;const plan=planImport([get('git-status')],[get('git-status'),{...get('git-status'),name:'Otra variante'},get('git-pull')],()=>`custom:import-${++i}`);
  assert.equal(plan.duplicates,1);assert.equal(plan.collisions,2);assert.equal(plan.records.length,2);assert.ok(plan.records.every(s=>s.id.startsWith('custom:')&&s.custom));
});
test('UI escapes personal content and labels recipe/destructive controls',()=>{
  const html=card(custom({name:'<script>alert(1)</script>',command:'echo "<img>"'}));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img&gt;'));
  assert.match(detail(get('recipe-update')),/data-step="3"/);assert.match(card(get('git-reset')),/Revisar y copiar/);
});
test('Snippets route includes local assets, exit link and accessible dialogs',async()=>{
  const html=await readFile(new URL('../snippets/index.html',import.meta.url),'utf8');assert.match(html,/<title>Snippets · Reynoso Toolchain<\/title>/);assert.match(html,/href="\.\.\/"/);assert.match(html,/label for="technology"/);assert.match(html,/dialog id="confirmation"/);assert.doesNotMatch(html,/<script[^>]*src="https?:|<link[^>]*rel="stylesheet"[^>]*href="https?:/);
});
test('worker ignores other apps and deletes only outdated Snippets caches',async()=>{
  const handlers={};const deleted=[];let claimed=false;
  const context={URL,self:{location:{origin:'https://reynosoch.github.io'},registration:{scope:'https://reynosoch.github.io/snippets/'},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,fn)=>{handlers[name]=fn;}},caches:{keys:async()=>['drop-v1','reynoso-snippets-v0','reynoso-snippets-v1','transcribe-model'],delete:async name=>{deleted.push(name);}}};
  vm.runInNewContext(await readFile(new URL('../snippets/service-worker.js',import.meta.url),'utf8'),context);
  let promise;handlers.activate({waitUntil:p=>{promise=p;}});await promise;assert.deepEqual(deleted,['reynoso-snippets-v0']);assert.ok(claimed);
  for(const url of ['https://reynosoch.github.io/','https://reynosoch.github.io/drop/','https://reynosoch.github.io/transcribe/','https://other.example/snippets/','https://reynosoch.github.io/snippets/not-a-shell'])handlers.fetch({request:{url,method:'GET'},respondWith:()=>assert.fail('Out of scope intercepted')});
});
