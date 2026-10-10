/**
 * 「图片对象阴影随裁剪形状自适应」验证（#90-续：阴影渲染修复）。
 *
 * 用法：node scripts/verify_clipshadow.mjs
 *
 * 覆盖（每种裁剪形状：none / circle / ellipse / triangle / hexagon / star / heart，
 *       外加 heart+dashed、star+double 两种带边框的情形）：
 *  A) 编辑器（Konva 画布）：**真机像素采样**
 *     - 标定：矩形对照元素（裁剪 = none）验证坐标映射（中心=内容灰 / 阴影月牙=黑 / 远处=背景白）
 *     - 形状元素：向下投影阴影**沿底行存在**（此前被裁没 → 无阴影）；远处为白；中心为内容灰
 *     - 圆/椭圆：底行阴影宽度明显窄于矩形（圆角剪影，证明阴影随形状而非矩形盒）
 *  B) 预览（发布态 DOM / parity 页）：结构 + 像素
 *     - 形状模式：外层「阴影 div」filter 含 `drop-shadow(...)`（core.resolveDropShadow 真值）；
 *       内层「clip div」clip-path == 同一形状路径；最外层无 box-shadow（阴影已迁到 filter）
 *     - none 模式：外层 box-shadow == `0px 14px 0px rgba(0,0,0,1)`，无 drop-shadow
 *     - 像素：所有形状底行均存在阴影黑，远处白
 *  C) 两端一致：底行「阴影黑」判定两端相同
 *
 * 退出码 0 = 全绿。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const core = require('D:/MyWorkBuddy/2026-08-10-22-39-56/packages/core/dist/index.js');

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT = 'e2e_clipshadow_fixture';
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

/* ── 夹具几何（与 scripts/clipshadow_fixture.mjs 对齐） ── */
const W = 110, H = 90;
const CONTENT_RGB = [128, 128, 128];
const BG_RGB = [255, 255, 255];
const GRID = { none: [15, 30], circle: [132, 30], ellipse: [250, 30], triangle: [15, 140], hexagon: [132, 140], star: [250, 140], heart: [15, 250], heart_dash: [132, 250], star_double: [250, 250] };
const ELEMENTS = [
  { id: 'c_none', key: 'none', shape: 'none', style: 'solid', border: 0 },
  { id: 'c_circle', key: 'circle', shape: 'circle', style: 'solid', border: 0 },
  { id: 'c_ellipse', key: 'ellipse', shape: 'ellipse', style: 'solid', border: 0 },
  { id: 'c_triangle', key: 'triangle', shape: 'triangle', style: 'solid', border: 0 },
  { id: 'c_hexagon', key: 'hexagon', shape: 'hexagon', style: 'solid', border: 0 },
  { id: 'c_star', key: 'star', shape: 'star', style: 'solid', border: 0 },
  { id: 'c_heart', key: 'heart', shape: 'heart', style: 'solid', border: 0 },
  { id: 'c_heart_dash', key: 'heart_dash', shape: 'heart', style: 'dashed', border: 6 },
  { id: 'c_star_double', key: 'star_double', shape: 'star', style: 'double', border: 8 },
];
// 底行阴影宽度比对：仅对「底部明显窄于矩形」的形状断言（圆/椭圆）。其他形状底部几何特殊，仅验证阴影存在。
const NARROW_SHAPES = new Set(['circle', 'ellipse']);

const results = [];
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  results.push({ ok, name, detail });
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}
const nearColor = (c, target, tol = 26) =>
  c && Math.abs(c[0] - target[0]) <= tol && Math.abs(c[1] - target[1]) <= tol && Math.abs(c[2] - target[2]) <= tol;
const isShadow = (c) => !!c && Math.max(c[0], c[1], c[2]) < 90 && c[0] <= 1.25 * Math.max(c[1], c[2]);
const isContent = (c) => !!c && nearColor(c, CONTENT_RGB, 45);

