/**
 * 账户详情「身份认证 / 账号安全」接口冒烟：
 * - dashboard 输出新增字段
 * - 身份证号校验（非法 → 400，合法 → 200 且 realNameStatus 转 PENDING）
 * - 证件影像读写
 * - 手机号占用 → 409 / 合法 → 200
 * - 修改密码：原密码错误 → 400，正确 → 200
 * 用一次性测试账号，跑完自清理。
 */
const BASE = 'http://localhost:3000/api';

function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (res) => {
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { status: res.status, json };
  });
}

/** GB 11643-1999 校验位 */
function validIdCard(base17) {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(base17[i]) * weights[i];
  return base17 + checks[sum % 11];
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
}

(async () => {
  const phone = '13900008888';
  const pwd = 'Test123456';
  const reg = await req('/auth/register', {
    method: 'POST',
    body: { phone, password: pwd, nickname: '冒烟账号安全' },
  });
  check('注册测试账号', reg.status === 201 || reg.status === 200, `status=${reg.status}`);
  const token = reg.json?.accessToken;
  if (!token) {
    console.log('无法取得 token，终止');
    process.exit(1);
  }

  // 1. dashboard 输出新字段
  const dash = await req('/user/dashboard', { token });
  const prof = dash.json?.profile ?? {};
  check(
    'dashboard profile 含身份认证字段',
    'idCard' in prof && 'idCardFront' in prof && 'idCardBack' in prof && 'realNameStatus' in prof,
    `realNameStatus=${prof.realNameStatus}`,
  );

  // 2. 非法身份证号 → 400
  const bad = await req('/auth/me', {
    method: 'PATCH',
    token,
    body: { idCard: '123456789012345678' },
  });
  check('非法身份证号被拒', bad.status === 400, `status=${bad.status} msg=${bad.json?.message}`);

  // 3. 合法身份证号 → 200 且转 PENDING
  const goodId = validIdCard('11010519491231002');
  const ok = await req('/auth/me', { method: 'PATCH', token, body: { idCard: goodId } });
  check('合法身份证号写入', ok.status === 200, `status=${ok.status} id=${ok.json?.idCard}`);
  check('提交后进入待审核', ok.json?.realNameStatus === 'PENDING', `status=${ok.json?.realNameStatus}`);

  // 4. 证件影像写入 + 回读
  const img = await req('/auth/me', {
    method: 'PATCH',
    token,
    body: { idCardFront: '/uploads/smoke-front.png', idCardBack: '/uploads/smoke-back.png' },
  });
  check(
    '证件影像写入',
    img.status === 200 && img.json?.idCardFront === '/uploads/smoke-front.png' && img.json?.idCardBack === '/uploads/smoke-back.png',
    `front=${img.json?.idCardFront} back=${img.json?.idCardBack}`,
  );
  const dash2 = await req('/user/dashboard', { token });
  check(
    'dashboard 回读证件影像',
    dash2.json?.profile?.idCardFront === '/uploads/smoke-front.png',
    `front=${dash2.json?.profile?.idCardFront}`,
  );

  // 5. 手机号占用 → 409
  const dup = await req('/auth/me', { method: 'PATCH', token, body: { phone: '13900001001' } });
  check('手机号占用返回 409', dup.status === 409, `status=${dup.status} msg=${dup.json?.message}`);

  // 6. 合法改号 → 200
  const newPhone = '13900008777';
  const chg = await req('/auth/me', { method: 'PATCH', token, body: { phone: newPhone } });
  check('手机号修改成功', chg.status === 200 && chg.json?.phone === newPhone, `phone=${chg.json?.phone}`);

  // 7. 修改密码：原密码错误 → 400 / 正确 → 200
  const badPwd = await req('/auth/change-password', {
    method: 'POST',
    token,
    body: { oldPassword: 'WrongPass123', newPassword: 'NewTest123456' },
  });
  check('错误原密码被拒', badPwd.status === 400, `status=${badPwd.status} msg=${badPwd.json?.message}`);
  const okPwd = await req('/auth/change-password', {
    method: 'POST',
    token,
    body: { oldPassword: pwd, newPassword: 'NewTest123456' },
  });
  check('正确原密码可改密', okPwd.status === 200 || okPwd.status === 201, `status=${okPwd.status}`);
  const relogin = await req('/auth/login', {
    method: 'POST',
    body: { phone: newPhone, password: 'NewTest123456' },
  });
  check('新密码可登录', relogin.status === 200 || relogin.status === 201, `status=${relogin.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
  process.exit(failed.length ? 1 : 0);
})();
