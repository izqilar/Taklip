import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT_ID = 'e2e_parity_fixture';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
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

const sel = await page.evaluate(() => {
  const s = window.Konva.stages[0];
  const g = s.findOne('#img_plain');
  const r = s.container().getBoundingClientRect();
  const p = g.getAbsolutePosition();
  return { x: r.left + p.x, y: r.top + p.y };
});
await page.mouse.click(sel.x, sel.y);
await page.waitForTimeout(400);
await page.locator('button[title="水平镜像"]').first().click();
await page.waitForTimeout(400);

// 监听每次 transform 事件 Konva 实际写回的属性
await page.evaluate(() => {
  window.__log = [];
  const g = window.Konva.stages[0].findOne('#img_plain');
  g.on('transform', () => {
    const kids = g.getChildren();
    window.__log.push({ sx: +g.scaleX().toFixed(4), sy: +g.scaleY().toFixed(4), rot: +g.rotation().toFixed(2) });
    void kids;
  });
});

const anchor = await page.evaluate(() => {
  const s = window.Konva.stages[0];
  const tr = s.findOne('Transformer');
  const a = tr.findOne('.middle-right');
  const p = a.getAbsolutePosition();
  const r = s.container().getBoundingClientRect();
  return { x: r.left + p.x, y: r.top + p.y };
});
await page.mouse.move(anchor.x, anchor.y);
await page.mouse.down();
for (let i = 1; i <= 6; i++) {
  await page.mouse.move(anchor.x + (40 * i) / 6, anchor.y);
  await page.waitForTimeout(60);
}
await page.mouse.up();
await page.waitForTimeout(400);

const out = await page.evaluate(() => {
  const g = window.Konva.stages[0].findOne('#img_plain');
  const r = g.getClientRect({ skipTransform: false });
  return { log: window.__log, final: { sx: g.scaleX(), sy: g.scaleY(), rot: g.rotation(), w: r.width, h: r.height } };
});
console.log('每次 transform 事件 Konva 写回的属性：');
console.log(JSON.stringify(out.log, null, 0));
console.log('最终：', JSON.stringify(out.final));
await browser.close();
