import { mkdir, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive:true, force:true });
await mkdir('dist');
for (const file of ['index.html','styles.css','theme.css','app.js','session.js','service-worker.js','manifest.webmanifest','protocol.js','files.js','clipboard.js','qr.js','devices.js','qrscan.js','favicon.svg','icons','.nojekyll','vendor']) await cp(file, `dist/${file}`, {recursive:true});
console.log('Sitio estático listo en dist/');
