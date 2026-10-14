import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdtemp,open,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {wavHeader,validateTimeMap} from '../audio/core.mjs';
import JSZip from 'jszip';
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),scratch=await mkdtemp(resolve(tmpdir(),'audio-qa-'));
const speech=await readFile(resolve(root,'audio/tests/fixtures/speech.wav'));
// WAV fixture has an optional LIST chunk. Locate its data chunk rather than assuming 44 bytes.
let offset=12,pcm;
while(offset+8<speech.length){const size=speech.readUInt32LE(offset+4);if(speech.toString('ascii',offset,offset+4)==='data'){pcm=speech.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
assert(pcm?.length);
async function fixture(duration){
  const name=resolve(scratch,`stereo-${duration}.wav`),file=await open(name,'w'),header=wavHeader(duration*16000),v=new DataView(header.buffer);
  v.setUint16(22,2,true);v.setUint32(28,64000,true);v.setUint16(32,4,true);v.setUint32(40,duration*64000,true);v.setUint32(4,36+duration*64000,true);await file.write(header);
  const slab=Buffer.alloc(64000);
  for(let second=0;second<duration;second++){
    for(let i=0;i<16000;i++){const t=second+i/16000,cycle=t%60,amplitude=Math.floor(t/60)%2?.6:.06;
      const sample=cycle>=4&&cycle<15||cycle>=22&&cycle<33?pcm.readInt16LE((Math.floor((cycle-4)*16000)%(pcm.length/2))*2)/32768:0;
      const noise=.00015*Math.sin(2*Math.PI*73*t)+.0001*Math.sin(2*Math.PI*173*t);
      slab.writeInt16LE(Math.round((sample*amplitude*.4+noise*6)*32767),i*4);slab.writeInt16LE(Math.round((sample*amplitude+noise)*32767),i*4+2);
    }
    await file.write(slab);
  }
  await file.close();return name;
}
const server=createServer(async(req,res)=>{
  try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+'/'))throw Error('Invalid path');if((await stat(path)).isDirectory())path=resolve(path,'index.html');const type={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.svg':'image/svg+xml','.json':'application/json'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push([r.method(),r.url()]));await page.goto(base+'/audio/');
  let lastFixture;const waitReady=()=>page.waitForFunction(()=>!document.querySelector('#prepare').disabled,null,{timeout:120000});
  for(const duration of process.env.AUDIO_QA_LONG==='1'?[30,360,3600]:[30]){
    const path=await fixture(duration);lastFixture=path;await page.setInputFiles('#file-input',path);await page.locator('#consent[open]').waitFor();
    if(duration===30){assert(!requests.some(([,url])=>/audio\/vendor/.test(url)));await page.locator('#consent button[value="cancel"]').click();assert(await page.locator('#prepare').isDisabled());await page.check('#save');await page.click('#analyze');}
    await page.click('#approve');await waitReady();assert((await page.locator('#diagnosis').innerText()).includes('2 canales'));
    if(duration===3600){await page.click('#prepare');await page.click('#approve');await page.click('#cancel');await page.waitForFunction(()=>document.querySelector('#cancel').hidden);assert.match(await page.locator('#status').innerText(),/cancelado/);}
    await page.click('#prepare');await page.click('#approve');await page.waitForFunction(()=>!document.querySelector('#result-panel').hidden&&!document.querySelector('#prepare').disabled,null,{timeout:900000});
    const mapDownload=page.waitForEvent('download');await page.click('#map');const map=JSON.parse(await readFile(await(await mapDownload).path(),'utf8'));assert.equal(map.originalDuration,duration);assert.ok(Math.abs(validateTimeMap(map.timeMap,duration)-map.outputDuration)<.001);assert(map.outputDuration<duration*.8);
    const audioDownload=page.waitForEvent('download');await page.click('#download');const output=await readFile(await(await audioDownload).path());assert.ok(Math.abs((output.length-44)/32000-map.outputDuration)<.001);let peak=0;for(let at=44;at<output.length;at+=2)peak=Math.max(peak,Math.abs(output.readInt16LE(at))/32768);assert(peak<=.8913);
    if(duration===30){
      await page.fill('#split-minutes','0.1');await page.click('#split-create');
      const count=Math.ceil(map.outputDuration/6);assert.equal(await page.locator('.audio-part').count(),count);assert.match(await page.locator('#split-filters').innerText(),/Reducción de ruido.*Nivelado de voz/);
      await page.locator('.audio-part').first().getByRole('button',{name:'Escuchar',exact:true}).click();assert(await page.locator('#part-player').isVisible());
      const oneDownload=page.waitForEvent('download');await page.locator('.audio-part').first().getByRole('button',{name:'Descargar WAV'}).click();const one=await readFile(await(await oneDownload).path());assert.deepEqual(one.subarray(44),output.subarray(44,44+6*32000));
      await page.click('#split-select-none');assert(await page.locator('#split-download-selected').isDisabled());await page.locator('.audio-part input').nth(1).check();
      const selectedDownload=page.waitForEvent('download');await page.click('#split-download-selected');const selectedZip=await JSZip.loadAsync(await readFile(await(await selectedDownload).path()));const manifest=JSON.parse(await selectedZip.file('partes.json').async('string'));assert.equal(manifest.parts.length,1);assert.equal(manifest.parts[0].start,6);assert.equal(manifest.actualDenoise,true);assert(manifest.settings.normalize);assert.deepEqual((await selectedZip.file(manifest.parts[0].file).async('nodebuffer')).subarray(44),output.subarray(44+6*32000,44+12*32000));
      await page.waitForFunction(()=>!document.querySelector('#split-download-all').disabled);const allDownload=page.waitForEvent('download');await page.click('#split-download-all');const allZip=await JSZip.loadAsync(await readFile(await(await allDownload).path()));const allManifest=JSON.parse(await allZip.file('partes.json').async('string'));assert.equal(allManifest.parts.length,count);assert.deepEqual(Buffer.concat(await Promise.all(allManifest.parts.map(async p=>(await allZip.file(p.file).async('nodebuffer')).subarray(44)))),output.subarray(44));
      await page.waitForFunction(()=>!document.querySelector('#prepare').disabled);
    }
    console.log(`Audio ${duration}s → ${map.outputDuration.toFixed(3)}s · ${map.timeMap.length} spans · peak ${peak.toFixed(5)} · Silero/RNNoise real`);
  }
  await page.selectOption('#preset','fast');await page.click('#split-prepare');await page.click('#approve');await page.waitForFunction(()=>!document.querySelector('#prepare').disabled&&document.querySelectorAll('.audio-part').length>0,null,{timeout:120000});assert.equal(await page.locator('#preset').inputValue(),'balanced');assert(await page.locator('#denoise').isChecked());assert(await page.locator('#highpass').isChecked());assert(await page.locator('#compress').isChecked());assert.match(await page.locator('#split-filters').innerText(),/Reducción de ruido/);
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:1000});
  await page.click('#preview');await page.click('#approve');await page.waitForFunction(()=>!document.querySelector('#ab').disabled,null,{timeout:120000});await page.click('#ab');await page.click('#ab');
  await page.click('#handoff');const popupPromise=page.waitForEvent('popup');await page.click('#approve');const receiver=await popupPromise;await receiver.locator('#audio-lab-note').waitFor();assert((await receiver.locator('#file-name').innerText()).endsWith('-clean.wav'));assert.equal(await receiver.locator('#enhance').isChecked(),false);
  await page.click('#remove');await page.waitForFunction(()=>document.querySelector('#file-card').hidden);assert.equal(await page.locator('.audio-part').count(),0);assert(await page.locator('#split-download-all').isDisabled());assert(await receiver.evaluate(async()=>{const response=await fetch(document.querySelector('#audio-preview').src);return response.ok&&(await response.blob()).size>44;}));
  await receiver.setInputFiles('#file-input',resolve(root,'audio/tests/fixtures/speech.wav'));assert.equal(await receiver.locator('#audio-lab-note').count(),0);assert.equal(await receiver.locator('#file-name').innerText(),'speech.wav');
  await page.reload();await page.locator('#recovery-box').waitFor();await page.setInputFiles('#file-input',lastFixture);await page.locator('#consent[open]').waitFor();await page.locator('#consent button[value="cancel"]').click();await page.click('#restore');await page.click('#approve');await waitReady();assert.match(await page.locator('#status').innerText(),/recuperado/);
  await page.click('#remove');await page.waitForFunction(()=>document.querySelector('#file-card').hidden);await page.click('#forget');await page.locator('#recovery-box').waitFor({state:'hidden'});
  // A clean load at each viewport avoids compositor artifacts after full-page resizing.
  for(const [width,height]of [[1366,900],[1024,1366],[390,844]]){const mobile=await browser.newPage({viewport:{width,height},hasTouch:true});await mobile.goto(base+'/audio/');assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.close();}
  assert.equal(errors.length,0,errors.join('\n'));assert(requests.every(([method])=>method==='GET'));assert(requests.filter(([,url])=>/audio\/vendor/.test(url)).every(([,url])=>url.startsWith(base)));
  console.log('Audio Lab: consent/lazy models, A/B, local handoff, normal Transcribe file, recovery and layouts passed.');
}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(scratch,{recursive:true,force:true});}
