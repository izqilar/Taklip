import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT_ID = 'e2e_mirror_fixture';
const EL_ID = process.argv[2] || 'img_noborder';
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

const clickAt = async (sel) => {
  const p = await page.evaluate((s) => {
    const st = window.Konva.stages[0];
    const n = st.findOne(s);
    const pos = n.getAbsolutePosition();
    const r = st.container().getBoundingClientRect();
    return { x: r.left + pos.x, y: r.top + pos.y };
  }, sel);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(400);
};
await clickAt('#' + EL_ID);
await page.locator('button[title="水平镜像"]').first().click();
await page.waitForTimeout(500);

// 记录 Transformer 自身状态 + 每次 transform 前 T 的宽高与锚点名
await page.evaluate((eid) => {
  window.__t = [];
  const st = window.Konva.stages[0];
  const tr = st.findOne('Transformer');
  const g = st.findOne('#' + eid);
  g.on('transform', () => {
    window.__t.push({
      trW: +tr.width().toFixed(2),
      trH: +tr.height().toFixed(2),
      trRot: +tr.rotation().toFixed(2),
      anchor: tr._movingAnchorName,
      tlX: +tr.findOne('.top-left').x().toFixed(2),
      brX: +tr.findOne('.bottom-right').x().toFixed(2),
      nodeSx: +g.scaleX().toFixed(4),
      nodeSy: +g.scaleY().toFixed(4),
      nodeRot: +g.rotation().toFixed(2),
    });
  });
  window.__getState = () => {
    const r = g.getClientRect({ skipTransform: false });
    return { tr: { x: +tr.x().toFixed(2), y: +tr.y().toFixed(2), w: +tr.width().toFixed(2), h: +tr.height().toFixed(2), rot: +tr.rotation().toFixed(2) }, nodeCR: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) } };
  };
}, EL_ID);

console.log('拖前状态:', JSON.stringify(await page.evaluate(() => window.__getState())));

const ap = await page.evaluate(() => {
  const st = window.Konva.stages[0];
  const tr = st.findOne('Transformer');
  const pos = tr.findOne('.middle-right').getAbsolutePosition();
  const r = st.container().getBoundingClientRect();
  return { x: r.left + pos.x, y: r.top + pos.y };
});
await page.mouse.move(ap.x, ap.y);
await page.mouse.down();
for (let i = 1; i <= 4; i++) {
  await page.mouse.move(ap.x + 10 * i, ap.y);
  await page.waitForTimeout(60);
}
await page.mouse.up();
await page.waitForTimeout(400);

const out = await page.evaluate(() => ({ log: window.__t, after: window.__getState() }));
console.log('每次 transform 事件快照:');
for (const r of out.log) console.log(' ', JSON.stringify(r));
console.log('拖后状态:', JSON.stringify(out.after));
await browser.close();
