/**
 * 组织内员工「岗位（StaffRole）」字典 —— 服务端镜像。
 *
 * 真值源：`UI_Design/index.html:4691` 的 `TEAM_SVC_META` 与 `TEAM_FUNCS`。
 * 前端镜像：`apps/admin/src/config/staffRoles.ts`。
 * ⚠️ 两侧必须同步修改（P2 抽到 packages/core 收敛为单一真值源）。
 *
 * 用途：
 *  1. 校验提交的 `staffRole` 是否属于内置岗位池（非内置则记为「自定义岗位」，放行但可审计）
 *  2. 校验 `dataScope` 是否在该层的白名单内（此前无任何校验，见文档 §2.1）
 *  3. 校验 `funcPerms` 是否在该层可分配权限池内（拒绝越权分配，红线 R-01/R-02/R-03）
 *
 * 关联文档：`docs/平台角色边界规范化.md`
 */

export type OrgType = 'PROVIDER' | 'AGENT' | 'CONSOLE';

export const ORG_TYPES: OrgType[] = ['PROVIDER', 'AGENT', 'CONSOLE'];

export function isOrgType(v: unknown): v is OrgType {
  return typeof v === 'string' && (ORG_TYPES as string[]).includes(v);
}

/* ══════════════════ 服务商层：服务类型 → 岗位池 / 职责池 / 特长 ══════════════════ */

export interface SvcMeta {
  roles: string[];
  duties: string[];
  trait: string;
}

/** 抄自原型 `UI_Design/index.html:4691` */
export const TEAM_SVC_META: Record<string, SvcMeta> = {
  特约设计: {
    roles: ['负责人', '设计助理', '客服专员', '文案策划'],
    duties: ['内容策划', '视觉设计', '模板创作', '客户沟通', '订单管理', '交付履约', '售后处理'],
    trait: '擅长电子请柬与 H5 视觉，负责模板与服务的创意输出与交付。',
  },
  婚庆策划: {
    roles: ['负责人', '策划师', '客服专员', '执行督导'],
    duties: ['方案策划', '流程设计', '客户沟通', '供应商统筹', '现场执行', '订单管理'],
    trait: '擅长婚礼主题策划与流程设计，统筹现场执行全链路。',
  },
  摄影摄像: {
    roles: ['负责人', '摄影师', '后期师', '客服专员'],
    duties: ['拍摄执行', '后期制作', '场景设计', '客户沟通', '作品交付', '订单管理'],
    trait: '擅长纪实与唯美风格拍摄，负责作品后期精修与交付。',
  },
  花艺布置: {
    roles: ['负责人', '花艺师', '布置专员', '客服专员'],
    duties: ['花艺设计', '现场布置', '物料统筹', '客户沟通', '验收维护', '订单管理'],
    trait: '擅长婚礼与宴会花艺设计，负责现场布置与验收维护。',
  },
  司仪主持: {
    roles: ['负责人', '司仪', '礼仪顾问', '客服专员'],
    duties: ['主持控场', '流程彩排', '台词创作', '客户沟通', '现场互动', '订单管理'],
    trait: '擅长仪式流程把控与现场互动，负责彩排与主持。',
  },
  灯光音响: {
    roles: ['负责人', '灯光师', '音响师', '客服专员'],
    duties: ['灯光设计', '音响调试', '设备管理', '现场执行', '客户沟通', '订单管理'],
    trait: '擅长舞台灯光与音响系统，负责设备调试与现场保障。',
  },
};

/** 代码侧服务类型名 → 原型键名的别名（SVC_OPTIONS 「婚礼策划」 对应原型「婚庆策划」） */
const SVC_ALIAS: Record<string, string> = { 婚礼策划: '婚庆策划' };

export const TEAM_DEFAULT_ROLES = ['负责人', '执行专员', '客服专员'];
export const TEAM_DEFAULT_DUTIES = ['客户沟通', '订单管理', '交付履约', '售后处理'];
export const TEAM_DEFAULT_TRAIT = '负责本服务类型的客户沟通、订单管理与交付履约。';

/** 服务商层通用追加岗位（所有服务类型都可选） */
export const PROVIDER_COMMON_ROLES = ['店长/调度', '财务专员'];

const svcKey = (svc?: string | null): string | undefined => {
  if (!svc) return undefined;
  const raw = String(svc).trim();
  return SVC_ALIAS[raw] ?? raw;
};

export function teamRolesOf(svc?: string | null): string[] {
  const meta = TEAM_SVC_META[svcKey(svc) ?? ''];
  const base = meta ? meta.roles : TEAM_DEFAULT_ROLES;
  return Array.from(new Set([...base, ...PROVIDER_COMMON_ROLES]));
}

export function teamDutiesOf(svc?: string | null): string[] {
  return TEAM_SVC_META[svcKey(svc) ?? '']?.duties ?? TEAM_DEFAULT_DUTIES;
}

