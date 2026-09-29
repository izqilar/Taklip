/**
 * 验证「填充色」改造后的三项：
 *  A. 单色/渐变/图案/图片 四个互斥单选按钮齐全、名称为短名、选中态一致；
 *  A2. 排版：圆点在上、名称在下、四个按钮一行内等宽排满、名称不折行；
 *  B. 选中可填充对象（形状/文本）后，不再出现「底部整宽空白面板 + 整屏垂直滚动条」。
 *
 * 用法：node scripts/verify_fill_radio.mjs
 * 前置：apps/web(:5173) 在跑；夹具项目 e2e_fill_fixture 已存在（否则先跑 scripts/fill_fixture.mjs）。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT_ID = 'e2e_fill_fixture';
const PHONE = '13900001001';
const PASSWORD = 'Test123456';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}${detail ? '  (' + detail + ')' : ''}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? '  (' + detail + ')' : ''}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const errs = [];

const boot = await ctx.newPage();
await boot.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await boot.evaluate(async ({ phone, password }) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const d = await res.json();
  localStorage.setItem('access_token', d.accessToken || '');
  localStorage.setItem('refresh_token', d.refreshToken || '');
  localStorage.setItem('user_info', JSON.stringify(d.user || {}));
}, { phone: PHONE, password: PASSWORD });

const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 40000 });
await page.waitForTimeout(2500);

const stageInfo = await page.evaluate(() => {
  const stage = window.Konva.stages[0];
  const tr = stage.getAbsoluteTransform();
  const el = stage.container();
  const r = el.getBoundingClientRect();
  return { scale: tr.getMatrix()[0], left: r.left, top: r.top };
});

const designToContainer = (pts) =>
  page.evaluate((ps) => {
    const stage = window.Konva.stages[0];
    const tr = stage.getAbsoluteTransform();
    return ps.map((p) => tr.point({ x: p.x, y: p.y }));
  }, pts);

async function clickDesign(designPt) {
  const [c] = await designToContainer([designPt]);
  await page.mouse.click(stageInfo.left + c.x, stageInfo.top + c.y);
  await page.waitForTimeout(600);
}

/* ── 任务 B：选中可填充对象后，整屏垂直滚动条 + 底部整宽空白面板 ── */
console.log('\n── 任务 B：选中填充对象后的整屏滚动条 / 底部空白面板 ──');

