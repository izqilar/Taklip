// 颜色选择器弹窗（设计稿对齐）端到端验证：
// 登录 → 新建作品进入编辑器（强制暗色）→ 加一个矩形并选中 → 切「渐变」填充
// → 点「停靠点颜色」色块 → 校验弹窗结构 / 暗色背景 / 标题栏可拖拽 / 调色板页签 / 预设取色 / 关闭 / 0 报错。
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:5173';
const USER = process.env.USER_PHONE || '13900001001';
const PWD = process.env.USER_PWD || 'Test123456';
const OUT = path.resolve(__dirname, '..', '.wb_e2e_fill');

const report = { steps: [] };
const errors = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript(() => { try { localStorage.setItem('editor.theme', 'dark'); } catch {} });

  // 登录（手机号字段是 type=tel，密码是 type=password）
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="tel"]', USER);
  await page.fill('input[type="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  report.steps.push({ step: 'afterLoginUrl', value: page.url() });
  await page.waitForTimeout(1500);

  // 新建作品 → 进入真实编辑器
  await page.getByRole('button', { name: /新建|New|createNew/ }).first().click();
  await page.waitForURL((u) => u.toString().includes('/editor/'), { timeout: 20000 }).catch(() => {});
  report.steps.push({ step: 'editorUrl', value: page.url() });

  await page.waitForFunction(() => !!window.__editorStore, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { document.documentElement.classList.add('dark'); localStorage.setItem('editor.theme', 'dark'); } catch {} }).catch(() => {});
  report.steps.push({ step: 'darkClass', value: await page.evaluate(() => document.documentElement.classList.contains('dark')).catch(() => false) });

  // 加一个矩形（addElement 会自动选中）
  const sel = await page.evaluate(() => {
    const st = window.__editorStore;
    if (!st) return { ok: false, reason: 'no store' };
    const s = st.getState();
    s.addElement('rect');
    const s2 = st.getState();
    const p2 = s2.project.pages[s2.activePage];
    const els = (p2 && p2.elements) || [];
    return { ok: true, count: els.length, id: els[els.length - 1] && els[els.length - 1].id };
  });
  report.steps.push({ step: 'select', value: sel });
  await page.waitForTimeout(900);

  const fillPanelVisible = await page.locator('[data-fill-type="gradient"]').first().isVisible().catch(() => false);
  report.steps.push({ step: 'fillPanelVisible', value: fillPanelVisible });
  if (!fillPanelVisible) {
    await page.screenshot({ path: path.join(OUT, 'pk_nofill.png') }).catch(() => {});
    await browser.close();
    console.log('RESULT', JSON.stringify({ report, errors: errors.slice(0, 10), pass: false }, null, 2));
    process.exit(2);
  }

  // 切到「渐变」填充
  await page.locator('[data-fill-type="gradient"]').first().click({ force: true });
  await page.waitForTimeout(700);
  report.steps.push({ step: 'gradientKindSelectVisible', value: await page.locator('[data-testid="gradient-kind-select"]').first().isVisible().catch(() => false) });

  // 点「停靠点颜色」色块（ColorField 的色块按钮）
  const swatch = page.locator('[data-testid="colorfield-swatch"]').first();
  report.steps.push({ step: 'stopColorSwatchVisible', value: await swatch.isVisible().catch(() => false) });
  await swatch.click({ force: true });
  await page.waitForSelector('[data-testid="colorpicker"]', { state: 'visible', timeout: 15000 }).catch((e) => report.steps.push({ step: 'openErr', value: String(e) }));
  await page.waitForTimeout(600);

  const picker = page.locator('[data-testid="colorpicker"]').first();
  report.steps.push({ step: 'pickerVisible', value: await picker.isVisible().catch(() => false) });
  if (!(await picker.isVisible().catch(() => false))) {
    await page.screenshot({ path: path.join(OUT, 'pk_fail.png') }).catch(() => {});
    await browser.close();
    console.log('RESULT', JSON.stringify({ report, errors: errors.slice(0, 10), pass: false }, null, 2));
    process.exit(2);
  }

  // 结构断言
  const ids = [
    'colorpicker-title', 'colorpicker-tab-custom', 'colorpicker-tab-palette', 'colorpicker-close',
    'colorpicker-sv', 'colorpicker-hue', 'colorpicker-alpha', 'colorpicker-format', 'colorpicker-hex',
    'colorpicker-opacity', 'colorpicker-clear', 'colorpicker-confirm',
  ];
  const present = {};
  for (const id of ids) present[id] = await page.locator(`[data-testid="${id}"]`).count();
  report.present = present;
  report.eyedropperPresent = await page.locator('[data-testid="colorpicker-eyedropper"]').count();
  report.presetCount = await page.locator('[data-testid="colorpicker-preset"]').count();
  report.tabCustomActive = await page.locator('[data-testid="colorpicker-tab-custom"]').getAttribute('data-active');

  report.styles = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="colorpicker"]');
    const cs = root ? getComputedStyle(root) : null;
    return {
      rootBg: cs ? cs.backgroundColor : null,
      rootColor: cs ? cs.color : null,
      confirmText: document.querySelector('[data-testid="colorpicker-confirm"]')?.textContent.trim() ?? null,
      clearText: document.querySelector('[data-testid="colorpicker-clear"]')?.textContent.trim() ?? null,
      customText: document.querySelector('[data-testid="colorpicker-tab-custom"]')?.textContent.trim() ?? null,
      paletteText: document.querySelector('[data-testid="colorpicker-tab-palette"]')?.textContent.trim() ?? null,
      hexValue: document.querySelector('[data-testid="colorpicker-hex"]')?.value ?? null,
      opacityValue: document.querySelector('[data-testid="colorpicker-opacity"]')?.value ?? null,
    };
  });

  await page.screenshot({ path: path.join(OUT, 'pk_custom_dark.png') }).catch(() => {});
  await picker.screenshot({ path: path.join(OUT, 'pk_custom_dark_only.png') }).catch(() => {});

  // 预设取色（自定义页签内 hex 输入框可见）：点击一个预设 → hex 变化
  const c0 = await page.locator('[data-testid="colorpicker-hex"]').inputValue().catch(() => null);
  await page.locator('[data-testid="colorpicker-preset"]').nth(4).click({ force: true });
  await page.waitForTimeout(400);
  const c1 = await page.locator('[data-testid="colorpicker-hex"]').inputValue().catch(() => null);
  report.presetPick = { before: c0, after: c1, changed: c0 !== c1 };

  // 拖拽标题栏
  const before = await picker.boundingBox();
  const title = page.locator('[data-testid="colorpicker-title"]').first();
  const tb = await title.boundingBox();
  if (tb && before) {
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2 - 120, tb.y + tb.height / 2 + 90, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  const after = await picker.boundingBox();
  report.drag = { dx: after && before ? Math.round(after.x - before.x) : null, dy: after && before ? Math.round(after.y - before.y) : null };
  await page.screenshot({ path: path.join(OUT, 'pk_after_drag.png') }).catch(() => {});

  // 切「调色板」页签
  await page.locator('[data-testid="colorpicker-tab-palette"]').first().click({ force: true });
  await page.waitForTimeout(400);
  report.palettePresetCount = await page.locator('[data-testid="colorpicker-preset"]').count();
  await picker.screenshot({ path: path.join(OUT, 'pk_palette_dark_only.png') }).catch(() => {});

  // 关闭（X）→ 弹层消失
  await page.locator('[data-testid="colorpicker-close"]').first().click({ force: true });
  await page.waitForTimeout(400);
  report.steps.push({ step: 'pickerClosedAfterX', value: !(await picker.isVisible().catch(() => false)) });

  await browser.close();

  const need = ['colorpicker-title', 'colorpicker-tab-custom', 'colorpicker-tab-palette', 'colorpicker-close', 'colorpicker-sv', 'colorpicker-hue', 'colorpicker-alpha', 'colorpicker-format', 'colorpicker-hex', 'colorpicker-opacity', 'colorpicker-clear', 'colorpicker-confirm'];
  const missing = need.filter((k) => !report.present[k]);
  const pass =
    report.steps.find((s) => s.step === 'pickerVisible')?.value === true &&
    missing.length === 0 &&
    report.styles.rootBg === 'rgb(44, 44, 44)' &&
    Math.abs(report.drag.dx) > 60 &&
    report.presetCount >= 32 &&
    report.presetPick.changed === true &&
    report.steps.find((s) => s.step === 'pickerClosedAfterX')?.value === true &&
    errors.length === 0;

  console.log('RESULT', JSON.stringify({ report, missing, errorCount: errors.length, errors: errors.slice(0, 8), pass }, null, 2));
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error('FATAL', e);
  console.log('RESULT', JSON.stringify({ report, errors: errors.slice(0, 8), pass: false }, null, 2));
  process.exit(1);
});
