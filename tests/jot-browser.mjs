import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{try{let p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==root&&!p.startsWith(root+'/'))throw Error();if((await stat(p)).isDirectory())p=resolve(p,'index.html');res.writeHead(200,{'Content-Type':types[extname(p)]||'application/octet-stream'});res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const password=`qa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let browser;
async function unlock(page){
  await page.waitForSelector('body[data-ready=true]');
  if(await page.locator('#app').isHidden()){
    await page.fill('#password',password);await page.click('#access-submit');await page.waitForFunction(()=>!document.querySelector('#app').hidden);
  }
}
try{
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1366,height:900}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // An independently cached session module can arrive before Drop's application.
  await page.route('**/drop/app.js*',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.continue();});
  await page.goto(base+'/jot/');await page.waitForSelector('body[data-ready=true]');
  assert.equal(await page.locator('#username').inputValue(),'admin');
  assert.equal(await page.locator('#password').inputValue(),'');
  assert.equal(await page.locator('#confirm-wrap').isVisible(),true);
  await page.fill('#password',password);await page.fill('#password-confirm',password);await page.click('#access-submit');
  await page.waitForFunction(()=>!document.querySelector('#app').hidden);
  await page.click('#new-note');await page.fill('#note-title','Pendiente del día');await page.fill('#note-body','Revisar inventario a las 2 y entregar reporte.');await page.fill('#note-labels','trabajo, hoy');
  await page.waitForTimeout(850);await page.waitForFunction(()=>document.querySelector('#saved-state').textContent==='Guardado local');
  const stored=await page.evaluate(async()=>{const d=await new Promise((res,rej)=>{const r=indexedDB.open('reynoso-jot');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});const noteRows=await new Promise((res,rej)=>{const r=d.transaction('notes').objectStore('notes').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});const meta=await new Promise((res,rej)=>{const r=d.transaction('meta').objectStore('meta').get('vault');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return {noteRows,meta};});
  assert.equal(stored.noteRows.length,1);const raw=JSON.stringify(stored.noteRows);assert(!raw.includes('Pendiente del día'));assert(!raw.includes('Revisar inventario'));assert.equal(stored.meta.username,'admin');assert(!('password' in stored.meta));
  await page.click('#close-editor');await page.waitForFunction(()=>document.querySelector('#saved-state').textContent==='Guardado local');await page.click('#lock-vault');
  await page.fill('#password',password);await page.click('#access-submit');await page.waitForFunction(()=>!document.querySelector('#app').hidden);assert.match(await page.locator('#notes').innerText(),/Pendiente del día/);
  await page.reload();await unlock(page);assert.match(await page.locator('#notes').innerText(),/Pendiente del día/);
  const downloadEvent=page.waitForEvent('download');await page.click('#export-vault');const download=await downloadEvent,backup=await readFile(await download.path(),'utf8');assert.equal(download.suggestedFilename().startsWith('jot-backup-'),true);assert(!backup.includes('Pendiente del día'));assert(!backup.includes('Revisar inventario'));

  await page.locator('#notes .note-card').first().click();await page.click('#send-drop-text');
  await page.waitForFunction(()=>location.pathname.endsWith('/drop/')&&document.querySelector('#text-input')?.value.includes('Pendiente del día'));
  assert.match(await page.locator('#text-input').inputValue(),/Revisar inventario a las 2/);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('reynoso-toolchain:drop-handoff:v1')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('reynoso-drop:text-draft')),null);

  await page.goto(base+'/jot/');await unlock(page);await page.locator('#notes .note-card').first().click();await page.click('#send-drop-file');
  await page.waitForFunction(()=>location.pathname.endsWith('/drop/')&&document.querySelector('#file-queue')?.textContent.includes('Pendiente-del-dia.txt'));
  assert.match(await page.locator('#file-queue').innerText(),/Pendiente-del-dia\.txt/);

  await page.goto(base+'/');await page.waitForFunction(()=>document.querySelector('[data-tool="jot"]'));await page.waitForFunction(()=>document.querySelector('#recent-tools [data-tool="jot"]'));assert.match(await page.locator('[data-tool="jot"]').innerText(),/Jot/);
  assert.deepEqual(errors,[]);
  console.log('Jot browser: cifrado, persistencia, respaldo, handoff texto/TXT a Drop y recientes OK.');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
