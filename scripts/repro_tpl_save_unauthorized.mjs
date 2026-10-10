/**
 * 「模板字段设计 · 新建模板保存失败（Unauthorized）」—— 根因取证 + 修复回归验证。
 *
 * 根因：`TemplateFieldDesignPage` 用**裸 fetch + 手搓 authHeaders()**，绕过了
 * `api/client.ts` 的 `request()` 里那条「401 → refresh token 静默续期 → 重试一次」管线。
 * 于是 access token 过期/失效时，本页保存直接拿到 `401 {"message":"Unauthorized"}`，
 * 页面把服务端原文当业务错误抛给用户；而走 api client 的其它页面会静默续期 ⇒ 「只有这个页面坏」。
 *
 * 本脚本以「网络层」为唯一判据（不看最终值）：
 *   P1 新鲜令牌             → 保存 201，闭环正常
 *   P2 access token 失效     → 断言「先 401(bad token) 再 201(续期后新 token)」的两次 POST
 *                             —— 这就是 authFetch 重试管线生效的直接证据（修复前止步于第一次 401）
 *   P3 续期闭环本身可用      → 用 refresh 换来的新令牌确实能创建模板
 *   P4 两个令牌都失效        → 页面给出「请重新登录」，且**不再暴露原始 Unauthorized**
 *
 * 运行：node scripts/repro_tpl_save_unauthorized.mjs
 * 前置：web :5173 + server :3000 已启动。
 * 修复前基线（已实测记录）：P2 = 单次 POST 401 → 页面错误框 "Unauthorized"（与用户截图一致）。
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';
const BAD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.badsig';

const stamp = Date.now();
let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

/* 记录每次「创建模板」的 POST：状态码 + 携带的是否为失效令牌（判定重试的关键证据） */
let attempts = [];
const watchPosts = (page) => {
  page.on('response', (r) => {
    if (r.url().includes('/api/guest-lists/templates') && r.request().method() === 'POST') {
      const auth = r.request().headers()['authorization'] || '';
      attempts.push({ status: r.status(), usedBadToken: auth.includes('badsig') });
    }
  });
};

async function loginOnPage(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  return page.evaluate(
    async ([api, phone, password]) => {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      localStorage.setItem('access_token', d.accessToken);
      if (d.refreshToken) localStorage.setItem('refresh_token', d.refreshToken);
      if (d.user) localStorage.setItem('user_info', JSON.stringify(d.user));
      return { accessToken: d.accessToken, refreshToken: d.refreshToken };
    },
    [API, PHONE, PASSWORD],
  );
}

async function attemptSave(page, name, { corruptBeforeSave = false, corruptRefresh = false } = {}) {
  await page.goto(`${BASE}/user/invitations/fields`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /新建模板/ }).first().click();
  await page.waitForTimeout(600);

  const nameInput = page.locator('input[placeholder*="婚礼"], input[placeholder*="2026"]').first();
  if (await nameInput.count()) await nameInput.fill(name);

  const addBtn = page.getByRole('button', { name: /新增字段/ }).first();
  // 空态会渲染一行占位 <tr>（无 input），故按「是否有可编辑输入框」判断，而不是按行数
  if ((await page.locator('table tbody tr input').count()) === 0) await addBtn.click();
  await page.waitForTimeout(400);

  await page.locator('table tbody tr').first().locator('input').first().fill(`e2e_${stamp}`);
  await page.locator('table tbody tr').first().locator('input').nth(1).fill('E2E姓名');
  await page.waitForTimeout(200);

  // ★ 关键：在「点击保存」前一刻才污染令牌 —— 避免页面加载期的其它 api 调用先把令牌续好，
  //   从而让「本次 POST 自身是否触发续期重试」可被干净地观测到。
  if (corruptBeforeSave) {
    await page.evaluate(
      ([t, brk]) => {
        localStorage.setItem('access_token', t);
        if (brk) localStorage.setItem('refresh_token', 'broken-refresh-token');
      },
      [BAD_TOKEN, corruptRefresh],
    );
  }
  attempts = [];

  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/api/guest-lists/templates') && r.request().method() === 'POST',
    { timeout: 15000 },
  );
  await page.getByRole('button', { name: /保存配置/ }).first().click();
  const resp = await respPromise;
  let body = '';
  try {
    body = JSON.stringify(await resp.json());
  } catch {
    body = '<non-json>';
  }
  await page.waitForTimeout(1500);
  const pageText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600);
  return {
    status: resp.status(),
    body,
    errBox: await page.locator('text=Unauthorized').count(),
    pageText,
  };
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
watchPosts(page);

