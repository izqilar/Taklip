/**
 * 「文本对象图片填充」三端一致性验证（编辑器 Konva / 预览 DOM / core 真值）。
 *
 * 用法：node scripts/verify_textimgfill.mjs
 *
 * 覆盖：
 *  A) 用户 real-case 元素（320×205，crop，fit=cover）编辑器 vs 预览 几何逐项相等；
 *  B) 5 种适配方式（cover / contain / repeat-x / repeat-y / repeat）+ 无裁剪对照，
 *     编辑器 Konva 与预览 DOM 的几何都与 core `imageFillGeometry` 真值一致；
 *  C) 宽高比：cover/contain 绘制宽高比 == 裁剪区宽高比（禁止拉伸变形）；
 *  D) 预览态确实渲染出图片（background-clip:text + dataURL），而非回落单色/空白。
 *
 * 退出码 0 = 全绿。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
import fs from 'node:fs';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const OUT = 'shots';
fs.mkdirSync(OUT, { recursive: true });

/* ── core 真值（与 packages/core/src/fill.ts 同式） ── */
const SRC_FULL = { w: 1654, h: 2480 };
const CROP = { x: 0.138888931274414, y: 0.109259287516276, width: 0.8305555979410808, height: 0.3185184054904514 };
function croppedSize(full, crop) {
  if (!crop) return { w: full.w, h: full.h };
  return { w: Math.max(1, full.w * crop.width), h: Math.max(1, full.h * crop.height) };
}
function expectedGeo(box, img, fit) {
  const bw = box.width || 1, bh = box.height || 1, iw = img.w || 1, ih = img.h || 1;
  if (fit === 'cover' || fit === 'contain') {
    const s = fit === 'cover' ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
    return { drawW: iw * s, drawH: ih * s, drawX: (bw - iw * s) / 2, drawY: (bh - ih * s) / 2, repeat: 'no-repeat', scale: s, iw, ih };
  }
  return { drawW: iw, drawH: ih, drawX: 0, drawY: 0, repeat: fit, scale: 1, iw, ih };
}

const results = [];
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  results.push({ ok, name, detail });
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}
const near = (a, b, tol = 0.75) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/* 项目 B 的 6 个元素（与 fixture 对齐） */
const CASES = [
  { id: 'f_cover', fit: 'cover', crop: CROP, w: 170, h: 140 },
  { id: 'f_contain', fit: 'contain', crop: CROP, w: 170, h: 140 },
  { id: 'f_rep_x', fit: 'repeat-x', crop: CROP, w: 170, h: 140 },
  { id: 'f_rep_y', fit: 'repeat-y', crop: CROP, w: 170, h: 140 },
  { id: 'f_repeat', fit: 'repeat', crop: CROP, w: 170, h: 140 },
  { id: 'f_nocrop', fit: 'cover', crop: null, w: 170, h: 140 },
];

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

/* ══════ 1) 编辑器（Konva）══════ */
async function readEditor(project) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/editor/${project}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 40000 });
  await page
    .waitForFunction(
      () => {
        const s = window.Konva?.stages?.[0];
        if (!s) return false;
        const t = s.find('Text');
        return t.length > 0 && t.some((n) => n.getAttr('fillPatternImage'));
      },
      { timeout: 25000 },
    )
    .catch(() => {});
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const stage = window.Konva.stages[0];
    const out = {};
    for (const n of stage.find('Text')) {
      if (!n.getAttr('fillPatternImage')) continue;
      const img = n.fillPatternImage();
      const pid = (n.parent && n.parent.id && n.parent.id()) || n.id();
      out[pid] = {
        width: n.width(), height: n.height(), text: n.text(),
        srcW: img.naturalWidth || img.width, srcH: img.naturalHeight || img.height,
        fpScaleX: n.fillPatternScaleX(), fpScaleY: n.fillPatternScaleY(),
        fpX: n.fillPatternX(), fpY: n.fillPatternY(),
        fpRepeat: n.fillPatternRepeat(),
      };
    }
    return out;
  });
  const cv = await page.$('canvas');
  if (cv) await cv.screenshot({ path: `${OUT}/verify_editor_${project}.png` });
  await page.close();
  return { data, errs };
}

