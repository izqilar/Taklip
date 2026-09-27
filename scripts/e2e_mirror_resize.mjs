/**
 * 验证「镜像后调整大小」不再失调 / 不再自动变成垂直镜像，且不影响未镜像对象。
 *
 * 方法：真实浏览器 + 真实鼠标拖拽 Transformer 锚点（走完整 Kaiser(transform→onChange→store) 链路），
 * 通过 window.Konva 读取节点最终状态：
 *   - 视觉盒子尺寸是否符合预期增量（宽增 Δ / 高不变）
 *   - 镜像方向是否保持（scaleX=-1 且不出现 scaleY=-1 或 rotation ±180）
 * 用例矩阵：未镜像 / 仅水平镜像 / 仅垂直镜像 / 双向镜像 × 横向拖右边 anchor / 纵向拖下边 anchor。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const BASE_URL = 'http://localhost:5173';
const PROJECT_ID = process.argv[2] || 'e2e_mirror_fixture';
const TARGET = process.argv[3] || 'img_noborder'; // 被测元素 id
const DX = 40; // 拖拽增量（舞台 1:1 时即为设计 px）

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }),
  });
  const d = await res.json();
  localStorage.setItem('access_token', d.accessToken);
  localStorage.setItem('refresh_token', d.refreshToken);
  localStorage.setItem('user_info', JSON.stringify(d.user));
});
await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(2000);

/** 读取被测元素的最终节点状态（宽高取内层 Image/Rect 节点，旋转时 clientRect 是包围盒不适用） */
const readNode = () =>
  page.evaluate((id) => {
    const stage = window.Konva.stages[0];
    const g = stage.findOne('#' + id);
    if (!g) return null;
    const out = { scaleX: g.scaleX(), scaleY: g.scaleY(), rotation: g.rotation() };
    const inner = g.findOne('Image') || g.findOne('Rect');
    if (inner) {
      out.w = inner.width();
      out.h = inner.height();
    } else {
      const r = g.getClientRect({ skipTransform: false });
      out.w = r.width;
      out.h = r.height;
    }
    const tr = stage.findOne('Transformer');
    out.attached = tr && tr.nodes ? tr.nodes().length : 0;
    out.trRotation = tr ? tr.rotation() : null;
    return out;
  }, TARGET);

/** 选中被测元素（点它的视觉中心） */
async function selectImage() {
  const pt = await page.evaluate((id) => {
    const stage = window.Konva.stages[0];
    const g = stage.findOne('#' + id);
    const p = g.getAbsolutePosition();
    const rect = stage.container().getBoundingClientRect();
    return { x: rect.left + p.x, y: rect.top + p.y };
  }, TARGET);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(400);
  return pt;
}

/** 拖拽指定 anchor */
async function dragAnchor(anchorName, dx, dy) {
  const p = await page.evaluate((name) => {
    const stage = window.Konva.stages[0];
    const tr = stage.findOne('Transformer');
    const a = tr.findOne(name);
    if (!a) return null;
    const pos = a.getAbsolutePosition();
    const rect = stage.container().getBoundingClientRect();
    return { x: rect.left + pos.x, y: rect.top + pos.y, scale: stage.scaleX() };
  }, anchorName);
  if (!p) return false;
  const sx = p.scale || 1;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(p.x + (dx / sx) * (i / steps), p.y + (dy / sx) * (i / steps));
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  return true;
}

async function clickMirror(title) {
  const btn = page.locator(`button[title="${title}"]`).first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  await page.waitForTimeout(400);
  return true;
}

await selectImage();
let st = await readNode();
check('图片已被选中（Transformer 已挂载）', st && st.attached === 1, JSON.stringify(st));
const BASE_W = st.w;
const BASE_H = st.h;
console.log(`\n基准盒子：${BASE_W.toFixed(2)} × ${BASE_H.toFixed(2)}`);

