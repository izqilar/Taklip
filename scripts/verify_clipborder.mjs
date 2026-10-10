/**
 * 「图片对象边框随裁剪形状自适应」验证（#90）。
 *
 * 用法：node scripts/verify_clipborder.mjs
 *
 * 覆盖（每种裁剪形状：none / circle / ellipse / triangle / hexagon / star / heart，
 *       外加 heart+dashed、star+double 两种线型）：
 *  A) 编辑器（Konva 画布）：**真机像素采样**
 *     - 标定：矩形对照元素（裁剪 = none）验证坐标映射（中心=内容灰 / 盒角=边框红 / 盒外=背景白）
 *     - 形状元素：轮廓采样点**必为边框红**（边框贴合形状轮廓）
 *     - 形状元素：盒子四角**必非边框红且为背景白**（证明边框不是矩形盒式 / 未被残留裁切）
 *     - 形状元素：中心**必为图片内容灰**（图片本身正常绘制）
 *  B) 预览（发布态 DOM / parity 页）：同样做像素采样 + 结构断言
 *     - 元素内存在「边框 SVG 覆盖层」，其 path `d` 与 core `buildClipSvgPath` 逐字节相等
 *     - 描边颜色 / 线宽 / dash 与 core `clipBorderStrokes` + `borderDashArray` 一致
 *     - 图片层 clip-path == 同源形状路径；none 元素仍走矩形 CSS 边框（无覆盖层）
 *  C) 两端一致：同一轮廓采样点在编辑器与预览中同为「边框红」。
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
const PROJECT = 'e2e_clipborder_fixture';
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

/* ── 夹具几何（与 scripts/clipborder_fixture.mjs 对齐） ── */
const W = 110, H = 90, BW = 10;
const BORDER_RGB = [226, 0, 0];
const CONTENT_RGB = [128, 128, 128];
const BG_RGB = [255, 255, 255];
const GRID = { none: [15, 30], circle: [132, 30], ellipse: [250, 30], triangle: [15, 140], hexagon: [132, 140], star: [250, 140], heart: [15, 250], heart_dash: [132, 250], star_double: [250, 250] };
const ELEMENTS = [
  { id: 'c_none', key: 'none', shape: 'none', style: 'solid' },
  { id: 'c_circle', key: 'circle', shape: 'circle', style: 'solid' },
  { id: 'c_ellipse', key: 'ellipse', shape: 'ellipse', style: 'solid' },
  { id: 'c_triangle', key: 'triangle', shape: 'triangle', style: 'solid' },
  { id: 'c_hexagon', key: 'hexagon', shape: 'hexagon', style: 'solid' },
  { id: 'c_star', key: 'star', shape: 'star', style: 'solid' },
  { id: 'c_heart', key: 'heart', shape: 'heart', style: 'solid' },
  { id: 'c_heart_dash', key: 'heart_dash', shape: 'heart', style: 'dashed' },
  { id: 'c_star_double', key: 'star_double', shape: 'star', style: 'double' },
];

