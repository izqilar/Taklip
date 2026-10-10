/**
 * 模板字段设计 · 「字段 key」输入框焦点稳定性回归验证（真实 Chromium，非 mock）
 *
 * 缺陷（修复前）：<tr key={f.key + i}> —— 行 key 依赖字段内容 f.key。
 *   用户在「字段 key」输入框里每敲一个字符（含退格）都会改变 key，
 *   React 判定「旧行卸载 + 新行挂载」⇒ 该行 <input> 的 DOM 节点被重建 ⇒ 输入即失焦，
 *   无法连续输入 / 连续删除。
 *
 * 本脚本的判定方式（直接对准缺陷机理，而非只看最终值）：
 *   给待测 <input> 打上 data-probe 标记，每次按键后检查
 *   `document.activeElement` 是否仍是「同一个 DOM 节点」（标记仍在 = 节点未被重建）。
 *   —— 修复前：第 1 次按键就会标记丢失（activeElement 变 BODY）；
 *   —— 修复后：连续 N 次按键标记始终在、且值连续累积。
 *
 * 覆盖：
 *   A. 字段 key：连续输入 / 连续删除 / 全选替换 逐键焦点稳定
 *   B. 多行：新增第 2 行后互不干扰
 *   C. 模板名称输入不得清空已填字段行（同区第二个焦点/数据缺陷）
 *   D. 其他列（中文表头）仍可正常连续输入
 *   E. 表单校验与提交逻辑不受影响（名称必填 / key 格式 / 表头必填 / 保存成功回列表）
 *
 * 运行：node scripts/verify_fieldkey_focus.mjs
 * 前置：web :5173 与 server :3000 均已启动；账号 13900001001 / Test123456。
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
};

async function login(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  return page.evaluate(
    async ([api, phone, password]) => {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      const at = d?.accessToken || d?.token;
      if (!at) return false;
      localStorage.setItem('access_token', at);
      if (d?.refreshToken) localStorage.setItem('refresh_token', d.refreshToken);
      if (d?.user) localStorage.setItem('user_info', JSON.stringify(d.user));
      return true;
    },
    [API, PHONE, PASSWORD],
  );
}

/** 给元素打探针（节点被 React 重建后标记即消失 → 可判定「失焦」） */
const tagProbe = (page, handle, tag) =>
  page.evaluate(([el, t]) => el.setAttribute('data-probe', t), [handle, tag]);

/** 读取当前焦点元素所带的探针标记（null = 焦点不在被探针标记的节点上） */
const probeState = (page, tag) =>
  page.evaluate((t) => {
    const a = document.activeElement;
    return { probe: a?.getAttribute?.('data-probe') ?? null, tag: a?.tagName ?? 'NONE', ok: a?.getAttribute?.('data-probe') === t };
  }, tag);

/**
 * 逐键输入并在每次按键后校验焦点仍停留在同一 DOM 节点。
 * 返回首个失焦的键（null = 全程稳定）。
 */
async function typeWithProbe(page, locator, text, tag) {
  const h = await locator.elementHandle();
  await tagProbe(page, h, tag);
  for (const ch of text) {
    await page.keyboard.type(ch);
    const st = await probeState(page, tag);
    if (!st.ok) return { lostAt: ch, state: st };
  }
  return { lostAt: null, state: await probeState(page, tag) };
}

/** 逐次按键（用于退格等）并校验焦点稳定 */
async function pressWithProbe(page, locator, key, times, tag) {
  const h = await locator.elementHandle();
  await tagProbe(page, h, tag);
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(key);
    const st = await probeState(page, tag);
    if (!st.ok) return { lostAt: i + 1, state: st };
  }
  return { lostAt: null, state: await probeState(page, tag) };
}

const rowCount = (page) => page.locator('table tbody tr').count();
const keyInput = (page, i) => page.locator('table tbody tr').nth(i).locator('input').first();
const labelInput = (page, i) => page.locator('table tbody tr').nth(i).locator('input').nth(1);

