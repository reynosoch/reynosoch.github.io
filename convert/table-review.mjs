import {detectTable,parseDelimited} from './tabular.mjs';

const separatorName=value=>({'|':'Barra vertical ( | )',',':'Coma ( , )',';':'Punto y coma ( ; )','\t':'Tabulación'}[value]||'Sin separación');

// Review one source at a time so each file in a batch can use its own delimiter.
export function reviewTable(model) {
  if(model.tableText===undefined)return Promise.resolve(true);
  const source=model.tableText.replace(/^\uFEFF/,''),detected=detectTable(source);
  const dialog=document.createElement('dialog');
  dialog.className='table-review';dialog.setAttribute('aria-labelledby','table-review-title');
  dialog.innerHTML=`<form method="dialog">
    <header><div><p class="section-kicker">REVISAR COLUMNAS</p><h2 id="table-review-title">Separación del archivo</h2></div><button value="cancel" aria-label="Cerrar revisión" type="submit">Cerrar</button></header>
    <p class="table-review-file"></p><p class="table-review-detected"></p>
    <label for="table-separator">Separador de columnas</label>
    <select id="table-separator"><option value="|">Barra vertical ( | )</option><option value=",">Coma ( , )</option><option value=";">Punto y coma ( ; )</option><option value="tab">Tabulación</option><option value="custom">Otro carácter</option><option value="none">Sin separación</option></select>
    <label class="table-custom" hidden>Carácter separador<input id="table-custom-separator" type="text" maxlength="1" autocomplete="off" placeholder="Ej. :"></label>
    <p class="table-review-count" role="status" aria-live="polite"></p>
    <div class="table-preview" tabindex="0" role="region" aria-label="Vista previa de las primeras filas"><table></table></div>
    <p class="table-review-note">Vista previa de las primeras 6 filas. El Excel se genera sin colores ni formato decorativo.</p>
    <footer><button value="cancel" type="submit">Cancelar</button><button id="table-review-confirm" value="confirm" class="button-primary" type="submit">Confirmar y generar</button></footer>
  </form>`;
  dialog.querySelector('.table-review-file').textContent=model.file.name;
  dialog.querySelector('.table-review-detected').textContent=detected?`Separación detectada: ${separatorName(detected.delimiter)}.`:'No se detectó una separación consistente. Puede elegirla o conservar una sola columna.';
  const select=dialog.querySelector('#table-separator'),custom=dialog.querySelector('#table-custom-separator'),confirm=dialog.querySelector('#table-review-confirm');
  select.value=detected?(detected.delimiter==='\t'?'tab':detected.delimiter):'none';
  let rows=[];
  function render(){
    const isCustom=select.value==='custom';
    dialog.querySelector('.table-custom').hidden=!isCustom;
    const separator=select.value==='tab'?'\t':isCustom?custom.value:select.value==='none'?null:select.value;
    const valid=!isCustom||(custom.value.length===1&&!/["\r\n]/.test(custom.value));
    confirm.disabled=!valid;
    rows=separator&&valid?parseDelimited(source,separator).map(row=>row.map(value=>value.trim())):source.split(/\r?\n/).filter(line=>line!=='').map(line=>[line]);
    const width=rows.reduce((max,row)=>Math.max(max,row.length),1),uneven=rows.some(row=>row.length!==width);
    dialog.querySelector('.table-review-count').textContent=!valid?'Indique un solo carácter separador (sin comillas ni saltos de línea).':`${rows.length} filas en total · ${width} columnas${uneven?' · Hay filas con distinto número de columnas; revise la vista previa.':''}`;
    const table=dialog.querySelector('table');table.replaceChildren();
    for(const row of rows.slice(0,6)){
      const tr=table.insertRow();
      for(let i=0;i<Math.min(width,50);i++)tr.insertCell().textContent=row[i]??'';
    }
    if(width>50)dialog.querySelector('.table-review-count').textContent+=' · Se muestran las primeras 50 columnas.';
  }
  select.addEventListener('change',()=>{render();if(select.value==='custom')custom.focus();});custom.addEventListener('input',render);
  document.body.append(dialog);render();dialog.showModal();select.focus();
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>{
      const accepted=dialog.returnValue==='confirm'&&!confirm.disabled;
      if(accepted){model.rows=rows;model.kind='table';model.repaired=true;}
      dialog.remove();resolve(accepted);
    },{once:true});
  });
}