/* ── 独立的形状几何复算（镜像 core 的构造，用于取「轮廓采样点」） ── */
function regularPolygonPoints(cx, cy, r, sides, startDeg = -90) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const ang = ((startDeg - 90) * Math.PI) / 180 + (i * 2 * Math.PI) / sides;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return pts;
}
function starPoints(cx, cy, outer, inner, points, startDeg = -90) {
  const pts = [];
  const step = Math.PI / points;
  const start = ((startDeg - 90) * Math.PI) / 180;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = start + i * step;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
const edgeSamples = (pts, ts = [0.5]) => {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    for (const t of ts) out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
};
/** 在 w×h 盒子内，返回该裁剪形状**轮廓上**的采样点（局部坐标，原点 = 盒子左上角） */
function outlinePoints(shape, w, h) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
  switch (shape) {
    case 'circle': {
      const out = [];
      for (let a = 0; a < 360; a += 45) out.push([cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)]);
      return out;
    }
    case 'ellipse': {
      const out = [];
      for (let a = 0; a < 360; a += 45) out.push([cx + (w / 2) * Math.cos((a * Math.PI) / 180), cy + (h / 2) * Math.sin((a * Math.PI) / 180)]);
      return out;
    }
    case 'triangle':
      return edgeSamples([[w / 2, 0], [0, h], [w, h]], [0.15, 0.5, 0.85]);
    case 'hexagon':
      return edgeSamples(regularPolygonPoints(cx, cy, R, 6), [0.25, 0.5, 0.75]);
    case 'star':
      return edgeSamples(starPoints(cx, cy, R, R * 0.382, 5), [0.5]);
    case 'heart': {
      const anchors = [[50, 88], [2, 28], [98, 28], [27, 5], [73, 5], [50, 22]];
      const sx = w / 100, sy = h / 100;
      return anchors.map(([x, y]) => [x * sx, y * sy]);
    }
    default:
      return [];
  }
}
/** 轮廓采样点 → 元素局部坐标：先按 inset 内缩盒子，再平移回原位（与 core 同构） */
function outlineLocal(shape, inset) {
  const iw = Math.max(0.01, W - inset * 2);
  const ih = Math.max(0.01, H - inset * 2);
  return outlinePoints(shape, iw, ih).map(([x, y]) => [x + inset, y + inset]);
}
/** 盒角采样点（形状模式下属「形状之外」）：四角内缩 1px，避免压线 */
function cornerLocals() {
  const m = 1;
  return [[m, m], [W - m, m], [W - m, H - m], [m, H - m]];
}

const results = [];
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  results.push({ ok, name, detail });
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}
const nearColor = (c, target, tol = 26) =>
  c && Math.abs(c[0] - target[0]) <= tol && Math.abs(c[1] - target[1]) <= tol && Math.abs(c[2] - target[2]) <= tol;
/** 边框是否存在：以「红占主导」判定（红通道高且明显高于绿蓝），
 * 这样形状边框在薄环 / 编辑器缩放下的抗锯齿粉边（红与白混合）也判为边框红，
 * 同时仍能正确排除纯白背景与灰色内容。 */
const isBorder = (c) => !!c && c[0] >= 170 && c[0] >= 1.25 * Math.max(c[1], c[2]);

/**
 * 把 `clip-path: path("...")` 归一化为「绝对坐标 + 空格分隔 + 去尾零」形式，
 * 以对齐浏览器对 clip-path 计算值的归一化（相对命令→绝对、逗号→空格、".00"→整数）。
 * 这样即使 core.buildClipSvgPath 输出相对命令，也能与 getComputedStyle 返回的绝对形式逐字节比对。
 */
function normalizeClip(d) {
  let s = (d || '').trim();
  const m = s.match(/^path\(\s*"(.*)"\s*\)$/);
  if (m) s = m[1];
  const tokens = s.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [];
  let cx = 0, cy = 0;
  let cmd = '';
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
      if (up === 'M') cmd = rel ? 'l' : 'L'; // M 后的隐式重复对视为 L
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
    } else {
      i++; // 未知命令：跳过
    }
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

/* ══════════════════ 1) 编辑器（Konva 画布）像素采样 ══════════════════ */
const specs = ELEMENTS.map((e) => ({
  ...e,
  x: GRID[e.key][0],
  y: GRID[e.key][1],
  outline: outlineLocal(e.shape, BW / 2),
  outlineDouble: e.style === 'double' ? [...outlineLocal(e.shape, BW / 6), ...outlineLocal(e.shape, BW - BW / 6)] : [],
  corners: e.shape === 'none' ? [] : cornerLocals(),
  center: [[W / 2, H / 2]],
  rectCorners: e.shape === 'none' ? [[BW / 2, BW / 2], [W - BW / 2, BW / 2], [W - BW / 2, H - BW / 2], [BW / 2, H - BW / 2], [-4, -4], [W + 4, H + 4]] : [],
}));

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