// ── 用例 1：未镜像对象横向缩放（回归保护） ────────────────────────────
let ok = await dragAnchor('.middle-right', DX, 0);
st = await readNode();
check(
  `未镜像：右锚点横拖 ${DX}px 后宽度 +${DX}（±3）`,
  ok && Math.abs(st.w - BASE_W - DX) <= 3 && Math.abs(st.h - BASE_H) <= 3,
  `${st.w.toFixed(2)} × ${st.h.toFixed(2)}`,
);
check('未镜像：未产生任何镜像/旋转', st.scaleX === 1 && st.scaleY === 1 && Math.abs(st.rotation) < 0.01, `scaleX=${st.scaleX} scaleY=${st.scaleY} rot=${st.rotation.toFixed(2)}`);

// ── 用例 2：水平镜像后横向缩放 ────────────────────────────────────────
check('点到了「水平镜像」按钮', await clickMirror('水平镜像'));
st = await readNode();
check('水平镜像已生效（scaleX=-1，scaleY=1）', st.scaleX === -1 && st.scaleY === 1, `scaleX=${st.scaleX} scaleY=${st.scaleY}`);
const W2 = st.w;
const H2 = st.h;
await dragAnchor('.middle-right', DX, 0);
st = await readNode();
check(
  `水平镜像后：右锚点横拖 ${DX}px 宽度 +${DX}（±3）`,
  Math.abs(st.w - W2 - DX) <= 3 && Math.abs(st.h - H2) <= 3,
  `${st.w.toFixed(2)} × ${st.h.toFixed(2)}（原 ${W2.toFixed(2)} × ${H2.toFixed(2)}）`,
);
check(
  '水平镜像后：仍保持水平镜像，未被折叠成垂直镜像/180°旋转',
  st.scaleX === -1 && st.scaleY === 1 && Math.abs(st.rotation) < 0.01,
  `scaleX=${st.scaleX} scaleY=${st.scaleY} rot=${st.rotation.toFixed(2)}`,
);

// ── 用例 3：水平镜像 + 纵向缩放 ───────────────────────────────────────
await dragAnchor('.bottom-center', 0, DX);
st = await readNode();
check(
  `水平镜像后：下锚点纵拖 ${DX}px 高度 +${DX}（±3）`,
  Math.abs(st.h - H2 - DX) <= 3 && Math.abs(st.w - W2 - DX) <= 3,
  `${st.w.toFixed(2)} × ${st.h.toFixed(2)}`,
);
check(
  '水平镜像后纵向缩放：宽高比未被打乱、镜像方向不变',
  st.scaleX === -1 && st.scaleY === 1 && Math.abs(st.rotation) < 0.01,
  `scaleX=${st.scaleX} scaleY=${st.scaleY} rot=${st.rotation.toFixed(2)}`,
);

// ── 用例 4：叠加垂直镜像（双向镜像）后缩放 ────────────────────────────
check('点到了「垂直镜像」按钮', await clickMirror('垂直镜像'));
st = await readNode();
check('双向镜像已生效（scaleX=-1，scaleY=-1）', st.scaleX === -1 && st.scaleY === -1, `scaleX=${st.scaleX} scaleY=${st.scaleY}`);
const W4 = st.w;
const H4 = st.h;
await dragAnchor('.bottom-right', DX, DX);
st = await readNode();
check(
  `双向镜像后：右下角拖 (${DX},${DX}) 宽高各 +${DX}（±3）`,
  Math.abs(st.w - W4 - DX) <= 3 && Math.abs(st.h - H4 - DX) <= 3,
  `${st.w.toFixed(2)} × ${st.h.toFixed(2)}（原 ${W4.toFixed(2)} × ${H4.toFixed(2)}）`,
);
check(
  '双向镜像后：镜像方向保持，未出现朝向突变',
  st.scaleX === -1 && st.scaleY === -1 && Math.abs(st.rotation) < 0.01,
  `scaleX=${st.scaleX} scaleY=${st.scaleY} rot=${st.rotation.toFixed(2)}`,
);

