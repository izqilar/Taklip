/**
 * 验证编辑器「预览」视图与作品预览同构（布局/尺寸/控件均一致）
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT_ID = process.argv[2] || 'e2e_mirror_fixture';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }) });
  const d = await res.json();
  localStorage.setItem('access_token', d.accessToken);
  localStorage.setItem('refresh_token', d.refreshToken);
  localStorage.setItem('user_info', JSON.stringify(d.user));
});
await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(2000);

await page.locator('button[title="预览"]').first().click();
await page.waitForSelector('[data-testid="editor-preview-modal"]', { timeout: 10000 });
await page.waitForTimeout(1200);

const info = await page.evaluate(() => {
  const modal = document.querySelector('[data-testid="editor-preview-modal"]');
  if (!modal) return null;
  const card = modal.firstElementChild;
  const left = card?.children?.[0];
  const shell = left?.firstElementChild;
  const controls = left?.children?.[1];
  const shellBox = shell ? shell.getBoundingClientRect() : null;
  const cardBox = card ? card.getBoundingClientRect() : null;
  return {
    cardW: cardBox ? Math.round(cardBox.width) : null,
    shellW: shellBox ? Math.round(shellBox.width) : null,
    shellH: shellBox ? Math.round(shellBox.height) : null,
    shellRadius: shell ? getComputedStyle(shell).borderRadius : null,
    shellBg: shell ? getComputedStyle(shell).backgroundColor : null,
    buttons: controls ? Array.from(controls.querySelectorAll('button')).map((b) => b.textContent?.trim()) : [],
    hasCheckbox: controls ? !!controls.querySelector('input[type=checkbox]') : false,
    rightPanel: !!card?.children?.[1],
    renderedElements: modal.querySelectorAll('[data-element-id]').length,
  };
});
console.log('预览结构:', JSON.stringify(info));

check('预览模态已打开', !!info);
check('卡片最大宽度 760（与作品预览一致）', info && info.cardW === 760, `实际 ${info?.cardW}`);
check('手机壳宽度 320（300 + bezel 10×2）', info && info.shellW === 320, `实际 ${info?.shellW}`);
check('手机壳高度 = 667×0.8 + 20 ≈ 554', info && Math.abs(info.shellH - 554) <= 2, `实际 ${info?.shellH}`);
check('手机壳圆角 32px', info && info.shellRadius === '32px', info?.shellRadius);
check('手机壳底色 #111827', info && info.shellBg === 'rgb(17, 24, 39)', info?.shellBg);
check(
  '控件组与作品预览一致（上一页/下一页/重播动画 + 播放动画开关）',
  info && ['上一页', '下一页', '重播动画'].every((t) => info.buttons.includes(t)) && info.hasCheckbox,
  JSON.stringify(info?.buttons),
);
check('右侧属性栏存在', info && info.rightPanel);
check('页面元素已渲染到预览中', info && info.renderedElements > 0, `${info?.renderedElements} 个元素`);

await page.screenshot({ path: 'scripts/out_preview_editor.png' });

// Esc 关闭
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const closed = await page.evaluate(() => !document.querySelector('[data-testid="editor-preview-modal"]'));
check('Esc 可关闭预览', closed);
check('运行期间无页面异常', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} PASS =====`);
if (failed.length) {
  console.log('FAILED: ' + failed.map((f) => f.name).join('; '));
  process.exit(1);
}
