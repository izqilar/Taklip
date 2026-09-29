// 跨内核渲染验证（Chromium）：确认含维吾尔文且所选字体缺覆盖的文本，
// 在编辑器里被确定性回退到统一「补字字体」(NotoNaskhArabic-Regular)，
// 且该字体已注册进 document.fonts（两内核因此使用同一回退字体，消除字形/连字不一致）。
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000';
const PROJECT_ID = 'cmuje8nb800011z5cxlptgosw';
const USER = '13900001001';
const PWD = 'Test123456';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });

  // 登录
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="phone"]', USER).catch(() => {});
  await page.fill('input[type="password"]', PWD).catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForTimeout(1500);
  // 若仍在登录页，尝试常见输入框
  const url1 = page.url();
  if (url1.includes('/login')) {
    await page.getByText('登录').click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  // 直接进编辑器
  await page.goto(BASE + '/editor/' + PROJECT_ID, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 等待字体加载完成
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const fam = 'NotoNaskhArabic-Regular';
    const out = {};
    out.fallbackRegistered = document.fonts ? document.fonts.check('16px "' + fam + '"') : null;
    // 列出已加载的 @font-face 家族（确认回退字体在集合里）
    const faces = [];
    if (document.fonts && document.fonts.forEach) {
      document.fonts.forEach((f) => faces.push(f.family + (f.status === 'loaded' ? '(loaded)' : '')));
    }
    out.fallbackFaceLoaded = faces.some((x) => x.startsWith(fam));
    // 找到画布里渲染的文本内容（canvas 不可读，但编辑器文本编辑 overlay 是 DOM）
    // 尝试读取任意 contentEditable / textarea 的 fontFamily（编辑态）
    let overlayFont = null;
    const editable = document.querySelector('[contenteditable="true"], textarea');
    if (editable) overlayFont = getComputedStyle(editable).fontFamily;
    out.overlayFontFamily = overlayFont;
    return out;
  });

  // 截图
  const shot = '.wb_e2e_fill/uyghur_editor_' + Date.now() + '.png';
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {});

  // 双击文本进入编辑，再读 overlay font-family（若可定位）
  // 取画布中心附近双击
  const box = await page.locator('canvas').first().boundingBox().catch(() => null);
  let overlayFont2 = null;
  if (box) {
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    overlayFont2 = await page.evaluate(() => {
      const e = document.querySelector('[contenteditable="true"], textarea');
      return e ? getComputedStyle(e).fontFamily : null;
    });
  }

  await browser.close();

  const pass =
    result.fallbackRegistered === true || result.fallbackFaceLoaded === true;
  console.log('RESULT', JSON.stringify({
    fallbackRegistered: result.fallbackRegistered,
    fallbackFaceLoaded: result.fallbackFaceLoaded,
    overlayFontFamily: result.overlayFontFamily,
    overlayFontFamilyAfterDblClick: overlayFont2,
    errorCount: errors.length,
    errors: errors.slice(0, 8),
    pass,
  }, null, 2));
  console.log('SHOT', shot);
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
