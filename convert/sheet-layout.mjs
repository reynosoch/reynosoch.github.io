const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function column(index){let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
export const sheetStyles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF243746"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function worksheetXml(rows,hasHeader=true){
  const width=rows.reduce((max,row)=>Math.max(max,row.length),1);
  const range=`A1:${column(width-1)}${Math.max(1,rows.length)}`;
  const cols=Array.from({length:width},(_,i)=>{
    const length=rows.slice(0,200).reduce((max,row)=>Math.max(max,String(row[i]??'').length),0);
    return `<col min="${i+1}" max="${i+1}" width="${Math.max(12,Math.min(48,length+3))}" customWidth="1"/>`;
  }).join('');
  const data=rows.map((row,ri)=>`<row r="${ri+1}" ht="${ri===0&&hasHeader?34:21}" customHeight="1">${row.map((v,ci)=>{
    const value=String(v??''),style=ri===0&&hasHeader?1:ri%2===0?2:0;
    // Keep identifiers, dates, formulas and leading zeroes as literal text.
    const numeric=ri>0&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)&&value.replace(/[^0-9]/g,'').length<=15;
    return numeric?`<c r="${column(ci)}${ri+1}" s="${style}"><v>${value}</v></c>`:`<c r="${column(ci)}${ri+1}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0">${hasHeader?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>${cols}</cols><sheetData>${data}</sheetData>${hasHeader&&rows.length>1?`<autoFilter ref="${range}"/>`:''}</worksheet>`;
}