const main = async () => {
  console.log('=== 模板字段设计 · 「字段 key」焦点稳定性回归 ===');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  check('登录 web 并写入令牌', await login(page));

  /* ── 进入「模板字段设计」列表页 → 新建模板 ── */
  await page.goto(`${BASE}/user/invitations/fields`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /新建模板/ }).first().click();
  await page.waitForTimeout(600);
  const bodyText = await page.locator('body').innerText();
  check('进入「新建模板」页（含模板名称 + 字段设计）', /模板字段设计/.test(bodyText) && /模板名称/.test(bodyText));

  const nameInput = page.getByPlaceholder(/2026|婚礼|诚邀/).first();
  check('「模板名称」输入框可见', await nameInput.isVisible().catch(() => false));

  /* ── 新增字段 → 出现 field_1 行 ── */
  await page.getByRole('button', { name: /新增字段/ }).first().click();
  await page.waitForTimeout(300);
  check('新增字段后出现 1 行', (await rowCount(page)) === 1, `实际 ${await rowCount(page)}`);
  const key0 = keyInput(page, 0);
  check('默认 key = field_1', (await key0.inputValue()) === 'field_1', await key0.inputValue());

  /* ── A1. 字段 key：连续输入（逐键校验焦点节点未重建） ── */
  await key0.click();
  const t1 = await typeWithProbe(page, key0, 'abcd', 'key-0');
  check('A1 字段 key 连续输入 4 字符焦点不丢', t1.lostAt === null, t1.lostAt ? `第「${t1.lostAt}」键后失焦（activeElement=${t1.state.tag}）` : '');
  check('A1 输入值连续累积 = field_1abcd', (await key0.inputValue()) === 'field_1abcd', await key0.inputValue());

  /* ── A2. 字段 key：连续删除 ── */
  const t2 = await pressWithProbe(page, key0, 'Backspace', 4, 'key-0');
  check('A2 字段 key 连续退格 4 次焦点不丢', t2.lostAt === null, t2.lostAt ? `第 ${t2.lostAt} 次退格后失焦（activeElement=${t2.state.tag}）` : '');
  check('A2 删除后回到 field_1', (await key0.inputValue()) === 'field_1', await key0.inputValue());

  /* ── A3. 全选替换（模拟用户整体改写 key） ── */
  await key0.click();
  await page.keyboard.press('ControlOrMeta+A');
  const t3 = await typeWithProbe(page, key0, 'guestNote', 'key-0');
  check('A3 全选后重写 key 焦点不丢', t3.lostAt === null, t3.lostAt ? `第「${t3.lostAt}」键后失焦` : '');
  check('A3 重写值 = guestNote', (await key0.inputValue()) === 'guestNote', await key0.inputValue());

  /* ── A4. 逐键值/焦点快照（诊断输出，便于对比修复前后） ── */
  await page.keyboard.press('ControlOrMeta+A');
  const trace = [];
  const h0 = await key0.elementHandle();
  await tagProbe(page, h0, 'key-0');
  for (const ch of 'abcdef') {
    await page.keyboard.type(ch);
    const st = await probeState(page, 'key-0');
    trace.push(`${ch}:${st.ok ? 'FOCUS' : 'BLUR(' + st.tag + ')'}`);
    if (!st.ok) break;
  }
  console.log('  [逐键焦点轨迹]', trace.join(' '));
  check('A4 逐键轨迹全程 FOCUS（节点未被重建）', trace.every((x) => x.includes('FOCUS')), trace.join(' '));

  /* ── B. 追加第 2 行，两行互不干扰 ── */
  await page.getByRole('button', { name: /新增字段/ }).first().click();
  await page.waitForTimeout(300);
  check('B 新增第 2 行后共 2 行', (await rowCount(page)) === 2, `实际 ${await rowCount(page)}`);
  const key1 = keyInput(page, 1);
  await key1.click();
  const t4 = await typeWithProbe(page, key1, 'x9', 'key-1');
  check('B 第 2 行 key 连续输入焦点不丢', t4.lostAt === null, t4.lostAt ? `第「${t4.lostAt}」键后失焦` : '');
  check('B 第 2 行值 = field_2x9', (await key1.inputValue()) === 'field_2x9', await key1.inputValue());
  check('B 第 1 行值未被连带修改', (await key0.inputValue()) === 'abcdef', await key0.inputValue());

  /* ── C. 模板名称输入不得清空/重挂载字段行（第二个焦点+数据缺陷） ── */
  const rowsBefore = await rowCount(page);
  const key0Before = await key0.inputValue();
  await nameInput.click();
  const t5 = await typeWithProbe(page, nameInput, 'E2E焦点模板', 'name');
  check('C 模板名称连续输入焦点不丢', t5.lostAt === null, t5.lostAt ? `第「${t5.lostAt}」键后失焦` : '');
  const rowsAfter = await rowCount(page);
  check('C 输入模板名称后字段行未被清空', rowsAfter === rowsBefore, `${rowsBefore} → ${rowsAfter}`);
  const key0After = await key0.inputValue({ timeout: 3000 }).catch(() => '(行已消失)');
  check('C 已填字段值保持', key0After === key0Before, key0After);
  check('C 表格未回到「加载中…」', !/加载中/.test(await page.locator('body').innerText()));

  /* ── D. 其他列（中文表头）连续输入 ── */
  const lab0 = labelInput(page, 0);
  await lab0.click();
  const t6 = await typeWithProbe(page, lab0, '姓名备注', 'label-0');
  check('D 中文表头连续输入焦点不丢', t6.lostAt === null, t6.lostAt ? `第「${t6.lostAt}」键后失焦` : '');
  check('D 中文表头值连续累积', (await lab0.inputValue()) === '姓名备注', await lab0.inputValue());

  /* ── E. 校验与提交逻辑不受影响 ── */
  // E1：清空模板名称 → 保存 → 报「请填写模板名称」且不跳转
  await nameInput.click();
  await nameInput.fill('');
  await page.getByRole('button', { name: /保存配置/ }).first().click();
  await page.waitForTimeout(400);
  let txt = await page.locator('body').innerText();
  check('E1 模板名称为空时保存被拦截（提示必填）', /请填写模板名称/.test(txt), txt.slice(0, 120));
  check('E1 未跳转回列表（仍停留在新建页）', /模板字段设计/.test(txt));

  // 填回名称
  await nameInput.click();
  await nameInput.fill('E2E焦点验证模板');
  await page.waitForTimeout(200);

  // E2：非法 key（数字开头）→ 保存 → 报 key 格式错误
  await key0.click();
  await key0.fill('1bad');
  await page.getByRole('button', { name: /保存配置/ }).first().click();
  await page.waitForTimeout(400);
  txt = await page.locator('body').innerText();
  check('E2 非法字段 key 被本地校验拦截', /须以字母开头|重复/.test(txt), txt.slice(0, 140));

  // E3：key 合法但中文表头为空 → 报表头必填
  await key0.fill('e2e_note');
  await lab0.fill('');
  await page.getByRole('button', { name: /保存配置/ }).first().click();
  await page.waitForTimeout(400);
  txt = await page.locator('body').innerText();
  check('E3 中文表头为空被拦截', /中文表头必填/.test(txt), txt.slice(0, 140));

  // E4：补齐后保存成功 → 回列表并可见新模板
  await lab0.fill('E2E备注');
  await labelInput(page, 1).fill('E2E备注2'); // 第 2 行中文表头同样必填，否则校验会（正确地）拦截
  await key1.fill('e2e_note2');
  const tplName = `E2E焦点模板_${Date.now()}`;
  await nameInput.fill(tplName);
  await page.getByRole('button', { name: /保存配置/ }).first().click();
  await page.waitForTimeout(2500);
  txt = await page.locator('body').innerText();
  const backToList = page.url().includes('/user/invitations/fields') && /新建模板/.test(txt);
  check('E4 校验通过后保存成功并返回列表', backToList, page.url());
  if (!backToList) {
    const banner = await page
      .locator('div')
      .filter({ hasText: /必填|重复|须以字母开头|HTTP|失败/ })
      .first()
      .innerText()
      .catch(() => '');
    console.log('  [E4 诊断] 页面提示 =', JSON.stringify(banner.slice(0, 200)));
    console.log('  [E4 诊断] 行数 =', await rowCount(page), ' name =', await nameInput.inputValue().catch(() => '?'));
  }
  check('E4 列表出现新建的模板', txt.includes(tplName), txt.slice(0, 200));

  /* 清理：删除本次创建的模板，避免污染数据 */
  if (txt.includes(tplName)) {
    const del = await page.evaluate(
      async ([api, name]) => {
        const h = { Authorization: `Bearer ${localStorage.getItem('access_token')}` };
        const list = await fetch(`${api}/api/guest-lists/templates`, { headers: h }).then((r) => r.json());
        const arr = Array.isArray(list?.templates) ? list.templates : [];
        const t = arr.find((x) => x.name === name);
        if (!t) return 'not-found';
        const r = await fetch(`${api}/api/guest-lists/templates/${t.id}`, { method: 'DELETE', headers: h });
        return `deleted ${r.status}`;
      },
      [API, tplName],
    );
    console.log('  [清理]', tplName, '→', del);
  }

  /* ── 截图留档 ── */
  mkdirSync('shots', { recursive: true });
  await page.goto(`${BASE}/user/invitations/fields`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /新建模板/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /新增字段/ }).first().click();
  await page.waitForTimeout(200);
  const shotKey = keyInput(page, 0);
  await shotKey.click();
  await page.keyboard.type('guest_name_ok');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'shots/verify_fieldkey_focus.png', fullPage: false }).catch(() => {});
  const shotState = await probeState(page, 'key-0');
  check('截图场景：连续输入后焦点仍在字段 key 输入框', shotState.tag === 'INPUT', `activeElement=${shotState.tag}`);

  await browser.close();
  writeFileSync('shots/verify_fieldkey_focus_result.json', JSON.stringify({ pass, fail, at: new Date().toISOString() }, null, 2));
  console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
};

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
