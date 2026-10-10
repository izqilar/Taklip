/**
 * 兄弟页回归：`GuestLists`（诚邀名单制作）与 `GuestListEditor`（名单在线编辑）
 * 与「模板字段设计」共享同一根因缺陷（裸 fetch + 手搓 authHeaders 绕过 401 续期管线），
 * 本轮一并迁移到 `authFetch`。本脚本验证迁移后：
 *   A. 两页正常加载与基本动作可用（新鲜令牌）
 *   B. access token 失效 + refresh 有效 → 动作仍能静默续期成功（401 → 201 两次请求）
 *   C. 页面不再暴露原始 "Unauthorized"
 *
 * 运行：node scripts/verify_guest_pages_auth.mjs
 * 前置：web :5173 + server :3000 已启动。
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';
const BAD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.badsig';

let pass = 0;
let fail = 0;
const check = (n, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${extra ? ` — ${extra}` : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

let attempts = [];
const watch = (page, pathPart, method) => {
  page.on('response', (r) => {
    if (r.url().includes(pathPart) && (!method || r.request().method() === method)) {
      const auth = r.request().headers()['authorization'] || '';
      attempts.push({ url: r.url().split('/api')[1], status: r.status(), usedBadToken: auth.includes('badsig') });
    }
  });
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
watch(page, '/api/guest-lists', null);

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

/* ── A. 诚邀名单制作页：加载 + 新建名单 ── */
console.log('\n=== A. GuestLists（诚邀名单制作）===');
attempts = [];
await page.goto(`${BASE}/user/invitations/lists`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const listText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
check('列表页加载无 Unauthorized', !/Unauthorized/.test(listText), listText.slice(0, 120));
check('GET /api/guest-lists 返回 200', attempts.some((a) => a.url.startsWith('/guest-lists') && a.status === 200), JSON.stringify(attempts.slice(0, 5)));
check('GET /api/guest-lists/templates 返回 200', attempts.some((a) => a.url.startsWith('/guest-lists/templates') && a.status === 200), JSON.stringify(attempts.slice(0, 5)));

/* ── B. 失效令牌下新建名单：应 401 → 续期 → 201 ── */
console.log('\n=== B. 失效令牌下新建名单（应静默续期）===');
attempts = [];
await page.evaluate((t) => localStorage.setItem('access_token', t), BAD_TOKEN);
const nameInput = page.locator('input[placeholder*="名单"]').first();
if (await nameInput.count()) {
  await nameInput.fill(`E2E名单_${Date.now()}`);
  const btn = page.getByRole('button', { name: /新建|创建/ }).first();
  await btn.click();
  await page.waitForTimeout(3000);
  const posts = attempts.filter((a) => a.url === '/guest-lists' && a.status !== undefined);
  console.log('   attempts=', JSON.stringify(posts.slice(0, 4)));
  const first = posts.find((a) => a.usedBadToken);
  const second = posts.find((a) => !a.usedBadToken);
  check('首次 POST 携带失效令牌 → 401', first?.status === 401, JSON.stringify(posts.slice(0, 4)));
  check('续期后重试 → 201', second?.status === 201, JSON.stringify(posts.slice(0, 4)));
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check('页面无 Unauthorized 文案', !/Unauthorized/.test(text), text.slice(0, 120));
} else {
  check('找到「新建名单」输入框', false, '未找到输入框');
}

/* ── C. 名单编辑页：加载 + 单元格编辑（PUT）→ 200 ── */
console.log('\n=== C. GuestListEditor（名单在线编辑）===');
const listId = await page.evaluate(async () => {
  const res = await fetch('/api/guest-lists', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
  const d = await res.json();
  return Array.isArray(d) && d.length ? d[0].id : null;
});
if (listId) {
  attempts = [];
  await page.goto(`${BASE}/user/invitations/lists/${listId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const rec = attempts.find((a) => a.url.includes(`/guest-lists/${listId}/records`));
  check('GET 名单记录返回 200', rec?.status === 200, JSON.stringify(rec ?? attempts.slice(0, 3)));
  const editorText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check('编辑页无 Unauthorized', !/Unauthorized/.test(editorText), editorText.slice(0, 120));

  // 确保至少存在一行真实记录（tmp_ 行只 POST 不 PUT，无法验证续期）
  let rowCount = await page.locator('table tbody tr').count();
  if (rowCount === 0) {
    const addBtn = page.getByRole('button', { name: /新增一行/ }).first();
    if (await addBtn.count()) {
      await addBtn.click();
      await page.waitForTimeout(300);
      const nameCell = page.locator('table tbody tr').first().locator('input').first();
      await nameCell.fill(`E2E宾客_${Date.now() % 100000}`);
      await nameCell.blur(); // 触发 commitNewRow → POST
      await page.waitForTimeout(2500);
      rowCount = await page.locator('table tbody tr').count();
    }
  }
  check('编辑页存在可编辑行', rowCount > 0, `rowCount=${rowCount}`);

  // 失效令牌下编辑单元格 → PUT 应 401 → 续期 → 200
  // PUT url 形如 /guest-lists/{listId}/records/{recordId}；POST 为 .../records（末尾）
  attempts = [];
  await page.evaluate((t) => localStorage.setItem('access_token', t), BAD_TOKEN);
  const cell = page.locator('table tbody tr').first().locator('input').first();
  if (await cell.count()) {
    await cell.fill(`E2E改_${Date.now() % 100000}`);
    await cell.blur();
    await page.waitForTimeout(3500);
    const puts = attempts.filter((a) => /\/records\/[^/?]+$/.test(a.url) && a.status !== undefined);
    console.log('   attempts=', JSON.stringify(puts.slice(0, 4)));
    check(
      '编辑保存：失效令牌 401 后重试成功',
      puts.some((a) => a.usedBadToken && a.status === 401) && puts.some((a) => !a.usedBadToken && a.status < 400),
      JSON.stringify(puts.slice(0, 4)),
    );
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    check('编辑后页面无 Unauthorized 文案', !/Unauthorized/.test(text), text.slice(0, 120));
  } else {
    check('找到可编辑单元格', false, '无单元格');
  }
} else {
  check('取到名单 id', false, '无名单');
}

await browser.close();
console.log(`\n结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
