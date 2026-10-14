const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function column(index){let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
export function worksheetXml(rows){
  const width=rows.reduce((max,row)=>Math.max(max,row.length),1);
  const range=`A1:${column(width-1)}${Math.max(1,rows.length)}`;
  const cols=Array.from({length:width},(_,i)=>{
    const length=rows.slice(0,200).reduce((max,row)=>Math.max(max,String(row[i]??'').length),0);
    return `<col min="${i+1}" max="${i+1}" width="${Math.max(12,Math.min(48,length+3))}" customWidth="1"/>`;
  }).join('');
  const data=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{
    const value=String(v??'');
    // Keep identifiers, dates, formulas and leading zeroes as literal text.
    const numeric=ri>0&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)&&value.replace(/[^0-9]/g,'').length<=15;
    return numeric?`<c r="${column(ci)}${ri+1}"><v>${value}</v></c>`:`<c r="${column(ci)}${ri+1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`;
}