console.log('\n=== P1：新鲜令牌（正常登录态）===');
const tokens = await loginOnPage(page);
check('登录成功并写入 localStorage', !!tokens?.accessToken);
attempts = [];
const p1 = await attemptSave(page, `P1模板_${stamp}`);
console.log('   网络证据:', JSON.stringify({ ...p1, body: p1.body.slice(0, 120) }), '| attempts=', JSON.stringify(attempts));
check('P1 POST 返回 201（保存成功）', p1.status === 201, `status=${p1.status} body=${p1.body.slice(0, 140)}`);
check('P1 只发一次 POST（无需续期）', attempts.length === 1, JSON.stringify(attempts));

console.log('\n=== P2：access token 失效，refresh token 仍有效 → 应静默续期并保存成功 ===');
attempts = [];
const p2 = await attemptSave(page, `P2模板_${stamp}`, { corruptBeforeSave: true });
console.log('   网络证据:', JSON.stringify({ status: p2.status, errBox: p2.errBox }), '| attempts=', JSON.stringify(attempts));
check('P2 第 1 次 POST 携带失效令牌 → 401', attempts[0]?.status === 401 && attempts[0]?.usedBadToken === true, JSON.stringify(attempts));
check('P2 第 2 次 POST 携带续期后的新令牌 → 201（重试管线生效）', attempts[1]?.status === 201 && attempts[1]?.usedBadToken === false, JSON.stringify(attempts));
check('P2 保存最终成功（末次 POST 201）', attempts.at(-1)?.status === 201, `首次=${p2.status} 末次=${attempts.at(-1)?.status}`);
check('P2 页面不再出现 Unauthorized 错误框', p2.errBox === 0, `errBox=${p2.errBox}`);
const rotated = await page.evaluate((t) => localStorage.getItem('access_token') !== t, BAD_TOKEN);
check('P2 localStorage 中的 access_token 已被续期写回', rotated);

console.log('\n=== P3：续期闭环本身可用 ===');
const heal = await page.evaluate(
  async ([api, name]) => {
    const rt = localStorage.getItem('refresh_token');
    const r1 = await fetch(`${api}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const d = await r1.json();
    const r2 = await fetch(`${api}/api/guest-lists/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${d.accessToken}` },
      body: JSON.stringify({ name, fields: [{ key: 'guest_name', label: '姓名', type: 'string', required: true, example: '' }] }),
    });
    return { status: r2.status };
  },
  [API, `P3续期后_${stamp}`],
);
check('P3 refresh 换来的新令牌可创建模板', heal.status === 201, JSON.stringify(heal));
const nowToken = await page.evaluate(() => localStorage.getItem('access_token'));
check('P3 与 P1 登录时的原始令牌不同（确实完成了轮换）', nowToken !== tokens.accessToken);

console.log('\n=== P4：两个令牌都失效 → 给「重新登录」提示，不暴露原始 Unauthorized ===');
attempts = [];
const p4 = await attemptSave(page, `P4模板_${stamp}`, { corruptBeforeSave: true, corruptRefresh: true });
const p4Err = (await page.locator('text=登录已失效').count()) > 0;
console.log('   attempts=', JSON.stringify(attempts), '| errBox(Unauthorized)=', p4.errBox, '| 友好提示=', p4Err);
check('P4 会话终结时给出中文可读提示（登录已失效，请重新登录）', p4Err, p4.pageText.slice(0, 200));
check('P4 不再把原始 "Unauthorized" 暴露给用户', p4.errBox === 0, `errBox=${p4.errBox}`);
check('P4 不重试（续期失败即止），仅 1 次 POST', attempts.length === 1, JSON.stringify(attempts));

await browser.close();
console.log(`\n结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
