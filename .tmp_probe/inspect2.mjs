import fs from 'fs';
const dir='.tmp_probe';
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json') || f.startsWith('inspect')) continue;
  let j; try { j = JSON.parse(fs.readFileSync(dir+'/'+f,'utf8').trim()); } catch(e){ console.log(f,'PARSE FAIL'); continue; }
  console.log('\n######## '+f);
  const pages = j.pages||[];
  pages.forEach((p,pi)=>{
    console.log(` page[${pi}] keys=${Object.keys(p).join(',')}`);
    const bg = p.background || p.bg || p.settings?.background;
    if (bg) console.log('   pageBG='+JSON.stringify(bg).slice(0,240));
    if (p.image || p.bgImage) console.log('   pageImage='+(p.image||p.bgImage));
  });
  const walk=(arr,d)=>{
    for (const el of arr||[]) {
      const src = el.src || el.fill?.src || el.fill?.image?.src || el.props?.src;
      if (el.type==='image'||src) console.log('   ' + '  '.repeat(d) + `[${el.type}] src=${src||'-'} ` + (el.fill?('fill='+JSON.stringify(el.fill).slice(0,120)):''));
      walk(el.children,d+1);
    }
  };
  pages.forEach((p,pi)=>{ console.log('   --- elements page'+pi); walk(p.elements||p.children,0); });
}
