import {recordUse,readRecents} from './recents.mjs';
const route=location.pathname.split('/').filter(Boolean).at(-1),id=route==='index.html'?location.pathname.split('/').filter(Boolean).at(-2):route;
let last=0;
function record(){try{recordUse(id);last=Date.now();}catch{}}
record();
// Record real activity, not just landing-card clicks; works with direct bookmarks.
for(const name of ['pointerdown','keydown','wheel'])document.addEventListener(name,e=>{if(e.isTrusted&&(Date.now()-last>1000||readRecents()[0]?.id!==id))record();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')record();});

window.addEventListener('focus',record);
