import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileKind, extendQueue, imageMime } from '../files.js';
import { MAX_FILE, MAX_MEMORY } from '../protocol.js';
test('la selección admite formatos de trabajo y conserva los archivos originales, sin conversión', async () => {
  const excel = new File([new Uint8Array([80,75,3,4,0,255,19])], 'Informe.XLSX');
  const csv = new File(['PN,Qty\r\nABC,12\r\n'], 'inventario.csv');
  const original = await excel.arrayBuffer();
  const {files,rejected} = extendQueue([], [excel,csv]);
  assert.equal(rejected.length,0); assert.equal(files[0],excel); assert.equal(files[1],csv);
  assert.deepEqual(await files[0].arrayBuffer(),original);
  for(const name of ['a.xlsx','b.xls','c.xlsm','d.xlsb','e.csv','f.ods']) assert.equal(fileKind(name),'Excel / datos');
  assert.equal(fileKind('a.docx'),'Documento'); assert.equal(fileKind('a.pptx'),'Presentación');
  assert.equal(fileKind('a.pdf'),'PDF'); assert.equal(fileKind('a.zip'),'Comprimido');
  assert.equal(fileKind('a.heic'),'Foto'); assert.equal(fileKind('a.custom'),'Archivo');
});
test('la cola mantiene archivos válidos y aplica límites de tamaño, cantidad y memoria', () => {
  const small = {name:'a.txt',size:10};
  const result = extendQueue([small],[{name:'large.zip',size:MAX_FILE+1},{name:'b.xlsx',size:100}]);
  assert.equal(result.files.length,2); assert.equal(result.files[0],small); assert.equal(result.rejected.length,1);
  assert.equal(extendQueue([{name:'a',size:MAX_FILE},{name:'b',size:MAX_FILE}],[small]).rejected.length,1);
  assert.equal(extendQueue(Array.from({length:30},()=>small),[small]).rejected.length,1);
  assert.equal(extendQueue([], [{name:'one',size:MAX_MEMORY}]).files.length,0);
});
test('la vista previa reconoce bytes de fotos y nunca interpreta HTML o SVG como imágenes', async () => {
  assert.equal(await imageMime(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])])),'image/png');
  assert.equal(await imageMime(new Blob([new Uint8Array([255,216,255,224])])),'image/jpeg');
  assert.equal(await imageMime(new Blob(['GIF89a'])),'image/gif');
  assert.equal(await imageMime(new Blob(['RIFF0000WEBP'])),'image/webp');
  assert.equal(await imageMime(new Blob(['0000ftypheic0000'])),'image/heic');
  assert.equal(await imageMime(new Blob(['0000ftypavif0000'])),'image/avif');
  assert.equal(await imageMime(new Blob(['<svg onload="alert(1)"></svg>'],{type:'image/png'})),null);
  assert.equal(await imageMime(new Blob(['<html><script>alert(1)</script>'],{type:'image/jpeg'})),null);
  assert.equal(await imageMime(new Blob([])),null);
});
