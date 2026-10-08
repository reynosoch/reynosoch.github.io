import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineCount,needsTextFile,textFile} from '../clipboard.js';
test('más de 400 líneas prepara un txt sin alterar Unicode, saltos ni contenido', async () => {
  const small = Array.from({length:400}, (_,i) => `línea ${i} → código`).join('\r\n');
  assert.equal(lineCount(small),400); assert.equal(needsTextFile(small),false);
  const large = `${small}\r\núltima línea 😊`;
  assert.equal(needsTextFile(large),true); assert.equal(lineCount(large),401);
  const file = textFile(large); assert.match(file.name,/\.txt$/); assert.equal(await file.text(),large);
  assert.equal(lineCount('a\rb\r\nc\nd'),4);
  assert.equal(needsTextFile('a'.repeat(512*1024)),false);
  assert.equal(needsTextFile('é'.repeat(512*1024)),true);
});
