import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tools } from '../shared/catalog.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(fileURLToPath(new URL('../',import.meta.url)));
for(const directory of ['transcribe','audio']) {
const vendors=JSON.parse(await readFile(resolve(root,directory,'vendor/manifest.json'),'utf8'));
for(const vendor of vendors) {
  const bytes=await readFile(resolve(root,directory,'vendor',vendor.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),vendor.sha256,`Lector incompleto o modificado: ${vendor.file}`);
  for(const license of vendor.licenses) await access(resolve(root,directory,'vendor',license));
}
}
let checked = 0;
async function checkReference(source, reference) {
  if (!reference.startsWith('./') && !reference.startsWith('../')) return;
  const target = resolve(dirname(source), reference.split(/[?#]/)[0]);
  if (target !== root && !target.startsWith(root + sep)) throw new Error(`Ruta fuera del sitio: ${reference}`);
  await access(target); checked++;
}
for (const relativePath of ['index.html',...tools.map(tool=>`${tool.id}/index.html`)]) {
  const source=resolve(root,relativePath), html=await readFile(source,'utf8');
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) await checkReference(source,match[1]);
  const tool=tools.find(tool=>relativePath===`${tool.id}/index.html`);
  assert.ok(html.includes(`<title>${tool?`${tool.name} · Reynoso Toolchain`:'Reynoso Toolchain'}</title>`),`Título incorrecto: ${relativePath}`);
  if(tool) {
    assert.match(html, /href="\.\.\/"/,`Sin vuelta al landing: ${relativePath}`);
    if(!tool.ready) {
      assert.match(html,/EN DESARROLLO/);
      assert.doesNotMatch(html,/<(?:input|textarea|form)\b|<script\b/,`Placeholder con procesamiento simulado: ${relativePath}`);
      assert.match(html,/Todavía no procesa archivos ni ejecuta acciones/);
    }
  }
}
for (const directory of ['drop','transcribe','transcribe/vendor','shared','snippets','snippets/lib','snippets/data','audio','audio/vendor']) {
  for (const name of await readdir(resolve(root,directory))) {
    if (!/\.(?:m?js)$/.test(name)) continue;
      const source=resolve(root,directory,name), content=await readFile(source,'utf8');
    if(directory.startsWith('transcribe')||directory.startsWith('snippets')||directory.startsWith('audio')||directory==='shared') execFileSync(process.execPath,['--check',source]);
    for(const match of content.matchAll(/(?:from\s+|import\s*\(|new URL\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)) await checkReference(source,match[2]);
  }
}
const sw=await readFile(resolve(root,'drop/service-worker.js'),'utf8');
const shell=sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
for(const match of shell.matchAll(/'([^']+)'/g)) await checkReference(resolve(root,'drop/service-worker.js'),match[1]);
const manifest=JSON.parse(await readFile(resolve(root,'drop/manifest.webmanifest'),'utf8'));
for(const reference of [manifest.start_url,manifest.scope,...manifest.icons.map(icon=>icon.src)]) await checkReference(resolve(root,'drop/manifest.webmanifest'),reference);
const readme=await readFile(resolve(root,'README.md'),'utf8');
for(const route of tools.map(tool=>`${tool.id}/`)) {
  if(!readme.includes(`https://reynosoch.github.io/${route}`)) throw new Error(`Falta acceso directo en README: ${route}`);
}
const landing=await readFile(resolve(root,'index.html'),'utf8');
for(const tool of tools) assert.equal([...landing.matchAll(new RegExp(`data-tool="${tool.id}"`,'g'))].length,1,`Tarjeta duplicada o ausente: ${tool.id}`);
const landingScripts=[...landing.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map(match=>match[1]);
assert.deepEqual(landingScripts,['./hub.mjs'],'El landing solo debe cargar su búsqueda ligera');
const hub=await readFile(resolve(root,'hub.mjs'),'utf8');
assert.doesNotMatch(hub,/peerjs|tesseract|transformers|duckdb|serviceWorker\.register/i,'El landing no debe cargar motores');
for(const match of hub.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) await checkReference(resolve(root,'hub.mjs'),match[1]);
console.log(`Rutas verificadas: landing + ${tools.length} herramientas, títulos, regreso, ${checked} recursos y PWA.`);