/* ══════ 2) 预览（DOM parity）══════ */
async function readParity(project) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/parity-text.html?project=${project}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const root = document.getElementById('root');
    const out = {};
    for (const el of root.querySelectorAll('[data-element-id]')) {
      const id = el.getAttribute('data-element-id');
      // 文本的填充层在内部 span 上（background-clip:text）
      const spans = [...el.querySelectorAll('span')];
      const fill = spans.find((s) => {
        const cs = getComputedStyle(s);
        return (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') && cs.backgroundImage && cs.backgroundImage !== 'none';
      });
      if (!fill) continue;
      const cs = getComputedStyle(fill);
      out[id] = {
        bgSize: cs.backgroundSize,
        bgPos: cs.backgroundPosition,
        bgRepeat: cs.backgroundRepeat,
        bgIsData: cs.backgroundImage.includes('data:') || cs.backgroundImage.includes('.webp') || cs.backgroundImage.includes('/uploads/'),
        bgClip: cs.webkitBackgroundClip || cs.backgroundClip,
      };
    }
    return out;
  });
  const rootEl = await page.$('#root');
  if (rootEl) await rootEl.screenshot({ path: `${OUT}/verify_parity_${project}.png` });
  await page.close();
  return { data, errs };
}

/* ══════════════════ 项目 B：5 档 + 无裁剪 ══════════════════ */
console.log('\n══ 项目 B：5 种适配方式 + 无裁剪（编辑器 Konva / 预览 DOM / core 真值） ══');
const edB = await readEditor('e2e_textimgfit_fixture');
const paB = await readParity('e2e_textimgfit_fixture');
check('编辑器：无运行时报错', edB.errs.length === 0, edB.errs.join(' | '));
check('预览：无运行时报错', paB.errs.length === 0, paB.errs.join(' | '));

for (const c of CASES) {
  const cs = croppedSize(SRC_FULL, c.crop);
  const exp = expectedGeo({ width: c.w, height: c.h }, cs, c.fit);
  const k = edB.data[c.id];
  const d = paB.data[c.id];

  const tag = `${c.id}(${c.fit}${c.crop ? '' : ', 无裁剪'})`;

  // ── 编辑器 Konva ──
  if (!k) { check(`[${tag}] 编辑器 Konva 节点存在且为图片填充`, false, '未找到'); continue; }
  check(`[${tag}] 编辑器：源图尺寸 == 裁剪区 ${cs.w | 0}×${cs.h | 0}`, near(k.srcW, cs.w, 1.5) && near(k.srcH, cs.h, 1.5), `${k.srcW}×${k.srcH}`);
  if (c.fit === 'cover' || c.fit === 'contain') {
    check(`[${tag}] 编辑器：缩放比 == 真值 ${exp.scale.toFixed(4)}`, near(k.fpScaleX, exp.scale, 0.002) && near(k.fpScaleY, exp.scale, 0.002), `${k.fpScaleX?.toFixed(4)}`);
    check(`[${tag}] 编辑器：锚点 == 真值 (x=${exp.drawX.toFixed(2)}, y=${exp.drawY.toFixed(2)})`, near(k.fpX, exp.drawX, 1) && near(k.fpY, exp.drawY, 1), `(${k.fpX?.toFixed(2)}, ${k.fpY?.toFixed(2)})`);
    check(`[${tag}] 编辑器：repeat=no-repeat`, k.fpRepeat === 'no-repeat', String(k.fpRepeat));
  } else {
    check(`[${tag}] 编辑器：平铺 scale=1（按原始像素）`, near(k.fpScaleX, 1, 0.001) && near(k.fpScaleY, 1, 0.001), `${k.fpScaleX}`);
    check(`[${tag}] 编辑器：repeat=${c.fit}`, k.fpRepeat === c.fit, String(k.fpRepeat));
  }

  // ── 预览 DOM ──
  if (!d) { check(`[${tag}] 预览 DOM 填充层存在且为图片`, false, '未找到 background-clip:text 的图片层'); continue; }
  check(`[${tag}] 预览：确实渲染出图片（dataURL/uploads）`, d.bgIsData, d.bgClip);
  check(`[${tag}] 预览：background-clip = text`, d.bgClip === 'text', d.bgClip);
  const m = /^([\d.]+)px\s+([\d.]+)px$/.exec(d.bgSize || '');
  check(`[${tag}] 预览：背景尺寸 == 真值 ${exp.drawW.toFixed(1)}×${exp.drawH.toFixed(1)}`, !!m && near(+m[1], exp.drawW, 1.5) && near(+m[2], exp.drawH, 1.5), d.bgSize);
  check(`[${tag}] 预览：background-repeat == ${exp.repeat}`, d.bgRepeat === exp.repeat, d.bgRepeat);

  // ── 宽高比（禁变形） ──
  const ratioSrc = cs.w / cs.h;
  const ratioDraw = exp.drawW / exp.drawH;
  check(`[${tag}] 宽高比：绘制区 == 裁剪区（不变形）`, near(ratioDraw, ratioSrc, 0.01), `${ratioDraw.toFixed(4)} vs ${ratioSrc.toFixed(4)}`);

  // ── 两端一致性 ──
  let eOK, pOK;
  if (c.fit === 'cover' || c.fit === 'contain') {
    eOK = near(k.fpScaleX, exp.scale, 0.002);
    pOK = !!m && near(cs.w * exp.scale, +m[1], 1.5);
  } else {
    eOK = k.fpRepeat === c.fit && near(k.fpScaleX, 1, 0.001);
    pOK = d.bgRepeat === c.fit && !!m && near(+m[1], cs.w, 1.5);
  }
  check(`[${tag}] 编辑器与预览几何一致（同源于 imageFillGeometry）`, eOK && pOK, `konva.scale=${k.fpScaleX?.toFixed(3)} dom.size=${d.bgSize}`);
}

