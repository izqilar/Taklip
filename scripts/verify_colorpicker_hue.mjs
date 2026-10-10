/**
 * 颜色选择器弹窗 —— 色相条 ↔ 左侧颜色预览区 / 滑块 颜色一致性验证。
 *
 * 缺陷（已修）：竖向色相条曾被换成「手绘彩虹」渐变
 *   linear-gradient(to bottom, #f00 0%, #ff00a0 17%, #8000ff 33%, #0080ff 50%,
 *                   #00ffd5 67%, #00ff00 83%, #ffff00 92%, #f00 100%)
 * 其色相顺序与位置映射（hue = t*360，自上而下递增）完全不符且非等步长，
 * 于是「在色条绿色处点一下」得到的 hue ≈ 241（紫）→ 左侧预览区/滑块显示紫色。
 *
 * 本脚本按真值校验：
 *   A) 色相条在 7 个 60° 档位上的实际渲染像素 == hsvToRgb(角度,1,1)
 *   B) 在任意 t 处点击后：滑块位置 == t、hex 选中色相 == t*360、
 *      滑块颜色 == 色条同位置像素、滑块颜色 == 该色相的纯色
 *   C) 左侧 S/V 预览面板右上角像素（s=1,v=1 → 纯色相）== 滑块颜色
 *   D) 透明度滑轨右端（a=1）== 当前选中色
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const USER = '13900001001';
const PWD = 'Test123456';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) {
    pass += 1;
    console.log('  \u2705 ' + name);
  } else {
    fail += 1;
    fails.push(`${name} :: ${detail}`);
    console.log('  \u274c ' + name + ' :: ' + detail);
  }
};

/* ── 颜色真值（与 ColorPicker 内部 hsvToRgb(h,1,1) 等价） ── */
function pureHue(h) {
  const c = 1;
  const x = 1 * (1 - Math.abs(((h / 60) % 2) - 1));
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; bb = 0; }
  else if (h < 120) { rr = x; gg = c; bb = 0; }
  else if (h < 180) { rr = 0; gg = c; bb = x; }
  else if (h < 240) { rr = 0; gg = x; bb = c; }
  else if (h < 300) { rr = x; gg = 0; bb = c; }
  else { rr = c; gg = 0; bb = x; }
  return [Math.round(rr * 255), Math.round(gg * 255), Math.round(bb * 255)];
}
function hueOf(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === rr) h = ((gg - bb) / d + 6) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return h * 60;
}
const fmt = (c) => (c ? `rgb(${c.join(',')})` : 'null');
const near = (a, b, tol = 8) =>
  !!a && !!b && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const hueDiff = (a, b) => {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
const parseRgb = (s) => {
  const m = String(s || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,/\s]+/).map(Number).filter((n) => Number.isFinite(n));
  return p.length >= 3 ? [p[0], p[1], p[2]] : null;
};

