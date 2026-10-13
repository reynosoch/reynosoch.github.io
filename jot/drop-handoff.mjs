const HANDOFF_KEY='reynoso-toolchain:drop-handoff:v1';
const MAX_AGE=5*60*1000;

const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function noteText(){
  const title=$('note-title')?.value.trim()||'';
  const labels=$('note-labels')?.value.split(',').map(value=>value.trim()).filter(Boolean)||[];
  const checklist=$('checklist');
  const parts=[];
  if(title)parts.push(title);
  if(checklist&&!checklist.hidden){
    const items=[...checklist.querySelectorAll('.check-row')].map(row=>{
      const box=row.querySelector('input[type="checkbox"]');
      const input=row.querySelector('input[type="text"]');
      const text=input?.value.trim();
      return text?`${box?.checked?'[x]':'[ ]'} ${text}`:'';
    }).filter(Boolean);
    if(items.length){if(parts.length)parts.push('');parts.push(...items);}
  }else{
    const body=$('note-body')?.value.trim()||'';
    if(body){if(parts.length)parts.push('');parts.push(body);}
  }
  if(labels.length){if(parts.length)parts.push('');parts.push(`Etiquetas: ${labels.join(', ')}`);}
  return parts.join('\n').trim();
}

function fileName(){
  const title=$('note-title')?.value.trim()||'jot-nota';
  const slug=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'jot-nota';
  return `${slug}.txt`;
}

async function waitForSave(){
  const state=$('saved-state');
  for(let i=0;i<16;i++){
    if(state?.textContent==='Guardado local')return;
    await sleep(100);
  }
}

async function send(mode){
  const text=noteText();
  if(!text){alert('Escribe algo en la nota antes de enviarla a Drop.');return;}
  await waitForSave();
  const payload={v:1,source:'jot',mode,text,name:fileName(),created:Date.now(),expires:Date.now()+MAX_AGE};
  try{
    sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(payload));
    location.href='../drop/?from=jot';
  }catch{
    alert('El navegador bloqueó el pase temporal a Drop. Copia la nota manualmente.');
  }
}

$('send-drop-text')?.addEventListener('click',()=>send('text'));
$('send-drop-file')?.addEventListener('click',()=>send('file'));
