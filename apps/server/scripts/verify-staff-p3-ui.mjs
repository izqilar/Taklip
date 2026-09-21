// P3 可视化验收：按成员隔离的审计时间线端点（三台 console 共用 StaffService.listAudit）
// 覆盖 PROVIDER 层 /api/provider/team/:id/audit-logs，断言返回该成员的 STAFF_* 留痕。
import { randomInt } from 'node:crypto';

const API = process.env.API_URL || 'http://127.0.0.1:3000/api';
const SP = { phone: '13800000001', password: 'dev123456' };

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randPhone = () => '139' + String(randomInt(0, 99999999)).padStart(8, '0');

async function req(method, path, { token, body } = {}) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep(1500); continue; }
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  return { status: 429, data: null };
}

async function login() {
  const r = await req('POST', '/auth/login', { body: SP });
  if (r.status !== 201 && r.status !== 200) throw new Error('SP 登录失败 ' + r.status + ' ' + JSON.stringify(r.data));
  return r.data.accessToken;
}

(async () => {
  console.log('▶ P3 可视化 · 成员审计时间线端点');
  const token = await login();
  const phone = randPhone();

  const c = await req('POST', '/provider/team', { token, body: { name: 'P3时间线测试员', phone, staffRole: '客服专员', accountStatus: 'ACTIVE', dataScope: 'service', funcPerms: [] } });
  ok('创建成员返回 201', c.status === 201);
  const id = c.data?.id ?? c.data?.data?.id;
  ok('拿到成员 id', !!id);

  const a1 = await req('GET', `/provider/team/${id}/audit-logs`, { token });
  ok('时间线端点 200', a1.status === 200);
  const items1 = a1.data ?? [];
  ok('含 STAFF_CREATE 留痕', items1.some((x) => x.action === 'STAFF_CREATE' && x.targetType === 'ORG_STAFF' && x.targetId === id));
  ok('留痕带操作者角色', items1.some((x) => x.actorRole));

  const u = await req('PATCH', `/provider/team/${id}`, { token, body: { accountStatus: 'DISABLED' } });
  ok('停用成员返回 200/201', u.status === 200 || u.status === 201);

  const a2 = await req('GET', `/provider/team/${id}/audit-logs`, { token });
  const items2 = a2.data ?? [];
  ok('含 STAFF_UPDATE 留痕', items2.some((x) => x.action === 'STAFF_UPDATE'));
  ok('UPDATE 含 before/after 快照', items2.some((x) => x.action === 'STAFF_UPDATE' && x.before && x.after));

  // 清理
  await req('DELETE', `/provider/team/${id}`, { token });
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('运行异常', e); process.exit(2); });
