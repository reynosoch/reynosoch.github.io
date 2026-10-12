import {engines,optional} from './engines.mjs';

const $=id=>document.getElementById(id);
const blobUrl=new Set();
const cleanupUrls=()=>{for(const url of blobUrl)URL.revokeObjectURL(url);blobUrl.clear()};
const svg=(body,cls='tool-icon')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons={
  merge:svg('<path d="M8 7h8M8 17h8M12 3v18"/><rect x="3" y="4" width="5" height="6" rx="1"/><rect x="16" y="14" width="5" height="6" rx="1"/>'),
  split:svg('<path d="M12 3v18M8 7H4m4 10H4m12-10h4m-4 10h4"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="17" r="1.5"/>'),
  compress:svg('<path d="m8 3-5 5m0-5v5h5m8-5 5 5m0-5v5h-5M8 21l-5-5m0 5v-5h5m8 5 5-5m0 5v-5h-5"/>'),
  word:svg('<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12l1.5 5L11 13l1.5 4 1.5-5"/>'),
  ppt:svg('<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M9 17v-5h3a2 2 0 0 1 0 4H9"/>'),
  sheet:svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>'),
  edit:svg('<path d="M4 20h4l11-11-4-4L4 16zM13.5 6.5l4 4"/><path d="M5 4h6"/>'),
  image:svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>'),
  sign:svg('<path d="M4 18c3-5 5-8 7-8 2 0-1 7 2 7 2 0 2-4 4-4 2 0 1 4 3 4"/><path d="M4 21h16"/>'),
  watermark:svg('<path d="M4 6h16v12H4z"/><path d="m8 15 2-6 2 6 2-6 2 6"/>'),
  rotate:svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  html:svg('<path d="m8 9-4 3 4 3m8-6 4 3-4 3M14 5l-4 14"/>'),
  unlock:svg('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M9 10V7a4 4 0 0 1 7-2"/>'),
  protect:svg('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/>'),
  organize:svg('<rect x="4" y="3" width="7" height="8" rx="1"/><rect x="13" y="3" width="7" height="8" rx="1"/><rect x="4" y="13" width="7" height="8" rx="1"/><path d="M16.5 14v6m-3-3h6"/>'),
  archive:svg('<path d="M4 7h16v14H4zM3 3h18v4H3z"/><path d="M9 11h6"/>'),
  repair:svg('<path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-3-3z"/>'),
  numbers:svg('<path d="M5 7h2v5H5m7-5h3l-3 5h3m-9 5h10"/>'),
  scan:svg('<path d="M8 3H4v4M16 3h4v4M8 21H4v-4m12 4h4v-4"/><rect x="7" y="7" width="10" height="10" rx="1"/>'),
  ocr:svg('<path d="M4 4h5M4 4v5m16-5h-5m5 0v5M4 20h5m-5 0v-5m16 5h-5m5 0v-5"/><path d="M8 12h8M12 8v8"/>'),
  compare:svg('<path d="M10 3H4v18h6m4-18h6v18h-6M7 9h6m-3-3v6m2 5h5"/>'),
  redact:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 9h12M6 12h8M6 15h10"/><path d="m4 4 16 16"/>'),
  crop:svg('<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>'),
  forms:svg('<path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h3M8 15h8"/><rect x="13" y="9" width="3" height="3" rx=".5"/>'),
  markdown:svg('<path d="M3 6h18v12H3z"/><path d="M6 15V9l3 3 3-3v6m3-3 2 2 2-2m-2 2v-5"/>'),
  workflow:svg('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 6h4a4 4 0 0 1 4 4M8 18h4a4 4 0 0 0 4-4"/>'),
  close:svg('<path d="m6 6 12 12M18 6 6 18"/>','ui-icon'),
  upload:svg('<path d="M12 16V4m-4 4 4-4 4 4M5 20h14"/>','ui-icon'),
  play:svg('<path d="m9 6 8 6-8 6z"/>','ui-icon'),
  download:svg('<path d="M12 4v12m-4-4 4 4 4-4M5 20h14"/>','ui-icon'),
  plus:svg('<path d="M12 5v14M5 12h14"/>','ui-icon'),
  trash:svg('<path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6"/>','ui-icon'),
  arrow:svg('<path d="M5 12h14m-6-6 6 6-6 6"/>','ui-icon'),
  shield:svg('<path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z"/>','tool-icon'),
};