/* ── 元素截图 → 像素采样（在页面里用 canvas 解码） ── */
async function sampleElement(page, selector, points) {
  await page.evaluate((sel) => {
    document.querySelectorAll(`${sel} > div`).forEach((el) => { el.style.visibility = 'hidden'; });
  }, selector);
  const b64 = (await page.locator(selector).first().screenshot()).toString('base64');
  const out = await page.evaluate(
    async ({ b64, points }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = (x, y) => {
        const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      return { w: img.naturalWidth, h: img.naturalHeight, samples: points.map(([x, y]) => px(x, y)) };
    },
    { b64, points },
  );
  await page.evaluate((sel) => {
    document.querySelectorAll(`${sel} > div`).forEach((el) => { el.style.visibility = ''; });
  }, selector);
  return out;
}

const errors = [];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('editor.theme', 'dark'); } catch {} });

  /* ── 登录 → 编辑器 → 矩形 → 渐变填充 → 打开取色器 ── */
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="tel"]', USER);
  await page.fill('input[type="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: /新建|New|createNew/ }).first().click();
  await page.waitForURL((u) => u.toString().includes('/editor/'), { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !!window.__editorStore, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    try {
      document.documentElement.classList.add('dark');
      localStorage.setItem('editor.theme', 'dark');
      const st = window.__editorStore;
      if (st) st.getState().addElement('rect');
    } catch {}
  });
  await page.waitForTimeout(1200);

  await page.locator('[data-fill-type="gradient"]').first().click({ force: true });
  await page.waitForTimeout(700);
  await page.locator('[data-testid="colorfield-swatch"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="colorpicker"]', { state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);

  const picker = page.locator('[data-testid="colorpicker"]').first();
  const track = page.locator('[data-testid="colorpicker-hue"]').first();
  const sv = page.locator('[data-testid="colorpicker-sv"]').first();
  const alphaBar = page.locator('[data-testid="colorpicker-alpha"]').first();
  const thumb = track.locator('> div').first();
  const hexInput = page.locator('[data-testid="colorpicker-hex"]').first();

  check('取色器弹窗已打开', await picker.isVisible().catch(() => false));
  if (!(await picker.isVisible().catch(() => false))) {
    await page.screenshot({ path: path.join(OUT, 'verify_cphue_fail.png') }).catch(() => {});
    await browser.close();
    console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
    process.exit(2);
  }

  const box = await track.boundingBox();
  console.log(`\n色相条尺寸: ${Math.round(box.width)}×${Math.round(box.height)} @(${Math.round(box.x)},${Math.round(box.y)})`);

  /* ── A) 7 个 60° 档位的实际渲染像素 == hsvToRgb(角度,1,1) ── */
  const stopTs = [0, 1 / 6, 1 / 3, 1 / 2, 2 / 3, 5 / 6, 1];
  // 端点为圆角（rounded-full），向内收 2px 采样；采样后按实际 y 反算有效 t
  const stopPts = stopTs.map((t, i) => {
    const y = i === 0 ? 2 : i === stopTs.length - 1 ? Math.round(box.height - 3) : Math.round(t * (box.height - 1));
    return [Math.round(box.width / 2), y];
  });
  const aShot = await sampleElement(page, '[data-testid="colorpicker-hue"]', stopPts);
  console.log('\n【A】色相条档位像素 == 纯色相真值');
  stopTs.forEach((t, i) => {
    const tEff = stopPts[i][1] / (box.height - 1);
    const got = aShot.samples[i];
    const want = pureHue(tEff * 360);
    check(
      `色相条档位 ${Math.round(t * 360)}°（采样 ${(tEff * 360).toFixed(1)}°）渲染像素 == 纯色 ${fmt(want)}`,
      near(got, want, 10),
      `${fmt(got)} vs ${fmt(want)}`,
    );
  });

  /* ── B/C/D) 逐点点击，校验滑块 / 左侧预览 / 透明度轨 ── */
  console.log('\n【B】点击色相条任意位置 → 滑块位置 / 选中色 / 色条像素 三方一致');
  const clickTs = [0.05, 1 / 6, 0.28, 1 / 3, 1 / 2, 0.62, 2 / 3, 0.82, 5 / 6, 0.95];
  const trackPts = clickTs.map((t) => [Math.round(box.width / 2), Math.round(t * (box.height - 1))]);
  const bShot = await sampleElement(page, '[data-testid="colorpicker-hue"]', trackPts);

  let firstMismatch = null;
  for (let i = 0; i < clickTs.length; i += 1) {
    const t = clickTs[i];
    await page.mouse.click(box.x + box.width / 2, box.y + t * box.height);
    await page.waitForTimeout(260);

    const info = await page.evaluate(() => {
      const trackEl = document.querySelector('[data-testid="colorpicker-hue"]');
      const thumbEl = trackEl?.querySelector('div');
      const hexEl = document.querySelector('[data-testid="colorpicker-hex"]');
      const tr = trackEl.getBoundingClientRect();
      const th = thumbEl.getBoundingClientRect();
      return {
        tThumb: (th.top + th.height / 2 - tr.top) / tr.height,
        thumbColor: getComputedStyle(thumbEl).backgroundColor,
        hex: hexEl ? hexEl.value : null,
      };
    });

    const selRgb = (() => {
      const h6 = String(info.hex || '').replace('#', '').slice(0, 6);
      if (!/^[0-9a-fA-F]{6}$/.test(h6)) return null;
      return [0, 2, 4].map((o) => parseInt(h6.slice(o, o + 2), 16));
    })();
    const hueSel = selRgb ? hueOf(selRgb[0], selRgb[1], selRgb[2]) : NaN;
    const wantHue = t * 360;
    const thumbPx = parseRgb(info.thumbColor);
    const trackPx = bShot.samples[i];
    const wantPure = pureHue(wantHue);

    const okPos = Math.abs(info.tThumb - t) <= 0.02;
    const okHue = Number.isFinite(hueSel) && hueDiff(hueSel, wantHue) <= 4;
    const okThumbEqTrack = near(thumbPx, trackPx, 10);
    const okThumbPure = near(thumbPx, wantPure, 12);
    check(
      `t=${t.toFixed(3)} (${Math.round(wantHue)}°)：滑块位置/选中色相/滑块色/色条色 一致`,
      okPos && okHue && okThumbEqTrack && okThumbPure,
      `滑块t=${info.tThumb.toFixed(3)} 选中hue=${Math.round(hueSel)} 滑块=${fmt(thumbPx)} 色条=${fmt(trackPx)} 期望纯=${fmt(wantPure)}`,
    );
    if (!(okPos && okHue && okThumbEqTrack && okThumbPure) && !firstMismatch) {
      firstMismatch = { t, wantHue, hueSel, thumbPx, trackPx, wantPure };
    }

    /* C) 左侧 S/V 预览面板右上角 = 纯色相（s=1,v=1） */
    const svBox = await sv.boundingBox();
    const svShot = await sampleElement(page, '[data-testid="colorpicker-sv"]', [
      [Math.round(svBox.width - 4), 4],
    ]);
    check(
      `t=${t.toFixed(3)}：左侧预览区右上角（纯色相）== 滑块颜色`,
      near(svShot.samples[0], thumbPx, 12),
      `${fmt(svShot.samples[0])} vs 滑块 ${fmt(thumbPx)}`,
    );

    /* D) 透明度滑轨右端（a=1）== 当前选中色 */
    const aBox = await alphaBar.boundingBox();
    const alphaShot = await sampleElement(page, '[data-testid="colorpicker-alpha"]', [
      [Math.round(aBox.width - 2), Math.round(aBox.height / 2)],
    ]);
    check(
      `t=${t.toFixed(3)}：透明度滑轨右端 == 当前选中色`,
      near(alphaShot.samples[0], selRgb, 14),
      `${fmt(alphaShot.samples[0])} vs 选中 ${fmt(selRgb)}`,
    );
  }

  if (firstMismatch) {
    console.log(
      `\n首次不一致：t=${firstMismatch.t.toFixed(3)} 期望色相 ${Math.round(firstMismatch.wantHue)}° ` +
        `实际选中 ${Math.round(firstMismatch.hueSel)}°（色条像素 ${fmt(firstMismatch.trackPx)} / 滑块 ${fmt(firstMismatch.thumbPx)}）`,
    );
  }

  await picker.screenshot({ path: path.join(OUT, 'verify_cphue_picker.png') }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, 'verify_cphue_full.png') }).catch(() => {});
  await browser.close();

  fs.writeFileSync(
    path.join(OUT, 'verify_cphue_result.json'),
    JSON.stringify({ pass, fail, fails, errors: errors.slice(0, 8) }, null, 2),
  );
  console.log(`\n汇总: ${pass} PASS / ${fail} FAIL   页面错误 ${errors.length}`);
  if (fails.length) console.log('失败项:\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exit(fail === 0 ? 0 : 2);
})().catch((e) => {
  console.error('FATAL', e);
  console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
  process.exit(1);
});
