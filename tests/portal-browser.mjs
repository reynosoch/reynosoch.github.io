import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {tools} from '../shared/catalog.mjs';

const root=resolve(new URL('../dist/',import.meta.url).pathname);
const artifacts=process.env.PORTAL_QA_ARTIFACT_DIR||resolve(tmpdir(),'reynoso-portal-qa');
await mkdir(artifacts,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try {
    let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+'/'))throw Error('Invalid path');
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});
    res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const routes=['',...tools.map(t=>t.id),'jot'];
  for(const route of routes){
    await page.goto(`${base}/${route}${route?'/':''}`);
    assert.equal(await page.locator('body').getAttribute('data-portal'),route||'toolchain');
    assert.doesNotMatch(await page.locator('body').innerText(),/\b(?:IA|AI)\b|inteligencia artificial/i);
    await page.locator('#workspace-open').click();await page.locator('#workspace-dialog[open]').waitFor();
    assert.equal(await page.locator('#workspace-search').evaluate(el=>el===document.activeElement),true);
    await page.locator('#workspace-search').fill('capturas');assert(await page.locator('#workspace-list').getByText('Shot',{exact:true}).isVisible());
    await page.locator('#workspace-search').fill('ninguna-coincidencia');assert(await page.locator('#workspace-empty').isVisible());
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement===document.querySelector('#workspace-open'));
    for(const viewport of [{width:1440,height:960},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,inner:innerWidth,bg:getComputedStyle(document.body).backgroundColor}));
      assert(metrics.width<=metrics.inner+1,`${route||'Toolchain'} overflows at ${viewport.width}: ${metrics.width}`);
      assert.equal(metrics.bg,'rgb(16, 18, 20)',`${route}: design system not loaded`);
    }
    if(['','drop','transcribe','shot','convert','cutout','audio','snippets','jot','context','diff'].includes(route)){
      await page.setViewportSize({width:1440,height:960});
      await page.screenshot({path:resolve(artifacts,`${route||'toolchain'}-desktop.png`),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:resolve(artifacts,`${route||'toolchain'}-mobile.png`),fullPage:true});
    }
  }
  await page.goto(base+'/');
  await page.keyboard.press('/');assert(await page.locator('#tool-search').evaluate(el=>el===document.activeElement));
  await page.keyboard.press('Alt+k');assert(await page.locator('#workspace-dialog').isVisible());
  await page.locator('#workspace-search').fill('Cutout');await page.keyboard.press('ArrowDown');assert.match(await page.evaluate(()=>document.activeElement.href),/\/cutout\/$/);
  const popupPromise=page.waitForEvent('popup');await page.keyboard.press('Enter');const popup=await popupPromise;await popup.waitForLoadState();assert.match(popup.url(),/\/cutout\/$/);await popup.close();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.ecosystem-details').getAttribute('open'),null);
  await page.locator('.ecosystem-details summary').click();
  assert(await page.locator('.ecosystem-flow').isVisible());
  await page.locator('#tool-search').fill('cutout');
  assert.equal(await page.locator('[data-tool]:visible').count(),1);
  await page.locator('[data-tool=cutout]').click();
  await page.goBack();
  await page.locator('#tool-search').fill('');
  assert(await page.locator('#recent-tools [data-tool=cutout]').isVisible());
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.quick-card').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  assert.deepEqual(errors,[]);
  console.log(`Portal architecture: ${routes.length} routes × 4 viewports, local CSS, no visible model copy, search, recents, LAB disclosure and reduced motion passed.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