const tools=[
  {id:'merge',name:'Unir PDF',desc:'Combina varios PDFs en el orden que elijas.',cat:'pages',icon:'merge'},
  {id:'split',name:'Dividir PDF',desc:'Separa páginas o extrae rangos en archivos independientes.',cat:'pages',icon:'split'},
  {id:'compress',name:'Comprimir PDF',desc:'Reduce tamaño con tres niveles de compresión visual.',cat:'optimize',icon:'compress'},
  {id:'pdf-word',name:'PDF a Word',desc:'Pasa contenido de PDF a DOCX editable.',cat:'convert',icon:'word',preset:'docx'},
  {id:'pdf-ppt',name:'PDF a PowerPoint',desc:'Convierte el PDF a una presentación PPTX.',cat:'convert',icon:'ppt',preset:'pptx'},
  {id:'pdf-excel',name:'PDF a Excel',desc:'Extrae contenido del PDF a una hoja XLSX.',cat:'convert',icon:'sheet',preset:'xlsx'},
  {id:'word-pdf',name:'Word a PDF',desc:'Convierte DOCX a PDF desde el conversor general.',cat:'convert',icon:'word',preset:'pdf'},
  {id:'ppt-pdf',name:'PowerPoint a PDF',desc:'Convierte PPTX a PDF desde el conversor general.',cat:'convert',icon:'ppt',preset:'pdf'},
  {id:'excel-pdf',name:'Excel a PDF',desc:'Convierte hojas XLS/XLSX a PDF.',cat:'convert',icon:'sheet',preset:'pdf'},
  {id:'edit',name:'Editar PDF',desc:'Añade texto, imagen, formas y trazos sobre una página.',cat:'edit',icon:'edit'},
  {id:'pdf-jpg',name:'PDF a JPG',desc:'Renderiza páginas del PDF como imágenes JPG.',cat:'convert',icon:'image',preset:'jpg'},
  {id:'jpg-pdf',name:'JPG a PDF',desc:'Convierte una o varias imágenes a un documento PDF.',cat:'convert',icon:'image',preset:'pdf'},
  {id:'sign',name:'Firmar PDF',desc:'Dibuja tu firma y colócala en una página.',cat:'edit',icon:'sign'},
  {id:'watermark',name:'Marca de agua',desc:'Estampa texto sobre todas o algunas páginas.',cat:'edit',icon:'watermark'},
  {id:'rotate',name:'Rotar PDF',desc:'Gira páginas 90°, 180° o 270°.',cat:'pages',icon:'rotate'},
  {id:'html-pdf',name:'HTML a PDF',desc:'Convierte archivos HTML a PDF desde el conversor general.',cat:'convert',icon:'html',preset:'pdf'},
  {id:'unlock',name:'Desbloquear PDF',desc:'Quita contraseña de apertura con la clave correcta.',cat:'security',icon:'unlock'},
  {id:'protect',name:'Proteger PDF',desc:'Cifra el documento con contraseña de apertura.',cat:'security',icon:'protect'},
  {id:'organize',name:'Organizar PDF',desc:'Reordena, duplica o elimina páginas con una secuencia.',cat:'pages',icon:'organize'},
  {id:'pdfa',name:'PDF para archivo',desc:'Normaliza el documento para conservación de largo plazo.',cat:'optimize',icon:'archive'},
  {id:'repair',name:'Reparar PDF',desc:'Reescribe la estructura y recupera páginas legibles.',cat:'optimize',icon:'repair'},
  {id:'numbers',name:'Números de página',desc:'Agrega numeración con posición y página inicial.',cat:'edit',icon:'numbers'},
  {id:'scan',name:'Escanear a PDF',desc:'Usa la cámara o fotos del móvil y crea un PDF.',cat:'convert',icon:'scan'},
  {id:'ocr',name:'OCR PDF',desc:'Convierte páginas escaneadas en PDF con texto seleccionable.',cat:'convert',icon:'ocr'},
  {id:'compare',name:'Comparar PDF',desc:'Compara visualmente dos páginas y genera una diferencia.',cat:'review',icon:'compare'},
  {id:'redact',name:'Censurar PDF',desc:'Marca zonas y genera una copia plana sin el contenido oculto.',cat:'security',icon:'redact'},
  {id:'crop',name:'Recortar PDF',desc:'Recorta márgenes o una región de página.',cat:'pages',icon:'crop'},
  {id:'forms',name:'Formularios PDF',desc:'Detecta campos, rellénalos o agrega un campo de texto.',cat:'edit',icon:'forms'},
  {id:'pdf-md',name:'PDF a Markdown',desc:'Convierte contenido del PDF a Markdown.',cat:'convert',icon:'markdown',preset:'md'},
  {id:'workflow',name:'Flujos',desc:'Guarda una cadena local de rotación, marca, numeración y compresión.',cat:'review',icon:'workflow'},
];

const categoryNames={all:'Todas',pages:'Páginas',convert:'Convertir',edit:'Editar',security:'Seguridad',optimize:'Optimizar',review:'Flujos'};

function renderCards(){
  const filters=$('pdf-tool-filters');
  filters.innerHTML=Object.entries(categoryNames).map(([id,label],i)=>`<button type="button" data-pdf-filter="${id}" aria-pressed="${i===0}">${label}</button>`).join('');
  $('pdf-tool-grid').innerHTML=tools.map(t=>`<button class="pdf-tool-card" type="button" data-pdf-tool="${t.id}" data-category="${t.cat}"><span class="pdf-tool-icon">${icons[t.icon]}</span><span class="pdf-tool-copy"><strong>${t.name}</strong><small>${t.desc}</small></span><span class="pdf-tool-go">${icons.arrow}</span></button>`).join('');
  filters.addEventListener('click',event=>{const btn=event.target.closest('[data-pdf-filter]');if(!btn)return;for(const b of filters.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===btn));const value=btn.dataset.pdfFilter;for(const card of $('pdf-tool-grid').children)card.hidden=value!=='all'&&card.dataset.category!==value;});
  $('pdf-tool-grid').addEventListener('click',event=>{const card=event.target.closest('[data-pdf-tool]');if(!card)return;const tool=tools.find(t=>t.id===card.dataset.pdfTool);if(tool?.preset)return presetConverter(tool);openTool(tool);});
}

function presetConverter(tool){
  const select=$('output-format');
  if(select){select.value=tool.preset;select.dispatchEvent(new Event('change',{bubbles:true}));}
  const quick=document.querySelector(`[data-format="${tool.preset}"]`);quick?.click();
  const zone=$('dropzone');
  zone?.scrollIntoView({behavior:'smooth',block:'center'});
  zone?.focus({preventScroll:true});
  const status=$('status');
  if(status)status.textContent=`Salida preparada: ${tool.preset.toUpperCase()}. Agrega el archivo de entrada.`;
}

const dialog=$('pdf-tool-dialog');
const title=$('pdf-tool-title');
const subtitle=$('pdf-tool-subtitle');
const body=$('pdf-tool-body');
const dialogStatus=$('pdf-tool-status');
const runButton=$('pdf-tool-run');
const output=$('pdf-tool-output');
let activeTool=null,activeCleanup=null;

function setDialogStatus(text,bad=false){dialogStatus.textContent=text;dialogStatus.classList.toggle('danger-text',bad)}
function result(blob,name,label='Resultado listo'){
  cleanupUrls();
  const url=URL.createObjectURL(blob);blobUrl.add(url);
  output.innerHTML=`<a class="pdf-output-card" href="${url}" download="${name}"><span>${icons.download}</span><span><strong>${name}</strong><small>${label} · ${(blob.size/1024/1024).toFixed(blob.size>1024*1024?2:3)} MB</small></span></a>`;
  setDialogStatus('Listo para descargar.');
}
function resultLinks(items,label='Resultados listos'){
  cleanupUrls();
  output.innerHTML=items.map(({blob,name})=>{const url=URL.createObjectURL(blob);blobUrl.add(url);return `<a class="pdf-output-card" href="${url}" download="${name}"><span>${icons.download}</span><span><strong>${name}</strong><small>${(blob.size/1024).toFixed(1)} KB</small></span></a>`}).join('');
  setDialogStatus(label);
}
function closeDialog(){activeCleanup?.();activeCleanup=null;cleanupUrls();dialog.close()}
$('pdf-tool-close').addEventListener('click',closeDialog);
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog()});
dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog()});