/* ══════════════════ 项目 A：用户 real-case 元素 ══════════════════ */
console.log('\n══ 项目 A：用户 real-case（320×205，crop，cover）══');
const edA = await readEditor('e2e_parity_fixture');
const paA = await readParity('e2e_parity_fixture');
check('编辑器 A：无运行时报错', edA.errs.length === 0, edA.errs.join(' | '));
check('预览 A：无运行时报错', paA.errs.length === 0, paA.errs.join(' | '));

const csA = croppedSize(SRC_FULL, CROP);
// 用户元素 t_photo：320×205 / cover；t_photo4：620×205 / cover
for (const spec of [{ id: 't_photo', w: 320, h: 205 }, { id: 't_photo4', w: 620, h: 205 }]) {
  const exp = expectedGeo({ width: spec.w, height: spec.h }, csA, 'cover');
  const kanva = edA.data[spec.id];
  const dom = paA.data[spec.id];
  check(`[${spec.id}] 编辑器：cover 锚点 == 真值 (${exp.drawX.toFixed(2)}, ${exp.drawY.toFixed(2)})`,
    kanva && near(kanva.fpX, exp.drawX, 1) && near(kanva.fpY, exp.drawY, 1),
    kanva ? `(${kanva.fpX?.toFixed(2)}, ${kanva.fpY?.toFixed(2)})` : '无节点');
  const m = dom && /^([\d.]+)px\s+([\d.]+)px$/.exec(dom.bgSize || '');
  check(`[${spec.id}] 预览：背景尺寸 == 真值 ${exp.drawW.toFixed(1)}×${exp.drawH.toFixed(1)}`,
    !!m && near(+m[1], exp.drawW, 1.5) && near(+m[2], exp.drawH, 1.5),
    dom ? dom.bgSize : '无填充层');
  check(`[${spec.id}] 预览：确实渲染出图片（非空白/非单色）`, !!(dom && dom.bgIsData), dom ? dom.bgClip : '');
  check(`[${spec.id}] 编辑态与预览态一致`, !!kanva && !!m && near(kanva.fpX, exp.drawX, 1) && near(csA.w * (spec.w / csA.w > 0 ? Math.max(spec.w / csA.w, spec.h / csA.h) : 1), +m[1], 1.5));
}

/* ══════════════════ 汇总 ══════════════════ */
console.log(`\n──────── 汇总：${pass} PASS / ${fail} FAIL ────────`);
console.log(`截图：${OUT}/verify_editor_*.png, ${OUT}/verify_parity_*.png`);
fs.writeFileSync(`${OUT}/verify_textimgfill_result.json`, JSON.stringify({ pass, fail, results }, null, 1));
await browser.close();
process.exit(fail === 0 ? 0 : 1);
