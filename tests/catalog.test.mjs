import test from 'node:test';
import assert from 'node:assert/strict';
import { tools, categories, dailyOrder } from '../shared/catalog.mjs';
import { matchesTool, normalizeQuery } from '../shared/search.mjs';
test('catalog exposes the requested stable routes without duplicate or fake ready apps',()=>{
  const routes=['drop','transcribe','inspect','diff','clean','sql','context','prompt','json','api','regex','code','image','audio','pdf','shot','encode','qr','convert','errors','snippets','projects'];
  assert.deepEqual(tools.map(tool=>tool.id),routes);
  assert.equal(new Set(tools.map(tool=>tool.id)).size,22);
  assert.deepEqual(tools.filter(tool=>tool.ready).map(tool=>tool.id),['drop','transcribe']);
  assert.equal(tools.filter(tool=>!tool.ready).length,20);
  for(const tool of tools) {
    assert.ok(/^[a-z]+$/.test(tool.id)); assert.ok(categories.some(category=>category.id===tool.category));
    assert.ok(tool.summary&&tool.purpose&&tool.features.length&&tool.examples.length);
    for(const id of tool.related) assert.ok(tools.some(other=>other.id===id),`Unknown related tool: ${id}`);
  }
});
test('daily tools have the agreed order and future flow relationships remain possible',()=>{
  assert.deepEqual(dailyOrder,['drop','transcribe','inspect','diff','context']);
  assert.deepEqual(tools.filter(tool=>tool.daily).map(tool=>tool.id).sort(),[...dailyOrder].sort());
  for(const [from,to] of [['inspect','clean'],['clean','diff'],['diff','drop'],['audio','transcribe'],['transcribe','drop'],['shot','transcribe'],['shot','context'],['transcribe','context']]) assert.ok(tools.find(tool=>tool.id===from).related.includes(to));
});
test('search matches all words, accents, case and genuine readiness',()=>{
  assert.equal(normalizeQuery(' CÓDIGO '),'codigo');
  assert.equal(matchesTool('Código y capturas','codigo CAPTURAS',true),true);
  assert.equal(matchesTool('Código y capturas','codigo excel',true),false);
  assert.equal(matchesTool('Drop','',true,'ready'),true);
  assert.equal(matchesTool('Inspect','',false,'ready'),false);
  assert.equal(matchesTool('Inspect','',false,'dev'),true);
  assert.equal(matchesTool('Drop','',true,'dev'),false);
});