// ── 用例 5：恢复未镜像（再次点击）后缩放仍正常 ─────────────────────────
check('再次点击「水平镜像」可恢复', await clickMirror('水平镜像'));
st = await readNode();
check('已回到仅垂直镜像（scaleX=1，scaleY=-1）', st.scaleX === 1 && st.scaleY === -1, `scaleX=${st.scaleX} scaleY=${st.scaleY}`);
const W5 = st.w;
const H5 = st.h;
await dragAnchor('.middle-right', DX, 0);
st = await readNode();
check(
  `仅垂直镜像：右锚点横拖 ${DX}px 宽度 +${DX}（±3）`,
  Math.abs(st.w - W5 - DX) <= 3 && Math.abs(st.h - H5) <= 3,
  `${st.w.toFixed(2)} × ${st.h.toFixed(2)}（原 ${W5.toFixed(2)} × ${H5.toFixed(2)}）`,
);
check(
  '仅垂直镜像：未被折叠成水平镜像/180°旋转',
  st.scaleX === 1 && st.scaleY === -1 && Math.abs(st.rotation) < 0.01,
  `scaleX=${st.scaleX} scaleY=${st.scaleY} rot=${st.rotation.toFixed(2)}`,
);

// ── 用例 6：带旋转元素的回归保护（Transformer 坐标系改动不能影响旋转对象） ──
const ROT_ID = 'img_rot30';
const readRot = () =>
  page.evaluate((id) => {
    const stage = window.Konva.stages[0];
    const g = stage.findOne('#' + id);
    const inner = g.findOne('Image') || g.findOne('Rect');
    const tr = stage.findOne('Transformer');
    return { w: inner ? inner.width() : null, h: inner ? inner.height() : null, rotation: g.rotation(), trRotation: tr ? tr.rotation() : null, attached: tr && tr.nodes ? tr.nodes().length : 0 };
  }, ROT_ID);
const selRot = await page.evaluate((id) => {
  const stage = window.Konva.stages[0];
  const g = stage.findOne('#' + id);
  const p = g.getAbsolutePosition();
  const r = stage.container().getBoundingClientRect();
  return { x: r.left + p.x, y: r.top + p.y };
}, ROT_ID);
await page.mouse.click(selRot.x, selRot.y);
await page.waitForTimeout(500);
let rot = await readRot();
check('旋转元素（30°）可被选中，Transformer 坐标系统与其一致', rot.attached === 1 && Math.abs(rot.trRotation - rot.rotation) < 0.01, `trRot=${rot.trRotation} nodeRot=${rot.rotation}`);
const RW = rot.w;
const RH = rot.h;
// 沿局部 +X 方向拖动：屏幕位移 = (cos30, sin30) * DX
const localDX = DX * Math.cos((30 * Math.PI) / 180) / ((await page.evaluate(() => window.Konva.stages[0].scaleX())) || 1);
const localDY = DX * Math.sin((30 * Math.PI) / 180) / ((await page.evaluate(() => window.Konva.stages[0].scaleX())) || 1);
await dragAnchor('.middle-right', localDX, localDY);
rot = await readRot();
check(
  `旋转元素（30°）：沿局部 X 方向拖 ${DX}px 宽度 +${DX}（±4）`,
  Math.abs(rot.w - RW - DX) <= 4 && Math.abs(rot.h - RH) <= 4,
  `${rot.w?.toFixed(2)} × ${rot.h?.toFixed(2)}（原 ${RW?.toFixed(2)} × ${RH?.toFixed(2)}）`,
);
check('旋转元素：旋转角未被缩放操作破坏', Math.abs(rot.rotation - 30) < 0.5, `rot=${rot.rotation?.toFixed(2)}`);

check('运行期间无页面异常', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n===== ${results.length - failed.length}/${results.length} PASS =====`);
if (failed.length) {
  console.log('FAILED: ' + failed.map((f) => f.name).join('; '));
  process.exit(1);
}
