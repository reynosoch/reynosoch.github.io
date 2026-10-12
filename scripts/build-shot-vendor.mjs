import {build} from 'esbuild';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('shot/vendor',{recursive:true});
await build({stdin:{contents:"export {Canvas,StaticCanvas,FabricImage,FabricObject,Rect,Ellipse,Circle,Line,Triangle,Group,Textbox,FabricText,PencilBrush,Point,util,classRegistry,filters,Canvas2dFilterBackend,setFilterBackend} from 'fabric';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,outfile:'shot/vendor/fabric-7.4.0.mjs',legalComments:'eof',target:'es2022'});
await build({stdin:{contents:"export {default} from 'jszip';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,outfile:'shot/vendor/jszip-3.10.2.mjs',legalComments:'eof',target:'es2022'});
await copyFile('node_modules/fabric/LICENSE','shot/vendor/fabric.LICENSE');await copyFile('node_modules/jszip/LICENSE.markdown','shot/vendor/jszip.LICENSE');
const manifest=[];for(const [file,version,license] of [['fabric-7.4.0.mjs','7.4.0','fabric.LICENSE'],['jszip-3.10.2.mjs','3.10.2','jszip.LICENSE']]){const bytes=await readFile('shot/vendor/'+file);manifest.push({file,version,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),licenses:[license]});}
await writeFile('shot/vendor/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(manifest.map(m=>`${m.file}: ${m.bytes} bytes`).join('\n'));
