/**
 * 登录入口多方式登录 + 密码找回 端到端验证（API 层）
 * 覆盖：四种标识登录（phone/email/userId/username）、忘记/重置密码、微信/QQ 扫码轮询（dev-scan）。
 * 用法：node scripts/verify_login_multimethod.mjs
 * 前置：apps/server 已运行于 :3000（新构建），且数据库可连。
 */
const BASE = process.env.API_BASE || 'http://localhost:3000';

let pass = 0;
let fail = 0;
const results = [];
function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    results.push(`  ✅ ${name}`);
  } else {
    fail += 1;
    results.push(`  ❌ ${name} ${detail}`);
  }
}

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function patch(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const run = async () => {
  console.log(`\n=== 登录入口多方式登录 + 密码找回 验证 @ ${BASE} ===\n`);

  // —— 1. 手机号登录（已知 USER 账号）——
  const phoneLogin = await post('/api/auth/login', { type: 'phone', account: '13900001001', password: 'Test123456' });
  check('手机号登录成功 (200 + accessToken)', phoneLogin.status === 200 && !!phoneLogin.json.accessToken, `status=${phoneLogin.status}`);
  check('登录响应含落点 home', !!phoneLogin.json.home);

  // —— 2. 错误凭证统一文案（防枚举）——
  // 注意：密码须 ≥6 字符，否则会先触发 DTO MinLength(6) 校验返回 400，掩盖真实的 401 路径。
  const wrong = await post('/api/auth/login', { type: 'phone', account: '13900001001', password: 'wrongpw' });
  check('错误凭证返回 401', wrong.status === 401, `status=${wrong.status}`);

  // —— 3. 邮箱 / 用户名 / 用户ID 登录：注册测试账号并设置 email + nickname ——
  const ts = Date.now();
  const phone = `139${String(ts).slice(-8)}`;
  const reg = await post('/api/auth/register', { phone, password: 'Verify123', nickname: `vuser_${ts}` });
  check('注册测试账号成功', reg.status === 201 || reg.status === 200, `status=${reg.status}`);
  const regToken = reg.json.accessToken;
  const userId = reg.json.user?.id;

  // 设置 email（PATCH /api/auth/me）
  const setProfile = await patch('/api/auth/me', { email: `v_${ts}@test.com`, nickname: `vuser_${ts}` }, regToken);
  check('设置 email + nickname 成功', setProfile.status === 200, `status=${setProfile.status}`);

  const emailLogin = await post('/api/auth/login', { type: 'email', account: `v_${ts}@test.com`, password: 'Verify123' });
  check('邮箱登录成功', emailLogin.status === 200 && !!emailLogin.json.accessToken, `status=${emailLogin.status}`);

  const usernameLogin = await post('/api/auth/login', { type: 'username', account: `vuser_${ts}`, password: 'Verify123' });
  check('用户名/昵称登录成功', usernameLogin.status === 200 && !!usernameLogin.json.accessToken, `status=${usernameLogin.status}`);

  const userIdLogin = await post('/api/auth/login', { type: 'userId', account: userId, password: 'Verify123' });
  check('用户ID登录成功', userIdLogin.status === 200 && !!userIdLogin.json.accessToken, `status=${userIdLogin.status}`);

  // —— 4. 忘记密码 + 重置密码（D1 模拟送达 → devCode）——
  const forgot = await post('/api/auth/forgot-password', { identifier: phone });
  check('忘记密码返回 200 + 模拟验证码', forgot.status === 200 && !!forgot.json.devCode, `status=${forgot.status}`);
  const devCode = forgot.json.devCode;
  const reset = await post('/api/auth/reset-password', { token: devCode, newPassword: 'Reset1234' });
  check('重置密码成功', reset.status === 200, `status=${reset.status}`);
  const loginAfterReset = await post('/api/auth/login', { type: 'phone', account: phone, password: 'Reset1234' });
  check('用新密码登录成功', loginAfterReset.status === 200, `status=${loginAfterReset.status}`);
  // 旧密码应失效
  const oldPw = await post('/api/auth/login', { type: 'phone', account: phone, password: 'Verify123' });
  check('旧密码已被作废', oldPw.status === 401, `status=${oldPw.status}`);

  // —— 5. 微信扫码登录（dev-scan 模拟全流程）——
  const wxStart = await post('/api/auth/wechat/qr/start', {});
  check('微信扫码发起返回 state', wxStart.status === 200 && !!wxStart.json.state, `status=${wxStart.status}`);
  const wxScan = await post('/api/auth/wechat/qr/dev-scan', { state: wxStart.json.state });
  check('微信 dev-scan 成功', wxScan.json.ok === true, `json=${JSON.stringify(wxScan.json)}`);
  const wxStatus = await (await fetch(BASE + `/api/auth/wechat/qr/status?state=${wxStart.json.state}`)).json();
  check('微信扫码状态 done 且返回令牌', wxStatus.status === 'done' && !!wxStatus.token?.accessToken, `status=${wxStatus.status}`);

  // —— 6. QQ 扫码登录（dev-scan）——
  const qqStart = await post('/api/auth/qq/qr/start', {});
  check('QQ 扫码发起返回 state', qqStart.status === 200 && !!qqStart.json.state, `status=${qqStart.status}`);
  const qqScan = await post('/api/auth/qq/qr/dev-scan', { state: qqStart.json.state });
  check('QQ dev-scan 成功', qqScan.json.ok === true, `json=${JSON.stringify(qqScan.json)}`);
  const qqStatus = await (await fetch(BASE + `/api/auth/qq/qr/status?state=${qqStart.json.state}`)).json();
  check('QQ 扫码状态 done 且返回令牌', qqStatus.status === 'done' && !!qqStatus.token?.accessToken, `status=${qqStatus.status}`);

  console.log(results.join('\n'));
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error('验证脚本异常：', e);
  process.exit(2);
});
