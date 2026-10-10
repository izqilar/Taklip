// 验证编辑器两个缺陷修复的核心逻辑（不依赖 React，复刻纯函数）
const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

// ── 缺陷 1：镜像后四角映射 ──
function dataCornerForVisual(visual, flipX, flipY) {
  let k = visual;
  if (flipX) k = k === 'topLeft' ? 'topRight' : k === 'topRight' ? 'topLeft' : k === 'bottomLeft' ? 'bottomRight' : 'bottomLeft';
  if (flipY) k = k === 'topLeft' ? 'bottomLeft' : k === 'bottomLeft' ? 'topLeft' : k === 'topRight' ? 'bottomRight' : 'topRight';
  return k;
}

// 视觉角 → 该视觉角上真实出现的数据角（期望）
const expected = {
  'flipX':      { topLeft: 'topRight', topRight: 'topLeft', bottomLeft: 'bottomRight', bottomRight: 'bottomLeft' },
  'flipY':      { topLeft: 'bottomLeft', topRight: 'bottomRight', bottomLeft: 'topLeft', bottomRight: 'topRight' },
  'flipXY':     { topLeft: 'bottomRight', topRight: 'bottomLeft', bottomLeft: 'topRight', bottomRight: 'topLeft' },
  'none':       { topLeft: 'topLeft', topRight: 'topRight', bottomLeft: 'bottomLeft', bottomRight: 'bottomRight' },
};

let ok = true;
for (const [name, m] of Object.entries(expected)) {
  const [fx, fy] = name === 'flipX' ? [true, false] : name === 'flipY' ? [false, true] : name === 'flipXY' ? [true, true] : [false, false];
  for (const v of keys) {
    const got = dataCornerForVisual(v, fx, fy);
    const want = m[v];
    const pass = got === want;
    if (!pass) ok = false;
    console.log(`[缺陷1 ${name}] 视觉角 ${v} -> 数据角 ${got} (期望 ${want}) ${pass ? '✓' : '✗'}`);
  }
}

// ── 缺陷 2：取色器初始透明度兜底 ──
function parseCssColorSentinel(value) {
  const norm = (value || '').trim().toLowerCase();
  if (norm === 'transparent' || norm === '') return { a: 0 };
  if (norm.startsWith('#')) return { a: 1 };
  const m = norm.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(s => parseFloat(s.trim())); return { a: Number.isFinite(p[3]) ? p[3] : 1 }; }
  return { a: 1 };
}
function initialAlpha(value) {
  const initial = parseCssColorSentinel(value);
  return value && value.trim().toLowerCase() !== 'transparent' && value.trim() !== '' ? initial.a : 1;
}
const cases = [
  ['transparent', 1, '未设背景→默认不透明'],
  ['', 1, '空串→默认不透明'],
  ['#ff0000', 1, '不透明红→1'],
  ['rgba(255,0,0,0.5)', 0.5, '半透明→0.5'],
  ['rgba(255,0,0,0)', 0, '渐变停靠点透明红→保留0(不被强改)'],
];
for (const [v, want, note] of cases) {
  const got = initialAlpha(v);
  const pass = Math.abs(got - want) < 1e-9;
  if (!pass) ok = false;
  console.log(`[缺陷2] value=${JSON.stringify(v)} -> alpha ${got} (期望 ${want}) ${pass ? '✓' : '✗'}  (${note})`);
}

console.log(ok ? '\nALL PASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
