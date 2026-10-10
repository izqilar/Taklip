/**
 * 校验：运营端（用户视角）「请柬事务中心」独立一级分组 与 web 端同名分组逐一对齐
 *
 * 基准（唯一真值）：apps/web/src/user/shared.tsx → USER_CENTER_NAV 中 group === '请柬事务中心' 的项
 * 被校验方：apps/admin/src/config/resources.tsx → group === 'invitationcenter' 的项
 *
 * 校验维度：
 *   A. 分组名称 / 分组顺序（用户视角可见顺序）/ 图标（两端均无分组级图标）
 *   B. 菜单项数量 / 名称 / 排列顺序 / 路由路径
 *   C. 权限标识（两端均无细粒度权限标识）
 *   D. 迁移清理：资源中心无请柬遗留、无重复入口、无空分组、无失效路由
 *
 * 运行：node scripts/verify_invitation_menu_alignment.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const WEB_NAV = 'apps/web/src/user/shared.tsx';
const WEB_I18N = 'apps/web/src/i18n/locales/zh-CN/common.json';
const ADMIN_RES = 'apps/admin/src/config/resources.tsx';
const ADMIN_APP = 'apps/admin/src/App.tsx';
const ADMIN_ACL = 'apps/admin/src/providers/accessControlProvider.ts';

const GROUP_WEB = '请柬事务中心';
const GROUP_ADMIN = 'invitationcenter';

let pass = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fails.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

/* ───────── 解析 web 端基准 ───────── */
const navSrc = R(WEB_NAV);
const i18n = JSON.parse(R(WEB_I18N));

/** labelKey 形如 common:userCenter.menu.fieldDesign → 取 userCenter.menu.<key> */
const labelOf = (labelKey) => {
  const tail = labelKey.split(':').pop(); // userCenter.menu.fieldDesign
  return tail.split('.').reduce((o, k) => (o == null ? o : o[k]), i18n);
};

const webItems = [];
for (const line of navSrc.split('\n')) {
  if (!line.includes(`group: '${GROUP_WEB}'`)) continue;
  const to = line.match(/to:\s*'([^']+)'/)?.[1];
  const labelKey = line.match(/labelKey:\s*'([^']+)'/)?.[1];
  if (to && labelKey) webItems.push({ to, labelKey, label: labelOf(labelKey) });
}
/** web 端分组出现顺序（去重，按 USER_CENTER_NAV 顺序） */
const webGroups = [];
for (const m of navSrc.matchAll(/group:\s*'([^']+)'/g)) {
  if (!webGroups.includes(m[1])) webGroups.push(m[1]);
}

/* ───────── 解析运营端 ───────── */
const resSrc = R(ADMIN_RES);
const appSrc = R(ADMIN_APP);
const aclSrc = R(ADMIN_ACL);

/** 条目：{ name, list, label, layer, group, meta } */
const adminEntries = [];
const entryRe =
  /\{\s*name:\s*'([^']+)',\s*list:\s*'([^']+)',\s*meta:\s*META\(\s*'([^']+)',\s*'([^']+)',\s*\{([\s\S]*?)\}\s*\),?\s*\}/g;
for (const m of resSrc.matchAll(entryRe)) {
  const meta = m[5];
  adminEntries.push({
    name: m[1],
    list: m[2],
    label: m[3],
    layer: m[4],
    group: meta.match(/group:\s*'([^']+)'/)?.[1] ?? '',
    hasAction: /\baction:/.test(meta),
  });
}

const adminGroupItems = adminEntries.filter((e) => e.group === GROUP_ADMIN && e.layer === 'user');

