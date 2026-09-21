/**
 * 岗位边界接口验证（P1）：员工登录打通 + DISABLED 漏洞修复。
 * 对应文档 docs/平台角色边界规范化.md §10.1 / §9 / R-05 / R-06 / K-07。
 *
 * 用法（需 :3000 在跑且已 build）：node scripts/verify-staff-p1.mjs
 * 注意：登录接口有 5/60s 限流，本脚本对登录做 429 重试避让。
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3000/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ADMIN = { phone: '13800000002', password: 'dev123456' };
const SP = { phone: '13800000001', password: 'dev123456' };
const EMP = { phone: '13900001001', password: 'Test123456' }; // 既有 USER 账号，用作「员工」
// 每次运行生成唯一手机号，避免与历史运行残留的注册账号撞 phone @unique
const INVITE_PHONE = '1390000' + String(Math.floor(1000 + Math.random() * 9000));
const INVITE_PW = 'Test123456';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function loginFull(acc) {
  let last;
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc),
    });
    let j = null;
    try { j = await r.json(); } catch { /* noop */ }
    last = { status: r.status, body: j, token: j?.accessToken ?? j?.access_token ?? j?.data?.accessToken };
    if (r.status !== 429) return last;
    await sleep(2500);
  }
  return last;
}
/** 登录，遇限流 429 退避重试 */
async function login(acc) {
  return (await loginFull(acc)).token;
}
async function call(token, method, path, body) {
  const r = await fetch(`${BASE}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let j = null;
  try { j = await r.json(); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const loginOk = (s) => s === 200 || s === 201;
async function register(phone, password) {
  return call(null, 'POST', 'auth/register', { phone, password, nickname: `P1${phone.slice(-4)}` });
}
async function cleanup(token, path, prefix = 'P1') {
  const list = await call(token, 'GET', `${path}?pageSize=100`);
  for (const it of list.body?.items ?? []) {
    if (String(it.name ?? '').startsWith(prefix) || String(it.phone ?? '') === INVITE_PHONE) {
      await call(token, 'DELETE', `${path}/${it.id}`);
    }
  }
}

async function main() {
  const adminTok = await login(ADMIN);
  const spTok = await login(SP);
  ok('登录：总台 / 服务商可获取 token', !!adminTok && !!spTok);
  if (!adminTok || !spTok) { console.log('无法继续'); process.exit(1); }

  /* ───── R-05：DISABLED 用户登录被拒（jwt.strategy 红线修复） ───── */
  const empFull = await loginFull(EMP);
  ok('R-05 前置：EMP 账号当前可登录', loginOk(empFull.status) && !!empFull.token, `status=${empFull.status}`);
  const empId = empFull.body?.user?.id ?? empFull.body?.data?.user?.id;
  if (empId) {
    await call(adminTok, 'POST', `admin/users/${empId}/status`, { status: 'DISABLED' });
    const afterDis = await loginFull(EMP);
    // 限流避让：若仍 429 再等一轮
    let disLogin = afterDis;
    for (let i = 0; i < 6 && disLogin.status === 429; i++) { await sleep(2500); disLogin = await loginFull(EMP); }
    await call(adminTok, 'POST', `admin/users/${empId}/status`, { status: 'ACTIVE' });
    const afterRe = await loginFull(EMP);
    for (let i = 0; i < 6 && afterRe.status === 429; i++) { await sleep(2500); Object.assign(afterRe, await loginFull(EMP)); }
    ok('R-05 DISABLED 用户登录返回 401（漏洞已修）', disLogin.status === 401, `login=${disLogin.status} ${disLogin.body?.message ?? ''}`);
    ok('R-05 重新启用后恢复登录', loginOk(afterRe.status), `login=${afterRe.status}`);
  } else {
    ok('R-05 取 EMP id 失败（跳过）', false, 'empId missing');
  }

  /* ───── 员工登录：邀请绑定已有账号 + JWT 组织上下文 + guard 消费权限 ───── */
  const mk = await call(spTok, 'POST', 'provider/team', {
    name: 'P1员工-花艺师', phone: EMP.phone, staffRole: '花艺师',
    funcPerms: ['order:view'], dataScope: 'provider',
  });
  ok('P1 新建员工（自动绑定已注册账号）→ 201/200 且 userId 非空',
    loginOk(mk.status) && !!mk.body?.userId, `status=${mk.status} userId=${mk.body?.userId}`);
  const memberId = mk.body?.id;

  const empTok2 = await login(EMP);
  const acc = await call(empTok2, 'GET', 'auth/access');
  const staffArr = acc.body?.staff ?? [];
  const prov = staffArr.find((s) => s.orgType === 'PROVIDER');
  ok('P1 员工登录后 /auth/access 含 PROVIDER 成员关系且带 funcPerms',
    !!prov && (prov.funcPerms ?? []).includes('order:view'), JSON.stringify(prov ?? null));

  const getTeam = await call(empTok2, 'GET', 'provider/team?pageSize=100');
  ok('P1 员工凭成员关系可进入「我的团队」(GET 200)', getTeam.status === 200, `status=${getTeam.status}`);

  const empWrite = await call(empTok2, 'POST', 'provider/team', {
    name: 'P1员工-越权新建', phone: '13900009851', staffRole: '花艺师', funcPerms: ['order:view'],
  });
  ok('P1 员工无 team:manage → 写操作 403（R-03 防自提权）', empWrite.status === 403, `status=${empWrite.status}`);

  const empPatch = await call(empTok2, 'PATCH', `provider/team/${memberId}`, { duties: ['x'] });
  ok('P1 员工无 team:manage → PATCH 403', empPatch.status === 403, `status=${empPatch.status}`);

  /* ───── R-06：停用成员关系被剔除（每次请求重算） ───── */
  if (memberId) {
    const disM = await call(spTok, 'PATCH', `provider/team/${memberId}`, { accountStatus: 'DISABLED' });
    const empTok3 = await login(EMP);
    const acc3 = await call(empTok3, 'GET', 'auth/access');
    const stillMember = (acc3.body?.staff ?? []).some((s) => s.orgType === 'PROVIDER');
    const getTeam3 = await call(empTok3, 'GET', 'provider/team?pageSize=100');
    ok('R-06 停用成员关系被剔除 → /auth/access 不含 PROVIDER', disM.status === 200 && !stillMember,
      `patch=${disM.status} stillMember=${stillMember}`);
    ok('R-06 停用后员工不再能进入「我的团队」(403)', getTeam3.status === 403, `status=${getTeam3.status}`);
    await call(spTok, 'PATCH', `provider/team/${memberId}`, { accountStatus: 'ACTIVE' });
  }

  /* ───── K-07：邀请绑定已有账号（先邀请未注册，后注册再 bind） ───── */
  const invite = await call(spTok, 'POST', 'provider/team', {
    name: 'P1邀请-客服', phone: INVITE_PHONE, staffRole: '客服专员', funcPerms: ['order:view'], dataScope: 'provider',
  });
  ok('P1 邀请未注册账号新建员工成功', loginOk(invite.status), `status=${invite.status}`);
  const inviteId = invite.body?.id;
  const bindBefore = inviteId ? await call(spTok, 'POST', `provider/team/${inviteId}/bind`) : { status: 0 };
  ok('P1 邀请未注册 → bind 返回 400（提示先注册）', bindBefore.status === 400, `status=${bindBefore.status}`);

  const reg = await register(INVITE_PHONE, INVITE_PW);
  ok('P1 被邀请账号成功注册', loginOk(reg.status), `status=${reg.status}`);
  const bindAfter = inviteId ? await call(spTok, 'POST', `provider/team/${inviteId}/bind`) : { status: 0 };
  ok('P1 注册后 bind → 200/201 且 userId 绑定', loginOk(bindAfter.status) && !!bindAfter.body?.userId,
    `status=${bindAfter.status} userId=${bindAfter.body?.userId}`);
  const inviteTok = await login({ phone: INVITE_PHONE, password: INVITE_PW });
  const inviteAcc = await call(inviteTok, 'GET', 'auth/access');
  ok('P1 被邀请账号登录即带 PROVIDER 上下文', (inviteAcc.body?.staff ?? []).some((s) => s.orgType === 'PROVIDER'),
    JSON.stringify(inviteAcc.body?.staff ?? []));
  const inviteUserId = reg.body?.user?.id ?? reg.body?.data?.user?.id;

  /* ───── 清理 ───── */
  await cleanup(spTok, 'provider/team');
  // 注册出的测试账号无删除接口，禁用以免遗留可登录账号
  if (inviteUserId) await call(adminTok, 'POST', `admin/users/${inviteUserId}/status`, { status: 'DISABLED' });
  // 双保险：确保 EMP 测试账号恢复启用（R-05 会先禁用再启用，此处兜底）
  if (empId) await call(adminTok, 'POST', `admin/users/${empId}/status`, { status: 'ACTIVE' });
  console.log('\n（已清理 P1* 测试数据）');

  console.log(`\nP1 结果：${pass} 通过 / ${fail} 失败`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('脚本异常：', e); process.exitCode = 1; });
