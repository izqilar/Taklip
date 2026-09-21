import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5174';
const out = [];
const log = (m) => { out.push(m); console.log(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

// ── 登录 ──
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', '13800000002');
await page.fill('input[type="password"]', 'dev123456');
await page.locator('button[type="submit"]').click();
await page.waitForSelector('text=管理总台', { timeout: 15000 });
log('✅ 登录成功，进入运营端工作台');

// ── 宽屏 1280：侧栏应固定贴左 x=0，无横向滚动 ──
const asideWide = await page.locator('aside').boundingBox();
const swWide = await page.evaluate(() => document.documentElement.scrollWidth);
log(`宽屏 aside: x=${asideWide.x.toFixed(0)} width=${asideWide.width.toFixed(0)} | scrollWidth=${swWide} innerWidth=1280`);
log(asideWide.x === 0 && asideWide.width === 240 ? '✅ 宽屏侧栏 240px 贴左正常' : '❌ 宽屏侧栏位置异常');
log(swWide <= 1280 ? '✅ 宽屏无横向滚动' : '❌ 宽屏出现横向滚动');

// ── 窄屏 390：侧栏应移出视口，汉堡按钮可见 ──
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const asideNarrow = await page.locator('aside').boundingBox();
const hamburger = page.getByRole('button', { name: '打开菜单' });
const hamVisible = await hamburger.isVisible();
const swNarrow = await page.evaluate(() => document.documentElement.scrollWidth);
log(`窄屏 aside: x=${asideNarrow.x.toFixed(0)} | 汉堡可见=${hamVisible} | scrollWidth=${swNarrow} innerWidth=390`);
log(asideNarrow.x < 0 ? '✅ 窄屏侧栏抽屉已收起（移出视口）' : '❌ 窄屏侧栏仍在视口内（错乱）');
log(hamVisible ? '✅ 窄屏汉堡按钮可见' : '❌ 窄屏汉堡按钮不可见');
log(swNarrow <= 390 ? '✅ 窄屏无横向滚动' : '❌ 窄屏出现横向滚动');

// ── 内容栅格降级校验：窄屏下 duo/trio/两列表单应降为单列 ──
const gridCols = await page.evaluate(() => {
  const el = document.querySelector('[class*="grid-cols-1"]');
  if (!el) return 'none';
  return getComputedStyle(el).gridTemplateColumns;
});
const tracks = gridCols === 'none' ? 0 : gridCols.trim().split(/\s+/).length;
log(`窄屏首个 grid-cols-1 容器 grid-template-columns="${gridCols}"（轨道数=${tracks}）`);
log(tracks === 1 ? '✅ 窄屏内容栅格已降为单列' : (gridCols === 'none' ? '⚠️ 当前页无 grid-cols-1 容器可测' : '❌ 窄屏内容栅格仍多列'));

// 点击汉堡 → 抽屉滑入
await hamburger.click();
await page.waitForTimeout(300);
const asideOpen = await page.locator('aside').boundingBox();
log(asideOpen.x === 0 ? '✅ 点击汉堡后侧栏抽屉滑入（x=0）' : `❌ 抽屉未滑入 x=${asideOpen.x.toFixed(0)}`);
await page.screenshot({ path: 'e2e/_shot_narrow_drawer.png', fullPage: false });
// 通过遮罩关闭抽屉（抽屉开启时汉堡被其遮挡，真实交互点遮罩关闭）
await page.mouse.click(300, 420);
await page.waitForTimeout(300);
const asideClosed = await page.locator('aside').boundingBox();
log(asideClosed.x < 0 ? '✅ 点击遮罩后抽屉收起' : `❌ 遮罩关闭失败 x=${asideClosed.x.toFixed(0)}`);

// 切回宽屏验证不变
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(300);
const asideBack = await page.locator('aside').boundingBox();
log(asideBack.x === 0 ? '✅ 回到宽屏侧栏恢复贴左' : `❌ 回到宽屏异常 x=${asideBack.x.toFixed(0)}`);
await page.screenshot({ path: 'e2e/_shot_wide.png', fullPage: false });

log(consoleErrors.length === 0 ? '✅ 无控制台错误' : `⚠️ 控制台错误 ${consoleErrors.length} 条: ` + consoleErrors.slice(0, 5).join(' | '));

await browser.close();
log('DONE');