/** 把 `clip-path: path("...")` 归一化为绝对坐标 + 空格分隔 + 去尾零（同 verify_clipborder） */
function normalizeClip(d) {
  let s = (d || '').trim();
  const m = s.match(/^path\(\s*"(.*)"\s*\)$/);
  if (m) s = m[1];
  const tokens = s.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [];
  let cx = 0, cy = 0, cmd = '';
  const out = [];
  let i = 0;
  const num = (v) => String(parseFloat(Number(v).toFixed(2)));
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; continue; }
    if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    if (up === 'Z') { out.push('Z'); continue; }
    if (up === 'M' || up === 'L') {
      const x = parseFloat(tokens[i]); const y = parseFloat(tokens[i + 1]); i += 2;
      const ax = rel ? cx + x : x, ay = rel ? cy + y : y;
      out.push(`${up} ${num(ax)} ${num(ay)}`);
      cx = ax; cy = ay;
      if (up === 'M') cmd = rel ? 'l' : 'L';
    } else if (up === 'A') {
      const rx = parseFloat(tokens[i]), ry = parseFloat(tokens[i + 1]), rot = parseFloat(tokens[i + 2]);
      const la = parseFloat(tokens[i + 3]), sw = parseFloat(tokens[i + 4]);
      const x = parseFloat(tokens[i + 5]), y = parseFloat(tokens[i + 6]); i += 7;
      const ax = rel ? cx + x : x, ay = rel ? cy + y : y;
      out.push(`A ${num(rx)} ${num(ry)} ${num(rot)} ${la} ${sw} ${num(ax)} ${num(ay)}`);
      cx = ax; cy = ay;
    } else if (up === 'C') {
      const x1 = parseFloat(tokens[i]), y1 = parseFloat(tokens[i + 1]);
      const x2 = parseFloat(tokens[i + 2]), y2 = parseFloat(tokens[i + 3]);
      const x = parseFloat(tokens[i + 4]), y = parseFloat(tokens[i + 5]); i += 6;
      const ax1 = rel ? cx + x1 : x1, ay1 = rel ? cy + y1 : y1;
      const ax2 = rel ? cx + x2 : x2, ay2 = rel ? cy + y2 : y2;
      const ax = rel ? cx + x : x, ay = rel ? cy + y : y;
      out.push(`C ${num(ax1)} ${num(ay1)} ${num(ax2)} ${num(ay2)} ${num(ax)} ${num(ay)}`);
      cx = ax; cy = ay;
    } else i++;
  }
  return out.join(' ');
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const boot = await ctx.newPage();
await boot.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await boot.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }),
  });
  const d = await res.json();
  localStorage.setItem('access_token', d.accessToken || '');
  localStorage.setItem('refresh_token', d.refreshToken || '');
  localStorage.setItem('user_info', JSON.stringify(d.user || {}));
});
await boot.close();

/* ════════════════ 1) 编辑器（Konva 画布）像素采样 ════════════════ */
const specs = ELEMENTS.map((e) => ({ ...e, x: GRID[e.key][0], y: GRID[e.key][1] }));

const edPage = await ctx.newPage();
const edErrs = [];
edPage.on('pageerror', (e) => edErrs.push(e.message));
await edPage.goto(`${BASE}/editor/${PROJECT}`, { waitUntil: 'networkidle' });
await edPage.waitForSelector('canvas', { timeout: 40000 });
await edPage
  .waitForFunction(
    () => {
      const s = window.Konva?.stages?.[0];
      if (!s) return false;
      return s.find('Image').length >= 9;
    },
    { timeout: 30000 },
  )
  .catch(() => {});
await edPage.waitForTimeout(2500);

const editorSample = await edPage.evaluate(({ specs, W, H }) => {
  const stage = window.Konva.stages[0];
  const layer = stage.getLayers()[0];
  const canvas = layer.getCanvas()._canvas;
  const g = canvas.getContext('2d');
  const zoom = stage.scaleX();
  const dpr = canvas.width / stage.width();
  const ox = stage.x();
  const oy = stage.y();
  const read = (px, py) => {
    const x = Math.round(px), y = Math.round(py);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    const d = g.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  };
  const at = (ex, ey, lx, ly) => read(((ex + lx) * zoom + ox) * dpr, ((ey + ly) * zoom + oy) * dpr);
  const isShadow = (c) => !!c && Math.max(c[0], c[1], c[2]) < 90 && c[0] <= 1.25 * Math.max(c[1], c[2]);
  const scanRow = (s, ly) => {
    const arr = [];
    for (let lx = 0; lx <= W; lx += 3) arr.push(isShadow(at(s.x, s.y, lx, ly)) ? 1 : 0);
    return arr;
  };
  const out = { els: {} };
  const scanRegion = (s) => {
    // 2D 扫描形状周边阴影带（覆盖所有形状：圆/椭圆/三角到底部，心/星/六边顶部在上方），
    // 只要存在随形状轮廓的向下阴影即可，避免固定行对「未触及盒底边」形状漏判。
    let n = 0;
    for (let ly = H - 20; ly <= H + 24; ly += 4)
      for (let lx = 0; lx <= W; lx += 4)
        if (isShadow(at(s.x, s.y, lx, ly))) n++;
    return n;
  };
  for (const s of specs) {
    out.els[s.id] = {
      interior: at(s.x, s.y, W / 2, H / 2),
      beyond: at(s.x, s.y, W / 2, H + 16),
      shadowRegion: scanRegion(s),
      narrowRow: scanRow(s, H + 5),
    };
  }
  return out;
}, { specs, W, H });