export function teamTraitOf(svc?: string | null): string {
  return TEAM_SVC_META[svcKey(svc) ?? '']?.trait ?? TEAM_DEFAULT_TRAIT;
}

/* ══════════════════ 功能权限池（须先于岗位池声明：PROVIDER_ROLE_META 初始化即引用） ══════════════════ */

/** 服务商层可分配权限（对齐原型 TEAM_FUNCS 8 项） */
export const TEAM_PERM_KEYS = [
  'order:view',
  'order:handle',
  'order:aftersale',
  'message:send',
  'template:publish',
  'content:offline',
  'data:export',
  'qualification:manage',
] as const;

/* ══════════════════ 代理商 / 总台岗位池 ══════════════════ */

export interface StaffRoleMeta {
  duties: string[];
  perms: string[];
  dataScope: string;
}

export const AGENT_ROLE_META: Record<string, StaffRoleMeta> = {
  区域经理: { duties: ['辖区经营统筹', '服务商拓展', '业绩负责'], perms: AGENT_LAYER_PERMS(), dataScope: 'agent' },
  入驻审核员: { duties: ['服务商入驻资质审核'], perms: ['provider:review', 'provider:qualification'], dataScope: 'region' },
  商务拓展: { duties: ['招商', '服务商拜访', '线索跟进'], perms: ['user:view', 'provider:review'], dataScope: 'region' },
  财务专员: { duties: ['分润对账', '提现发起'], perms: ['finance:view', 'finance:reconcile'], dataScope: 'agent' },
  客服专员: { duties: ['工单处理', '反馈跟进'], perms: ['feedback:handle', 'message:send'], dataScope: 'self' },
};

export const CONSOLE_ROLE_META: Record<string, StaffRoleMeta> = {
  超级管理员: { duties: ['全平台配置', '角色与区域管理'], perms: CONSOLE_LAYER_PERMS(), dataScope: 'all' },
  内容运营: { duties: ['模板运营', '公告运营'], perms: ['template:publish', 'template:review', 'announce:publish', 'announce:review'], dataScope: 'all' },
  审核员: { duties: ['模板审核', '资质审核', '入驻审核'], perms: ['template:review', 'qualification:manage', 'provider:review'], dataScope: 'all' },
  财务: { duties: ['提现审核', '平台对账'], perms: ['finance:view', 'withdrawal:review', 'finance:reconcile'], dataScope: 'all' },
  '客服/工单': { duties: ['反馈处理', '申诉仲裁'], perms: ['feedback:handle', 'appeal:arbitrate', 'message:send'], dataScope: 'self' },
};

export const PROVIDER_ROLE_META: Record<string, { perms: string[]; dataScope: string }> = {
  负责人: { perms: [...TEAM_PERM_KEYS], dataScope: 'provider' },
  '店长/调度': { perms: ['order:view', 'order:handle', 'order:aftersale', 'message:send', 'data:export'], dataScope: 'provider' },
  客服专员: { perms: ['order:view', 'order:aftersale', 'message:send'], dataScope: 'service' },
  财务专员: { perms: ['order:view', 'data:export'], dataScope: 'provider' },
  文案策划: { perms: ['order:view', 'template:publish', 'content:offline'], dataScope: 'service' },
  设计助理: { perms: ['order:view', 'template:publish'], dataScope: 'self' },
  策划师: { perms: ['order:view', 'order:handle'], dataScope: 'service' },
  执行督导: { perms: ['order:view', 'order:handle'], dataScope: 'provider' },
  执行专员: { perms: ['order:view'], dataScope: 'self' },
  摄影师: { perms: ['order:view'], dataScope: 'self' },
  后期师: { perms: ['order:view'], dataScope: 'self' },
  花艺师: { perms: ['order:view'], dataScope: 'self' },
  布置专员: { perms: ['order:view'], dataScope: 'self' },
  司仪: { perms: ['order:view'], dataScope: 'self' },
  礼仪顾问: { perms: ['order:view'], dataScope: 'self' },
  灯光师: { perms: ['order:view'], dataScope: 'self' },
  音响师: { perms: ['order:view'], dataScope: 'self' },
};

/* ══════════════════ 权限池裁剪 ══════════════════ */

/** 代理商层可见域全集（隐藏「服务与内容」域，与前端 LAYER_DOMAIN_IDS.agent 一致） */
function AGENT_LAYER_PERMS(): string[] {
  return ['user:view', 'user:edit', 'provider:review', 'provider:qualification', 'provider:upgrade',
    'order:view', 'order:handle', 'order:aftersale', 'finance:view', 'withdrawal:review',
    'withdrawal:operate', 'finance:reconcile', 'coupon:config', 'coupon:issue', 'coupon:view',
    'feedback:handle', 'appeal:arbitrate', 'announce:publish', 'announce:review', 'message:send',
    'role:manage', 'region:manage', 'settings:manage', 'data:export'];
}