// 先测未选中态（基线）
const baseScroll = await page.evaluate(() => ({
  sh: document.documentElement.scrollHeight,
  ch: document.documentElement.clientHeight,
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check('未选中：无整屏垂直滚动条', baseScroll.sh === baseScroll.ch, `scrollH=${baseScroll.sh} clientH=${baseScroll.ch}`);

// 选中一个矩形（可填充）
await clickDesign({ x: 160, y: 100 }); // r_grad 中心

const afterScroll = await page.evaluate(() => ({
  sh: document.documentElement.scrollHeight,
  ch: document.documentElement.clientHeight,
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check('选中形状：无整屏垂直滚动条', afterScroll.sh === afterScroll.ch, `scrollH=${afterScroll.sh} clientH=${afterScroll.ch}`);
check('选中形状：无整屏水平滚动条', afterScroll.sw === afterScroll.cw, `scrollW=${afterScroll.sw} clientW=${afterScroll.cw}`);

// 扫描：是否存在「整宽 + 贴视口底部 + 高度显著 + 可见 + 无内容」的空白面板
// （这正是用户描述的「屏幕下方整宽空白面板」；排除全屏隐形抽屉遮罩 opacity:0）
const blankPanel = await page.evaluate(() => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const all = Array.from(document.querySelectorAll('*'));
  const hits = [];
  for (const el of all) {
    const s = getComputedStyle(el);
    if (s.opacity === '0' || s.visibility === 'hidden' || s.display === 'none') continue;
    if (s.pointerEvents === 'none' && parseFloat(s.opacity) < 0.01) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.92) continue;       // 必须几乎整宽
    if (r.height < 60) continue;             // 必须是一块区域，不是细线
    if (r.bottom < vh - 2) continue;         // 必须贴到视口底部
    if (r.top < vh - r.height - 80) continue; // 必须底部锚定（非全屏覆盖层）
    const txt = (el.innerText || '').trim().length;
    const visibleChildren = Array.from(el.children).filter((c) => {
      const cr = c.getBoundingClientRect();
      return cr.width > 0 && cr.height > 0;
    }).length;
    if (txt === 0 && visibleChildren <= 1) {
      hits.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) });
    }
  }
  return { vh, vw, hits };
});
check('选中形状：无底部整宽空白面板', blankPanel.hits.length === 0, JSON.stringify(blankPanel.hits.slice(0, 3)));

// 再选中一个文本（可填充）复测
await clickDesign({ x: 160, y: 440 }); // t_pat 中心
const afterText = await page.evaluate(() => ({
  sh: document.documentElement.scrollHeight,
  ch: document.documentElement.clientHeight,
}));
check('选中文本：无整屏垂直滚动条', afterText.sh === afterText.ch, `scrollH=${afterText.sh} clientH=${afterText.ch}`);

/* ── 任务 A：四个互斥单选按钮（圆点在上 / 名称在下 / 一行四等分） ── */
console.log('\n── 任务 A：填充类型单选按钮组 ──');
const radioGroup = await page.evaluate(() => {
  // 找到所有 name="fill-type" 的 radio
  const inputs = Array.from(document.querySelectorAll('input[type=radio][name="fill-type"]'));
  const labels = inputs.map((inp) => {
    const lbl = inp.closest('label');
    const dot = lbl?.querySelector('span.rounded-full') || null; // 可见圆点（外层 span）
    const name = lbl?.querySelector('span.whitespace-nowrap') || null; // 名称 span
    const lr = lbl?.getBoundingClientRect();
    const dr = dot?.getBoundingClientRect();
    const nr = name?.getBoundingClientRect();
    return {
      checked: inp.checked,
      text: (name?.textContent || '').trim(),
      hasCustomDot: !!dot,
      label: lr ? { x: lr.x, y: lr.y, w: lr.width, h: lr.height, top: lr.top, bottom: lr.bottom, left: lr.left, right: lr.right } : null,
      dot: dr ? { cx: dr.x + dr.width / 2, cy: dr.y + dr.height / 2, top: dr.top, bottom: dr.bottom } : null,
      nameBox: nr ? { cx: nr.x + nr.width / 2, cy: nr.y + nr.height / 2, top: nr.top, bottom: nr.bottom, left: nr.left, right: nr.right, lineRects: name.getClientRects().length } : null,
    };
  });
  const group = document.querySelector('[role=radiogroup][aria-label]');
  const groupBox = group ? (() => { const r = group.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width }; })() : null;
  return { count: inputs.length, labels, groupBox };
});
check('填充类型含 4 个互斥单选按钮', radioGroup.count === 4, `count=${radioGroup.count}`);
const texts = radioGroup.labels.map((l) => l.text);
check('名称 = 单色 / 渐变 / 图案 / 图片', JSON.stringify(texts) === JSON.stringify(['单色', '渐变', '图案', '图片']), JSON.stringify(texts));
check('不再残留「单色填充」', !texts.some((x) => x.includes('填充')), JSON.stringify(texts));
const checkedCount = radioGroup.labels.filter((l) => l.checked).length;
check('至多一个被选中（互斥）', checkedCount <= 1, `checked=${checkedCount}`);

/* ── 任务 A2：排版（圆点在上、名称在下、一行四等分、不折行） ── */
console.log('\n── 任务 A2：单选按钮排版 ──');
const L = radioGroup.labels;
check('四个按钮均渲染出圆点与名称', L.every((l) => l.dot && l.nameBox), L.map((l) => `${!!l.dot}/${!!l.nameBox}`).join(','));
check('圆点在名称正上方（dot.bottom <= name.top）',
  L.every((l) => l.dot.bottom <= l.nameBox.top + 0.5),
  L.map((l) => `${l.dot.bottom.toFixed(1)}<=${l.nameBox.top.toFixed(1)}`).join(' | '));
check('水平居中对齐（dot.cx ≈ name.cx，容差 1.5px）',
  L.every((l) => Math.abs(l.dot.cx - (l.nameBox.left + l.nameBox.right) / 2) <= 1.5),
  '');
