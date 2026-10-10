/**
 * 验证「服务端导出图片」对文本图片填充的渲染（真正的渲染输出链路）。
 *
 * 用法：node scripts/verify_export_imgfill.mjs [projectId]
 *
 * 流程：登录 → POST /api/export/image（服务端 puppeteer 加载 /export-render 渲染）
 *       → 保存 PNG 到 shots/ → 用 canvas 统计非白像素，证明图片填充确实被画出（而非回落单色）。
 */
import fs from 'node:fs';

const API = 'http://127.0.0.1:3000';
const PROJECT = process.argv[2] || 'e2e_parity_fixture';
fs.mkdirSync('shots', { recursive: true });

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }),
});
const auth = await login.json();
const token = auth.accessToken;
if (!token) { console.error('login failed', JSON.stringify(auth).slice(0, 300)); process.exit(1); }

const res = await fetch(`${API}/api/export/image`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ projectId: PROJECT, source: 'draft', mode: 'current', page: 0, format: 'png' }),
});
if (!res.ok) {
  console.error('export failed', res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const out = `shots/verify_export_${PROJECT}.png`;
fs.writeFileSync(out, buf);
console.log(`导出成功：${buf.length} bytes → ${out}`);

// 用浏览器 canvas 解析 PNG，统计「非白像素」与「不同颜色数」，
// 单色回落 → 颜色数极少（背景色 + 一种填充色）；图片填充 → 颜色数很多。
const pw = (await import('file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js')).default;
const browser = await pw.chromium.launch();
const page = await browser.newPage();
const b64 = buf.toString('base64');
const stats = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const colors = new Set();
  let nonWhite = 0, total = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    if (a < 8) continue;
    total++;
    if (!(r > 245 && g > 245 && b > 245)) {
      nonWhite++;
      colors.add((r >> 3) + ',' + (g >> 3) + ',' + (b >> 3));
    }
  }
  return { w: c.width, h: c.height, total, nonWhite, colorBuckets: colors.size };
}, b64);
await browser.close();

console.log('统计:', JSON.stringify(stats));
const ok = stats.nonWhite > 500;
console.log(`${ok ? 'PASS' : 'FAIL'}  导出图包含大量非白像素（文本图片填充已绘制）  → nonWhite=${stats.nonWhite}`);
const rich = stats.colorBuckets > 30;
console.log(`${rich ? 'PASS' : 'FAIL'}  非白区域颜色丰富（是图片而非单色回落）  → buckets=${stats.colorBuckets}`);
process.exit(ok && rich ? 0 : 1);
