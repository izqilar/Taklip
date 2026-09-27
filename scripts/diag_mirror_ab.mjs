/**
 * 对偶对照：同一操作分别在「无边框」与「有边框」图片上执行，
 * 判断 resize 异常是边框裁剪 Group 引起，还是 Konva 负缩放本身引起。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT_ID = 'e2e_mirror_fixture';
const DX = 40;

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

const read = (id) =>
  page.evaluate((eid) => {
    const g = window.Konva.stages[0].findOne('#' + eid);
    if (!g) return null;
    const r = g.getClientRect({ skipTransform: false });
    return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), sx: g.scaleX(), sy: g.scaleY(), rot: +g.rotation().toFixed(2) };
  }, id);

async function clickEl(id) {
  const p = await page.evaluate((eid) => {
    const s = window.Konva.stages[0];
    const g = s.findOne('#' + eid);
    const pos = g.getAbsolutePosition();
    const r = s.container().getBoundingClientRect();
    return { x: r.left + pos.x, y: r.top + pos.y };
  }, id);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(400);
}

async function dragAnchor(name, dx, dy) {
  const p = await page.evaluate((n) => {
    const s = window.Konva.stages[0];
    const a = s.findOne('Transformer').findOne(n);
    if (!a) return null;
    const pos = a.getAbsolutePosition();
    const r = s.container().getBoundingClientRect();
    return { x: r.left + pos.x, y: r.top + pos.y };
  }, name);
  if (!p) return false;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(p.x + (dx * i) / 6, p.y + (dy * i) / 6);
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  return true;
}

for (const id of ['img_noborder', 'img_bordered']) {
  console.log(`\n===== ${id} =====`);
  await clickEl(id);
  let a = await read(id);
  console.log('初始        :', JSON.stringify(a));
  await dragAnchor('.middle-right', DX, 0);
  a = await read(id);
  console.log(`未镜像右拖${DX}:`, JSON.stringify(a), `期望宽 ${200 + DX}`);

  await page.locator('button[title="水平镜像"]').first().click();
  await page.waitForTimeout(400);
  a = await read(id);
  console.log('水平镜像后  :', JSON.stringify(a));
  const wBefore = a.w;
  await dragAnchor('.middle-right', DX, 0);
  a = await read(id);
  console.log(`镜像后右拖${DX}:`, JSON.stringify(a), `期望宽 ${(wBefore + DX).toFixed(2)}`);
}

await browser.close();