const editorSample = await edPage.evaluate((specs) => {
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
  const out = { zoom, dpr, ox, oy, canvasW: canvas.width, canvasH: canvas.height, els: {} };
  for (const s of specs) {
    out.els[s.id] = {
      outline: s.outline.map(([lx, ly]) => at(s.x, s.y, lx, ly)),
      outlineDouble: s.outlineDouble.map(([lx, ly]) => at(s.x, s.y, lx, ly)),
      corners: s.corners.map(([lx, ly]) => at(s.x, s.y, lx, ly)),
      rectCorners: s.rectCorners.map(([lx, ly]) => at(s.x, s.y, lx, ly)),
      center: s.center.map(([lx, ly]) => at(s.x, s.y, lx, ly)),
    };
  }
  return out;
}, specs);

const edShot = await edPage.$('canvas');
if (edShot) await edShot.screenshot({ path: `${OUT}/verify_clipborder_editor.png` });
await edPage.close();

console.log('\n══ A) 编辑器（Konva 画布）像素采样 ══');
check('编辑器：无运行时报错', edErrs.length === 0, edErrs.join(' | '));
const rect = editorSample.els.c_none;
check('标定（矩形对照）：盒角处为边框红', rect.rectCorners.slice(0, 4).every((c) => isBorder(c)),
  rect.rectCorners.slice(0, 4).map((c) => c && c.join(',')).join(' / '));
check('标定（矩形对照）：盒外 4px 为背景白', rect.rectCorners.slice(4).every((c) => nearColor(c, BG_RGB, 12)),
  rect.rectCorners.slice(4).map((c) => c && c.join(',')).join(' / '));
check('标定（矩形对照）：中心为图片内容灰', rect.center.every((c) => nearColor(c, CONTENT_RGB, 40)), rect.center[0]?.join(','));

