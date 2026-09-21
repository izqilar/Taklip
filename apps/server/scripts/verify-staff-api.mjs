/**
 * 岗位边界接口验证（P0）：白名单、越权拒绝、自填岗位、三层同构、存量不丢。
 * 对应文档 docs/平台角色边界规范化.md §12.2 的 A-08 ~ A-13。
 *
 * 用法（需 :3000 在跑）：node scripts/verify-staff-api.mjs
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3000/api';

const ADMIN = { phone: '13800000002', password: 'dev123456' };
const SP = { phone: '13800000001', password: 'dev123456' };

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function login(acc) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(acc),
  });
  const j = await r.json();
  return j?.accessToken ?? j?.access_token ?? j?.data?.accessToken;
}

async function call(token, method, path, body) {
  const r = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let j = null;
  try { j = await r.json(); } catch { /* noop */ }
  return { status: r.status, body: j };
}

/** 清理本脚本创建的测试数据（按姓名前缀） */
async function cleanup(token, path, prefix = 'E2E岗') {
  const list = await call(token, 'GET', `${path}?pageSize=100`);
  for (const it of list.body?.items ?? []) {
    if (String(it.name ?? '').startsWith(prefix)) {
      await call(token, 'DELETE', `${path}/${it.id}`);
    }
  }
}

