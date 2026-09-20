import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;

const EXE = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const BASE = 'http://localhost:5174';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

await page.goto(BASE + '/login');
await page.getByPlaceholder('手机号').fill('13800000002');
await page.getByPlaceholder('密码').fill('dev123456');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/admin/users');
console.log('LOGIN OK ->', page.url());

// ③ user view
await page.getByText('用户', { exact: true }).click();
await page.waitForTimeout(800);
const inputs = await page.locator('input').all();
console.log('--- ALL inputs on user view (count=' + inputs.length + ') ---');
for (const inp of inputs) {
  const ph = await inp.getAttribute('placeholder');
  const cls = await inp.getAttribute('class');
  console.log('  ph=', JSON.stringify(ph), 'class=', JSON.stringify(cls));
}
// also dump any element containing 以进入对象视角
const scopeText = await page.getByText(/以进入对象视角/).allInnerTexts().catch(() => []);
console.log('--- scope placeholder text nodes ---', JSON.stringify(scopeText));

// ④ readonly banner text
await page.getByText('管理员').click();
await page.waitForTimeout(300);
await page.getByText('只读模式', { exact: true }).click();
await page.waitForTimeout(500);
const readonlyTexts = await page.getByText(/只读模式/).allInnerTexts();
console.log('--- readonly matches ---', JSON.stringify(readonlyTexts));
// restore state by toggling off via exact dropdown item
await page.getByText('管理员').click();
await page.waitForTimeout(200);
await page.getByText('只读模式', { exact: true }).click();

// back to 总台 for ⑤/⑧
await page.getByText('总台', { exact: true }).click();
await page.waitForTimeout(400);

// ⑤ roles page "查看"
await page.getByText('角色与权限').click();
await page.waitForTimeout(600);
const viewEls = await page.getByText('查看').all();
console.log('--- roles "查看" count:', viewEls.length);
for (const el of viewEls) {
  const tag = await el.evaluate((n) => n.tagName);
  const role = await el.getAttribute('role');
  console.log('  查看 el:', tag, 'role=', role);
}

// ⑧ template review 查看 button
await page.getByText('模板审核').click();
await page.waitForTimeout(600);
const viewBtns = await page.getByRole('button', { name: '查看' }).all();
console.log('--- template "查看" button count:', viewBtns.length);
const rejectBtns = await page.getByRole('button', { name: '驳回' }).all();
console.log('--- template "驳回" button count:', rejectBtns.length);
// also check scope autocomplete input on user view works via text-node click
await page.getByText('用户', { exact: true }).click();
await page.waitForTimeout(400);
const phText = page.getByText('检索用户（昵称 / 手机号）以进入对象视角');
await phText.click();
await page.keyboard.insertText('13900001001');
await page.waitForTimeout(600);
const optCount = await page.locator('.ant-select-item-option').all();
console.log('--- scope options after typing:', optCount.length);
for (const o of optCount) { console.log('   opt:', await o.innerText()); }

console.log('--- pageerrors/console errors ---');
console.log(errs.length ? errs.join('\n') : '(none)');

await browser.close();
