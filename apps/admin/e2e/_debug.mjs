import { chromium } from '@playwright/test';

const EXE = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const BASE = 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type()==='error') console.log('CONSOLE-ERR:', m.text().slice(0,300)); });
page.on('pageerror', (e) => console.log('PAGEERR:', e.message.slice(0,300)));

await page.goto(`${BASE}/login`);
await page.getByPlaceholder('手机号').fill('13800000002');
await page.getByPlaceholder('密码').fill('dev123456');
await page.locator('button[type=submit]').click();
await page.waitForURL('**/admin/users');
await page.waitForTimeout(1000);
await page.getByText('模板审核').click();
await page.waitForTimeout(2500);
const html = await page.content();
console.log('HTML length:', html.length);
const idx = html.indexOf('登录成功');
console.log('around 登录成功:', html.slice(Math.max(0,idx-200), idx+200).replace(/\s+/g,' '));
// 找 Segmented / Table 痕迹
console.log('has 待审核:', html.includes('待审核'), '| has ant-segmented:', html.includes('ant-segmented'), '| has ant-table:', html.includes('ant-table'));
await browser.close();