const field=(label,html,hint='')=>`<label class="pdf-field"><span>${label}</span>${html}${hint?`<small>${hint}</small>`:''}</label>`;
const fileInput=(multiple=false,accept='.pdf',id='pdf-tool-files',capture='')=>`<input id="${id}" type="file" ${multiple?'multiple':''} accept="${accept}" ${capture?`capture="${capture}"`:''}>`;
const pageRangeField=()=>field('Páginas',`<input id="tool-pages" type="text" placeholder="Todas o 1-3,5,8-10">`,'Déjalo vacío para aplicar a todo el documento.');

const templates={
  merge:()=>`${field('PDFs a unir',fileInput(true,'.pdf'))}<p class="pdf-hint">Se respetará el orden de selección del navegador.</p>`,
  split:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Modo','<select id="split-mode"><option value="each">Una página por archivo</option><option value="range">Extraer páginas seleccionadas</option></select>')}${field('Rango','<input id="split-range" type="text" placeholder="1-3,5,8">','Solo se usa en Extraer páginas seleccionadas.')}`,
  compress:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Compresión','<select id="compress-level"><option value="balanced">Equilibrada</option><option value="strong">Fuerte</option><option value="quality">Más calidad</option></select>')}<p class="pdf-hint">La compresión renderiza las páginas para reducir peso. Puede perder texto seleccionable, enlaces y formularios.</p>`,
  watermark:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Texto','<input id="watermark-text" type="text" value="CONFIDENCIAL" maxlength="80">')}${field('Posición','<select id="watermark-position"><option value="center">Centro</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="diagonal">Diagonal</option></select>')}${field('Opacidad','<input id="watermark-opacity" type="range" min="10" max="90" value="25">')}${pageRangeField()}`,
  rotate:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Giro','<select id="rotate-deg"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select>')}${pageRangeField()}`,
  unlock:()=>`${field('PDF protegido',fileInput(false,'.pdf'))}${field('Contraseña','<input id="unlock-password" type="password" autocomplete="current-password">')}<p class="pdf-hint">Se genera una copia nueva sin la contraseña de apertura. Debes conocer la clave.</p>`,
  protect:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Contraseña de apertura','<input id="protect-password" type="password" autocomplete="new-password" minlength="1">')}${field('Contraseña propietaria','<input id="owner-password" type="password" autocomplete="new-password" placeholder="Opcional">')}<p class="pdf-hint">La contraseña de apertura será necesaria para ver el documento.</p>`,
  organize:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Nuevo orden','<input id="organize-order" type="text" placeholder="3,1,2,4-6">','Usa números, rangos y repeticiones. Omite una página para eliminarla.')}`,
  pdfa:()=>`${field('PDF',fileInput(false,'.pdf'))}<p class="pdf-hint">Crea una copia normalizada, sin cifrado y con metadatos de archivo. Sirve para conservación práctica; no sustituye una validación normativa especializada.</p>`,
  repair:()=>`${field('PDF dañado',fileInput(false,'.pdf'))}<p class="pdf-hint">Primero intenta reescribir la estructura. Si no es posible, recupera las páginas que PDF.js pueda renderizar.</p>`,
  numbers:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Posición','<select id="numbers-position"><option value="bottom-center">Abajo centro</option><option value="bottom-right">Abajo derecha</option><option value="bottom-left">Abajo izquierda</option><option value="top-center">Arriba centro</option><option value="top-right">Arriba derecha</option></select>')}${field('Empezar en','<input id="numbers-start" type="number" min="0" value="1">')}${field('Texto','<input id="numbers-template" type="text" value="{n}" maxlength="40">','Usa {n} para el número y {total} para el total.')}${pageRangeField()}`,
  scan:()=>`${field('Fotos o cámara',fileInput(true,'image/*','pdf-tool-files','environment'))}${field('Margen','<select id="scan-margin"><option value="18">Normal</option><option value="0">Sin margen</option><option value="36">Amplio</option></select>')}<p class="pdf-hint">En móvil, el selector puede abrir la cámara trasera. Puedes agregar varias fotos.</p>`,
  ocr:()=>`${field('PDF escaneado',fileInput(false,'.pdf'))}${field('Idioma','<select id="ocr-lang"><option value="spa">Español</option><option value="eng">English</option><option value="spa+eng">Español + English</option></select>')}<p class="pdf-hint">Se reconstruyen las páginas como imagen y se agrega una capa de texto seleccionable. El primer uso descarga el idioma elegido.</p>`,
  compare:()=>`${field('PDF A',fileInput(false,'.pdf','compare-a'))}${field('PDF B',fileInput(false,'.pdf','compare-b'))}${field('Página','<input id="compare-page" type="number" min="1" value="1">')}<div id="compare-preview" class="compare-preview"></div>`,
  crop:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Margen superior (mm)','<input id="crop-top" type="number" min="0" step="0.5" value="0">')}${field('Margen derecho (mm)','<input id="crop-right" type="number" min="0" step="0.5" value="0">')}${field('Margen inferior (mm)','<input id="crop-bottom" type="number" min="0" step="0.5" value="0">')}${field('Margen izquierdo (mm)','<input id="crop-left" type="number" min="0" step="0.5" value="0">')}${pageRangeField()}`,
  sign:()=>`${field('PDF',fileInput(false,'.pdf'))}<div class="signature-wrap"><span>Firma</span><canvas id="signature-pad" width="700" height="220"></canvas><button type="button" id="clear-signature">Limpiar trazo</button></div>${field('Página','<input id="sign-page" type="number" min="1" value="1">')}${field('Posición','<select id="sign-position"><option value="bottom-right">Abajo derecha</option><option value="bottom-left">Abajo izquierda</option><option value="center">Centro</option><option value="top-right">Arriba derecha</option></select>')}${field('Ancho','<input id="sign-width" type="range" min="80" max="280" value="160">')}`,
  edit:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Página','<input id="edit-page" type="number" min="1" value="1">')}${field('Texto a agregar','<input id="edit-text" type="text" maxlength="160" placeholder="Opcional">')}${field('Posición del texto','<select id="edit-position"><option value="top-left">Arriba izquierda</option><option value="top-right">Arriba derecha</option><option value="center">Centro</option><option value="bottom-left">Abajo izquierda</option><option value="bottom-right">Abajo derecha</option></select>')}${field('Imagen opcional','<input id="edit-image" type="file" accept="image/png,image/jpeg">')}${field('Forma','<select id="edit-shape"><option value="none">Ninguna</option><option value="rect">Rectángulo</option><option value="ellipse">Elipse</option></select>')}<div class="signature-wrap"><span>Dibujo libre</span><canvas id="edit-draw" width="700" height="220"></canvas><button type="button" id="clear-edit-draw">Limpiar dibujo</button></div>`,
  redact:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Página','<input id="redact-page" type="number" min="1" value="1">')}<div class="redact-preview"><canvas id="redact-canvas" width="900" height="1200"></canvas></div><div class="inline-actions"><button type="button" id="load-redact-page">Cargar página</button><button type="button" id="clear-redactions">Borrar marcas</button></div><p class="pdf-hint">Arrastra rectángulos sobre la vista previa. La salida se rasteriza para eliminar el contenido bajo las zonas marcadas.</p>`,
  forms:()=>`${field('PDF',fileInput(false,'.pdf'))}<div class="inline-actions"><button type="button" id="load-form-fields">Detectar campos</button></div><div id="form-fields" class="form-fields"><p class="pdf-hint">Carga un PDF para listar campos interactivos.</p></div><div class="form-create"><strong>Agregar campo de texto</strong>${field('Nombre','<input id="new-field-name" type="text" placeholder="campo.nuevo">')}${field('Página','<input id="new-field-page" type="number" min="1" value="1">')}${field('Posición X / Y','<div class="two-inputs"><input id="new-field-x" type="number" min="0" value="50"><input id="new-field-y" type="number" min="0" value="80"></div>')}${field('Ancho / Alto','<div class="two-inputs"><input id="new-field-w" type="number" min="20" value="220"><input id="new-field-h" type="number" min="14" value="28"></div>')}</div>`,
  workflow:()=>`${field('PDF',fileInput(false,'.pdf'))}${field('Nombre del flujo','<input id="workflow-name" type="text" placeholder="Mi flujo">')}${field('Rotar','<select id="workflow-rotate"><option value="0">No</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select>')}${field('Marca de agua','<input id="workflow-watermark" type="text" placeholder="Opcional">')}${field('Numeración','<select id="workflow-numbers"><option value="no">No</option><option value="yes">Sí</option></select>')}${field('Compresión','<select id="workflow-compress"><option value="none">No</option><option value="balanced">Equilibrada</option><option value="strong">Fuerte</option></select>')}<div class="inline-actions"><button type="button" id="save-workflow">Guardar flujo</button><select id="saved-workflows"><option value="">Flujos guardados</option></select><button type="button" id="delete-workflow">Eliminar</button></div><p class="pdf-hint">Los flujos se guardan únicamente en este navegador.</p>`,
};