const edShot = await edPage.$('canvas');
if (edShot) await edShot.screenshot({ path: `${OUT}/verify_clipshadow_editor.png` });
await edPage.close();

console.log('\n══ A) 编辑器（Konva 画布）像素采样 ══');
check('编辑器：无运行时报错', edErrs.length === 0, edErrs.join(' | '));
const rect = editorSample.els.c_none;
check('标定（矩形对照）：阴影存在', rect.shadowRegion >= 5, `dark=${rect.shadowRegion}`);
check('标定（矩形对照）：远处为背景白', nearColor(rect.beyond, BG_RGB, 12), rect.beyond?.join(','));
check('标定（矩形对照）：中心为图片内容灰', isContent(rect.interior), rect.interior?.join(','));
const rectNarrow = rect.narrowRow.reduce((a, b) => a + b, 0);

for (const s of specs) {
  const d = editorSample.els[s.id];
  const label = `编辑器[${s.key}${s.border ? '+' + s.style : ''}]`;
  check(`${label}：中心为图片内容灰`, isContent(d.interior), d.interior?.join(','));
  check(`${label}：阴影沿形状轮廓存在（此前形状模式被裁没 → 无阴影）`, d.shadowRegion >= 5, `dark=${d.shadowRegion}`);
  check(`${label}：远处为背景白`, nearColor(d.beyond, BG_RGB, 12), d.beyond?.join(','));
  if (NARROW_SHAPES.has(s.shape)) {
    const n = d.narrowRow.reduce((a, b) => a + b, 0);
    check(`${label}：底行阴影宽度明显窄于矩形（圆角剪影）`, n < rectNarrow * 0.7, `形状=${n} / 矩形=${rectNarrow}`);
  }
}

/* ════════════════ 2) 预览（parity DOM）结构 + 像素 ════════════════ */
const paPage = await ctx.newPage();
const paErrs = [];
paPage.on('pageerror', (e) => paErrs.push(e.message));
await paPage.goto(`${BASE}/parity-text.html?project=${PROJECT}`, { waitUntil: 'networkidle' });
await paPage.waitForTimeout(2500);

const domInfo = await paPage.evaluate((specs) => {
  const out = {};
  for (const s of specs) {
    const el = document.querySelector(`[data-element-id="${s.id}"]`);
    if (!el) { out[s.id] = null; continue; }
    const shadowDiv = el.querySelector('div');        // 第一层：drop-shadow 所在
    const clipDiv = shadowDiv ? shadowDiv.querySelector('div') : null; // 第二层：clip-path 所在
    out[s.id] = {
      outerBoxShadow: getComputedStyle(el).boxShadow,
      shadowFilter: shadowDiv ? getComputedStyle(shadowDiv).filter : null,
      clip: clipDiv ? getComputedStyle(clipDiv).clipPath : null,
    };
  }
  return out;
}, specs);
const wrapEl = await paPage.$('#root > div');
const shotTarget = wrapEl || (await paPage.$('#root'));
if (shotTarget) await shotTarget.screenshot({ path: `${OUT}/verify_clipshadow_parity.png` });

console.log('\n══ B) 预览（发布态 DOM）结构断言 ══');
check('预览：无运行时报错', paErrs.length === 0, paErrs.join(' | '));
for (const s of specs) {
  const info = domInfo[s.id];
  const label = `预览[${s.key}${s.border ? '+' + s.style : ''}]`;
  if (!info) { check(`${label}：元素存在`, false, '未找到'); continue; }
  if (s.shape === 'none') {
    const bs = (info.outerBoxShadow || '').replace(/\s+/g, ' ');
    check(`${label}：矩形模式走 box-shadow=0px 14px 0px rgba(0,0,0,1)`, bs.includes('14px') && (bs.includes('rgb(0, 0, 0)') || bs.includes('#000000')), info.outerBoxShadow);
    check(`${label}：无 drop-shadow filter（仅矩形阴影）`, !(info.shadowFilter || '').includes('drop-shadow'), info.shadowFilter);
  } else {
    const f = (info.shadowFilter || '').replace(/\s+/g, ' ');
    check(`${label}：形状模式阴影层 filter 含 drop-shadow（真值 resolveDropShadow）`, f.includes('drop-shadow'), info.shadowFilter);
    check(`${label}：drop-shadow 含黑色 + 14px 偏移（== core 真值）`, (f.includes('rgb(0, 0, 0)') || f.includes('#000000')) && f.includes('14px'), info.shadowFilter);
    check(`${label}：clip 层 clip-path == 同一形状路径（归一化）`, normalizeClip(info.clip) === normalizeClip(`path("${core.buildClipSvgPath(s.shape, W, H)}")`), info.clip);
    check(`${label}：最外层无 box-shadow（阴影已迁到 filter）`, (info.outerBoxShadow || '').startsWith('none') || info.outerBoxShadow === '', info.outerBoxShadow);
  }
}

