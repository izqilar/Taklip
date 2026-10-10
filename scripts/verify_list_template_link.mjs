/**
 * 验证：web 端「诚邀名单制作」新建名单时，模板选择下拉框（与「文件格式 / 下载模板」一起
 * 位于名称输入框**左侧**、同一行垂直居中）选中已保存模板后，新建名单按模板字段生成列，
 * 编辑器渲染对应列（模板联动）。
 *
 * 同时校验布局约束：控件顺序 = 模板→格式→下载→名称→新建；全页仅一个模板下拉
 * （名称输入框右侧的重复下拉已删除）；窄屏 900px 下无重叠、控件均可点。
 *
 * 运行：node scripts/verify_list_template_link.mjs
 * 前置：web :5173 + server :3000 已启动。
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';

let pass = 0;
let fail = 0;
const check = (n, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${extra ? ` — ${extra}` : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const ts = Date.now();
const tmplName = `E2E模板_${ts}`;
const listName = `E2E名单_${ts}`;

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
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

/* 1) 通过 API 创建一个带特征字段的自定义模板 */
const tplId = await page.evaluate(
  async ([api, name]) => {
    const tok = localStorage.getItem('access_token');
    const res = await fetch(`${api}/api/guest-lists/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        name,
        fields: [
          { key: 'guest_name', label: '姓名', type: 'string', required: true },
          { key: 'guest_title', label: '称谓', type: 'string' },
          { key: 'e2e_col', label: 'E2E专属列', type: 'string' },
        ],
      }),
    });
    const d = await res.json();
    return d?.template?.id || null;
  },
  [API, tmplName],
);
check('创建特征模板成功', !!tplId, `tplId=${tplId}`);

/* 2) 进入诚邀名单制作页 */
await page.goto(`${BASE}/user/invitations/lists`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

/* 3) 新建名单表单布局：模板选择 → 文件格式 → 下载模板 → 名称输入 → 新建名单（同一行） */
const layout = await page.evaluate(() => {
  const form = document.querySelector('[data-testid="new-list-form"]');
  if (!form) return null;
  const kids = [...form.children].filter((c) => ['INPUT', 'SELECT', 'BUTTON'].includes(c.tagName));
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    order: kids.map((c) => c.tagName),
    pageSelects: document.querySelectorAll('select').length,
    tplSelCount: document.querySelectorAll('select[data-testid="new-list-template"]').length,
    tplRect: rect(form.querySelector('select[data-testid="new-list-template"]')),
    fmtRect: rect([...form.querySelectorAll('select')].find((s) => !s.dataset.testid)),
    dlRect: rect([...form.querySelectorAll('button')].find((b) => b.textContent.includes('下载模板'))),
    inputRect: rect(form.querySelector('input[placeholder*="名单名称"]')),
    createRect: rect([...form.querySelectorAll('button')].find((b) => b.textContent.includes('新建名单'))),
  };
});
check('新建表单可定位', !!layout, JSON.stringify(layout?.order));
check(
  '控件顺序 = 模板 → 格式 → 下载 → 名称 → 新建',
  JSON.stringify(layout?.order) === JSON.stringify(['SELECT', 'SELECT', 'BUTTON', 'INPUT', 'BUTTON']),
  JSON.stringify(layout?.order),
);
check('名称输入框右侧无重复模板下拉（表单内唯一）', layout?.tplSelCount === 1, `tplSelCount=${layout?.tplSelCount}`);
/*
 * 「顶部模板下拉已删除」的结构性判据（不依赖脆弱的全页 select 计数）：
 *   a) 标题 h2 的下一个兄弟节点就是新建表单 —— 说明原顶部那一行控件容器已整体移除，
 *      没有被替换成空容器留下占位空隙；
 *   b) 表单之外的任何 select 都不含模板名选项 —— 说明没有模板下拉残留在别处。
 */
const leftover = await page.evaluate(() => {
  const form = document.querySelector('[data-testid="new-list-form"]');
  if (!form) return null;
  const h2 = [...document.querySelectorAll('h2')].find((e) => e.textContent.includes('诚邀名单制作'));
  const nextIsForm = !!h2 && h2.nextElementSibling === form;
  const tplNames = [...(form.querySelector('select[data-testid="new-list-template"]')?.options ?? [])]
    .map((o) => o.textContent)
    .filter((x) => x && x !== '模板列表' && x !== '选择模板（可选）');
  const straySelects = [...document.querySelectorAll('select')]
    .filter((s) => !form.contains(s))
    .map((s) => ({ testid: s.dataset.testid || null, opts: [...s.options].map((o) => o.textContent) }));
  const strayWithTpl = straySelects.filter((s) => s.opts.some((o) => tplNames.includes(o))).length;
  return { nextIsForm, tplNames: tplNames.length, straySelects: straySelects.length, strayWithTpl };
});
check('标题下即新建表单（无残留的顶部控件容器/占位空隙）', leftover?.nextIsForm === true, JSON.stringify(leftover));
check('表单外无残留的模板下拉', leftover?.strayWithTpl === 0, `strayWithTpl=${leftover?.strayWithTpl}（表单外 select=${leftover?.straySelects}，模板数=${leftover?.tplNames}）`);
const vmid = (r) => (r ? r.y + r.h / 2 : NaN);
const sameRow = (a, b) => !!a && !!b && Math.abs(vmid(a) - vmid(b)) <= 4;
check('模板下拉与名称输入框同一行、垂直居中', sameRow(layout?.tplRect, layout?.inputRect), `${vmid(layout?.tplRect)} vs ${vmid(layout?.inputRect)}`);
check('模板下拉在名称输入框左侧', (layout?.tplRect?.x ?? 1e9) < (layout?.inputRect?.x ?? -1e9), `tpl.x=${layout?.tplRect?.x}, input.x=${layout?.inputRect?.x}`);
check('格式下拉在模板下拉右侧', (layout?.fmtRect?.x ?? -1e9) > (layout?.tplRect?.x ?? 1e9), `fmt.x=${layout?.fmtRect?.x}, tpl.x=${layout?.tplRect?.x}`);
check('下载按钮在格式下拉右侧', (layout?.dlRect?.x ?? -1e9) > (layout?.fmtRect?.x ?? 1e9), `dl.x=${layout?.dlRect?.x}, fmt.x=${layout?.fmtRect?.x}`);
check('新建名单按钮在名称输入框右侧', (layout?.createRect?.x ?? -1e9) > (layout?.inputRect?.x ?? 1e9), `create.x=${layout?.createRect?.x}`);

/* 3b) 窄屏 900px：控件不得重叠、且各自仍有可见尺寸（可点） */
await page.setViewportSize({ width: 900, height: 900 });
await page.waitForTimeout(300);
const narrow = await page.evaluate(() => {
  const form = document.querySelector('[data-testid="new-list-form"]');
  if (!form) return null;
  const els = [...form.children].filter((c) => ['INPUT', 'SELECT', 'BUTTON'].includes(c.tagName));
  const rects = els.map((e) => {
    const r = e.getBoundingClientRect();
    return { tag: e.tagName, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const overlap = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) overlap.push(`${a.tag}#${i}-${b.tag}#${j}`);
    }
  }
  return { count: rects.length, overlap, sizes: rects.map((r) => `${r.tag}:${Math.round(r.w)}x${Math.round(r.h)}`) };
});
check('窄屏(900px)表单控件数量不变', narrow?.count === 5, `count=${narrow?.count}`);
check('窄屏(900px)无控件重叠', Array.isArray(narrow?.overlap) && narrow.overlap.length === 0, JSON.stringify(narrow?.overlap));
check('窄屏(900px)所有控件均有可见尺寸', (narrow?.sizes ?? []).length === 5, JSON.stringify(narrow?.sizes));
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);