async function main() {
  const adminTok = await login(ADMIN);
  const spTok = await login(SP);
  ok('登录：总台 / 服务商均可获取 token', !!adminTok && !!spTok);
  if (!adminTok || !spTok) { console.log('无法继续'); process.exit(1); }

  /* ───────── 服务商层：岗位池联动（A-01 ~ A-04） ───────── */
  const poolFloral = await call(spTok, 'GET', 'provider/team/role-pool?serviceType=' + encodeURIComponent('花艺布置'));
  const rolesFloral = poolFloral.body?.roles ?? [];
  ok('A-01 花艺布置岗位池 = 负责人/花艺师/布置专员/客服专员 + 通用',
    ['负责人', '花艺师', '布置专员', '客服专员', '店长/调度', '财务专员'].every((r) => rolesFloral.includes(r)),
    JSON.stringify(rolesFloral));

  const poolHost = await call(spTok, 'GET', 'provider/team/role-pool?serviceType=' + encodeURIComponent('司仪主持'));
  ok('A-02 司仪主持岗位池联动为 负责人/司仪/礼仪顾问/客服专员',
    ['负责人', '司仪', '礼仪顾问', '客服专员'].every((r) => (poolHost.body?.roles ?? []).includes(r)),
    JSON.stringify(poolHost.body?.roles));

  const poolFallback = await call(spTok, 'GET', 'provider/team/role-pool?serviceType=' + encodeURIComponent('化妆造型'));
  ok('A-03 未命中服务类型（化妆造型）fallback 非空且含兜底岗位',
    ['负责人', '执行专员', '客服专员'].every((r) => (poolFallback.body?.roles ?? []).includes(r)),
    JSON.stringify(poolFallback.body?.roles));

  const poolAlias = await call(spTok, 'GET', 'provider/team/role-pool?serviceType=' + encodeURIComponent('婚礼策划'));
  ok('A-04 「婚礼策划」经别名命中「婚庆策划」岗位池（含策划师/执行督导）',
    ['策划师', '执行督导'].every((r) => (poolAlias.body?.roles ?? []).includes(r)),
    JSON.stringify(poolAlias.body?.roles));

  /* ───────── 服务商层：越权拒绝（A-09 / A-10） ───────── */
  const badScope = await call(spTok, 'POST', 'provider/team', {
    name: 'E2E岗-非法范围', phone: '13900009001', staffRole: '花艺师', dataScope: 'all',
  });
  ok('A-09 服务商层 dataScope=all → 400', badScope.status === 400, `status=${badScope.status} ${badScope.body?.message ?? ''}`);

  const badPerm = await call(spTok, 'POST', 'provider/team', {
    name: 'E2E岗-越权权限', phone: '13900009002', staffRole: '花艺师', funcPerms: ['user:view'],
  });
  ok('A-10 非白名单 funcPerms=[user:view] → 400', badPerm.status === 400, `status=${badPerm.status} ${badPerm.body?.message ?? ''}`);

  const badWithdraw = await call(spTok, 'POST', 'provider/team', {
    name: 'E2E岗-红线提现', phone: '13900009003', staffRole: '花艺师', funcPerms: ['withdrawal:review'],
  });
  ok('R-02 红线：withdrawal:review 不进服务商执行岗 → 400', badWithdraw.status === 400, `status=${badWithdraw.status}`);

  /* ───────── 自填岗位放行（A-11） ───────── */
  const custom = await call(spTok, 'POST', 'provider/team', {
    name: 'E2E岗-自填岗位', phone: '13900009004', serviceType: '花艺布置',
    staffRole: '首席花艺顾问', duties: ['花艺设计'], funcPerms: ['order:view'],
    dataScope: 'provider', personality: '测试特长',
  });
  ok('A-11 自填岗位「首席花艺顾问」保存成功', custom.status === 201 || custom.status === 200,
    `status=${custom.status} role=${custom.body?.staffRole}`);
  ok('A-08 响应同时带 staffRole 与 teamRole 别名（契约不变）',
    custom.body?.staffRole === '首席花艺顾问' && custom.body?.teamRole === '首席花艺顾问',
    `staffRole=${custom.body?.staffRole} teamRole=${custom.body?.teamRole}`);

  /* ───────── PATCH 停用（原缺失接口） ───────── */
  if (custom.body?.id) {
    const patch = await call(spTok, 'PATCH', `provider/team/${custom.body.id}`, { accountStatus: 'DISABLED' });
    ok('新增 PATCH：停用成员成功', patch.status === 200 && patch.body?.accountStatus === 'DISABLED',
      `status=${patch.status} accountStatus=${patch.body?.accountStatus}`);
    const badPatch = await call(spTok, 'PATCH', `provider/team/${custom.body.id}`, { dataScope: 'all' });
    ok('PATCH 同样校验 dataScope 白名单 → 400', badPatch.status === 400, `status=${badPatch.status}`);
  }

  /* ───────── 存量迁移不丢（A-13） ───────── */
  const spList = await call(spTok, 'GET', 'provider/team?pageSize=100');
  const items = spList.body?.items ?? [];
  const migrated = items.find((i) => i.memberNo === 'MT-1003');
  ok('A-13 存量成员 MT-1003 迁移后仍可见且岗位/权限不丢',
    !!migrated && migrated.staffRole === '负责人' && Array.isArray(migrated.funcPerms) && migrated.funcPerms.length === 8,
    migrated ? `role=${migrated.staffRole} perms=${migrated.funcPerms?.length}` : 'not found');

  /* ───────── 代理商层（A-12） ───────── */
  const agentPool = await call(adminTok, 'GET', 'agent/team/role-pool');
  ok('A-12a 代理商岗位池 = 区域经理/入驻审核员/商务拓展/财务专员/客服专员',
    ['区域经理', '入驻审核员', '商务拓展', '财务专员', '客服专员'].every((r) => (agentPool.body?.roles ?? []).includes(r)),
    JSON.stringify(agentPool.body?.roles));

  const agentCreated = await call(adminTok, 'POST', 'agent/team', {
    name: 'E2E岗-代理商', phone: '13900009005', staffRole: '入驻审核员',
    funcPerms: ['provider:review'], dataScope: 'region',
  });
  ok('A-12b 代理商层可新建成员', agentCreated.status === 201 || agentCreated.status === 200, `status=${agentCreated.status}`);
  const agentBad = await call(adminTok, 'POST', 'agent/team', {
    name: 'E2E岗-代理商越权', phone: '13900009006', staffRole: '入驻审核员', dataScope: 'all',
  });
  ok('A-12c 代理商层 dataScope=all → 400（按层白名单）', agentBad.status === 400, `status=${agentBad.status}`);

  /* ───────── 总台层（A-12） ───────── */
  const consolePool = await call(adminTok, 'GET', 'admin/team/role-pool');
  ok('A-12d 总台岗位池 = 超级管理员/内容运营/审核员/财务/客服·工单',
    ['超级管理员', '内容运营', '审核员', '财务', '客服/工单'].every((r) => (consolePool.body?.roles ?? []).includes(r)),
    JSON.stringify(consolePool.body?.roles));

  const consoleCreated = await call(adminTok, 'POST', 'admin/team', {
    name: 'E2E岗-总台', phone: '13900009007', staffRole: '内容运营',
    funcPerms: ['template:publish', 'announce:publish'], dataScope: 'all',
  });
  ok('A-12e 总台层可新建成员（dataScope=all 合法）', consoleCreated.status === 201 || consoleCreated.status === 200, `status=${consoleCreated.status}`);

  const consoleForbidden = await call(adminTok, 'POST', 'admin/team', {
    name: 'E2E岗-总台红线', phone: '13900009008', staffRole: '内容运营', funcPerms: ['role:manage'],
  });
  ok('R-03 红线：role:manage 不可授予员工 → 400', consoleForbidden.status === 400, `status=${consoleCreated.status}`);

  /* ───────── 跨组织隔离 ───────── */
  const crossList = await call(adminTok, 'GET', 'admin/team?pageSize=100');
  const crossHit = (crossList.body?.items ?? []).some((i) => String(i.name ?? '').startsWith('E2E岗-代理商'));
  ok('跨组织隔离：代理商成员不出现在总台列表', !crossHit);

  /* ───────── 清理 ───────── */
  await cleanup(spTok, 'provider/team');
  await cleanup(adminTok, 'agent/team');
  await cleanup(adminTok, 'admin/team');
  console.log('\n（已清理 E2E岗* 测试数据）');

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('脚本异常：', e); process.exitCode = 1; });