const shot = fs.readFileSync(`${OUT}/verify_clipshadow_parity.png`).toString('base64');
const samplePage = await ctx.newPage();
await samplePage.goto('about:blank');
const domSample = await samplePage.evaluate(
  async ({ b64, specs, W, H }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const read = (px, py) => {
      const x = Math.round(px), y = Math.round(py);
      if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null;
      const d = g.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    };
    const isShadow = (c) => !!c && Math.max(c[0], c[1], c[2]) < 90 && c[0] <= 1.25 * Math.max(c[1], c[2]);
    const scanRow = (s, ly) => {
      const arr = [];
      for (let lx = 0; lx <= W; lx += 3) arr.push(isShadow(read(s.x + lx, s.y + ly)) ? 1 : 0);
      return arr;
    };
    const scanRegion = (s) => {
      let n = 0;
      for (let ly = H - 20; ly <= H + 24; ly += 4)
        for (let lx = 0; lx <= W; lx += 4)
          if (isShadow(read(s.x + lx, s.y + ly))) n++;
      return n;
    };
    const out = { size: [c.width, c.height], els: {} };
    for (const s of specs) {
      const at = (lx, ly) => read(s.x + lx, s.y + ly);
      out.els[s.id] = {
        interior: at(W / 2, H / 2),
        beyond: at(W / 2, H + 16),
        shadowRegion: scanRegion(s),
        narrowRow: scanRow(s, H + 5),
      };
    }
    return out;
  },
  { b64: shot, specs, W, H },
);
await samplePage.close();
await paPage.close();

console.log('\n══ B2) 预览（发布态 DOM）像素采样 ══');
const rectD = domSample.els.c_none;
check('标定（矩形对照）：阴影存在', rectD.shadowRegion >= 5, `dark=${rectD.shadowRegion}`);
check('标定（矩形对照）：中心为图片内容灰', isContent(rectD.interior), rectD.interior?.join(','));
const rectNarrowD = rectD.narrowRow.reduce((a, b) => a + b, 0);
for (const s of specs) {
  const d = domSample.els[s.id];
  const label = `预览[${s.key}${s.border ? '+' + s.style : ''}]`;
  check(`${label}：中心为图片内容灰`, isContent(d.interior), d.interior?.join(','));
  check(`${label}：阴影沿形状轮廓存在`, d.shadowRegion >= 5, `dark=${d.shadowRegion}`);
  check(`${label}：远处为背景白`, nearColor(d.beyond, BG_RGB, 12), d.beyond?.join(','));
  if (NARROW_SHAPES.has(s.shape)) {
    const n = d.narrowRow.reduce((a, b) => a + b, 0);
    check(`${label}：底行阴影宽度明显窄于矩形（圆角剪影）`, n < rectNarrowD * 0.7, `形状=${n} / 矩形=${rectNarrowD}`);
  }
}

/* ════════════════ C) 编辑器 vs 预览 一致性 ════════════════ */
console.log('\n══ C) 编辑器 vs 预览 一致性 ══');
let consistent = true;
const inconsistent = [];
for (const s of specs) {
  const e = editorSample.els[s.id];
  const d = domSample.els[s.id];
  const eDark = e.shadowRegion >= 5;
  const dDark = d.shadowRegion >= 5;
  const same = eDark === dDark && nearColor(e.beyond, BG_RGB, 12) === nearColor(d.beyond, BG_RGB, 12);
  if (!same) { consistent = false; inconsistent.push(s.key); }
}
check('所有形状：底行「阴影存在 / 远处白」判定两端一致', consistent, inconsistent.join(',') || '全部一致');

console.log(`\n──────── 汇总：${pass} PASS / ${fail} FAIL ────────`);
console.log(`截图：${OUT}/verify_clipshadow_editor.png, ${OUT}/verify_clipshadow_parity.png`);
fs.writeFileSync(`${OUT}/verify_clipshadow_result.json`, JSON.stringify({ pass, fail, results, editorSample, domSample }, null, 1));
await browser.close();
process.exit(fail === 0 ? 0 : 1);