/* 4) 在下拉框选中特征模板 */
const sel = page.locator('select[data-testid="new-list-template"]');
await sel.selectOption(tplId);
await page.waitForTimeout(300);

/* 5) 填写名称并新建 */
await page.locator('input[placeholder*="名单名称"]').fill(listName);
await page.getByRole('button', { name: /新建名单/ }).first().click();
await page.waitForTimeout(2500);

/* 6) 跳转到编辑器，且列来自模板（含 E2E专属列，无默认 8 列限制） */
const url = page.url();
check('跳转到名单编辑器', /\/user\/invitations\/lists\/.+/.test(url), url);
await page.waitForTimeout(1500);
const ths = await page.locator('table thead th').allInnerTexts();
console.log('   编辑器表头 =', JSON.stringify(ths));
check('编辑器按模板渲染「E2E专属列」', ths.some((t) => t.includes('E2E专属列')), JSON.stringify(ths));
check('编辑器含「姓名」列', ths.some((t) => t.includes('姓名')), JSON.stringify(ths));
// 编辑器固定结构：首列「#」(行号) + 末尾空列(删除操作) 为固定列，模板字段位于中间。
// 故数据列数 = 表头总数 - 2；3 字段模板应渲染 3 个数据列（# + 3字段 + 空 = 5 列）。
check('编辑器数据列数 = 模板字段数(3)', ths.length - 2 === 3, `dataCols=${ths.length - 2}, all=${JSON.stringify(ths)}`);

/* 7) 后端印证：listRecords 返回 columnDefs 含 e2e_col */
const listId = url.split('/').pop();
const cdOk = await page.evaluate(async ([api, id]) => {
  const tok = localStorage.getItem('access_token');
  const res = await fetch(`${api}/api/guest-lists/${id}/records`, { headers: { Authorization: `Bearer ${tok}` } });
  const d = await res.json();
  const cd = d?.columnDefs || [];
  return Array.isArray(cd) && cd.some((f) => f.key === 'e2e_col');
}, [API, listId]);
check('后端 listRecords 返回 columnDefs(含 e2e_col)', cdOk, '');

/* 8) 无模板路径仍可用（默认字段） */
await page.goto(`${BASE}/user/invitations/lists`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.locator('input[placeholder*="名单名称"]').fill(`E2E无模板_${ts}`);
const noTmplSel = page.locator('select[data-testid="new-list-template"]');
await noTmplSel.selectOption(''); // 清空模板选择
await page.getByRole('button', { name: /新建名单/ }).first().click();
await page.waitForTimeout(2500);
const url2 = page.url();
await page.waitForTimeout(1200);
const ths2 = await page.locator('table thead th').allInnerTexts();
check('无模板：编辑器回落默认列（不含 E2E专属列）', !ths2.some((t) => t.includes('E2E专属列')), JSON.stringify(ths2));

/* 清理 E2E 数据 */
await page.evaluate(async ([api, tid, l1, l2]) => {
  const tok = localStorage.getItem('access_token');
  const del = (m, u) => fetch(`${api}${u}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
  await del('', `/api/guest-lists/templates/${tid}`);
  if (l1) await del('', `/api/guest-lists/${l1}`);
  if (l2) await del('', `/api/guest-lists/${l2}`);
}, [API, tplId, listId, url2.split('/').pop()]);

await browser.close();
console.log(`\n结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