function openTool(tool){
  activeCleanup?.();activeCleanup=null;cleanupUrls();output.innerHTML='';activeTool=tool;
  title.textContent=tool.name;subtitle.textContent=tool.desc;body.innerHTML=templates[tool.id]?.()||'<p>Esta acción usa el conversor general de arriba.</p>';
  runButton.hidden=Boolean(tool.preset);setDialogStatus(tool.preset?'Salida preparada en el conversor general.':'Selecciona archivos y configura la acción.');
  if(tool.preset){dialog.showModal();return;}
  bindSpecial(tool.id);dialog.showModal();
}

runButton.addEventListener('click',async()=>{
  if(!activeTool)return;
  runButton.disabled=true;output.innerHTML='';setDialogStatus('Procesando…');
  try{await runners[activeTool.id]?.();}
  catch(error){console.error(error);setDialogStatus(error?.message||'No se pudo completar la operación.',true);}
  finally{runButton.disabled=false;}
});

const firstFile=(id='pdf-tool-files')=>{const file=$(id)?.files?.[0];if(!file)throw Error('Selecciona un archivo primero.');return file};
const files=(id='pdf-tool-files')=>{const list=[...($(id)?.files||[])];if(!list.length)throw Error('Selecciona al menos un archivo.');return list};
const pdfBlob=bytes=>new Blob([bytes],{type:'application/pdf'});
const safeBase=name=>name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._ -]+/gu,'_').slice(0,120)||'documento';
const saveName=(file,suffix='')=>`${safeBase(file.name)}${suffix}.pdf`;
async function PDFLib(label='PDF'){return await optional(engines.pdfLib,label)}
async function PDFEncrypt(){return await optional(engines.pdfEncrypt,'Protección PDF')}
async function PDFJS(){return await optional(engines.pdfjs,'Lector PDF')}
async function JSZip(){return (await import('../shot/vendor/jszip-3.10.2.mjs')).default}
function parsePages(input,count){if(!input?.trim())return Array.from({length:count},(_,i)=>i);const out=[];for(const token of input.split(',').map(s=>s.trim()).filter(Boolean)){const m=token.match(/^(\d+)(?:-(\d+))?$/);if(!m)throw Error(`Rango no válido: ${token}`);let a=+m[1],b=+(m[2]||m[1]);if(a>b)[a,b]=[b,a];for(let n=a;n<=b;n++){if(n<1||n>count)throw Error(`La página ${n} no existe.`);if(!out.includes(n-1))out.push(n-1)}}return out}
function parseOrder(input,count){if(!input?.trim())return Array.from({length:count},(_,i)=>i);const out=[];for(const token of input.split(',').map(s=>s.trim()).filter(Boolean)){const m=token.match(/^(\d+)(?:-(\d+))?$/);if(!m)throw Error(`Secuencia no válida: ${token}`);let a=+m[1],b=+(m[2]||m[1]),step=a<=b?1:-1;for(let n=a;;n+=step){if(n<1||n>count)throw Error(`La página ${n} no existe.`);out.push(n-1);if(n===b)break}}return out}
function positionXY(position,width,height,itemW,itemH,margin=28){const map={
  'top-left':[margin,height-itemH-margin],'top-right':[width-itemW-margin,height-itemH-margin],'top-center':[(width-itemW)/2,height-itemH-margin],
  'bottom-left':[margin,margin],'bottom-right':[width-itemW-margin,margin],'bottom-center':[(width-itemW)/2,margin],center:[(width-itemW)/2,(height-itemH)/2],top:[(width-itemW)/2,height-itemH-margin],bottom:[(width-itemW)/2,margin]
};return map[position]||map.center}
async function toDataUrl(blob){return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}
async function blobFromCanvas(canvas,type='image/jpeg',quality=.86){return await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(Error('No se pudo generar la imagen.')),type,quality))}
async function renderPage(pdf,pageNumber,scale=1.5){const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport}).promise;return {page,viewport,canvas}}
async function openPdfJs(file,password){const pdfjs=await PDFJS();return await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),password:password||undefined}).promise}
async function rasterPdf(file,{scale=1.35,quality=.78,password='',mutate}={}){const pdf=await openPdfJs(file,password),{PDFDocument}=await PDFLib(),out=await PDFDocument.create();for(let n=1;n<=pdf.numPages;n++){setDialogStatus(`Procesando página ${n} de ${pdf.numPages}…`);const {viewport,canvas}=await renderPage(pdf,n,scale);if(mutate)await mutate({canvas,pageNumber:n,viewport});const jpg=await blobFromCanvas(canvas,'image/jpeg',quality),img=await out.embedJpg(await jpg.arrayBuffer()),page=out.addPage([viewport.width/scale,viewport.height/scale]);page.drawImage(img,{x:0,y:0,width:page.getWidth(),height:page.getHeight()})}return pdfBlob(await out.save({useObjectStreams:true}))}
async function zipItems(items,name){const Zip=await JSZip(),zip=new Zip();for(const item of items)zip.file(item.name,item.blob);return {blob:await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}),name}}

