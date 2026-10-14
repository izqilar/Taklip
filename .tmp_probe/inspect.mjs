import fs from 'fs';
const dir='.tmp_probe';
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const raw = fs.readFileSync(dir+'/'+f,'utf8').trim();
  let j; try { j = JSON.parse(raw); } catch(e){ console.log(f, 'PARSE FAIL'); continue; }
  const els = j.elements || j.children || j.pages?.[0]?.elements || [];
  console.log('=== '+f+'  rootKeys='+Object.keys(j).join(','));
  const walk=(arr, depth)=>{
    for (const el of arr||[]) {
      const props = el.props||{};
      const src = el.src || props.src || el.fill?.image?.src || (el.fill&&el.fill.src) || el.image || props.image;
      const interesting = el.type==='image'||el.type==='gallery'||el.type==='puzzle'||src;
      if (interesting) console.log('  '.repeat(depth)+`[${el.type}] id=${el.id} src=${src||'-'} fillType=${el.fillType||el.fill?.type||'-'}`);
      walk(el.children, depth+1);
    }
  };
  walk(els,0);
}
