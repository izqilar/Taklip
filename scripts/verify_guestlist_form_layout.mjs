/**
 * 验证「诚邀名单制作」页新建区布局（双端：web :5173 + admin :5174）。
 *
 * 需求映射：
 *   1) 模板选择 / 文件格式 / 下载模板 移到名单名称输入框**左侧**，按
 *      「模板选择 → 文件格式 → 下载按钮 → 名称输入 → 新建名单」横向排列，
 *      同一行、垂直居中、间距一致（gap = 8）。
 *   2) 名称输入框右侧原有的重复模板下拉已删除：表单内模板下拉唯一，
 *      表单外无残留模板下拉，标题下无残留工具条容器（不留占位空隙）。
 *   3) 交互不变：模板选择联动下载/新建（请求携带 templateId），
 *      下载按钮按所选格式导出（format=xlsx / csv）；常规与窄屏均无重叠、控件可点。
 *
 * 运行：node scripts/verify_guestlist_form_layout.mjs
 * 前置：web :5173、admin :5174、server :3000 已启动（node dist/main）。
 */
import { chromium } from 'playwright';

const WEB = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const ADMIN = process.env.E2E_ADMIN_BASE || 'http://localhost:5174';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';

const GAP = 8;
const FORM = '[data-testid="new-list-form"]';
const TPL_SEL = `${FORM} select[data-testid="new-list-template"]`;

