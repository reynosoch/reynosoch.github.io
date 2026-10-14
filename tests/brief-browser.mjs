import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';

const root=resolve(new URL('../',import.meta.url).pathname),artifacts=process.env.BRIEF_QA_ARTIFACT_DIR||resolve(tmpdir(),'reynoso-brief-qa');
await mkdir(artifacts,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{try{let p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p!==root&&!p.startsWith(root+'/'))throw Error();if((await stat(p)).isDirectory())p=resolve(p,'index.html');res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream'});res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');assert.equal(await page.locator('[data-tool=brief]').count(),1);assert.match(await page.locator('[data-tool=brief]').innerText(),/LISTO/);await page.locator('[data-tool=brief]').click();
  await page.waitForSelector('body[data-ready=true]');assert(await page.locator('#copy').isDisabled());
  await page.fill('#title','Revisión del panel');await page.fill('#project','Inventario');await page.fill('#repository','https://example.test/project');await page.fill('#goal','Corregir las anotaciones sin cambiar cálculos.');await page.fill('#changes','Alinear el título\nConservar los marcadores de Shot');
  await page.selectOption('#template','visual');assert.match(await page.locator('#preview').inputValue(),/Conservar la funcionalidad existente/);
  await page.fill('#evidence','Captura 1: navbar.png\nNota literal: <script>alert(1)</script>');await page.click('#copy');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('copiado'));
  const text=await page.evaluate(()=>navigator.clipboard.readText());assert.match(text,/Rama: main/);assert.match(text,/- \[ \] Verificar escritorio y móvil/);assert.match(text,/<script>alert\(1\)<\/script>/);assert.equal(await page.locator('script:not([src])').count(),0);
  const md=page.waitForEvent('download');await page.click('#download');assert.equal(await readFile(await(await md).path(),'utf8'),text);
  await page.reload();await page.waitForSelector('body[data-ready=true]');assert.equal(await page.locator('#preview').inputValue(),text);
  page.once('dialog',d=>d.dismiss());await page.selectOption('#template','meeting');assert.match(await page.locator('#checks').inputValue(),/escritorio/);
  await page.click('#duplicate');assert.equal(await page.locator('.draft-row').count(),2);assert.match(await page.locator('#title').inputValue(),/copia/);
  const backupDownload=page.waitForEvent('download');await page.click('#backup');const backup=await readFile(await(await backupDownload).path());assert.equal(JSON.parse(backup).drafts.length,2);
  const fresh=await browser.newContext(),restore=await fresh.newPage();await restore.goto(base+'/brief/');await restore.waitForSelector('body[data-ready=true]');await restore.setInputFiles('#import-file',{name:'backup.json',mimeType:'application/json',buffer:backup});await restore.waitForFunction(()=>document.querySelectorAll('.draft-row').length===2);assert.equal(await restore.locator('#goal').inputValue(),'Corregir las anotaciones sin cambiar cálculos.');await fresh.close();
  await page.setInputFiles('#import-file',{name:'backup.json',mimeType:'application/json',buffer:backup});await page.waitForFunction(()=>document.querySelectorAll('.draft-row').length===4);assert.equal(new Set(JSON.parse(await page.evaluate(()=>localStorage.getItem('reynoso-brief:v1'))).drafts.map(d=>d.id)).size,4);
  await page.setInputFiles('#import-file',{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('no corresponde'));assert.equal(await page.locator('.draft-row').count(),4);
  page.once('dialog',d=>d.dismiss());await page.click('#delete');assert.equal(await page.locator('.draft-row').count(),4);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(artifacts,'brief-desktop.png'),fullPage:true});
  for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(artifacts,'brief-mobile.png'),fullPage:true});
  await page.click('a[href="../"]');await page.waitForURL(base+'/');assert(await page.locator('#recent-tools [data-tool=brief]').isVisible());
  // A blocked local store remains editable with an explicit session-only notice.
  const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw Error('Storage blocked');}});});const q=await blocked.newPage();await q.goto(base+'/brief/');await q.waitForSelector('body[data-ready=true]');await q.fill('#goal','Encargo temporal');assert.match(await q.locator('#saved').innerText(),/Solo en esta sesión/);assert(await q.locator('#download').isEnabled());await blocked.close();
  assert.deepEqual(errors,[]);console.log('Brief: catálogo, borrador real, plantillas, portapapeles, Markdown, recuperación, respaldo/importación sin sobrescritura, 4 tamaños, recientes y almacenamiento bloqueado OK.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
