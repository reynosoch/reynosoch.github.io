import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../',import.meta.url)));
let checked = 0;
async function checkReference(source, reference) {
  if (!reference.startsWith('./') && !reference.startsWith('../')) return;
  const target = resolve(dirname(source), reference.split(/[?#]/)[0]);
  if (target !== root && !target.startsWith(root + sep)) throw new Error(`Ruta fuera del sitio: ${reference}`);
  await access(target); checked++;
}
for (const relativePath of ['index.html','drop/index.html','transcribe/index.html']) {
  const source=resolve(root,relativePath), html=await readFile(source,'utf8');
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) await checkReference(source,match[1]);
}
for (const directory of ['drop','transcribe']) {
  for (const name of await readdir(resolve(root,directory))) {
    if (!/\.(?:m?js)$/.test(name)) continue;
    const source=resolve(root,directory,name), content=await readFile(source,'utf8');
    for(const match of content.matchAll(/(?:from\s+|import\s*\(|new URL\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)) await checkReference(source,match[2]);
  }
}
const sw=await readFile(resolve(root,'drop/service-worker.js'),'utf8');
const shell=sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
for(const match of shell.matchAll(/'([^']+)'/g)) await checkReference(resolve(root,'drop/service-worker.js'),match[1]);
const manifest=JSON.parse(await readFile(resolve(root,'drop/manifest.webmanifest'),'utf8'));
for(const reference of [manifest.start_url,manifest.scope,...manifest.icons.map(icon=>icon.src)]) await checkReference(resolve(root,'drop/manifest.webmanifest'),reference);
const readme=await readFile(resolve(root,'README.md'),'utf8');
for(const route of ['drop/','transcribe/']) {
  if(!readme.includes(`https://reynosoch.github.io/${route}`)) throw new Error(`Falta acceso directo en README: ${route}`);
}
console.log(`Rutas verificadas: ${checked} recursos de portada, Drop, Transcribe y PWA.`);
