import { technologies, platforms } from '../data/default-snippets.mjs';
export const safetyLabels = {safe:'SEGURO',caution:'PRECAUCIÓN',destructive:'DESTRUCTIVO'};
// A conservative guard for common destructive commands, not a general shell parser.
export function effectiveSafety(snippet, command=snippet.command) {
  if (snippet.safety==='destructive' || /git\s+(?:restore\b|reset\b[^\n]*--hard|clean\b[^\n]*-[a-z]*f)|\b(?:Stop-Process|Remove-Item|DROP\s+(?:TABLE|DATABASE)|TRUNCATE|DELETE\s+FROM)\b|\brm\s+[^\n]*-[a-z]*[rf]|\b(?:del|rmdir)\s+/i.test(command)) return 'destructive';
  return snippet.safety;
}
export function normalizeSnippet(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Snippet inválido.');
  const string=(key,max,required=true)=>{
    if(typeof value[key]!=='string'||value[key].length>max||(required&&!value[key].trim())) throw new Error(`Revisa el campo ${key}.`);
    return value[key].trim();
  };
  const id=string('id',160),name=string('name',140),command=string('command',24000),description=string('description',3000);
  if(!technologies.includes(value.technology)||!platforms.includes(value.platform)||!Object.hasOwn(safetyLabels,value.safety)||!['command','recipe'].includes(value.type)) throw new Error('Tecnología, plataforma, tipo o seguridad inválidos.');
  if(!Array.isArray(value.useCases)||!value.useCases.length||value.useCases.length>30||value.useCases.some(x=>typeof x!=='string'||!x.trim()||x.length>3000)) throw new Error('Agrega al menos un caso de uso válido.');
  if(!Array.isArray(value.tags)||value.tags.length>40||value.tags.some(x=>typeof x!=='string'||x.length>80)) throw new Error('Tags inválidos (máximo 40).');
  if(value.type==='recipe'&&command.split('\n').filter(x=>x.trim()).length<2) throw new Error('Una receta necesita al menos dos pasos, uno por línea.');
  const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
  const now=new Date().toISOString();
  const record={id,name,command,description,technology:value.technology,platform:value.platform,type:value.type,safety:value.safety,useCases:value.useCases.map(x=>x.trim()),tags:[...new Set(value.tags.map(x=>x.trim()).filter(Boolean))],favorite:value.favorite===true,usageCount:Number.isSafeInteger(value.usageCount)&&value.usageCount>=0?value.usageCount:0,lastUsed:validDate(value.lastUsed)?value.lastUsed:null,createdAt:validDate(value.createdAt)?value.createdAt:now,updatedAt:validDate(value.updatedAt)?value.updatedAt:now,custom:value.custom===true};
  record.safety=effectiveSafety(record); return record;
}
export function recipeSteps(snippet) { return snippet.type==='recipe'?snippet.command.split('\n').map(x=>x.trim()).filter(Boolean):[snippet.command]; }