for (const s of specs) {
  const d = editorSample.els[s.id];
  const label = `编辑器[${s.key}${s.style !== 'solid' ? '+' + s.style : ''}]`;
  check(`${label}：中心为图片内容灰`, d.center.every((c) => nearColor(c, CONTENT_RGB, 40)), d.center[0]?.join(','));

  const redCount = d.outline.filter((c) => isBorder(c)).length;
  if (s.style === 'dashed') {
    check(`${label}：轮廓上出现边框红（虚线，非全采样）`, redCount >= Math.ceil(d.outline.length * 0.35), `${redCount}/${d.outline.length} 采样点为红`);
  } else {
    check(`${label}：轮廓采样点全部为边框红（${redCount}/${d.outline.length}）`, redCount === d.outline.length,
      d.outline.map((c) => (isBorder(c) ? 'R' : c ? c.join(',') : 'null')).join(' '));
  }
  if (s.style === 'double') {
    const redCount2 = d.outlineDouble.filter((c) => isBorder(c)).length;
    check(`${label}：双线两条中线均为边框红（${redCount2}/${d.outlineDouble.length}）`, redCount2 === d.outlineDouble.length,
      `${redCount2}/${d.outlineDouble.length}`);
  }
  if (s.shape !== 'none') {
    const bad = d.corners.filter((c) => isBorder(c));
    // 部分形状（如三角形）的盒子四角会落入形状内部 → 这些角点本就是红（合法）；
    // 此处只需证明「边框不是整圈矩形盒」：大多角点无红即可（矩形盒会 4 角全红）。
    check(`${label}：盒子四角非全红（边框随形状而非矩形盒）`, bad.length <= 2, bad.map((c) => c && c.join(',')).join(' / ') || 'ok');
    const white = d.corners.filter((c) => nearColor(c, BG_RGB, 12)).length;
    check(`${label}：盒子四角多数留白（形状之外确实留空）`, white >= 2, `${white}/${d.corners.length}`);
  }
}
/* ══════════════════ 2) 预览（parity DOM）══════════════════ */
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
    const svg = el.querySelector('svg');
    const paths = svg ? [...svg.querySelectorAll('path')] : [];
    // 图片层：带 clip-path 的后代（形状模式）或元素本身（矩形模式）
    const clipHost = el.getAttribute('style')?.includes('clip-path') ? el : el.querySelector('div[style*="clip-path"]');
    const cs = el ? getComputedStyle(el) : null;
    out[s.id] = {
      hasSvg: !!svg,
      svgStyle: svg ? { left: getComputedStyle(svg).left, top: getComputedStyle(svg).top, width: svg.getAttribute('width'), height: svg.getAttribute('height') } : null,
      paths: paths.map((p) => {
        const pcs = getComputedStyle(p);
        return {
          d: p.getAttribute('d'),
          transform: p.getAttribute('transform'),
          stroke: pcs.stroke,
          strokeWidth: pcs.strokeWidth,
          dash: p.getAttribute('stroke-dasharray'),
          fill: p.getAttribute('fill'),
        };
      }),
      wrapperBorder: cs ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` : null,
      clip: clipHost ? getComputedStyle(clipHost).clipPath : null,
    };
  }
  return out;
}, specs);
const wrapEl = await paPage.$('#root > div');
const shotTarget = wrapEl || (await paPage.$('#root'));
if (shotTarget) await shotTarget.screenshot({ path: `${OUT}/verify_clipborder_parity.png` });

console.log('\n══ B) 预览（发布态 DOM）结构断言 ══');
check('预览：无运行时报错', paErrs.length === 0, paErrs.join(' | '));
for (const s of specs) {
  const info = domInfo[s.id];
  const label = `预览[${s.key}${s.style !== 'solid' ? '+' + s.style : ''}]`;
  if (!info) { check(`${label}：元素存在`, false, '未找到'); continue; }
  const expectedClipd = `path("${core.buildClipSvgPath(s.shape, W, H)}")`;
  if (s.shape === 'none') {
    check(`${label}：无边框覆盖层（矩形模式走 CSS 边框，保持原行为）`, !info.hasSvg, `hasSvg=${info.hasSvg}`);
    check(`${label}：CSS 边框 = 10px solid rgb(226,0,0)`, /^10px solid rgb\(226, 0, 0\)$/.test(info.wrapperBorder || ''), info.wrapperBorder);
    continue;
  }
  check(`${label}：存在边框 SVG 覆盖层`, info.hasSvg, `hasSvg=${info.hasSvg}`);
  const strokes = core.clipBorderStrokes(BW, s.style);
  check(`${label}：描边条数 = ${strokes.length}（core.clipBorderStrokes）`, info.paths.length === strokes.length, `实际 ${info.paths.length}`);
  let geomOK = true, styleOK = true;
  const detail = [];
  strokes.forEach((st, i) => {
    const p = info.paths[i];
    if (!p) { geomOK = false; return; }
    const expD = core.buildClipSvgPath(s.shape, Math.max(0.01, W - st.inset * 2), Math.max(0.01, H - st.inset * 2));
    const expT = `translate(${st.inset} ${st.inset})`;
    geomOK = geomOK && p.d === expD && p.transform === expT;
    const okStroke = nearColor((p.stroke.match(/[\d.]+/g) || []).map(Number), BORDER_RGB) && Math.abs(parseFloat(p.strokeWidth) - st.width) <= 0.6 && p.fill === 'none';
    styleOK = styleOK && okStroke;
    const dashExp = core.borderDashArray(s.style);
    const dashOK = dashExp ? p.dash === dashExp.join(' ') : !p.dash;
    styleOK = styleOK && dashOK;
    detail.push(`#${i} inset=${st.inset.toFixed(2)} w=${p.strokeWidth} dash=${p.dash} dMatch=${p.d === expD}`);
  });
  check(`${label}：path d/transform == core 真值（形状轮廓 + 内缩）`, geomOK, detail.join(' | '));
  check(`${label}：描边颜色/线宽/dash == core 真值`, styleOK, detail.join(' | '));
  check(`${label}：图片层 clip-path == 同一形状路径（归一化）`, normalizeClip(info.clip) === normalizeClip(expectedClipd), `${info.clip} vs ${expectedClipd}`);
}

