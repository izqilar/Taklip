import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const shots = 'D:/MyWorkBuddy/2026-08-10-22-39-56/shots/';

const results = [];
const log = (k, v) => { results.push(`${k}: ${v}`); console.log(`${k}: ${v}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

try {
  // 1) 登录
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="tel"]', '13900001001');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
  log('login', 'redirected -> ' + page.url());

  // 2) 进入编辑器（点「设计工坊」创建并跳转）
  await page.getByText('设计工坊', { exact: true }).first().click();
  await page.waitForSelector('.editor-canvas-wrap', { timeout: 20000 });
  await page.waitForTimeout(1200); // 等画布/面板渲染
  log('editor', 'loaded ' + page.url());

  // 亮色截图
  await page.screenshot({ path: shots + 'theme_light.png' });

  // 读取亮色下关键表面计算样式
  const light = await page.evaluate(() => {
    const wrap = document.querySelector('.editor-canvas-wrap');
    const header = wrap?.querySelector('header');
    const main = [...wrap.querySelectorAll('main')].find((m) => m.className.includes('flex-1'));
    const panel = wrap.querySelector('aside') || wrap.querySelector('[class*="w-56"]');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      htmlDark: document.documentElement.classList.contains('dark'),
      headerBg: cs(header)?.backgroundColor,
      mainBg: cs(main)?.backgroundColor,
      panelBg: cs(panel)?.backgroundColor,
      wrapColor: cs(wrap)?.color,
    };
  });
  log('light.htmlDark', light.htmlDark);
  log('light.headerBg', light.headerBg);
  log('light.mainBg(canvas desk)', light.mainBg);
  log('light.panelBg', light.panelBg);
  log('light.wrapColor', light.wrapColor);

  // 3) 切换为暗色
  const toggle = page.locator('header button[title*="深色"]');
  await toggle.click();
  await page.waitForTimeout(800);
  const ls = await page.evaluate(() => localStorage.getItem('editor.theme'));
  log('afterToggle.localStorage', ls);

  // 暗色截图
  await page.screenshot({ path: shots + 'theme_dark.png' });

  // 读取暗色下关键表面
  const dark = await page.evaluate(() => {
    const wrap = document.querySelector('.editor-canvas-wrap');
    const header = wrap?.querySelector('header');
    const main = [...wrap.querySelectorAll('main')].find((m) => m.className.includes('flex-1'));
    const panel = wrap.querySelector('aside') || wrap.querySelector('[class*="w-56"]');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    // 取一个面板内的文字样本，确认暗底上文字为浅色
    const sampleText = wrap?.querySelector('.text-gray-600, .text-gray-700, .text-gray-800');
    // 扫描暗色下所有仍带白底（接近 rgb(255,255,255) 且不透明）的元素，
    // 确认无残留浅色浮层（缩放条 / 文本编辑框 / 画廊·拼图角标等）。
    const nearWhite = [];
    wrap?.querySelectorAll('*').forEach((el) => {
      const cls = el.className && typeof el.className === 'string' ? el.className : '';
      if (cls.includes('bg-white')) {
        const bg = getComputedStyle(el).backgroundColor;
        // 解析 rgba 亮度
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m) {
          const r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4];
          const lum = (r * 0.299 + g * 0.587 + b * 0.114) * a;
          if (lum > 200) {
            const tag = (el.tagName || '') + (cls ? '.' + cls.split(/\s+/).filter((c) => c.startsWith('bg-white')).join('.') : '');
            nearWhite.push(tag + ' => ' + bg);
          }
        }
      }
    });
    return {
      htmlDark: document.documentElement.classList.contains('dark'),
      headerBg: cs(header)?.backgroundColor,
      mainBg: cs(main)?.backgroundColor,
      panelBg: cs(panel)?.backgroundColor,
      wrapColor: cs(wrap)?.color,
      sampleTextColor: sampleText ? getComputedStyle(sampleText).color : null,
      bgWhiteResiduals: nearWhite,
    };
  });
  log('dark.htmlDark', dark.htmlDark);
  log('dark.headerBg', dark.headerBg);
  log('dark.mainBg(canvas desk)', dark.mainBg);
  log('dark.panelBg', dark.panelBg);
  log('dark.wrapColor', dark.wrapColor);
  log('dark.sampleTextColor', dark.sampleTextColor);
  log('dark.bgWhiteResiduals', dark.bgWhiteResiduals.length ? dark.bgWhiteResiduals.join(' || ') : 'NONE');

  // 4) 打开预览，确认用户作品内容（DOM SchemaRenderer）未被暗色改暗
  //    预览按钮可能在画布区；尝试多种命中方式
  let previewOpened = false;
  const previewTriggers = [
    page.locator('header button[title*="预览"]'),
    page.getByText('预览', { exact: false }).first(),
  ];
  for (const tr of previewTriggers) {
    try {
      if (await tr.count()) { await tr.first().click({ timeout: 2000 }); previewOpened = true; break; }
    } catch { /* ignore */ }
  }
  await page.waitForTimeout(600);
  if (previewOpened) {
    await page.screenshot({ path: shots + 'theme_dark_preview.png' });
    const prev = await page.evaluate(() => {
      // 预览弹窗内的用户页面容器（inline 白底），确认不是被改暗的灰底
      const whiteish = [...document.querySelectorAll('div')].find(
        (d) => d.style && d.style.backgroundColor === 'rgb(255, 255, 255)' && d.offsetWidth > 200 && d.offsetHeight > 200,
      );
      return whiteish ? whiteish.style.backgroundColor : 'no-inline-white-page-found';
    });
    log('preview.userPageBg', prev);
  } else {
    log('preview', 'no preview trigger found (skip fidelity check)');
  }

  // 断言
  const ok =
    light.htmlDark === false &&
    dark.htmlDark === true &&
    dark.headerBg === 'rgb(44, 44, 44)' &&
    dark.wrapColor === 'rgb(237, 237, 237)' &&
    dark.bgWhiteResiduals.length === 0;
  log('ASSERT.darkApplied', ok ? 'PASS' : 'FAIL');
  log('consoleErrors', errors.length ? errors.slice(0, 5).join(' | ') : 'none');
} catch (e) {
  log('FATAL', e.message);
} finally {
  await browser.close();
}

console.log('\n=== SUMMARY ===');
console.log(results.join('\n'));
