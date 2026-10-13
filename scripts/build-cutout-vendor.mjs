import {build} from 'esbuild';
import {copyFile,writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('cutout/vendor',{recursive:true});
await build({stdin:{contents:"export {segmentForeground} from '@imgly/background-removal';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,outfile:'cutout/vendor/segment-1.7.0.mjs',target:'es2022',legalComments:'eof'});
await copyFile('node_modules/@imgly/background-removal/LICENSE.md','cutout/vendor/imgly.LICENSE');
// ONNX MIT license is checked in alongside the bundle.
await copyFile('node_modules/@imgly/background-removal/ThirdPartyLicenses.json','cutout/vendor/ThirdPartyLicenses.json');
const bytes=await readFile('cutout/vendor/segment-1.7.0.mjs');
await writeFile('cutout/vendor/manifest.json',JSON.stringify([{file:'segment-1.7.0.mjs',version:'1.7.0',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),licenses:['imgly.LICENSE','onnx.LICENSE','ThirdPartyLicenses.json']}],null,2)+'\n');
console.log('CUTOUT bundle',bytes.length);