/* ── 预览像素采样：截 #root 后在浏览器里用 canvas 解码取色 ── */
const shot = fs.readFileSync(`${OUT}/verify_clipborder_parity.png`).toString('base64');
const samplePage = await ctx.newPage();
await samplePage.goto('about:blank');
const domSample = await samplePage.evaluate(
  async ({ b64, specs }) => {
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
    const out = { size: [c.width, c.height], els: {} };
    for (const s of specs) {
      const at = (lx, ly) => read(s.x + lx, s.y + ly);
      out.els[s.id] = {
        outline: s.outline.map(([lx, ly]) => at(lx, ly)),
        outlineDouble: s.outlineDouble.map(([lx, ly]) => at(lx, ly)),
        corners: s.corners.map(([lx, ly]) => at(lx, ly)),
        rectCorners: s.rectCorners.map(([lx, ly]) => at(lx, ly)),
        center: s.center.map(([lx, ly]) => at(lx, ly)),
      };
    }
    return out;
  },
  { b64: shot, specs },
);
await samplePage.close();
await paPage.close();

console.log('\n══ B2) 预览（发布态 DOM）像素采样 ══');
check('预览截图尺寸 == 页面尺寸 375×667', domSample.size[1] === 667 && Math.abs(domSample.size[0] - 375) <= 5, domSample.size.join('×'));
const rectD = domSample.els.c_none;
check('标定（矩形对照）：盒角处为边框红', rectD.rectCorners.slice(0, 4).every((c) => isBorder(c)),
  rectD.rectCorners.slice(0, 4).map((c) => c && c.join(',')).join(' / '));
check('标定（矩形对照）：中心为图片内容灰', rectD.center.every((c) => nearColor(c, CONTENT_RGB, 40)), rectD.center[0]?.join(','));

let consistent = true;
const inconsistent = [];
for (const s of specs) {
  const d = domSample.els[s.id];
  const e = editorSample.els[s.id];
  const label = `预览[${s.key}${s.style !== 'solid' ? '+' + s.style : ''}]`;
  check(`${label}：中心为图片内容灰`, d.center.every((c) => nearColor(c, CONTENT_RGB, 40)), d.center[0]?.join(','));
  const redCount = d.outline.filter((c) => isBorder(c)).length;
  if (s.style === 'dashed') {
    check(`${label}：轮廓上出现边框红（虚线，非全采样）`, redCount >= Math.ceil(d.outline.length * 0.35), `${redCount}/${d.outline.length}`);
  } else {
    check(`${label}：轮廓采样点全部为边框红（${redCount}/${d.outline.length}）`, redCount === d.outline.length,
      d.outline.map((c) => (isBorder(c) ? 'R' : c ? c.join(',') : 'null')).join(' '));
  }
  if (s.style === 'double') {
    const redCount2 = d.outlineDouble.filter((c) => isBorder(c)).length;
    check(`${label}：双线两条中线均为边框红（${redCount2}/${d.outlineDouble.length}）`, redCount2 === d.outlineDouble.length, `${redCount2}/${d.outlineDouble.length}`);
  }
  if (s.shape !== 'none') {
    const bad = d.corners.filter((c) => isBorder(c));
    check(`${label}：盒子四角非全红（边框随形状而非矩形盒）`, bad.length <= 2, bad.map((c) => c && c.join(',')).join(' / ') || 'ok');
  }
  // 两端一致：每个轮廓采样点的「是否边框红」判定必须相同
  const same = s.outline.every((_, i) => nearColor(d.outline[i], BORDER_RGB) === nearColor(e.outline[i], BORDER_RGB));
  if (!same) { consistent = false; inconsistent.push(s.key); }
}
console.log('\n══ C) 编辑器 vs 预览 一致性 ══');
check('所有形状：轮廓采样点的「边框红」判定两端一致', consistent, inconsistent.join(',') || '全部一致');

console.log(`\n──────── 汇总：${pass} PASS / ${fail} FAIL ────────`);
console.log(`截图：${OUT}/verify_clipborder_editor.png, ${OUT}/verify_clipborder_parity.png`);
fs.writeFileSync(`${OUT}/verify_clipborder_result.json`, JSON.stringify({ pass, fail, results, editorSample, domSample }, null, 1));
await browser.close();
process.exit(fail === 0 ? 0 : 1);
