import {tools} from './catalog.mjs';
export const RECENT_KEY='reynoso-toolchain:recent:v1';
const ids=new Set(tools.map(t=>t.id));
export function parseRecents(value){try{const data=JSON.parse(value);if(!Array.isArray(data))return [];const unique=new Map();for(const row of data)if(row&&ids.has(row.id)&&Number.isFinite(row.at)&&row.at>=0){if((unique.get(row.id)?.at??-1)<row.at)unique.set(row.id,{id:row.id,at:row.at});}return [...unique.values()].sort((a,b)=>b.at-a.at).slice(0,tools.length);}catch{return [];}}
export function readRecents(storage){try{return parseRecents((storage??globalThis.localStorage).getItem(RECENT_KEY));}catch{return [];}}
export function recordUse(id,storage,now=Date.now()){if(!ids.has(id))return [];const previous=readRecents(storage),at=Math.max(now,(previous[0]?.at??0)+1),next=[{id,at},...previous.filter(x=>x.id!==id)];try{(storage??globalThis.localStorage).setItem(RECENT_KEY,JSON.stringify(next));}catch{}return next;}
