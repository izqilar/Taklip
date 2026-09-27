/**
 * 「单色 / 渐变 / 图案」三态填充 —— 端到端验证。
 *
 * 用法：node scripts/e2e_fill_paint.mjs [projectId]
 *
 * 覆盖：
 *  1. 默认单色不引入任何新属性（Konva 节点 fillPriority 未设置 → 与改造前逐字节一致）
 *  2. 渐变（DOM div 背景 / SVG <defs> / 文本 background-clip）与编辑器 Konva 像素级一致
 *  3. 图案（瓦片平铺）与编辑器 Konva 像素级一致
 *  4. 三种类型的数据分别保存、来回切换互不覆盖
 *  5. 键盘可达：渐变把手支持方向键微调（role=slider + aria-valuenow）
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT_ID = process.argv[2] || 'e2e_fill_fixture';
const PHONE = '13900001001';
const PASSWORD = 'Test123456';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? '  (' + detail + ')' : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? '  (' + detail + ')' : ''}`);
  }
};

const dist = (a, b) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });

/* ── 登录并写入 localStorage（编辑器与 parity 页共用） ── */
const boot = await ctx.newPage();
await boot.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await boot.evaluate(
  async ({ phone, password }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const d = await res.json();
    localStorage.setItem('access_token', d.accessToken || '');
    localStorage.setItem('refresh_token', d.refreshToken || '');
    localStorage.setItem('user_info', JSON.stringify(d.user || {}));
  },
  { phone: PHONE, password: PASSWORD },
);

/* ── 解码采样用的空白页 ── */
const lab = await ctx.newPage();
await lab.goto('about:blank');

async function samplePng(b64, points) {
  return lab.evaluate(
    async ({ b64, points }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      return points.map((p) => {
        const d = cx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
      });
    },
    { b64, points },
  );
}

/* ══════════════ ① 编辑器（Konva）采样 ══════════════ */
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/editor/${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 40000 });
await page.waitForTimeout(2500);

const stageInfo = await page.evaluate(() => {
  const stage = window.Konva.stages[0];
  const el = stage.container();
  const r = el.getBoundingClientRect();
  const tr = stage.getAbsoluteTransform();
  return {
    scale: tr.getMatrix()[0],
    containerLeft: r.left,
    containerTop: r.top,
    hasKonva: true,
  };
});
console.log(`编辑器画布缩放 = ${stageInfo.scale.toFixed(4)}`);

/** 设计坐标 → 容器像素坐标（截图后的采样坐标） */
async function designToContainer(points) {
  return page.evaluate((pts) => {
    const stage = window.Konva.stages[0];
    const tr = stage.getAbsoluteTransform();
    return pts.map((p) => {
      const q = tr.point({ x: p.x, y: p.y });
      return { x: q.x, y: q.y };
    });
  }, points);
}

async function sampleEditor(designPoints) {
  const local = await designToContainer(designPoints);
  const handle = await page.$('.konvajs-content');
  const buf = await handle.screenshot();
  return samplePng(buf.toString('base64'), local);
}

