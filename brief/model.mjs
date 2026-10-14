export const KEY='reynoso-brief:v1';
export const MAX_DRAFTS=30;
export const fields=['title','project','repository','branch','goal','situation','changes','constraints','evidence','checks','delivery'];
export const labels={title:'Título',project:'Proyecto',repository:'Repositorio o enlace',branch:'Rama',goal:'Objetivo',situation:'Situación actual',changes:'Cambios requeridos',constraints:'Restricciones',evidence:'Evidencia y referencias',checks:'Criterios de aceptación',delivery:'Entrega'};
export function newDraft(now=Date.now(),id=globalThis.crypto.randomUUID()){
  return {id,createdAt:now,updatedAt:now,...Object.fromEntries(fields.map(f=>[f,f==='branch'?'main':'']))};
}
export function validateDraft(d){
  if(!d||typeof d!=='object'||Array.isArray(d)||typeof d.id!=='string'||!d.id||d.id.length>160||!Number.isFinite(d.createdAt)||!Number.isFinite(d.updatedAt))throw Error('Borrador inválido.');
  for(const f of fields)if(typeof d[f]!=='string'||d[f].length>(f==='title'?160:6000))throw Error(`Revise ${labels[f]}.`);
  return Object.fromEntries(['id','createdAt','updatedAt',...fields].map(f=>[f,d[f]]));
}
export function decode(text){
  if(typeof text!=='string'||text.length>1_000_000||new TextEncoder().encode(text).length>1_000_000)throw Error('El respaldo supera 1 MB.');
  let data;try{data=JSON.parse(text);}catch{throw Error('No se pudo leer el respaldo JSON.');}
  if(data?.app!=='reynoso-brief'||data.version!==1||!Array.isArray(data.drafts)||data.drafts.length>MAX_DRAFTS)throw Error('El respaldo no corresponde a Brief o supera 30 borradores.');
  const drafts=data.drafts.map(validateDraft);
  if(new Set(drafts.map(d=>d.id)).size!==drafts.length)throw Error('El respaldo contiene identificadores repetidos.');
  return drafts;
}
export function encode(drafts){
  const text=JSON.stringify({app:'reynoso-brief',version:1,drafts:drafts.map(validateDraft)},null,2);
  decode(text);return text;
}
const lines=text=>text.split('\n').map(s=>s.replace(/^\s*(?:[-*]|\d+[.)])\s+/,'').trim()).filter(Boolean);
export function buildBrief(d){
  validateDraft(d);
  if(!d.goal.trim())return '';
  const sections=[`# ${d.title.trim()||'Encargo de trabajo'}`];
  const context=[d.project.trim()&&`Proyecto: ${d.project.trim()}`,d.repository.trim()&&`Repositorio o enlace: ${d.repository.trim()}`,d.repository.trim()&&d.branch.trim()&&`Rama: ${d.branch.trim()}`].filter(Boolean);
  if(context.length)sections.push(context.join('\n'));
  for(const f of ['goal','situation','changes','constraints','evidence','checks','delivery']){
    if(!d[f].trim())continue;
    const list=['changes','constraints','evidence','checks'].includes(f);
    sections.push(`## ${labels[f]}\n\n${list?lines(d[f]).map(s=>`${f==='checks'?'- [ ]':'-'} ${s}`).join('\n'):d[f].trim()}`);
  }
  return sections.join('\n\n')+'\n';
}
export const templates={
  visual:{changes:'',constraints:'Conservar la funcionalidad existente.\nMantener la navegación y las URLs.\nUsar lenguaje profesional.',checks:'Verificar escritorio y móvil.\nConfirmar que las acciones existentes siguen funcionando.\nRevisar contraste y navegación con teclado.',delivery:'Resumen de cambios y comprobaciones realizadas.'},
  bug:{changes:'',constraints:'Corregir únicamente el alcance descrito.\nConservar los datos existentes.',checks:'Reproducir el problema antes de corregirlo.\nConfirmar que el caso reportado queda resuelto.\nComprobar los casos relacionados.',delivery:'Causa identificada, corrección y verificación.'},
  meeting:{changes:'',constraints:'Distinguir decisiones confirmadas de asuntos pendientes.',checks:'Cada acción tiene responsable y fecha.\nLas decisiones tienen evidencia o referencia.\nLos asuntos pendientes quedan identificados.',delivery:'Acuerdos, acciones y puntos pendientes para revisión.'},
  release:{changes:'',constraints:'Preservar funciones y datos existentes.\nConfirmar la versión publicada.',checks:'Ejecutar las pruebas del proyecto.\nCompletar la compilación.\nVerificar la URL publicada.',delivery:'Versión entregada, URL, comprobaciones y límites conocidos.'}
};
