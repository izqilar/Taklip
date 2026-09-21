/**
 * P3 验证：员工操作审计留痕（K-08）。
 *
 * 链路：SP 登录 → 对 /api/provider/team 做 create/update/remove/bind 四个变更；
 * 每个变更应在 AuditLog 落一条记录（action ∈ STAFF_CREATE/UPDATE/REMOVE/BIND），
 * 操作者为 SP（actorRole = SERVICE_PROVIDER）。脚本最后以 ADMIN 身份从
 * /api/admin/audit-logs 读取并断言留痕齐全。
 *
 * 不依赖任何明文令牌，全部用仓库既有测试账号登录。
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';
const SP = { phone: '13800000001', password: 'dev123456' };
const ADMIN = { phone: '13800000002', password: 'dev123456' };
const REGISTERED_USER_PHONE = '13900001001'; // 种子 USER，已注册，可用于 bind 用例

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function req(method, path, { token, body } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
  }
  throw new Error('rate-limited after retries: ' + method + ' ' + path);
}

async function login({ phone, password }) {
  const { status, data } = await req('POST', '/auth/login', { body: { phone, password } });
  if (status !== 201 || !data?.accessToken) throw new Error(`login failed (${status}): ${JSON.stringify(data)}`);
  return data.accessToken;
}

function randPhone() {
  let p = '13';
  for (let i = 0; i < 9; i++) p += Math.floor(Math.random() * 10);
  return p;
}

async function main() {
  console.log('=== P3 员工操作审计留痕验证 ===');
  const spToken = await login(SP);
  const adminToken = await login(ADMIN);

  const baseMember = {
    name: 'P3审计测试员',
    phone: randPhone(),
    staffRole: '客服专员',
    accountStatus: 'ACTIVE',
    dataScope: 'service',
    funcPerms: [],
  };

  // 1) create
  const c = await req('POST', '/provider/team', { token: spToken, body: baseMember });
  if (c.status !== 201) console.log('  [debug] create resp:', c.status, JSON.stringify(c.data).slice(0, 300));
  ok('创建成员返回 201', c.status === 201);
  const idA = c.data?.id;
  ok('返回成员 id', !!idA);

  // 2) update
  const u = await req('PATCH', `/provider/team/${idA}`, { token: spToken, body: { staffRole: '设计助理', accountStatus: 'DISABLED' } });
  ok('更新成员返回 200', u.status === 200);

  // 3) remove
  const r = await req('DELETE', `/provider/team/${idA}`, { token: spToken });
  ok('删除成员返回 200', r.status === 200);

  // 4) bind：新建一个用已注册手机号命名的成员，再绑定
  const b = await req('POST', '/provider/team', { token: spToken, body: { ...baseMember, phone: REGISTERED_USER_PHONE } });
  ok('创建可绑定成员返回 201', b.status === 201);
  const idB = b.data?.id;
  const bind = await req('POST', `/provider/team/${idB}/bind`, { token: spToken });
  ok('绑定账号返回 201', bind.status === 201);
  const rb = await req('DELETE', `/provider/team/${idB}`, { token: spToken });
  ok('清理可绑定成员返回 200', rb.status === 200);

  // ---- ADMIN 侧读取 AuditLog 断言 ----
  const expect = [
    { action: 'STAFF_CREATE', targetId: idA },
    { action: 'STAFF_UPDATE', targetId: idA },
    { action: 'STAFF_REMOVE', targetId: idA },
    { action: 'STAFF_BIND', targetId: idB },
  ];
  for (const e of expect) {
    const q = `/admin/audit-logs?action=${e.action}&targetId=${e.targetId}`;
    const { status, data } = await req('GET', q, { token: adminToken });
    const rows = Array.isArray(data) ? data : (data?.items ?? []);
    const hit = rows.find((x) => x.action === e.action && x.targetId === e.targetId && x.targetType === 'ORG_STAFF');
    ok(`AuditLog 含 ${e.action} 留痕 (actorRole=SERVICE_PROVIDER)`, status === 200 && !!hit && hit.actorRole === 'SERVICE_PROVIDER');
  }

  console.log(`\nP3 结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('运行异常:', e.message); process.exit(1); });
