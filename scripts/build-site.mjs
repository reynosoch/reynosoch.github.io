import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { tools } from '../shared/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'dist');
await rm(dist,{recursive:true,force:true}); await mkdir(dist);
for(const file of ['index.html','hub.css','hub.mjs','favicon.svg','.nojekyll','shared']) await cp(resolve(root,file),resolve(dist,file),{recursive:true});
await cp(resolve(root,'drop/dist'),resolve(dist,'drop'),{recursive:true});
for(const tool of tools.filter(t=>t.ready&&t.id!=='drop')) await cp(resolve(root,tool.id),resolve(dist,tool.id),{recursive:true,filter: source => !/\/(tests|README\.md)(\/|$)/.test(source)});
for(const tool of tools.filter(tool=>!tool.ready)) {
  await mkdir(resolve(dist,tool.id),{recursive:true});
  await cp(resolve(root,tool.id,'index.html'),resolve(dist,tool.id,'index.html'));
}
console.log(`Reynoso Toolchain listo en dist/: landing y ${tools.length} herramientas.`);
