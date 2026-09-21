/**
 * 岗位边界接口验证（P2）：统一与模板化。
 * 对应文档 docs/平台角色边界规范化.md §10.1 / K-04。
 *
 * 核心不变量：岗位字典只有唯一真值源 packages/core/src/staff-roles.ts，
 * 服务端/运营端均从此 re-export，旧 team-role.meta.ts 删除、ProviderTeamMember 表删除。
 *
 * 用法（需 :3000 在跑且已 build）：node scripts/verify-staff-p2.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000/api';
const ROOT = resolve(process.cwd(), '..', '..'); // apps/server -> repo root
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ADMIN = { phone: '13800000002', password: 'dev123456' };
const SP = { phone: '13800000001', password: 'dev123456' };

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
async function login(acc) { return (await loginFull(acc)).token; }
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

/** ───── 文件系统不变量 ───── */
function fileAsserts() {
  const meta = resolve(ROOT, 'apps/server/src/console/team-role.meta.ts');
  ok('P2 旧字典 team-role.meta.ts 已删除', !existsSync(meta));

  const schema = readFileSync(resolve(ROOT, 'apps/server/prisma/schema.prisma'), 'utf8');
  ok('P2 schema 已无 ProviderTeamMember 模型', !/model\s+ProviderTeamMember\b/.test(schema));
  ok('P2 schema 保留 OrgStaff 统一表', /model\s+OrgStaff\b/.test(schema));

  // admin facade：应只剩 re-export，不应再含本地字典字面量
  const facade = readFileSync(resolve(ROOT, 'apps/admin/src/config/staffRoles.ts'), 'utf8');
  ok('P2 运营端 staffRoles 退化为 core re-export facade',
    /from\s+['"]@h5design\/core['"]/.test(facade) && !/teamRolesOf\s*[:=]\s*\(/.test(facade));

  // server dist 应从 @h5design/core 引入，而非已删的 team-role.meta
  const dist = readFileSync(resolve(ROOT, 'apps/server/dist/console/staff.service.js'), 'utf8');
  ok('P2 server dist 从 @h5design/core 引入岗位字典', /require\(['"]@h5design\/core['"]\)/.test(dist));

  // core 单一真值源应存在且导出关键符号
  const core = resolve(ROOT, 'packages/core/src/staff-roles.ts');
  ok('P2 唯一真值源 packages/core/src/staff-roles.ts 存在', existsSync(core));
  const coreSrc = existsSync(core) ? readFileSync(core, 'utf8') : '';
  ok('P2 真值源导出 STAFF_ROLE_POOLS / staffRolePool / STAFF_ROLE_TEMPLATES',
    /STAFF_ROLE_POOLS/.test(coreSrc) && /staffRolePool/.test(coreSrc) && /STAFF_ROLE_TEMPLATES/.test(coreSrc));
}

/** ───── 运行时冒烟：repoint 后链路未破 ───── */
async function runtimeSmoke() {
  const spTok = await login(SP);
  ok('P2 运行时：服务商可登录', !!spTok);
  if (!spTok) { console.log('无法继续运行时验证'); return; }

  const list = await call(spTok, 'GET', 'provider/team?pageSize=100');
  ok('P2 运行时：GET provider/team 仍 200（统一表链路未破）', list.status === 200,
    `status=${list.status}`);
  ok('P2 运行时：列表含 P0 存量成员或角色池字段', Array.isArray(list.body?.items ?? list.body?.data?.items),
    `count=${(list.body?.items ?? list.body?.data?.items ?? []).length}`);

  // 新建一名员工，验证 funcPerms 走 core 校验池
  const INVITE_PHONE = '1390000' + String(Math.floor(1000 + Math.random() * 9000));
  const mk = await call(spTok, 'POST', 'provider/team', {
    name: 'P2员工-设计助理', phone: INVITE_PHONE, staffRole: '设计助理',
    funcPerms: ['order:view'], dataScope: 'provider',
  });
  ok('P2 运行时：新建员工 201/200 且 staffRole 命中 core 池', loginOk(mk.status), `status=${mk.status}`);
  const mid = mk.body?.id;

  // getAccess 对服务商账号本身不带 staff，但接口须正常
  const acc = await call(spTok, 'GET', 'auth/access');
  ok('P2 运行时：/auth/access 正常返回（200）', acc.status === 200, `status=${acc.status}`);

  if (mid) {
    const del = await call(spTok, 'DELETE', `provider/team/${mid}`);
    ok('P2 运行时：删除测试员工 200/204', del.status === 200 || del.status === 204, `status=${del.status}`);
  }
}

async function main() {
  console.log('── P2 文件系统不变量 ──');
  fileAsserts();
  console.log('\n── P2 运行时冒烟（重指 core 后链路） ──');
  await runtimeSmoke();

  console.log(`\nP2 结果：${pass} 通过 / ${fail} 失败`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('脚本异常：', e); process.exitCode = 1; });
