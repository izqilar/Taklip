/* eslint-disable */
/**
 * 验证：图片元素「裁剪」在 DOM 渲染端（编辑器预览 / 我端作品卡片缩略图）必须完整覆盖元素框，
 * 与编辑器 Konva 裁剪几何一致 —— 消除「右侧留白 + 内容横向压缩」。
 *
 * 根因（已定位）：
 *   裁剪以「比元素框更大的 <img> + 负 margin」实现：
 *     width  = naturalW * scale，scale = el.width / cropW  ⇒ width ≥ el.width / crop.width
 *     marginLeft = -cropX * scale, marginTop = -cropY * scale
 *   宿主全局 reset（apps/web 的 `@tailwind base` → preflight）会给所有 img 加
 *     `max-width: 100%; height: auto;`
 *   普通声明的 max-width:100% 相对包含块（即裁剪 frame，宽 = el.width）解析，
 *   把本应更宽的图片压回框宽 → 图片内容横向压缩 + 框内右侧留白。
 *   编辑器画布走 Konva（canvas 绘制，不受 CSS 影响）→ 只在预览 / 发布 / 缩略图暴露。
 *   修复：packages/render/src/SchemaRenderer.tsx 的 ImageElementView.imgStyle 显式
 *        `maxWidth: 'none'; maxHeight: 'none'`（内联声明优先级高于普通样式表规则）。
 *
 * 覆盖：
 *   A) 编辑器「预览」模态（PreviewModal → DOMRenderer → SchemaRenderer）
 *   B) 我端「我的作品」卡片缩略图（SchemaThumbnail → SchemaRenderer）
 *
 * 用法：node scripts/verify_image_crop_preview.cjs [projectId]
 *   默认 projectId = cmuje8nb800011z5cxlptgosw（Mirzat-Malika，dev_user_004 含裁剪图片）
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const API_ORIGIN = BASE;
const PROJECT_ID = process.argv[2] || 'cmuje8nb800011z5cxlptgosw';
const ACCOUNT = { phone: '13800000004', password: 'dev123456' };

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const skip = (name, detail = '') => {
  results.push({ name, ok: true, detail, skipped: true });
  console.log(`SKIP  ${name}${detail ? '  — ' + detail : ''}`);
};

function assertCoverage(label, rows) {
  if (!rows.length) {
    skip(`${label}: 未发现裁剪图片元素（跳过）`);
    return;
  }
  for (const d of rows) {
    const tag = `${label} [${d.src}]`;
    const natRatio = d.natural[0] / d.natural[1];
    const drawRatio = (d.img.r - d.img.l) / (d.img.b - d.img.t);
    check(
      `${tag} 宽度未被宿主全局 reset 压回（computed ≈ inline）`,
      Math.abs(d.computedW - d.inlineW) < 1,
      `inline ${d.inlineW} / computed ${d.computedW}`,
    );
    check(
      `${tag} 完整覆盖元素框（左右无留白）`,
      d.frame && d.img.l <= d.frame.l + 0.5 && d.img.r >= d.frame.r - 0.5,
      d.frame ? `img ${d.img.l}..${d.img.r} vs 框 ${d.frame.l}..${d.frame.r}` : 'no frame',
    );
    check(
      `${tag} 完整覆盖元素框（上下无留白）`,
      d.frame && d.img.t <= d.frame.t + 0.5 && d.img.b >= d.frame.b - 0.5,
      d.frame ? `img ${d.img.t}..${d.img.b} vs 框 ${d.frame.t}..${d.frame.b}` : 'no frame',
    );
    check(
      `${tag} 内容无畸形（渲染宽高比 ≈ 原图宽高比）`,
      Math.abs(drawRatio - natRatio) < 0.01,
      `natural ${natRatio.toFixed(4)} / drawn ${drawRatio.toFixed(4)}`,
    );
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(async (acc) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc),
    });
    const d = await res.json();
    if (!d.accessToken) throw new Error('login failed: ' + JSON.stringify(d).slice(0, 200));
    localStorage.setItem('access_token', d.accessToken);
    localStorage.setItem('refresh_token', d.refreshToken);
    localStorage.setItem('user_info', JSON.stringify(d.user));
  }, ACCOUNT);

  /* ── A) 编辑器预览 ── */
  await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('button[title="预览"]').first().click();
  await page.waitForSelector('[data-testid="editor-preview-modal"]', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const previewRows = await page.evaluate(() => {
    const scope = document.querySelector('[data-testid="editor-preview-modal"]');
    if (!scope) return [];
    const out = [];
    for (const img of scope.querySelectorAll('img')) {
      const inlineW = parseFloat(img.style.width);
      if (!isFinite(inlineW)) continue;
      const frame = img.parentElement;
      const r = img.getBoundingClientRect();
      const f = frame ? frame.getBoundingClientRect() : null;
      out.push({
        src: (img.currentSrc || img.src).split('/').pop(),
        natural: [img.naturalWidth, img.naturalHeight],
        inlineW,
        computedW: parseFloat(getComputedStyle(img).width),
        img: { l: +r.left.toFixed(2), r: +r.right.toFixed(2), t: +r.top.toFixed(2), b: +r.bottom.toFixed(2) },
        frame: f && { l: +f.left.toFixed(2), r: +f.right.toFixed(2), t: +f.top.toFixed(2), b: +f.bottom.toFixed(2) },
      });
    }
    return out;
  });
  const preview = previewRows;
  console.log('A) 编辑器预览内裁剪图片:', JSON.stringify(preview));
  assertCoverage('A 预览', preview);
  await page.screenshot({ path: 'scripts/out_crop_preview_fixed.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  /* ── B) 我端作品卡片缩略图 ── */
  await page.goto(`${BASE}/user/works`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const cards = await page.evaluate(() => {
    const out = [];
    for (const img of document.querySelectorAll('img')) {
      const inlineW = parseFloat(img.style.width);
      if (!isFinite(inlineW)) continue;
      const frame = img.parentElement;
      const r = img.getBoundingClientRect();
      const f = frame ? frame.getBoundingClientRect() : null;
      out.push({
        src: (img.currentSrc || img.src).split('/').pop(),
        natural: [img.naturalWidth, img.naturalHeight],
        inlineW,
        computedW: parseFloat(getComputedStyle(img).width),
        img: { l: +r.left.toFixed(2), r: +r.right.toFixed(2), t: +r.top.toFixed(2), b: +r.bottom.toFixed(2) },
        frame: f && { l: +f.left.toFixed(2), r: +f.right.toFixed(2), t: +f.top.toFixed(2), b: +f.bottom.toFixed(2) },
      });
    }
    return out;
  });
  console.log('B) 作品卡片缩略图内裁剪图片:', JSON.stringify(cards));
  assertCoverage('B 卡片', cards);
  await page.screenshot({ path: 'scripts/out_crop_card_fixed.png' });

  check('运行期间无页面异常', errs.length === 0, errs.slice(0, 2).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} PASS =====`);
  if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join('; '));
    process.exit(1);
  }
})();