let pass = 0;
let fail = 0;
const check = (n, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${extra ? ` — ${extra}` : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

/** 在页面内量测布局（不依赖任何实现细节，只读 DOM + getBoundingClientRect） */
const layoutProbe = () => {
  const form = document.querySelector('[data-testid="new-list-form"]');
  if (!form) return null;
  const els = [...form.children].filter((c) => ['INPUT', 'SELECT', 'BUTTON'].includes(c.tagName));
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const tpl = form.querySelector('select[data-testid="new-list-template"]');
  const fmt = [...form.querySelectorAll('select')].find((s) => s !== tpl);
  const dl = [...form.querySelectorAll('button')].find((b) => b.textContent.includes('下载模板'));
  const input = form.querySelector('input[placeholder]');
  const create = [...form.querySelectorAll('button')].find((b) => b.textContent.includes('新建名单'));
  // 间距：按 x 排序后相邻元素的水平间隙（同一行时才可比）
  const rects = [rect(tpl), rect(fmt), rect(dl), rect(input), rect(create)];
  const gaps = [];
  for (let i = 0; i + 1 < rects.length; i += 1) {
    if (rects[i] && rects[i + 1]) gaps.push(Math.round(rects[i + 1].x - (rects[i].x + rects[i].w)));
  }
  // 重叠检测：任一控件对都不应有面积重叠
  const overlap = [];
  for (let i = 0; i < els.length; i += 1) {
    for (let j = i + 1; j < els.length; j += 1) {
      const a = els[i].getBoundingClientRect();
      const b = els[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) overlap.push(`${els[i].tagName}#${i}-${els[j].tagName}#${j}`);
    }
  }
  const h2 = [...document.querySelectorAll('h2')].find((e) => e.textContent.includes('诚邀名单制作'));
  const tplNames = [...(tpl?.options ?? [])].map((o) => o.textContent).filter((x) => x && x !== '模板列表' && x !== '选择模板（可选）');
  const stray = [...document.querySelectorAll('select')]
    .filter((s) => !form.contains(s))
    .map((s) => [...s.options].map((o) => o.textContent));
  return {
    order: els.map((c) => c.tagName),
    count: els.length,
    rects,
    gaps,
    overlap,
    sizes: els.map((c) => {
      const r = c.getBoundingClientRect();
      return `${c.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
    tplInForm: form.querySelectorAll('select[data-testid="new-list-template"]').length,
    tplNames: tplNames.length,
    h2NextIsForm: !!h2 && h2.nextElementSibling === form,
    strayWithTpl: stray.filter((opts) => opts.some((o) => tplNames.includes(o))).length,
    tplValue: tpl?.value ?? null,
  };
};

/**
 * 双端共用断言集。
 * @param {string} tag 端名（WEB / ADMIN）
 * @param {import('playwright').Page} page
 * @param {string} label 端的显示名
 */
async function assertLayout(tag, page, label) {
  console.log(`\n—— ${label} ——`);

  /* 需求 1：顺序 + 同行 + 垂直居中 + 间距一致（1440 常规宽度） */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const L = await page.evaluate(layoutProbe);
  check(`${tag} 新建表单可定位`, !!L, JSON.stringify(L?.order));
  if (!L) return;
  check(
    `${tag} 控件顺序 = 模板 → 格式 → 下载 → 名称 → 新建`,
    JSON.stringify(L.order) === JSON.stringify(['SELECT', 'SELECT', 'BUTTON', 'INPUT', 'BUTTON']),
    JSON.stringify(L.order),
  );
  const vmid = (r) => (r ? r.y + r.h / 2 : NaN);
  const mids = L.rects.map(vmid);
  const sameRow = mids.every((m) => Number.isFinite(m) && Math.abs(m - mids[0]) <= 4);
  check(`${tag} 五控件同一行且垂直居中`, sameRow, `mids=${mids.join(',')}`);
  const gapsOk = L.gaps.length === 4 && L.gaps.every((g) => Math.abs(g - GAP) <= 1);
  check(`${tag} 间距一致（gap≈${GAP}）`, gapsOk, `gaps=${L.gaps.join(',')}`);
  const xs = L.rects.map((r) => r?.x ?? NaN);
  check(
    `${tag} 横向次序 模板<格式<下载<名称<新建`,
    xs[0] < xs[1] && xs[1] < xs[2] && xs[2] < xs[3] && xs[3] < xs[4],
    `x=${xs.join(' < ')}`,
  );
  check(`${tag} 模板/格式/下载 均在名称输入框左侧`, xs[0] < xs[3] && xs[2] < xs[3], `dl.x=${xs[2]}, input.x=${xs[3]}`);

  /* 需求 2：重复模板下拉已删除、无残留容器 */
  check(`${tag} 表单内模板下拉唯一（右侧重复下拉已删）`, L.tplInForm === 1, `tplInForm=${L.tplInForm}`);
  check(`${tag} 标题下即新建表单（无残留工具条容器/占位空隙）`, L.h2NextIsForm === true, `h2NextIsForm=${L.h2NextIsForm}`);
  check(`${tag} 表单外无残留模板下拉`, L.strayWithTpl === 0, `strayWithTpl=${L.strayWithTpl}（模板数=${L.tplNames}）`);

  /* 需求 3：模板联动 + 按格式下载（拦截真实请求，证明参数正确） */
  const reqs = [];
  page.on('request', (r) => {
    if (r.url().includes('/guest-lists/template')) reqs.push(r.url());
  });
  const tplSel = page.locator(TPL_SEL);
  const opts = await tplSel.locator('option').evaluateAll((os) =>
    os.map((o) => ({ v: o.value, t: o.textContent })).filter((o) => o.v),
  );
  check(`${tag} 模板下拉有可用模板数据`, opts.length > 0, `模板数=${opts.length}`);
  const pick = opts.find((o) => o.t.includes('婚礼请柬诚邀模板')) || opts[opts.length - 1];
  if (pick) {
    await tplSel.selectOption(pick.v);
    await page.waitForTimeout(250);
    const after = await tplSel.inputValue();
    check(`${tag} 模板选择成功切换（数据联动可用）`, after === pick.v, `value=${after}`);
  }

  const dlBtn = page.getByRole('button', { name: '下载模板' }).first();
  const fmtSel = page.locator(`${FORM} select`).nth(1);
  for (const fmt of ['xlsx', 'csv']) {
    await fmtSel.selectOption(fmt);
    await page.waitForTimeout(150);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
      dlBtn.click(),
    ]);
    await page.waitForTimeout(400);
    const hit = reqs.find((u) => u.includes(`format=${fmt}`));
    const okFmt = !!hit;
    const okTpl = !!hit && (!pick || hit.includes(`templateId=${pick.v}`));
    check(`${tag} 下载模板按所选格式导出（${fmt}）`, okFmt && !!dl, `req=${hit ? hit.split('?')[1] : 'none'}, file=${dl?.suggestedFilename() ?? 'none'}`);
    if (fmt === 'xlsx') check(`${tag} 下载请求携带当前所选 templateId`, okTpl, hit ? hit.split('?')[1] : 'none');
  }

  /* 需求 3：窄屏 900px 无重叠、控件仍有可见尺寸（可点） */
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(400);
  const N = await page.evaluate(layoutProbe);
  check(`${tag} 窄屏(900)控件数量不变`, N?.count === 5, `count=${N?.count}`);
  check(`${tag} 窄屏(900)无控件重叠`, Array.isArray(N?.overlap) && N.overlap.length === 0, JSON.stringify(N?.overlap));
  const clickable = (N?.sizes ?? []).every((s) => {
    const [, wh] = s.split(':');
    const [w, h] = wh.split('x').map(Number);
    return w >= 40 && h >= 24;
  });
  check(`${tag} 窄屏(900)各控件均有可点尺寸`, clickable, JSON.stringify(N?.sizes));

  /* 需求 3：窄屏下下载按钮仍可点击（不被遮挡） */
  const dlNarrow = await page.getByRole('button', { name: '下载模板' }).first().isEnabled();
  check(`${tag} 窄屏(900)下载按钮可用`, dlNarrow === true, `enabled=${dlNarrow}`);

  await page.setViewportSize({ width: 1440, height: 900 });
}

const browser = await chromium.launch({ headless: true });

/* ── web 端 ── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    async ([api, phone, password]) => {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const d = await res.json();
      localStorage.setItem('access_token', d.accessToken);
      localStorage.setItem('refresh_token', d.refreshToken);
      localStorage.setItem('user_info', JSON.stringify(d.user));
    },
    [API, PHONE, PASSWORD],
  );
  await page.goto(`${WEB}/user/invitations/lists`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(FORM, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await assertLayout('WEB', page, 'web 端 :5173 /user/invitations/lists');
  await ctx.close();
}

/* ── admin 端（用户视角）── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input#phone', { timeout: 15000 });
  await page.fill('input#phone', '13800000002');
  await page.fill('input#password', 'dev123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  await page.goto(`${ADMIN}/user/invitations/lists`, { waitUntil: 'networkidle' });
  await page.waitForSelector(FORM, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await assertLayout('ADMIN', page, 'admin 端 :5174 /user/invitations/lists');
  await ctx.close();
}

await browser.close();
console.log(`\n结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