const runners={
  merge:async()=>{const list=files();if(list.length<2)throw Error('Selecciona por lo menos dos PDFs.');const {PDFDocument}=await PDFLib(),out=await PDFDocument.create();for(const file of list){const doc=await PDFDocument.load(await file.arrayBuffer());const pages=await out.copyPages(doc,doc.getPageIndices());pages.forEach(p=>out.addPage(p))}result(pdfBlob(await out.save({useObjectStreams:true})),'pdf-unido.pdf')},
  split:async()=>{const file=firstFile(),{PDFDocument}=await PDFLib(),src=await PDFDocument.load(await file.arrayBuffer()),count=src.getPageCount(),mode=$('split-mode').value;if(mode==='range'){const indices=parsePages($('split-range').value,count),out=await PDFDocument.create(),pages=await out.copyPages(src,indices);pages.forEach(p=>out.addPage(p));return result(pdfBlob(await out.save()),saveName(file,'-extraido'))}const items=[];for(let i=0;i<count;i++){const out=await PDFDocument.create(),[page]=await out.copyPages(src,[i]);out.addPage(page);items.push({name:`${safeBase(file.name)}-pagina-${i+1}.pdf`,blob:pdfBlob(await out.save())})}if(items.length===1)return result(items[0].blob,items[0].name);const zipped=await zipItems(items,`${safeBase(file.name)}-paginas.zip`);result(zipped.blob,zipped.name,`${items.length} PDFs en ZIP`)},
  compress:async()=>{const file=firstFile(),level=$('compress-level').value,opts=level==='strong'?{scale:1,quality:.52}:level==='quality'?{scale:1.65,quality:.86}:{scale:1.3,quality:.7};const blob=await rasterPdf(file,opts);result(blob,saveName(file,'-comprimido'),`Original ${(file.size/1024/1024).toFixed(2)} MB`)},
  watermark:async()=>{const file=firstFile(),text=$('watermark-text').value.trim();if(!text)throw Error('Escribe el texto de la marca.');const {PDFDocument,StandardFonts,rgb,degrees}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),font=await doc.embedFont(StandardFonts.HelveticaBold),indices=parsePages($('tool-pages').value,doc.getPageCount()),opacity=+$('watermark-opacity').value/100,pos=$('watermark-position').value;for(const i of indices){const page=doc.getPage(i),{width,height}=page.getSize(),size=Math.max(16,Math.min(56,width/12)),tw=font.widthOfTextAtSize(text,size);let [x,y]=positionXY(pos==='diagonal'?'center':pos,width,height,tw,size,30);page.drawText(text,{x,y,size,font,color:rgb(.55,.55,.55),opacity,rotate:pos==='diagonal'?degrees(35):degrees(0)})}result(pdfBlob(await doc.save()),saveName(file,'-marca'))},
  rotate:async()=>{const file=firstFile(),{PDFDocument,degrees}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),indices=parsePages($('tool-pages').value,doc.getPageCount()),turn=+$('rotate-deg').value;for(const i of indices){const page=doc.getPage(i),now=page.getRotation().angle||0;page.setRotation(degrees((now+turn)%360))}result(pdfBlob(await doc.save()),saveName(file,'-rotado'))},
  unlock:async()=>{const file=firstFile(),password=$('unlock-password').value;const blob=await rasterPdf(file,{scale:1.5,quality:.9,password});result(blob,saveName(file,'-desbloqueado'),'Copia nueva sin contraseña')},
  protect:async()=>{const file=firstFile(),password=$('protect-password').value;if(!password)throw Error('Escribe una contraseña de apertura.');const {PDFDocument}=await PDFEncrypt(),doc=await PDFDocument.load(await file.arrayBuffer());await doc.encrypt({userPassword:password,ownerPassword:$('owner-password').value||password});result(pdfBlob(await doc.save()),saveName(file,'-protegido'),'PDF cifrado')},
  organize:async()=>{const file=firstFile(),{PDFDocument}=await PDFLib(),src=await PDFDocument.load(await file.arrayBuffer()),order=parseOrder($('organize-order').value,src.getPageCount());if(!order.length)throw Error('El nuevo documento necesita al menos una página.');const out=await PDFDocument.create(),pages=await out.copyPages(src,order);pages.forEach(p=>out.addPage(p));result(pdfBlob(await out.save()),saveName(file,'-organizado'))},
  pdfa:async()=>{const file=firstFile(),{PDFDocument}=await PDFLib(),src=await PDFDocument.load(await file.arrayBuffer()),out=await PDFDocument.create(),pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p));out.setTitle(src.getTitle?.()||safeBase(file.name));out.setAuthor(src.getAuthor?.()||'');out.setCreator('Reynoso Toolchain Convert');out.setProducer('Reynoso Toolchain Convert');out.setCreationDate(src.getCreationDate?.()||new Date());out.setModificationDate(new Date());result(pdfBlob(await out.save({useObjectStreams:false})),saveName(file,'-archivo'),'Copia normalizada para archivo')},
  repair:async()=>{const file=firstFile();try{const {PDFDocument}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer(),{throwOnInvalidObject:false,updateMetadata:false});return result(pdfBlob(await doc.save({useObjectStreams:false})),saveName(file,'-reparado'),'Estructura reescrita')}catch{const blob=await rasterPdf(file,{scale:1.35,quality:.88});result(blob,saveName(file,'-recuperado'),'Páginas recuperadas visualmente')}},
  numbers:async()=>{const file=firstFile(),{PDFDocument,StandardFonts,rgb}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),font=await doc.embedFont(StandardFonts.Helvetica),indices=parsePages($('tool-pages').value,doc.getPageCount()),start=+$('numbers-start').value||0,tpl=$('numbers-template').value||'{n}',pos=$('numbers-position').value;indices.forEach((idx,k)=>{const page=doc.getPage(idx),text=tpl.replaceAll('{n}',String(start+k)).replaceAll('{total}',String(indices.length)),size=10,tw=font.widthOfTextAtSize(text,size),[x,y]=positionXY(pos,page.getWidth(),page.getHeight(),tw,size,22);page.drawText(text,{x,y,size,font,color:rgb(.18,.18,.18)})});result(pdfBlob(await doc.save()),saveName(file,'-numerado'))},
  scan:async()=>{const list=files();const {PDFDocument}=await PDFLib(),doc=await PDFDocument.create(),margin=+$('scan-margin').value;for(const file of list){const bytes=await file.arrayBuffer(),type=file.type.toLowerCase();let img;if(type.includes('png'))img=await doc.embedPng(bytes);else img=await doc.embedJpg(bytes);const dims=img.scale(1),landscape=dims.width>dims.height,pageW=landscape?842:595,pageH=landscape?595:842,scale=Math.min((pageW-margin*2)/dims.width,(pageH-margin*2)/dims.height),w=dims.width*scale,h=dims.height*scale,page=doc.addPage([pageW,pageH]);page.drawImage(img,{x:(pageW-w)/2,y:(pageH-h)/2,width:w,height:h})}result(pdfBlob(await doc.save()),'escaneo.pdf',`${list.length} página${list.length===1?'':'s'}`)},
  compare:async()=>{const a=firstFile('compare-a'),b=firstFile('compare-b'),pageNo=Math.max(1,+$('compare-page').value||1),pdfA=await openPdfJs(a),pdfB=await openPdfJs(b);if(pageNo>pdfA.numPages||pageNo>pdfB.numPages)throw Error('Esa página no existe en ambos documentos.');const A=await renderPage(pdfA,pageNo,1.2),B=await renderPage(pdfB,pageNo,1.2),w=Math.max(A.canvas.width,B.canvas.width),h=Math.max(A.canvas.height,B.canvas.height),diff=document.createElement('canvas');diff.width=w;diff.height=h;const ctx=diff.getContext('2d'),aData=A.canvas.getContext('2d').getImageData(0,0,A.canvas.width,A.canvas.height),bData=B.canvas.getContext('2d').getImageData(0,0,B.canvas.width,B.canvas.height),img=ctx.createImageData(w,h);let changed=0,total=w*h;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const oi=(y*w+x)*4,ai=(y*A.canvas.width+x)*4,bi=(y*B.canvas.width+x)*4,insideA=x<A.canvas.width&&y<A.canvas.height,insideB=x<B.canvas.width&&y<B.canvas.height,ar=insideA?aData.data[ai]:255,ag=insideA?aData.data[ai+1]:255,ab=insideA?aData.data[ai+2]:255,br=insideB?bData.data[bi]:255,bg=insideB?bData.data[bi+1]:255,bb=insideB?bData.data[bi+2]:255,d=Math.abs(ar-br)+Math.abs(ag-bg)+Math.abs(ab-bb);if(d>45){changed++;img.data[oi]=245;img.data[oi+1]=130;img.data[oi+2]=31}else{const g=(ar+ag+ab)/3;img.data[oi]=img.data[oi+1]=img.data[oi+2]=g}img.data[oi+3]=255}ctx.putImageData(img,0,0);const preview=$('compare-preview');preview.innerHTML='';for(const [label,canvas] of [['A',A.canvas],['B',B.canvas],['Diferencia',diff]]){const wrap=document.createElement('figure'),cap=document.createElement('figcaption');cap.textContent=label;wrap.append(canvas,cap);preview.append(wrap)}const blob=await blobFromCanvas(diff,'image/png',1);result(blob,`comparacion-pagina-${pageNo}.png`,`${(changed/total*100).toFixed(2)}% de píxeles cambiaron`)},
  crop:async()=>{const file=firstFile(),{PDFDocument}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),indices=parsePages($('tool-pages').value,doc.getPageCount()),mm=72/25.4,top=+$('crop-top').value*mm,right=+$('crop-right').value*mm,bottom=+$('crop-bottom').value*mm,left=+$('crop-left').value*mm;for(const i of indices){const page=doc.getPage(i),{width,height}=page.getSize(),w=width-left-right,h=height-top-bottom;if(w<=20||h<=20)throw Error('Los márgenes dejan una página demasiado pequeña.');page.setCropBox(left,bottom,w,h)}result(pdfBlob(await doc.save()),saveName(file,'-recortado'))},
  sign:async()=>{const file=firstFile(),pad=$('signature-pad');if(!pad.dataset.drawn)throw Error('Dibuja tu firma primero.');const {PDFDocument}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),pageNo=Math.max(1,+$('sign-page').value||1);if(pageNo>doc.getPageCount())throw Error('La página indicada no existe.');const png=await blobFromCanvas(pad,'image/png',1),img=await doc.embedPng(await png.arrayBuffer()),page=doc.getPage(pageNo-1),width=+$('sign-width').value,height=width*(pad.height/pad.width),[x,y]=positionXY($('sign-position').value,page.getWidth(),page.getHeight(),width,height,30);page.drawImage(img,{x,y,width,height});result(pdfBlob(await doc.save()),saveName(file,'-firmado'))},
  edit:async()=>{const file=firstFile(),{PDFDocument,StandardFonts,rgb}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),pageNo=Math.max(1,+$('edit-page').value||1);if(pageNo>doc.getPageCount())throw Error('La página indicada no existe.');const page=doc.getPage(pageNo-1),{width,height}=page.getSize(),text=$('edit-text').value.trim();if(text){const font=await doc.embedFont(StandardFonts.Helvetica),size=18,tw=font.widthOfTextAtSize(text,size),[x,y]=positionXY($('edit-position').value,width,height,tw,size,30);page.drawText(text,{x,y,size,font,color:rgb(.1,.1,.1)})}const imgFile=$('edit-image').files?.[0];if(imgFile){const bytes=await imgFile.arrayBuffer(),img=imgFile.type.includes('png')?await doc.embedPng(bytes):await doc.embedJpg(bytes),dims=img.scaleToFit(180,140);page.drawImage(img,{x:30,y:height-dims.height-30,width:dims.width,height:dims.height})}const shape=$('edit-shape').value;if(shape==='rect')page.drawRectangle({x:width*.25,y:height*.35,width:width*.5,height:height*.2,borderWidth:2,borderColor:rgb(.95,.32,.08),opacity:.08});if(shape==='ellipse')page.drawEllipse({x:width*.5,y:height*.45,xScale:width*.24,yScale:height*.1,borderWidth:2,borderColor:rgb(.95,.32,.08),opacity:.08});const draw=$('edit-draw');if(draw.dataset.drawn){const png=await blobFromCanvas(draw,'image/png',1),img=await doc.embedPng(await png.arrayBuffer());page.drawImage(img,{x:30,y:30,width:Math.min(width-60,360),height:Math.min(120,height*.2)})}result(pdfBlob(await doc.save()),saveName(file,'-editado'))},
  redact:async()=>{const file=firstFile(),pageNo=Math.max(1,+$('redact-page').value||1),marks=redactionMarks.get(pageNo)||[];if(!marks.length)throw Error('Marca por lo menos una zona en la vista previa.');const blob=await rasterPdf(file,{scale:1.55,quality:.92,mutate:async({canvas,pageNumber})=>{if(pageNumber!==pageNo)return;const ctx=canvas.getContext('2d'),source=$('redact-canvas');for(const r of marks){ctx.fillStyle='#000';ctx.fillRect(r.x/source.width*canvas.width,r.y/source.height*canvas.height,r.w/source.width*canvas.width,r.h/source.height*canvas.height)}}});result(blob,saveName(file,'-censurado'),'Salida plana con zonas eliminadas')},
  forms:async()=>{const file=firstFile(),{PDFDocument}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),form=doc.getForm();for(const input of $('form-fields').querySelectorAll('[data-field-name]')){const name=input.dataset.fieldName,field=form.getFieldMaybe(name);if(!field)continue;const type=field.constructor.name;try{if(type.includes('TextField'))field.setText(input.value);else if(type.includes('CheckBox'))input.checked?field.check():field.uncheck();else if(type.includes('Dropdown')||type.includes('OptionList')||type.includes('RadioGroup')){if(input.value)field.select(input.value)}}catch{}}const newName=$('new-field-name').value.trim();if(newName){const pageNo=Math.max(1,+$('new-field-page').value||1);if(pageNo>doc.getPageCount())throw Error('La página del campo nuevo no existe.');const field=form.createTextField(newName);field.addToPage(doc.getPage(pageNo-1),{x:+$('new-field-x').value||50,y:+$('new-field-y').value||80,width:+$('new-field-w').value||220,height:+$('new-field-h').value||28})}result(pdfBlob(await doc.save()),saveName(file,'-formulario'))},
  ocr:async()=>{const file=firstFile(),pdf=await openPdfJs(file),{PDFDocument,StandardFonts,rgb}=await PDFLib(),out=await PDFDocument.create(),font=await out.embedFont(StandardFonts.Helvetica),T=await optional(engines.tesseract,'OCR'),worker=await T.createWorker($('ocr-lang').value);try{for(let n=1;n<=pdf.numPages;n++){setDialogStatus(`OCR página ${n} de ${pdf.numPages}…`);const scale=1.5,{viewport,canvas}=await renderPage(pdf,n,scale),jpg=await blobFromCanvas(canvas,'image/jpeg',.9),img=await out.embedJpg(await jpg.arrayBuffer()),page=out.addPage([viewport.width/scale,viewport.height/scale]);page.drawImage(img,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});const recognized=await worker.recognize(canvas),words=recognized.data?.words||[];for(const word of words){if(!word.text?.trim()||!word.bbox)continue;const x=word.bbox.x0/scale,y=page.getHeight()-word.bbox.y1/scale,size=Math.max(4,(word.bbox.y1-word.bbox.y0)/scale*.78);try{page.drawText(word.text,{x,y,size,font,color:rgb(1,1,1),opacity:.01})}catch{}}}}finally{await worker.terminate()}result(pdfBlob(await out.save()),saveName(file,'-ocr'),'PDF con capa de texto seleccionable')},
  workflow:async()=>{const file=firstFile(),config=currentWorkflow(),blob=await runWorkflow(file,config);result(blob,saveName(file,'-flujo'),config.name||'Flujo aplicado')},
};

