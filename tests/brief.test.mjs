import test from 'node:test';
import assert from 'node:assert/strict';
import {newDraft,buildBrief,encode,decode,templates} from '../brief/model.mjs';
test('brief preserves text and criteria without inventing empty requirements',()=>{
  const d={...newDraft(100,'draft'),title:'Cambio visual',goal:'Conservar el cálculo NET.',changes:'1. Revisar navbar\n- Corregir recorte',checks:'No alterar fórmulas\nFunciona en móvil'};
  const text=buildBrief(d);
  assert.match(text,/# Cambio visual/);assert.match(text,/- Revisar navbar\n- Corregir recorte/);assert.match(text,/- \[ \] No alterar fórmulas/);assert.doesNotMatch(text,/## Restricciones|## Entrega|Rama:/);
  assert.equal(buildBrief(newDraft(100,'empty')),'');
});
test('backup preserves fields, rejects oversized, malformed and duplicate drafts',()=>{
  const d={...newDraft(100,'draft'),goal:'Revisar <script> como texto.'};
  assert.deepEqual(decode(encode([d])),[d]);
  for(const s of ['{}','x',JSON.stringify({app:'reynoso-brief',version:2,drafts:[]}),JSON.stringify({app:'reynoso-brief',version:1,drafts:[d,d]})])assert.throws(()=>decode(s));
  assert.throws(()=>encode([{...d,goal:'a'.repeat(6001)}]));assert.throws(()=>decode(' '.repeat(1_000_001)));
  for(const t of Object.values(templates))assert(t.constraints&&t.checks&&t.delivery);
});
