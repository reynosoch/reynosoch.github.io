export class History {
  constructor(limit=80,budget=3_000_000){this.limit=limit;this.budget=budget;this.states=[];this.index=-1;}
  push(state){const value=JSON.stringify(state);if(this.states[this.index]===value)return;this.states.splice(this.index+1);this.states.push(value);this.index=this.states.length-1;while(this.states.length>1&&(this.states.length>this.limit||this.states.reduce((n,s)=>n+s.length,0)>this.budget)){this.states.shift();this.index--;}}
  undo(){if(this.index>0)return JSON.parse(this.states[--this.index]);}
  redo(){if(this.index<this.states.length-1)return JSON.parse(this.states[++this.index]);}
  get canUndo(){return this.index>0;}get canRedo(){return this.index<this.states.length-1;}
}
export const safeName=(name='captura')=>name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,90)||'captura';
export function feedback(name,notes,intro='Revisa la captura adjunta.') {return `${intro.trim()}\n\nCaptura: ${name}\n\n${notes.map((n,i)=>`${i+1}. ${n.trim()||'Revisar el punto marcado.'}`).join('\n')}\n\nRespeta la funcionalidad existente y corrige únicamente los puntos marcados. No cambiar otras áreas sin necesidad.\n`;}
export function clampCrop(rect,width,height){const left=Math.max(0,Math.min(width-1,rect.left)),top=Math.max(0,Math.min(height-1,rect.top));return {left,top,width:Math.max(1,Math.min(width-left,rect.width)),height:Math.max(1,Math.min(height-top,rect.height))};}
export function boundedSize(width,height,maxPixels=40_000_000){if(!Number.isFinite(width*height)||width<1||height<1||width*height>maxPixels||Math.max(width,height)>16384)throw Error('Esta imagen es demasiado grande. Usa una captura de hasta 40 megapíxeles y 16 384 px por lado.');return {width,height};}
