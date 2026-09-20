import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;
const EXE = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const BASE = 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.includes('OBJSCOPE')) errs.push('CONSOLE: ' + t); });
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('resolve') || r.status() >= 400) console.log('RESP', r.status(), u);
});
page.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText));

await page.goto(BASE + '/login');
await page.getByPlaceholder('手机号').fill('13800000002');
await page.getByPlaceholder('密码').fill('dev123456');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/admin/users');
console.log('LOGIN OK');

// --- ④/⑧: template drawer buttons ---
await page.getByText('模板审核').click();
await page.waitForTimeout(600);
const viewBtns = await page.getByRole('button', { name: '查看' }).all();
console.log('template 查看 buttons:', viewBtns.length);
if (viewBtns.length) {
  await viewBtns[0].click();
  await page.waitForTimeout(800);
  const btns = await page.getByRole('button').all();
  console.log('--- drawer buttons after 查看 ---');
  for (const b of btns) {
    const txt = (await b.innerText()).trim();
    const dis = await b.isDisabled();
    console.log('  btn:', JSON.stringify(txt), 'disabled=', dis);
  }
  // close drawer
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// --- ⑥: provider-review rows ---
await page.getByText(/^服务商管理/).first().click();
await page.waitForTimeout(800);
const rows = await page.locator('table tbody tr').all();
console.log('provider-review rows:', rows.length);
const pbtns = await page.getByRole('button').all();
console.log('--- provider page buttons ---');
for (const b of pbtns) {
  const txt = (await b.innerText()).trim();
  if (txt) console.log('  btn:', JSON.stringify(txt));
}

// --- ③: object scope dropdown ---
await page.getByText('用户', { exact: true }).click();
await page.waitForTimeout(500);
const scopeSel = page.locator('.ant-select').filter({ hasText: '以进入对象视角' });
const scopeInput = scopeSel.locator('input.ant-select-selection-search-input');
await scopeInput.click();
await scopeInput.pressSequentially('13900001001', { delay: 50 });
await page.waitForTimeout(2000);
const optCount = await page.locator('.ant-select-item-option').count();
console.log('option count:', optCount);
console.log('option texts:', JSON.stringify(await page.locator('.ant-select-item-option-content').allInnerTexts().catch(() => [])));
const tagAfter = await page.locator('.ant-tag').filter({ hasText: '13900001001' }).count();
console.log('selected tag count:', tagAfter);

console.log('--- errors ---', errs.length ? errs.join('\n') : '(none)');
await browser.close();
