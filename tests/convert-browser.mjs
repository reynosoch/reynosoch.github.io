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
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1366,height:768}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/convert/');
  await page.waitForSelector('body[data-ready=true]');

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

  assert.deepEqual(errors,[]);
  console.log('Convert browser: CSV→XLSX, TXT→DOCX y TXT→PDF generan archivos reales sin subirlos.');
} finally {
  await browser?.close();
  await new Promise(r=>server.close(r));
}