const redactionMarks=new Map();
function bindSpecial(id){
  if(id==='sign')activeCleanup=bindDrawCanvas($('signature-pad'),$('clear-signature'));
  if(id==='edit')activeCleanup=bindDrawCanvas($('edit-draw'),$('clear-edit-draw'));
  if(id==='redact')bindRedactor();
  if(id==='forms')$('load-form-fields').addEventListener('click',loadFormFields);
  if(id==='workflow')bindWorkflows();
}
function bindDrawCanvas(canvas,clear){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#111';let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
  const down=e=>{drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);canvas.setPointerCapture?.(e.pointerId)};
  const move=e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();canvas.dataset.drawn='1'};
  const up=()=>{drawing=false};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);window.addEventListener('pointerup',up);clear.addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);delete canvas.dataset.drawn});
  return()=>{window.removeEventListener('pointerup',up)};
}
async function bindRedactor(){
  const canvas=$('redact-canvas'),ctx=canvas.getContext('2d'),marks=redactionMarks;let baseImage=null,start=null;
  async function load(){const file=firstFile(),pdf=await openPdfJs(file),pageNo=Math.max(1,+$('redact-page').value||1);if(pageNo>pdf.numPages)throw Error('La página indicada no existe.');const rendered=await renderPage(pdf,pageNo,1.2),ratio=Math.min(1,900/rendered.canvas.width,1200/rendered.canvas.height);canvas.width=Math.round(rendered.canvas.width*ratio);canvas.height=Math.round(rendered.canvas.height*ratio);ctx.drawImage(rendered.canvas,0,0,canvas.width,canvas.height);baseImage=ctx.getImageData(0,0,canvas.width,canvas.height);drawMarks(pageNo);setDialogStatus('Arrastra rectángulos sobre la página.');}
  function drawMarks(pageNo){if(!baseImage)return;ctx.putImageData(baseImage,0,0);ctx.fillStyle='rgba(0,0,0,.82)';for(const r of marks.get(pageNo)||[])ctx.fillRect(r.x,r.y,r.w,r.h)}
  function pt(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
  canvas.addEventListener('pointerdown',e=>{start=pt(e)});canvas.addEventListener('pointerup',e=>{if(!start)return;const end=pt(e),pageNo=Math.max(1,+$('redact-page').value||1),rect={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};if(rect.w>3&&rect.h>3){const list=marks.get(pageNo)||[];list.push(rect);marks.set(pageNo,list)}start=null;drawMarks(pageNo)});
  $('load-redact-page').addEventListener('click',()=>load().catch(e=>setDialogStatus(e.message,true)));$('clear-redactions').addEventListener('click',()=>{marks.delete(Math.max(1,+$('redact-page').value||1));drawMarks(Math.max(1,+$('redact-page').value||1))});
  $('pdf-tool-files').addEventListener('change',()=>load().catch(e=>setDialogStatus(e.message,true)));
}
async function loadFormFields(){
  try{const file=firstFile(),{PDFDocument}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer()),form=doc.getForm(),fields=form.getFields(),host=$('form-fields');if(!fields.length){host.innerHTML='<p class="pdf-hint">No encontré campos interactivos. Puedes crear uno nuevo abajo.</p>';return}host.innerHTML='';for(const f of fields){const name=f.getName(),type=f.constructor.name,wrap=document.createElement('label');wrap.className='pdf-field';const span=document.createElement('span');span.textContent=name;let input;if(type.includes('CheckBox')){input=document.createElement('input');input.type='checkbox';try{input.checked=f.isChecked()}catch{}}else if(type.includes('Dropdown')||type.includes('OptionList')||type.includes('RadioGroup')){input=document.createElement('select');for(const opt of f.getOptions?.()||[]){const o=document.createElement('option');o.value=o.textContent=opt;input.append(o)}try{input.value=f.getSelected?.()?.[0]||f.getSelected?.()||''}catch{}}else{input=document.createElement('input');input.type='text';try{input.value=f.getText?.()||''}catch{}}input.dataset.fieldName=name;wrap.append(span,input);host.append(wrap)}setDialogStatus(`${fields.length} campo${fields.length===1?'':'s'} detectado${fields.length===1?'':'s'}.`)}catch(e){setDialogStatus(e.message,true)}}
