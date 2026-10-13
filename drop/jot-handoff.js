const HANDOFF_KEY='reynoso-toolchain:drop-handoff:v1';
const DROP_DRAFT_KEY='reynoso-drop:text-draft';
const MAX_AGE=5*60*1000;

function showToast(message){
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=message;toast.hidden=false;
  setTimeout(()=>{toast.hidden=true;},4500);
}

function consume(){
  let raw='';
  try{raw=sessionStorage.getItem(HANDOFF_KEY)||'';sessionStorage.removeItem(HANDOFF_KEY);}catch{return;}
  if(!raw)return;
  try{
    const data=JSON.parse(raw);
    const fresh=Number.isFinite(data?.created)&&Date.now()-data.created>=0&&Date.now()-data.created<=MAX_AGE;
    if(data?.v!==1||data?.source!=='jot'||!fresh||typeof data.text!=='string'||!data.text.trim()||!['text','file'].includes(data.mode))return;
    const text=data.text.slice(0,1024*1024);
    if(data.mode==='file'){
      const input=document.getElementById('file-input');
      if(!input)return;
      const name=String(data.name||'jot-nota.txt').replace(/[\\/:*?"<>|]+/g,'-').slice(0,120)||'jot-nota.txt';
      const file=new File([text],name,{type:'text/plain;charset=utf-8',lastModified:data.created});
      const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      showToast('Nota de Jot preparada como archivo. Conecta la otra pantalla y envíala.');
    }else{
      const area=document.getElementById('text-input');
      if(!area)return;
      area.value=text;area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();
      try{localStorage.removeItem(DROP_DRAFT_KEY);}catch{}
      showToast('Nota de Jot preparada como texto. Conecta la otra pantalla y envíala.');
    }
    const url=new URL(location.href);url.searchParams.delete('from');history.replaceState(null,'',url.pathname+url.search+url.hash);
  }catch{
    // Ignore malformed or expired handoffs; Drop remains usable normally.
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(consume,0),{once:true});
else setTimeout(consume,0);