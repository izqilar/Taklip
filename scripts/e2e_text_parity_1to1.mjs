/**
 * 1:1 文本垂直对齐测量：编辑器 Konva 画布（100% 缩放） vs SchemaRenderer DOM（scale=1）。
 * 两者都按 1:1 渲染，消除预览模态框 0.899 缩放带来的测量混淆。
 *
 * 原理（与 e2e_render_parity 相同，但两端都 1:1）：
 *  - 纯色基准块反推原点/缩放（此处 scale≈1）；
 *  - 文本元素盒内找最上一行 ink，换算设计坐标 inkTop，比较两端。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://localhost:5173';
const PROJECT_ID = process.argv[2] || 'e2e_parity_fixture';
const TOL = 0.5;

const SOLID = { r: 0x33, g: 0x66, b: 0xff };
const BORDER = { r: 0xee, g: 0xd5, b: 0xc5 };
// 仅测量文本；边框不涉及本脚本
const LAYOUT = {
  txt_mid: { x: 20, y: 480, w: 200, h: 60 },
  txt_top: { x: 20, y: 570, w: 200, h: 60 },
  txt_big: { x: 245, y: 480, w: 110, h: 41 },
  txt_multi: { x: 255, y: 280, w: 100, h: 60 },
};

async function measure(page, buf) {
  return await page.evaluate(
    async ({ b64, SOLID, BORDER, LAYOUT }) => {
      const im = new Image();
      im.src = 'data:image/png;base64,' + b64;
      await im.decode();
      const cv = document.createElement('canvas');
      cv.width = im.width;
      cv.height = im.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, cv.width, cv.height);
      const near = (i, c, tol) =>
        Math.abs(data[i] - c.r) <= tol && Math.abs(data[i + 1] - c.g) <= tol && Math.abs(data[i + 2] - c.b) <= tol;

      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] < 200) continue;
          if (!near(i, SOLID, 10)) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxY < 0) return { error: 'no solid' };
      // ★ 纯色块的「内容区」而非元素盒：#12 的 border-box 修复后，边框整体画在盒内，
      //   图像内容被内缩 borderWidth=7 → 内容设计坐标为 y 37..443（h 406）、x 47..233（w 186）。
      //   若仍按整盒 420 标定，会得出 406/420≈0.9667 的假缩放，把一切差值放大 1/0.9667 倍。
      const BW = 7;
      const CY0 = 30 + BW;
      const CX0 = 40 + BW;
      const CW = 200 - 2 * BW;
      const CH = 450 - 30 - 2 * BW;
      const scale = (maxY - minY + 1) / CH;
      const originX = minX - CX0 * scale;
      const originY = minY - CY0 * scale;
      const toScreen = (dx, dy) => [originX + dx * scale, originY + dy * scale];

      const ink = (el, pad = 12) => {
        const [sx0, sy0] = toScreen(el.x, el.y - pad);
        const [sx1, sy1] = toScreen(el.x + el.w, el.y + el.h + pad);
        const X0 = Math.max(0, Math.round(sx0)), X1 = Math.min(width - 1, Math.round(sx1));
        const Y0 = Math.max(0, Math.round(sy0)), Y1 = Math.min(height - 1, Math.round(sy1));
        // 用「ink 质量重心」而非「首个超阈值行」：
        // 两端若只是整体平移 δ，则重心也精确平移 δ；而对抗锯齿（AA）边缘阈值不敏感，
        // 可把「首行是否刚好超过暗度阈值」造成的 ±1 整行量化误差压到亚像素级。
        let mass = 0;
        let msum = 0;
        let firstRow = -1;
        let lastRow = -1;
        for (let y = Y0; y <= Y1; y++) {
          let rowMass = 0;
          for (let x = X0; x <= X1; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] < 200) continue;
            const darkness = 255 - (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (darkness > 40) rowMass += darkness;
          }
          if (rowMass > 0) {
            if (firstRow < 0) firstRow = y;
            lastRow = y;
          }
          mass += rowMass;
          msum += rowMass * y;
        }
        if (mass <= 0) return null;
        return {
          centroid: (msum / mass - originY) / scale,
          top: (firstRow - originY) / scale,
          bottom: (lastRow - originY) / scale,
        };
      };
      const nearC = (i, c, tol) =>
        Math.abs(data[i] - c.r) <= tol && Math.abs(data[i + 1] - c.g) <= tol && Math.abs(data[i + 2] - c.b) <= tol;
      // 竖扫：固定设计 x，找边框色带的上/下边界（用于检顶部边框）
      const bandV = (dx, dya, dyb) => {
        const x = Math.round(originX + dx * scale);
        const Y0 = Math.max(0, Math.round(originY + dya * scale));
        const Y1 = Math.min(height - 1, Math.round(originY + dyb * scale));
        let first = -1;
        let last = -1;
        for (let y = Y0; y <= Y1; y++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] < 200) continue;
          if (!nearC(i, BORDER, 12)) continue;
          if (first < 0) first = y;
          last = y;
        }
        if (first < 0) return null;
        return { outer: (first - originY) / scale, inner: (last + 1 - originY) / scale, thickness: (last + 1 - first) / scale };
      };
      // 横扫：固定设计 y，找边框色带的左/右边界（用于检左/右边框）
      const bandH = (dy, dxa, dxb) => {
        const y = Math.round(originY + dy * scale);
        const X0 = Math.max(0, Math.round(originX + dxa * scale));
        const X1 = Math.min(width - 1, Math.round(originX + dxb * scale));
        let first = -1;
        let last = -1;
        for (let x = X0; x <= X1; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] < 200) continue;
          if (!nearC(i, BORDER, 12)) continue;
          if (first < 0) first = x;
          last = x;
        }
        if (first < 0) return null;
        return { outer: (first - originX) / scale, inner: (last + 1 - originX) / scale, thickness: (last + 1 - first) / scale };
      };

      const out = { scale, origin: { x: originX, y: originY }, ink: {} };
      for (const id of ['txt_mid', 'txt_top', 'txt_big', 'txt_multi']) out.ink[id] = ink(LAYOUT[id]);
      // 边框带（img_plain：设计坐标 x 40..240, y 30..230，borderWidth=7）
      out.bandTop = bandV(140, 0, 60); // 顶边框：期望 outer=30 inner=37
      out.bandLeft = bandH(140, 0, 80); // 左边框：期望 outer=40 inner=47
      out.bandRight = bandH(140, 200, 280); // 右边框：期望 outer=233 inner=240
      return out;
    },
    { b64: buf.toString('base64'), SOLID, BORDER, LAYOUT },
  );
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

// 1) 编辑器画布（100% 缩放）
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const login = await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }),
  });
  const d = await res.json();
  if (!res.ok) return { error: d?.message };
  localStorage.setItem('access_token', d.accessToken);
  localStorage.setItem('refresh_token', d.refreshToken);
  localStorage.setItem('user_info', JSON.stringify(d.user));
  return { ok: true };
});
check('登录成功', login.ok, login.error || '');
await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(1200);
await page.mouse.click(700, 880);
const reset = page.locator('button[title="重置为 100%"]').first();
if ((await reset.count()) > 0) {
  await reset.click();
  await page.waitForTimeout(600);
}
await page.waitForTimeout(1200);
const shotEditor = await page.screenshot();
const mEditor = await measure(page, shotEditor);
console.log('\n[编辑器 Konva]', JSON.stringify(mEditor, null, 1));

// 2) SchemaRenderer 1:1
await page.goto(`${BASE}/parity-text.html?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const shotDom = await page.screenshot();
const mDom = await measure(page, shotDom);
console.log('\n[SchemaRenderer 1:1]', JSON.stringify(mDom, null, 1));

if (mEditor.error || mDom.error) {
  check('两端都能测到基准块', false, mEditor.error || mDom.error);
} else {
  console.log('\n===== 差值（DOM - Konva，设计 px）=====');
  for (const k of ['txt_mid', 'txt_top', 'txt_big', 'txt_multi']) {
    const d = (mEditor.ink[k]?.centroid ?? 0) - (mDom.ink[k]?.centroid ?? 0);
    console.log(
      `  ${k.padEnd(11)} inkTop ${mEditor.ink[k]?.top.toFixed(2)} → ${mDom.ink[k]?.top.toFixed(2)}` +
        `   重心 ${mEditor.ink[k]?.centroid.toFixed(2)} → ${mDom.ink[k]?.centroid.toFixed(2)}   Δ ${d.toFixed(2)}`,
    );
    check(
      `${k} 文本垂直位置三端一致（重心 Δ<${TOL}）`,
      Math.abs(d) < TOL,
      `Konva=${mEditor.ink[k]?.centroid.toFixed(2)} DOM=${mDom.ink[k]?.centroid.toFixed(2)}`,
    );
  }
  // 边框：真正的 1:1 下验证「粗细 + 颜色 + 位置（border-box 内画）」完全对齐。
  // ★ 为何必须 1:1：在产品内的预览模态框是 0.899 等比缩小，Chrome 会把 CSS 边框宽度
  //   吸附到整数设备像素（7×0.899=6.29 → 6），造成约 0.3 设计 px 的表观差异；
  //   而导出图片走的是 1:1（或更高 deviceScaleFactor）的 DOM 渲染，不受此影响。
  const bandCases = [
    ['bandTop', 30, 37],
    ['bandLeft', 40, 47],
    ['bandRight', 233, 240],
  ];
  for (const [key, expOuter, expInner] of bandCases) {
    const k1 = mEditor[key];
    const k2 = mDom[key];
    if (!k1 || !k2) {
      check(`${key} 两端都测到边框色带`, false, `Konva=${JSON.stringify(k1)} DOM=${JSON.stringify(k2)}`);
      continue;
    }
    const dThick = k1.thickness - k2.thickness;
    const dOuter = k1.outer - k2.outer;
    console.log(
      `  ${key.padEnd(11)} outer ${k1.outer.toFixed(2)} → ${k2.outer.toFixed(2)}` +
        `   thickness ${k1.thickness.toFixed(2)} → ${k2.thickness.toFixed(2)}   Δ厚 ${dThick.toFixed(2)}`,
    );
    check(
      `${key} 边框厚度三端一致（Δ<${TOL}）`,
      Math.abs(dThick) < TOL,
      `Konva=${k1.thickness.toFixed(2)} DOM=${k2.thickness.toFixed(2)}`,
    );
    check(
      `${key} 边框位置为 border-box（outer≈${expOuter}, inner≈${expInner}）`,
      Math.abs(k1.outer - expOuter) < TOL &&
        Math.abs(k2.outer - expOuter) < TOL &&
        Math.abs(k1.inner - expInner) < TOL &&
        Math.abs(k2.inner - expInner) < TOL,
      `Konva ${k1.outer.toFixed(2)}~${k1.inner.toFixed(2)} / DOM ${k2.outer.toFixed(2)}~${k2.inner.toFixed(2)}`,
    );
    void dOuter;
  }
}
check('运行期间无页面异常', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} PASS =====`);
if (failed.length) {
  console.log('FAILED: ' + failed.map((f) => f.name).join('; '));
  process.exit(1);
}
