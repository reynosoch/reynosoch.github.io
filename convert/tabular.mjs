// Detect structured text conservatively; spaces inside names remain untouched.
export function parseDelimited(text, delimiter=',') {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i],next=text[i+1];
    if(c==='"'&&(quoted||cell==='')) {
      if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&next==='\n')i++;
      row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';
    }else cell+=c;
  }
  row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  return rows;
}

export function detectTable(text) {
  const source=String(text).replace(/^\uFEFF/,'');
  let best=null;
  for(const delimiter of ['\t','|',';',',']) {
    const rows=parseDelimited(source,delimiter);
    if(rows.length<2)continue;
    const width=rows[0].length;
    if(width<2)continue;
    // Do not silently turn prose or ragged exports into a shifted table.
    if(!rows.every(row=>row.length===width))continue;
    const score=width;
    if(!best||score>best.score)best={rows,delimiter,score};
  }
  if(!best)return null;
  return {rows:best.rows.map(row=>row.map(cell=>cell.trim())),delimiter:best.delimiter};
}

export function repairSingleColumn(rows) {
  if(!rows.length||!rows.every(row=>row.length===1))return null;
  return detectTable(rows.map(row=>String(row[0]??'')).join('\n'));
}