/** 总台层可见域全集（10 域 28 点） */
function CONSOLE_LAYER_PERMS(): string[] {
  return ['user:view', 'user:edit', 'provider:review', 'provider:qualification', 'provider:upgrade',
    'template:publish', 'content:offline', 'template:review', 'qualification:manage',
    'order:view', 'order:handle', 'order:aftersale', 'finance:view', 'withdrawal:review',
    'withdrawal:operate', 'finance:reconcile', 'coupon:config', 'coupon:issue', 'coupon:view',
    'feedback:handle', 'appeal:arbitrate', 'announce:publish', 'announce:review', 'message:send',
    'role:manage', 'region:manage', 'settings:manage', 'data:export'];
}

/**
 * 员工权限池的禁止项（红线，文档 §9）：
 *  R-03 `role:manage` / `settings:manage` 仅老板持有、不可转授（防自我提权）
 *  R-02 `withdrawal:*` 不进服务商 / 代理商执行岗权限池（财务发起 / 审批分离；
 *        总台「财务」是审批方，故 CONSOLE 层保留 `withdrawal:review`）
 *  `region:manage` 属平台级区域治理，不下放给服务商 / 代理商员工
 */
export const STAFF_FORBIDDEN_PERMS: Record<OrgType, string[]> = {
  PROVIDER: ['role:manage', 'settings:manage', 'region:manage', 'withdrawal:review', 'withdrawal:operate'],
  AGENT: ['role:manage', 'settings:manage', 'region:manage', 'withdrawal:operate'],
  CONSOLE: ['role:manage', 'settings:manage'],
};

/** 某层可分配给员工的权限池（已裁剪红线禁止项） */
export function staffPermPool(org: OrgType): string[] {
  const raw = org === 'PROVIDER' ? [...TEAM_PERM_KEYS] : org === 'AGENT' ? AGENT_LAYER_PERMS() : CONSOLE_LAYER_PERMS();
  const forbid = STAFF_FORBIDDEN_PERMS[org] ?? [];
  return raw.filter((k) => !forbid.includes(k));
}

/* ══════════════════ 数据范围白名单 ══════════════════ */

export const SCOPE_BY_ORG: Record<OrgType, string[]> = {
  PROVIDER: ['self', 'service', 'provider'],
  AGENT: ['self', 'region', 'agent'],
  CONSOLE: ['self', 'all'],
};

export const SCOPE_TEXT: Record<string, string> = {
  self: '自身',
  service: '自身（服务域）',
  provider: '本服务商',
  region: '本辖区',
  agent: '本代理商',
  all: '全平台',
};

/* ══════════════════ 校验工具 ══════════════════ */

/** 该层岗位池（服务商层按 serviceType 联动；无 serviceType 时返回兜底 + 通用岗位） */
export function staffRolePool(org: OrgType, serviceType?: string | null): string[] {
  if (org === 'PROVIDER') return teamRolesOf(serviceType);
  return Object.keys(org === 'AGENT' ? AGENT_ROLE_META : CONSOLE_ROLE_META);
}

/**
 * 校验并裁剪 dataScope：非法值返回 undefined（调用方据此抛 400）。
 * 此前 `dataScope` 无任何白名単校验，任意字符串都能落库。
 */
export function assertDataScope(org: OrgType, scope?: string | null): string {
  const allow = SCOPE_BY_ORG[org];
  const v = (scope ?? '').toString().trim() || 'self';
  return allow.includes(v) ? v : undefined as unknown as string;
}

/** dataScope 是否合法 */
export function validDataScope(org: OrgType, scope?: string | null): boolean {
  const v = (scope ?? '').toString().trim() || 'self';
  return SCOPE_BY_ORG[org].includes(v);
}

/**
 * 校验并裁剪 funcPerms：越权项（不在池内 / 属红线禁止项）直接剔除。
 * 若存在越权项，调用方应拒绝整个请求（返回 400），而不是静默丢弃 ——
 * 静默丢弃会让调用方以为授权成功。
 */
export function checkFuncPerms(org: OrgType, perms?: string[] | null): { ok: boolean; illegal: string[]; value: string[] } {
  const pool = staffPermPool(org);
  const list = Array.isArray(perms) ? perms.filter((p) => typeof p === 'string') : [];
  const illegal = list.filter((p) => !pool.includes(p));
  return { ok: illegal.length === 0, illegal, value: [...new Set(list.filter((p) => pool.includes(p)))] };
}

/** 岗位是否属于内置池（自填岗位返回 false，放行但标记为自定义） */
export function isBuiltinStaffRole(org: OrgType, role?: string | null, serviceType?: string | null): boolean {
  return staffRolePool(org, serviceType).includes((role ?? '').toString().trim());
}