function workflowStore(){try{return JSON.parse(localStorage.getItem('reynoso-convert-workflows')||'{}')}catch{return {}}}
function currentWorkflow(){return{name:$('workflow-name').value.trim(),rotate:+$('workflow-rotate').value||0,watermark:$('workflow-watermark').value.trim(),numbers:$('workflow-numbers').value==='yes',compress:$('workflow-compress').value}}
function bindWorkflows(){const select=$('saved-workflows');function refresh(){const store=workflowStore();select.innerHTML='<option value="">Flujos guardados</option>'+Object.keys(store).sort().map(name=>`<option>${name}</option>`).join('')}refresh();$('save-workflow').addEventListener('click',()=>{const config=currentWorkflow();if(!config.name)return setDialogStatus('Ponle un nombre al flujo.',true);const store=workflowStore();store[config.name]=config;localStorage.setItem('reynoso-convert-workflows',JSON.stringify(store));refresh();select.value=config.name;setDialogStatus('Flujo guardado en este navegador.')});select.addEventListener('change',()=>{const config=workflowStore()[select.value];if(!config)return;$('workflow-name').value=config.name||'';$('workflow-rotate').value=String(config.rotate||0);$('workflow-watermark').value=config.watermark||'';$('workflow-numbers').value=config.numbers?'yes':'no';$('workflow-compress').value=config.compress||'none'});$('delete-workflow').addEventListener('click',()=>{if(!select.value)return;const store=workflowStore();delete store[select.value];localStorage.setItem('reynoso-convert-workflows',JSON.stringify(store));refresh();setDialogStatus('Flujo eliminado.')})}
async function runWorkflow(file,config){const {PDFDocument,StandardFonts,rgb,degrees}=await PDFLib(),doc=await PDFDocument.load(await file.arrayBuffer());if(config.rotate)for(const page of doc.getPages())page.setRotation(degrees(((page.getRotation().angle||0)+config.rotate)%360));if(config.watermark){const font=await doc.embedFont(StandardFonts.HelveticaBold);for(const page of doc.getPages()){const {width,height}=page.getSize(),size=Math.max(18,Math.min(44,width/14)),tw=font.widthOfTextAtSize(config.watermark,size);page.drawText(config.watermark,{x:(width-tw)/2,y:height/2,size,font,color:rgb(.55,.55,.55),opacity:.22,rotate:degrees(35)})}}if(config.numbers){const font=await doc.embedFont(StandardFonts.Helvetica);doc.getPages().forEach((page,i)=>{const text=String(i+1),tw=font.widthOfTextAtSize(text,10);page.drawText(text,{x:(page.getWidth()-tw)/2,y:18,size:10,font,color:rgb(.2,.2,.2)})})}let blob=pdfBlob(await doc.save());if(config.compress&&config.compress!=='none'){const temp=new File([blob],file.name,{type:'application/pdf'}),opts=config.compress==='strong'?{scale:1,quality:.52}:{scale:1.3,quality:.7};blob=await rasterPdf(temp,opts)}return blob}

renderCards();
document.body.dataset.pdfTools='ready';