const tops = L.map((l) => Math.round(l.label.top));
check('四个按钮同一行（top 全等）', new Set(tops).size === 1, JSON.stringify(tops));
const widths = L.map((l) => Math.round(l.label.w));
check('四个按钮等宽（±1px）', Math.max(...widths) - Math.min(...widths) <= 1, JSON.stringify(widths));
check('四个按钮都在分组框内（无溢出 / 无换行折行）',
  L.every((l) => l.label.left >= radioGroup.groupBox.left - 1 && l.label.right <= radioGroup.groupBox.right + 1)
  && L[3].label.right === Math.max(...L.map((l) => l.label.right)),
  `group=[${Math.round(radioGroup.groupBox.left)},${Math.round(radioGroup.groupBox.right)}] last=${Math.round(L[3].label.right)}`);
check('名称单行不折行（clientRects = 1 且高度 < 2 行）',
  L.every((l) => l.nameBox.lineRects === 1),
  L.map((l) => l.nameBox.lineRects).join(','));
check('按钮高度为紧凑两行（< 56px）', L.every((l) => l.label.h < 56), JSON.stringify(L.map((l) => Math.round(l.label.h))));

// 点击「图片填充」并验证图片填充编辑器出现
const clickRadio = async (labelText) =>
  page.evaluate((label) => {
    const labels = Array.from(document.querySelectorAll('label'));
    const target = labels.find((l) => (l.innerText || '').replace(/\s+/g, '').trim() === label);
    if (!target) return false;
    const input = target.querySelector('input[type=radio]');
    if (!input) return false;
    input.click();
    return true;
  }, labelText);

const okImg = await clickRadio('图片');
await page.waitForTimeout(500);
check('可切换到「图片」', okImg);
const imgEditor = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const hasUpload = all.some((e) => (e.innerText || '').includes('上传图片'));
  const hasFit = all.some((e) => (e.innerText || '').includes('适配方式'));
  const hasOpacity = all.some((e) => (e.innerText || '').includes('不透明度'));
  const radios = document.querySelectorAll('input[type=radio][name="image-fit"]').length;
  return { hasUpload, hasFit, hasOpacity, radios };
});
check('图片填充编辑器出现（上传图片按钮）', imgEditor.hasUpload);
check('图片填充编辑器出现（适配方式 + 三选项）', imgEditor.hasFit && imgEditor.radios === 3, `radios=${imgEditor.radios}`);
check('图片填充编辑器出现（不透明度）', imgEditor.hasOpacity);

// 分组标题必须仍是「图片填充」——单选改用独立 i18n 键（fill.typeImage），
// 不得连带改到复用了同一键的 ImageFillEditor 分组标题（fill.image）
const leafTexts = () => page.evaluate(() => {
  const out = new Set();
  document.querySelectorAll('span').forEach((s) => {
    if (s.children.length === 0) {
      const t = (s.textContent || '').trim();
      if (t) out.add(t);
    }
  });
  return Array.from(out);
});
const tImg = await leafTexts();
check('分组标题仍为「图片填充」（未被单选改名连带）', tImg.includes('图片填充'), JSON.stringify(tImg.filter((x) => x.includes('图片'))));

// 切到「图案」同样核对：单选显示「图案」，分组标题仍是「图案填充」
const okPat = await clickRadio('图案');
await page.waitForTimeout(600);
const tPat = await leafTexts();
check('可切换到「图案」', okPat);
check('分组标题仍为「图案填充」（未被单选改名连带）', tPat.includes('图案填充'), JSON.stringify(tPat.filter((x) => x.includes('图案'))));
check('「图案」按钮单行不折行', await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input[type=radio][name="fill-type"]'));
  const name = inputs[2].closest('label').querySelector('span.whitespace-nowrap');
  return name.getClientRects().length === 1;
}));

// 切回单色，确认互斥（图片不再选中）
const okSolid = await clickRadio('单色');
await page.waitForTimeout(400);
const afterSolid = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input[type=radio][name="fill-type"]'));
  return inputs.map((i) => i.checked);
});
check('切回单色后仅 1 个被选中', afterSolid.filter(Boolean).length === 1, JSON.stringify(afterSolid));

check('运行期间无页面异常', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