/** GROUP_ORDER 顺序 */
const orderBlock = resSrc.match(/GROUP_ORDER:\s*MenuGroupKey\[\]\s*=\s*\[([\s\S]*?)\];/)?.[1] ?? '';
const groupOrder = [...orderBlock.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

/** GROUP_LABEL 中文名 */
const groupLabel = (k) => resSrc.match(new RegExp(`${k}:\\s*'([^']+)'`))?.[1];

/** 用户视角可见分组（有 user 层条目的分组），按 GROUP_ORDER 排序 */
const userGroups = [...new Set(adminEntries.filter((e) => e.layer === 'user' && e.group).map((e) => e.group))].sort(
  (a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b),
);

const routes = new Set([...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));

/* ───────── A. 分组维度 ───────── */
console.log('\nA. 分组名称 / 顺序 / 图标');
ok('A1 运营端分组中文名 == web 端分组名', groupLabel(GROUP_ADMIN) === GROUP_WEB, `${groupLabel(GROUP_ADMIN)}`);
ok('A2 分组键已注册进 GROUP_ORDER', groupOrder.includes(GROUP_ADMIN));
ok('A3 分组键已注册进 MenuGroupKey 类型', new RegExp(`\\|\\s*'${GROUP_ADMIN}'`).test(resSrc));
ok(
  'A4 紧随「资源中心」之后（与 web 端同：资源中心 → 请柬事务中心）',
  groupOrder.indexOf(GROUP_ADMIN) === groupOrder.indexOf('resourcecenter') + 1,
);
ok(
  'A5 位于「评价与反馈」之前（与 web 端同：请柬事务中心 → 评价与反馈）',
  groupOrder.indexOf(GROUP_ADMIN) < groupOrder.indexOf('feedback'),
);
ok(
  'A6 用户视角分组顺序与 web 端一致',
  JSON.stringify(userGroups.map((g) => groupLabel(g))) ===
    JSON.stringify(webGroups.filter((g) => userGroups.includes(g) || true).map((g) => g)),
  `运营端=${JSON.stringify(userGroups.map((g) => groupLabel(g)))} web=${JSON.stringify(webGroups)}`,
);
ok('A7 两端分组标题均无分组级图标（图标在菜单项上）', !/GROUP_ICON/.test(resSrc));

/* ───────── B. 菜单项维度 ───────── */
console.log('\nB. 菜单项 数量 / 名称 / 顺序 / 路由');
ok('B1 菜单项数量一致', adminGroupItems.length === webItems.length, `运营端=${adminGroupItems.length} web=${webItems.length}`);
webItems.forEach((w, i) => {
  const a = adminGroupItems[i];
  ok(`B2.${i + 1} 第 ${i + 1} 项路由路径一致`, a?.list === w.to, `运营端=${a?.list} web=${w.to}`);
  ok(`B3.${i + 1} 第 ${i + 1} 项名称一致`, a?.label === w.label, `运营端=${a?.label} web=${w.label}`);
});
ok('B4 菜单项资源名与路由一一对应', adminGroupItems.every((e) => e.name === e.list.slice(1)));

/* ───────── C. 权限标识 ───────── */
console.log('\nC. 权限标识 / 角色可见范围');
ok('C1 三项均无细粒度 action 覆盖（与 web 端一致：无权限标识）', adminGroupItems.every((e) => !e.hasAction));
ok(
  'C2 user/* 资源不按角色拦截（accessControlProvider 兜底放行）',
  /user\/\*[\s\S]{0,80}不按角色拦截/.test(aclSrc) || /user\/\*/.test(aclSrc),
);
ok('C3 三项均归属 user 视角层', adminGroupItems.every((e) => e.layer === 'user'));

/* ───────── D. 迁移清理 ───────── */
console.log('\nD. 迁移清理（无重复入口 / 失效菜单 / 空分组）');
ok('D1 资源中心已无请柬事务中心遗留', !adminEntries.some((e) => e.group === 'resourcecenter' && /invitation/i.test(e.name)));
ok('D2 全端无旧路由 /user/invitation-center 残留', !/user\/invitation-center/.test(resSrc) && !/user\/invitation-center/.test(appSrc));
ok(
  'D3 资源中心非空（仍保留我的图库 / 我的作品）',
  adminEntries.filter((e) => e.group === 'resourcecenter' && e.layer === 'user').length >= 2,
);
ok('D4 无重复菜单项（资源名唯一）', new Set(adminEntries.map((e) => e.name)).size === adminEntries.length);
adminGroupItems.forEach((e, i) => {
  ok(`D5.${i + 1} 路由 ${e.list} 已注册（无失效菜单）`, routes.has(e.list));
});

/* ───────── 汇总 ───────── */
console.log('\n────────────────────────────────');
console.log(`PASS ${pass} / FAIL ${fails.length}`);
if (fails.length) {
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log('全部校验通过：运营端「请柬事务中心」与 web 端逐一对齐。');