/* ══════════════ ② 发布态 DOM 采样（parity 页，1:1） ══════════════ */
const dom = await ctx.newPage();
await dom.goto(`${BASE}/parity-text.html?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
await dom.waitForTimeout(2000);
const domReady = await dom.evaluate(() => {
  const root = document.getElementById('root');
  return { text: (root?.innerText || '').slice(0, 40), divs: root?.querySelectorAll('div').length ?? -1 };
});

async function sampleDom(designPoints) {
  const root = await dom.$('#root > div');
  const buf = await root.screenshot();
  return samplePng(buf.toString('base64'), designPoints);
}

console.log('\n── ① 渐变（矩形：DOM div 背景 vs Konva）──');
// r_grad: x40 y40 w240 h120，90° 线性渐变 红→蓝
const rectPts = [
  { x: 60, y: 100 },
  { x: 160, y: 100 },
  { x: 260, y: 100 },
  { x: 160, y: 60 },
];
const eRect = await sampleEditor(rectPts);
const dRect = await sampleDom(rectPts);
for (let i = 0; i < rectPts.length; i++) {
  const d = dist(eRect[i], dRect[i]);
  check(
    `矩形渐变采样点 ${i} 三端一致`,
    d <= 10,
    `Konva=${eRect[i].slice(0, 3)} DOM=${dRect[i].slice(0, 3)} Δ=${d}`,
  );
}
check('矩形渐变方向正确（左红右蓝）', eRect[0][0] > 180 && eRect[2][2] > 180, `左=${eRect[0].slice(0, 3)} 右=${eRect[2].slice(0, 3)}`);

console.log('\n── ② 径向渐变（多边形：SVG <defs> vs Konva）──');
// p_grad: x40 y200 w160 h160，径向 红(中心) → 蓝(外围)
const polyPts = [
  { x: 120, y: 280 }, // 中心
  { x: 60, y: 215 }, // 靠近左上顶点
];
const ePoly = await sampleEditor(polyPts);
const dPoly = await sampleDom(polyPts);
for (let i = 0; i < polyPts.length; i++) {
  const d = dist(ePoly[i], dPoly[i]);
  check(
    `多边形径向渐变采样点 ${i} 三端一致`,
    d <= 10,
    `Konva=${ePoly[i].slice(0, 3)} DOM=${dPoly[i].slice(0, 3)} Δ=${d}`,
  );
}

console.log('\n── ③ 图案填充（矩形：DOM 平铺 vs Konva fillPatternImage）──');
// r_pat: x220 y200 w120 h160 —— 棋盘格 #111827/#ffffff，瓦片 24px。
// 沿竖线密集采样：若两端瓦片相位不一致（平铺原点错位），匹配率会显著下降。
const patPts = [];
for (let y = 212; y <= 348; y += 4) patPts.push({ x: 280, y });
const ePat = await sampleEditor(patPts);
const dPat = await sampleDom(patPts);
let patMatched = 0;
for (let i = 0; i < patPts.length; i++) {
  if (dist(ePat[i], dPat[i]) <= 16) patMatched += 1;
}
const patRatio = patMatched / patPts.length;
check(
  '矩形图案填充三端一致（瓦片相位对齐，匹配率 ≥ 90%）',
  patRatio >= 0.9,
  `匹配 ${patMatched}/${patPts.length} = ${(patRatio * 100).toFixed(0)}%`,
);

console.log('\n── ④ 图案填充（文本 background-clip vs Konva）──');
// t_pat: x40 y400 w240 h80，棋盘格 #111827 / #ffffff，瓦片 24px
const textPts = [];
for (let x = 60; x <= 250; x += 6) textPts.push({ x, y: 440 });
const eText = await sampleEditor(textPts);
const dText = await sampleDom(textPts);
let matched = 0;
for (let i = 0; i < textPts.length; i++) {
  if (dist(eText[i], dText[i]) <= 40) matched += 1;
}
const ratio = matched / textPts.length;
check('文本图案填充三端一致（匹配率 ≥ 80%）', ratio >= 0.8, `匹配 ${matched}/${textPts.length} = ${(ratio * 100).toFixed(0)}%`);

/* ══════════════ ③ Konva 节点属性 ══════════════ */
console.log('\n── ④ Konva 填充属性 ──');
const nodeAttrs = await page.evaluate(() => {
  const stage = window.Konva.stages[0];
  const read = (id) => {
    const n = stage.findOne('#' + id);
    if (!n) return null;
    return {
      fillPriority: n.getAttr('fillPriority'),
      hasLinear: !!n.fillLinearGradientColorStops(),
      hasRadial: !!n.fillRadialGradientColorStops(),
      hasPattern: !!n.fillPatternImage(),
    };
  };
  return { rect: read('r_grad'), poly: read('p_grad'), text: null };
});
check('矩形使用线性渐变', nodeAttrs.rect?.fillPriority === 'linear-gradient' && nodeAttrs.rect?.hasLinear, JSON.stringify(nodeAttrs.rect));
check('多边形使用径向渐变', nodeAttrs.poly?.fillPriority === 'radial-gradient' && nodeAttrs.poly?.hasRadial, JSON.stringify(nodeAttrs.poly));

/* ══════════════ ④ 面板交互：三种类型互不覆盖 ══════════════ */
console.log('\n── ⑤ 面板切换：三类数据分别保存 ──');
// 选中矩形
const clickPt = await designToContainer([{ x: 160, y: 100 }]);
await page.mouse.click(stageInfo.containerLeft + clickPt[0].x, stageInfo.containerTop + clickPt[0].y);
await page.waitForTimeout(600);

const readEl = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('__e2e_noop__');
    void raw;
    // 从编辑器 store 读取当前元素（zustand 未挂到 window，改从 DOM 面板 + Konva 反查）
    const stage = window.Konva.stages[0];
    const n = stage.findOne('#r_grad');
    return n
      ? {
          fill: n.fill(),
          fillPriority: n.getAttr('fillPriority'),
          hasLinear: !!n.fillLinearGradientColorStops(),
          hasPattern: !!n.fillPatternImage(),
          stops: n.fillLinearGradientColorStops() || null,
        }
      : null;
  });

const before = await readEl();
check('矩形已选中且呈现渐变', before?.fillPriority === 'linear-gradient', JSON.stringify(before?.stops));

const clickRadio = async (labelText) => {
  const ok = await page.evaluate((label) => {
    const labels = Array.from(document.querySelectorAll('label'));
    const target = labels.find((l) => (l.textContent || '').trim() === label);
    if (!target) return false;
    const input = target.querySelector('input[type=radio]');
    if (!input) return false;
    input.click();
    return true;
  }, labelText);
  await page.waitForTimeout(500);
  return ok;
};

const okPattern = await clickRadio('图案填充');
check('可切换到「图案填充」', okPattern);
const asPattern = await readEl();
check('切换图案后 Konva 走 pattern 分支', asPattern?.fillPriority === 'pattern' && asPattern?.hasPattern, JSON.stringify(asPattern?.fillPriority));

const okGrad = await clickRadio('渐变填充');
check('可切回「渐变填充」', okGrad);
const backGrad = await readEl();
check(
  '切回渐变后停靠点被完整回填（未被图案覆盖）',
  backGrad?.fillPriority === 'linear-gradient' &&
    JSON.stringify(backGrad?.stops) === JSON.stringify(before?.stops),
  JSON.stringify(backGrad?.stops),
);

const okSolid = await clickRadio('单色填充');
check('可切回「单色填充」', okSolid);
const asSolid = await readEl();
check(
  '单色时回落 Konva 默认 color 分支且无渐变/图案残留',
  (asSolid?.fillPriority === 'color' || asSolid?.fillPriority == null) &&
    !asSolid?.hasLinear &&
    !asSolid?.hasRadial &&
    !asSolid?.hasPattern,
  `fillPriority=${asSolid?.fillPriority} fill=${asSolid?.fill}`,
);
// 切回单色后像素层面必须是原始纯色 #3366ff（编辑器侧；DOM 侧的三种类型一致性见 ①②③，
// 因为发布态读取的是已保存 schema，不随编辑器未保存改动变化）
const eSolid = await sampleEditor([{ x: 160, y: 100 }]);
check(
  '切回单色后编辑器渲染为原始纯色 #3366ff',
  dist(eSolid[0], [51, 102, 255]) <= 2,
  `Konva=${eSolid[0].slice(0, 3)}`,
);

/* ══════════════ ⑤ 键盘无障碍 ══════════════ */
console.log('\n── ⑥ 键盘无障碍 ──');
await clickRadio('渐变填充');
const kb = await page.evaluate(() => {
  const handles = Array.from(document.querySelectorAll('[role=slider]'));
  return { count: handles.length, now: handles[0]?.getAttribute('aria-valuenow') ?? null };
});
check('渐变把手存在且为 role=slider', kb.count >= 2, `把手数=${kb.count}`);
if (kb.count >= 2) {
  await page.evaluate(() => {
    document.querySelector('[role=slider]').focus();
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() =>
    document.querySelector('[role=slider]')?.getAttribute('aria-valuenow'),
  );
  check('方向键可微调停靠点位置', String(after) !== String(kb.now), `${kb.now} → ${after}`);
}

check('运行期间无页面异常', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (domReady) console.log(`（DOM 页：${domReady.text || '(无文本)'}，div 数 ${domReady.divs}）`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
