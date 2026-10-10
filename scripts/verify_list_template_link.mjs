/**
 * 验证：web 端「诚邀名单制作」新建名单时，模板选择下拉框（位于名称输入框与新建名单按钮之间）
 * 选中已保存模板后，新建名单按模板字段生成列，编辑器渲染对应列（模板联动）。
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

/* 3) 新建名单表单：下拉框位于「名称输入框」与「新建名单」按钮之间（DOM 顺序） */
const order = await page.evaluate(() => {
  const form = document.querySelector('[data-testid="new-list-form"]');
  if (!form) return null;
  const kids = [...form.children].filter((c) => ['INPUT', 'SELECT', 'BUTTON'].includes(c.tagName));
  return kids.map((c) => c.tagName);
});
check('新建表单含「模板选择」下拉', Array.isArray(order), JSON.stringify(order));
check(
  '下拉框位于 名称输入框 与 新建名单按钮 之间',
  JSON.stringify(order) === JSON.stringify(['INPUT', 'SELECT', 'BUTTON']),
  JSON.stringify(order),
);

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
