import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import JSZip from 'jszip';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+'/'))throw Error('Invalid path');if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{} });
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1366,height:768}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.href==='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm',route=>route.fulfill({status:200,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`export async function createWorker(){return {setParameters:async()=>{},recognize:async()=>({data:{text:'HELLO 67',confidence:99}}),terminate:async()=>{}}} export default {createWorker};`}));
  await page.goto(base+'/convert/');
  await page.waitForSelector('body[data-ready=true]');
  await page.waitForSelector('body[data-image-text-ready=true]');
  await page.waitForSelector('body[data-pdf-tools=ready]');
  assert.equal(await page.locator('.window-bar .traffic i').count(),3);
  assert.equal(await page.locator('#pick-folder').isVisible(),true);
  assert.equal(await page.locator('#window-count').innerText(),'0 archivos');
  assert.equal(await page.locator('#image-text-panel').isVisible(),true);
  assert.match(await page.locator('#image-text-panel').innerText(),/Texto de imagen/i);

  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlR9hAAAAAASUVORK5CYII=','base64');
  await page.setInputFiles('#file-input',{name:'captura.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>document.querySelectorAll('#image-text-sources .image-text-source').length===1);
  assert.match(await page.locator('#image-text-sources').innerText(),/captura\.png/i);
  assert.match(await page.locator('#image-text-sources').innerText(),/Extraer texto/i);
  await page.click('[data-extract-image-text]');
  await page.waitForFunction(()=>document.querySelector('#image-text-results textarea')?.value.includes('HELLO 67'));
  assert.equal(await page.locator('#image-text-results textarea').inputValue(),'HELLO 67');
  assert.match(await page.locator('#image-text-results').innerText(),/99%/);
  assert.equal(await page.locator('[data-image-text-copy]').isEnabled(),true);
  assert.equal(await page.locator('[data-image-text-download]').isEnabled(),true);
  assert.match(await page.locator('[data-image-text-download]').innerText(),/Descargar \.txt/i);
  await page.fill('#image-text-results textarea','HELLO 67 EDITADO');
  assert.equal(await page.locator('#image-text-results textarea').inputValue(),'HELLO 67 EDITADO');
  await page.click('#clear');
  assert.match(await page.locator('#image-text-sources').innerText(),/aparecerán aquí/i);

  assert.equal(await page.locator('.pdf-tool-card').count(),30);
  assert.equal(await page.locator('.pdf-tool-card .tool-icon').count(),30);
  assert.match(await page.locator('#pdf-suite').innerText(),/Unir PDF/);
  assert.match(await page.locator('#pdf-suite').innerText(),/Proteger PDF/);
  assert.match(await page.locator('#pdf-suite').innerText(),/OCR PDF/);
  assert.match(await page.locator('#pdf-suite').innerText(),/Flujos/);
  assert.doesNotMatch(await page.locator('body').innerText(),/[⌁↥]/);

  await page.click('[data-pdf-tool="pdf-word"]');
  assert.equal(await page.locator('#output-format').inputValue(),'docx');
  await page.click('[data-pdf-filter="security"]');
  assert.equal(await page.locator('.pdf-tool-card:visible').count(),3);
  await page.click('[data-pdf-filter="all"]');
  await page.click('[data-pdf-tool="merge"]');
  assert.equal(await page.locator('#pdf-tool-dialog').evaluate(el=>el.open),true);
  assert.equal(await page.locator('#pdf-tool-dialog svg').count()>0,true);
  await page.click('#pdf-tool-close');
  assert.equal(await page.locator('#pdf-tool-dialog').evaluate(el=>el.open),false);

  const csv='part,qty,cost\nABC-1,12,3.50\nXYZ-9,4,18.00\n';
  await page.setInputFiles('#file-input',{name:'inventory.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.click('[data-format=xlsx]');
  await page.click('#convert');
  await page.waitForFunction(()=>document.querySelectorAll('#results .result-card').length===1&&!document.querySelector('#convert').disabled);
  assert.match(await page.locator('#results').innerText(),/inventory\.xlsx/i);
  const xlsxDownload=page.waitForEvent('download');
  await page.click('#download-all');
  const xlsx=await xlsxDownload, xlsxPath=await xlsx.path();
  assert.equal(xlsx.suggestedFilename(),'inventory.xlsx');
  const zip=await JSZip.loadAsync(await readFile(xlsxPath));
  assert(zip.file('xl/workbook.xml'));
  assert(zip.file('xl/worksheets/sheet1.xml'));
  const sheet=await zip.file('xl/worksheets/sheet1.xml').async('text');
  assert.match(sheet,/ABC-1/);
  assert.match(sheet,/18\.00/);

  await page.click('#clear');
  await page.setInputFiles('#file-input',{name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Uno\nDos\nTres')});
  await page.click('[data-format=docx]');
  await page.click('#convert');
  await page.waitForFunction(()=>document.querySelectorAll('#results .result-card').length===1&&!document.querySelector('#convert').disabled);
  const docxDownload=page.waitForEvent('download');
  await page.click('#download-all');
  const docx=await docxDownload, docxPath=await docx.path();
  assert.equal(docx.suggestedFilename(),'notes.docx');
  const docZip=await JSZip.loadAsync(await readFile(docxPath));
  const documentXml=await docZip.file('word/document.xml').async('text');
  assert.match(documentXml,/Uno/);
  assert.match(documentXml,/Tres/);

  await page.click('#clear');
  await page.setInputFiles('#file-input',{name:'brief.txt',mimeType:'text/plain',buffer:Buffer.from('Reynoso Convert PDF test')});
  await page.click('[data-format=pdf]');
  await page.click('#convert');
  await page.waitForFunction(()=>document.querySelectorAll('#results .result-card').length===1&&!document.querySelector('#convert').disabled);
  const pdfDownload=page.waitForEvent('download');
  await page.click('#download-all');
  const pdf=await pdfDownload, pdfPath=await pdf.path(),pdfBytes=await readFile(pdfPath);
  assert.equal(pdf.suggestedFilename(),'brief.pdf');
  assert.equal(pdfBytes.subarray(0,8).toString(),'%PDF-1.4');

  await page.click('#clear');
  await page.setInputFiles('#file-input',{name:'people.json',mimeType:'application/json',buffer:Buffer.from('[{"name":"Javier","role":"dev"},{"name":"Myke","role":"agent"}]')});
  await page.selectOption('#output-format','tsv');
  await page.click('#convert');
  await page.waitForFunction(()=>document.querySelectorAll('#results .result-card').length===1&&!document.querySelector('#convert').disabled);
  const tsvDownload=page.waitForEvent('download');
  await page.click('#download-all');
  const tsv=await tsvDownload,tsvPath=await tsv.path(),tsvText=await readFile(tsvPath,'utf8');
  assert.equal(tsv.suggestedFilename(),'people.tsv');
  assert.match(tsvText,/name\trole/);
  assert.match(tsvText,/Javier\tdev/);

  assert.deepEqual(errors,[]);
  console.log('Convert browser: extracción y edición directa de texto de imagen + PDF Studio + uploader Mac + CSV→XLSX + TXT→DOCX/PDF + JSON→TSV verificados.');
} finally {
  await browser?.close();
  await new Promise(r=>server.close(r));
}
