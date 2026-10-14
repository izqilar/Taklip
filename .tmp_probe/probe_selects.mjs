import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(async ([api, phone, password]) => {
  const res = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  const d = await res.json();
  localStorage.setItem('access_token', d.accessToken);
  localStorage.setItem('refresh_token', d.refreshToken);
}, [API, '13900001001', 'Test123456']);
await page.goto(`${BASE}/user/invitations/lists`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => [...document.querySelectorAll('select')].map((s, i) => ({
  i,
  testid: s.dataset.testid || null,
  inForm: !!s.closest('[data-testid="new-list-form"]'),
  title: s.getAttribute('title') || null,
  opts: [...s.options].slice(0, 3).map((o) => o.textContent),
  parentCls: s.parentElement?.className?.toString().slice(0, 60),
})));
console.log(JSON.stringify(info, null, 1));
await browser.close();
