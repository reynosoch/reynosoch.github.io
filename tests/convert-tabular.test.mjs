import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectTable,parseDelimited,repairSingleColumn} from '../convert/tabular.mjs';
import {worksheetXml} from '../convert/sheet-layout.mjs';

test('detects pipe exports without splitting commas inside descriptions',()=>{
  const result=detectTable('\uFEFFSeq  |Parent Item|Description|Usage\r\n  1|VP-123|IC-MEM 8GB, FBGA|1.25\r\n2|VP-456|Vendor, Inc.|0\r\n');
  assert.equal(result.delimiter,'|');
  assert.deepEqual(result.rows,[['Seq','Parent Item','Description','Usage'],['1','VP-123','IC-MEM 8GB, FBGA','1.25'],['2','VP-456','Vendor, Inc.','0']]);
});
test('supports tabs, semicolons, quoted delimiters, escaped quotes and multiline cells',()=>{
  for(const separator of ['\t',';',','])assert.equal(detectTable(`Part${separator}Qty\nABC${separator}2`).delimiter,separator);
  assert.deepEqual(parseDelimited('Name;Note\n"A; B";"line 1\nline ""2"""',';'),[['Name','Note'],['A; B','line 1\nline "2"']]);
  assert.equal(detectTable('Una nota de trabajo\nOtro párrafo'),null);
  assert.equal(detectTable('A|B|C\n1|2'),null);
});
test('repairs one-column workbooks only when all rows form a consistent table',()=>{
  assert.deepEqual(repairSingleColumn([['A|B'],['1|2']]).rows,[['A','B'],['1','2']]);
  assert.equal(repairSingleColumn([['A','B'],['1','2']]),null);
});
test('worksheet has readable widths, no decoration and safe literal identifiers',()=>{
  const xml=worksheetXml([['Part','Qty','Cost'],['00123','2','3.50'],['=1+1','0','18.00']]);
  assert.doesNotMatch(xml,/<autoFilter|<pane| s="|<fill|<color/);
  assert.match(xml,/<cols><col/);
  assert.match(xml,/<c r="A2"[^>]*t="inlineStr"/);
  assert.match(xml,/<c r="B2"><v>2<\/v>/);
  assert.doesNotMatch(xml,/<f>/);
  assert.doesNotMatch(worksheetXml([['A'],['B']],false),/<autoFilter|<pane/);
});
