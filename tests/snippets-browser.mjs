import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { defaultSnippets } from '../snippets/data/default-snippets.mjs';
import { exportLibrary } from '../snippets/lib/import-export.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(req,res)=>{
  try{
    let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+'/'))throw new Error('Bad path');
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    const type={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'}[extname(path)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  async function waitCount(n){await page.waitForFunction(n=>document.querySelectorAll('#results .snippet-card').length===n,n);}
  async function search(text){await page.locator('#search').fill(text);}
  async function all(){await page.locator('#search').fill('');await page.locator('#technology').selectOption('Todas');await page.locator('[data-filter="all"]').click();}
  async function clipboard(text){await page.waitForFunction(async text=>(await navigator.clipboard.readText())===text,text);}
  async function records(){return page.evaluate(async()=>{const {createLibrary}=await import('/snippets/lib/storage.mjs');return createLibrary().all();});}
  const copy=(id,scope='#results')=>page.locator(`${scope} [data-action="copy"][data-id="default:${id}"]`);
  const open=(id)=>page.locator(`#results [data-action="detail"][data-id="default:${id}"]`);
  await page.goto(base+'/snippets/');await waitCount(defaultSnippets.length);
  assert.equal(await page.title(),'Snippets · Reynoso Toolchain');
  for(const [query,id] of [['traer cambios de main','git-pull'],['levantar vite','npm-dev'],['crear entorno python','python-venv']]){await search(query);assert.ok(await open(id).count());}
  await all();await page.locator('#technology').selectOption('Python');assert.equal(await page.locator('#results .snippet-card').count(),defaultSnippets.filter(s=>s.technology==='Python').length);
  await all();await search('traer cambios');await open('git-pull').click();assert.ok(await page.locator('#detail').isVisible());assert.ok((await page.locator('#detail').innerText()).includes('¿Cuándo usarlo?'));await page.keyboard.press('Escape');
  await copy('git-pull').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Copiado');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'git pull origin main');
  await page.locator('#results [data-action="favorite"]').first().focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement.dataset.action==='favorite'&&document.activeElement.getAttribute('aria-pressed')==='true');await page.locator('[data-filter="favorites"]').click();await waitCount(1);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#results .snippet-card'));await page.locator('[data-filter="favorites"]').click();await waitCount(1);
  await page.locator('[data-filter="recent"]').click();await waitCount(1);assert.equal((await records()).find(s=>s.id==='default:git-pull').usageCount,1);
  await all();await search('reset hard');await copy('git-reset').click();await page.waitForSelector('#confirmation[open]');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'git pull origin main');assert.equal((await records()).find(s=>s.id==='default:git-reset').usageCount,0);
  await copy('git-reset').click();await page.locator('#confirm-accept').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Copiado');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'git reset --hard HEAD');
  await all();await search('actualizar proyecto después');await open('recipe-update').click();await page.locator('#detail [data-step="0"]').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'git status');await page.locator('#detail #toast').waitFor({state:'visible'});await copy('recipe-update','#detail').click();await clipboard('git status\ngit pull origin main\nnpm install\nnpm run dev');await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');assert.equal(await page.evaluate(()=>document.activeElement.id),'search');await page.keyboard.press('Control+Shift+s');await page.waitForSelector('#editor[open]');
  await page.locator('#name').fill('Mi comando de prueba');await page.locator('#command').fill('echo Reynoso');await page.locator('#description').fill('Muestra un texto.');await page.locator('#useCases').fill('Cuando quiero probar la terminal.');await page.locator('#tags').fill('personal, prueba');await page.locator('#snippet-form button[type="submit"]').click();await page.waitForSelector('#editor[open]',{state:'hidden'});
  await search('Mi comando de prueba');await waitCount(1);const personalId=await page.locator('#results [data-action="detail"]').getAttribute('data-id');await page.locator('#results [data-action="detail"]').click();await page.locator('#detail [data-action="edit"]').click();await page.locator('#name').fill('Mi comando editado');await page.locator('#snippet-form button[type="submit"]').click();await search('Mi comando editado');await waitCount(1);assert.equal((await records()).find(s=>s.id===personalId).name,'Mi comando editado');
  await page.locator('#settings-open').click();const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading;const data=JSON.parse(await readFile(await download.path(),'utf8'));assert.ok(data.snippets.some(s=>s.id===personalId));
  const incoming={...defaultSnippets[0],id:personalId,name:'Importado con colisión',custom:true};const json=exportLibrary([incoming]);await page.locator('#import-file').setInputFiles({name:'snippets.json',mimeType:'application/json',buffer:Buffer.from(json)});await page.waitForSelector('#confirmation[open]');assert.ok((await page.locator('#confirm-message').innerText()).includes('1 IDs en conflicto'));await page.locator('#confirm-accept').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='1 snippets importados');assert.ok((await records()).some(s=>s.name==='Mi comando editado'));assert.ok((await records()).some(s=>s.name==='Importado con colisión'&&s.id!==personalId));
  await page.locator('#restore').click();await page.locator('#confirm-accept').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Biblioteca inicial restaurada');assert.ok((await records()).some(s=>s.id===personalId));await page.locator('[data-close="settings"]').click();
  await search('Mi comando editado');await page.locator('#results [data-action="detail"]').click();await page.locator('#detail [data-action="delete"]').click();await page.locator('#confirmation button[value="cancel"]').click();assert.ok((await records()).some(s=>s.id===personalId));await page.locator('#detail [data-action="delete"]').click();await page.locator('#confirm-accept').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Snippet eliminado');assert.ok(!(await records()).some(s=>s.id===personalId));
  await all();
  if(process.env.SCREENSHOT_DIR)await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
  for(const [name,width,height] of [['desktop',1440,1000],['ipad-landscape',1180,820],['ipad-portrait',820,1180],['mobile',390,844]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow: ${name}`);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR,`${name}.png`)});
    await open('git-pull').click();await page.locator('#detail').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});assert.ok(await page.evaluate(()=>{const r=document.querySelector('#detail').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),`Drawer overflow: ${name}`);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR,`${name}-detail.png`)});
    await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await waitCount(defaultSnippets.length+1);await context.setOffline(true);await page.reload();await waitCount(defaultSnippets.length+1);await search('traer cambios');assert.ok(await open('git-pull').count());await context.setOffline(false);
  await page.locator('.home').click();await page.waitForURL(base+'/');assert.equal(await page.locator('[data-tool="snippets"] .state').innerText(),'LISTO');
  for(const [path,title] of [['/','Reynoso Toolchain'],['/drop/','Drop · Reynoso Toolchain'],['/transcribe/','Transcribe · Reynoso Toolchain']]){const response=await page.goto(base+path);assert.equal(response.status(),200);assert.equal(await page.title(),title);if(path!=='/')assert.ok(await page.locator('a[href="../"]').count());}
  const touchContext=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true});
  const touch=await touchContext.newPage();await touch.goto(base+'/snippets/');await touch.waitForSelector('#results .snippet-card');await touch.locator('#search').fill('traer cambios');await touch.locator('#results [data-action="detail"][data-id="default:git-pull"]').tap();assert.ok(await touch.locator('#detail').isVisible());await touch.locator('[data-close="detail"]').tap();await touch.locator('.home').tap();await touch.waitForURL(base+'/');await touchContext.close();
  const blocked=await context.newPage();await blocked.goto(base+'/snippets/');await blocked.waitForSelector('#results .snippet-card');const before=(await records()).find(s=>s.id==='default:git-status').usageCount;
  await blocked.evaluate(()=>{Object.defineProperty(navigator.clipboard,'writeText',{value:async()=>{throw new Error('Denied');}});document.execCommand=()=>false;});await blocked.locator('#search').fill('git status');await blocked.locator('#results [data-action="copy"][data-id="default:git-status"]').click();await blocked.waitForFunction(()=>document.getElementById('toast').textContent.includes('bloqueó copiar'));assert.equal((await records()).find(s=>s.id==='default:git-status').usageCount,before);await blocked.close();
  assert.deepEqual(errors,[]);console.log('Browser OK: search, filters, clipboard, confirmation, persistent favorites/usage, recipes, CRUD, import/export, restore, shortcuts, 4 viewports, offline and routes.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
