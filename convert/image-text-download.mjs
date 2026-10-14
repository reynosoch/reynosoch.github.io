// Compatibility path for browsers that ignore download clicks from detached anchors.
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-image-text-download]');
  if(!button||button.disabled)return;
  const card=button.closest('.image-text-result');
  const area=card?.querySelector('.image-text-output');
  if(!area?.value)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const source=card.querySelector('.image-text-result-head strong')?.textContent||'imagen';
  const stem=source.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-')||'imagen';
  const url=URL.createObjectURL(new Blob([area.value],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=`${stem}-texto.txt`;
  link.hidden=true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
},true);
