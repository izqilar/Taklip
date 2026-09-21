/**
 * 组织内员工「岗位（StaffRole）」字典 —— 三层（服务商 / 代理商 / 总台）共用。
 *
 * 真值源：`UI_Design/index.html:4691` 的 `TEAM_SVC_META`(6 服务类型 → 角色池 + 职责池 + trait)
 *         与 `TEAM_FUNCS`(8 项功能权限)。本文件是它在运营端的镜像，
 *         服务端镜像为 `apps/server/src/console/team-role.meta.ts`，
 *         **改任一侧都必须同步另一侧**（P2 抽到 packages/core 收敛）。
 *
 * ⚠️ 概念区分（文档 §1.4）：
 *   - 平台身份 User.role：决定进哪个端、管哪个辖区（本体系不碰）
 *   - 组织内岗位 staffRole：决定在本单位能干什么（本文件）
 *   - 工种 serviceType：决定会什么手艺（仅服务商层，与岗位联动）
 *
 * 关联文档：`docs/平台角色边界规范化.md`
 */

import { layerDomains } from './permGroups';

/** 组织层类型：服务商 / 代理商 / 总台 */
export type OrgType = 'PROVIDER' | 'AGENT' | 'CONSOLE';

export interface SvcMeta {
  roles: string[];
  duties: string[];
  trait: string;
}

/**
 * 服务类型 → { 岗位池, 职责池, 特长画像 }。
 * 抄自原型 `UI_Design/index.html:4691`，键名与原型保持一致（含「婚庆策划」）。
 */
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

/**
 * 服务类型别名：`SVC_OPTIONS`(15 项) 与原型 `TEAM_SVC_META`(6 项) 的键名差异。
 * 代码里叫「婚礼策划」，原型里叫「婚庆策划」——不映射会导致该类型的岗位下拉为空。
 */
const SVC_ALIAS: Record<string, string> = {
  婚礼策划: '婚庆策划',
};

/** 未命中原型服务类型时的兜底岗位池（避免下拉为空，文档 §2.2 冲突 1） */
export const TEAM_DEFAULT_ROLES = ['负责人', '执行专员', '客服专员'];

/** 兜底职责池（原型未定义时使用，取「业务经理」通用职责） */
export const TEAM_DEFAULT_DUTIES = ['客户沟通', '订单管理', '交付履约', '售后处理'];

/** 兜底特长画像 */
export const TEAM_DEFAULT_TRAIT = '负责本服务类型的客户沟通、订单管理与交付履约。';

/** 服务商层通用追加岗位：所有服务类型都可选（文档 §5.1） */
export const PROVIDER_COMMON_ROLES = ['店长/调度', '财务专员'];

/** 归一化服务类型键（走别名 → 原型键） */
const svcKey = (svc?: string | null): string | undefined => {
  if (!svc) return undefined;
  const raw = String(svc).trim();
  return SVC_ALIAS[raw] ?? raw;
};

/** 服务类型 → 岗位池（含通用追加岗位）；未命中则回落到兜底池 + 通用岗位 */
export function teamRolesOf(svc?: string | null): string[] {
  const meta = TEAM_SVC_META[svcKey(svc) ?? ''];
  const base = meta ? meta.roles : TEAM_DEFAULT_ROLES;
  return Array.from(new Set([...base, ...PROVIDER_COMMON_ROLES]));
}

/** 服务类型 → 职责池；未命中则回落到兜底职责池 */
export function teamDutiesOf(svc?: string | null): string[] {
  return TEAM_SVC_META[svcKey(svc) ?? '']?.duties ?? TEAM_DEFAULT_DUTIES;
}

/** 服务类型 → 特长画像（用于预填「特长」字段）；未命中回落兜底文案 */
export function teamTraitOf(svc?: string | null): string {
  return TEAM_SVC_META[svcKey(svc) ?? '']?.trait ?? TEAM_DEFAULT_TRAIT;
}

/* ══════════════════ 代理商 / 总台岗位池（文档 §5.2 / §5.3） ══════════════════ */

/** 代理商层可见域全集（permGroups LAYER_DOMAIN_IDS.agent，隐藏「服务与内容」域） */
function agentLayerPerms(): string[] {
  return layerDomains('agent').flatMap((d) => d.points.map((p) => p.key));
}

/** 总台层可见域全集（10 域 28 点） */
function consoleLayerPerms(): string[] {
  return layerDomains('console').flatMap((d) => d.points.map((p) => p.key));
}

export interface StaffRoleMeta {
  /** 默认职责 */
  duties: string[];
  /** 默认功能权限子集（permGroups key） */
  perms: string[];
  /** 默认数据范围 */
  dataScope: string;
}

/** 代理商层岗位池 */
export const AGENT_ROLE_META: Record<string, StaffRoleMeta> = {
  区域经理: {
    duties: ['辖区经营统筹', '服务商拓展', '业绩负责'],
    // agent 层可见域全集（LAYER_DOMAIN_IDS.agent），再由 STAFF_FORBIDDEN_PERMS 裁剪
    perms: agentLayerPerms(),
    dataScope: 'agent',
  },
  入驻审核员: {
    duties: ['服务商入驻资质审核'],
    perms: ['provider:review', 'provider:qualification'],
    dataScope: 'region',
  },
  商务拓展: {
    duties: ['招商', '服务商拜访', '线索跟进'],
    perms: ['user:view', 'provider:review'],
    dataScope: 'region',
  },
  财务专员: {
    duties: ['分润对账', '提现发起'],
    perms: ['finance:view', 'finance:reconcile'],
    dataScope: 'agent',
  },
  客服专员: {
    duties: ['工单处理', '反馈跟进'],
    perms: ['feedback:handle', 'message:send'],
    dataScope: 'self',
  },
};

/** 总台层岗位池 */
export const CONSOLE_ROLE_META: Record<string, StaffRoleMeta> = {
  超级管理员: {
    duties: ['全平台配置', '角色与区域管理'],
    perms: consoleLayerPerms(),
    dataScope: 'all',
  },
  内容运营: {
    duties: ['模板运营', '公告运营'],
    perms: ['template:publish', 'template:review', 'announce:publish', 'announce:review'],
    dataScope: 'all',
  },
  审核员: {
    duties: ['模板审核', '资质审核', '入驻审核'],
    perms: ['template:review', 'qualification:manage', 'provider:review'],
    dataScope: 'all',
  },
  财务: {
    duties: ['提现审核', '平台对账'],
    perms: ['finance:view', 'withdrawal:review', 'finance:reconcile'],
    dataScope: 'all',
  },
  '客服/工单': {
    duties: ['反馈处理', '申诉仲裁'],
    perms: ['feedback:handle', 'appeal:arbitrate', 'message:send'],
    dataScope: 'self',
  },
};

/** 服务商层岗位 → 默认权限 / 数据范围（权限池固定为 TEAM_PERM_KEYS 8 项，对齐原型 TEAM_FUNCS） */
export const PROVIDER_ROLE_META: Record<string, { perms: string[]; dataScope: string }> = {
  负责人: {
    perms: ['order:view', 'order:handle', 'order:aftersale', 'message:send', 'template:publish', 'content:offline', 'data:export', 'qualification:manage'],
    dataScope: 'provider',
  },
  店长调度: { perms: ['order:view', 'order:handle', 'order:aftersale', 'message:send', 'data:export'], dataScope: 'provider' },
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

/** 三层岗位池（列表顺序即下拉顺序） */
export const STAFF_ROLE_POOLS: Record<OrgType, string[]> = {
  PROVIDER: [], // 服务商层岗位随服务类型联动，用 teamRolesOf(svc) 取，不用静态池
  AGENT: Object.keys(AGENT_ROLE_META),
  CONSOLE: Object.keys(CONSOLE_ROLE_META),
};

/** 取某层某岗位的默认配置（服务商层无 serviceType 时按岗位名查） */
export function staffRoleMetaOf(org: OrgType, role?: string | null): StaffRoleMeta | undefined {
  if (!role) return undefined;
  if (org === 'AGENT') return AGENT_ROLE_META[role];
  if (org === 'CONSOLE') return CONSOLE_ROLE_META[role];
  const p = PROVIDER_ROLE_META[role];
  return p ? { duties: [], perms: p.perms, dataScope: p.dataScope } : undefined;
}

/* ══════════════════ 功能权限子集 ══════════════════ */

/**
 * 服务商层可分配的功能权限（对齐原型 TEAM_FUNCS 8 项）。
 * 注意：不是 provider 层的全部 6 域 12 点，而是原型明确列出的 8 项。
 */
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

/** 各层可分配给员工的功能权限池（服务商=原型 8 项；代理商/总台=该层可见域全集） */
export function staffPermPool(org: OrgType): string[] {
  if (org === 'PROVIDER') return [...TEAM_PERM_KEYS];
  const pool = org === 'AGENT' ? agentLayerPerms() : consoleLayerPerms();
  return pool.filter((k) => !STAFF_FORBIDDEN_PERMS[org].includes(k));
}

/** 某层可分配权限池（已裁剪红线项） */
export function staffPermOptions(org: OrgType): string[] {
  return staffPermPool(org);
}

/* ══════════════════ 数据范围 ══════════════════ */

export interface ScopeOpt {
  value: string;
  labelKey: string;
}

/** 各层可选数据范围（服务端按此白名单校验，文档 §5.4） */
export const SCOPE_OPTS_BY_ORG: Record<OrgType, ScopeOpt[]> = {
  PROVIDER: [
    { value: 'self', labelKey: 'pages.team.scopeSelf' },
    { value: 'service', labelKey: 'pages.team.scopeService' },
    { value: 'provider', labelKey: 'pages.team.scopeProvider' },
  ],
  AGENT: [
    { value: 'self', labelKey: 'pages.team.scopeSelf' },
    { value: 'region', labelKey: 'pages.team.scopeRegion' },
    { value: 'agent', labelKey: 'pages.team.scopeAgent' },
  ],
  CONSOLE: [
    { value: 'self', labelKey: 'pages.team.scopeSelf' },
    { value: 'all', labelKey: 'pages.team.scopeAll' },
  ],
};

/** 数据范围合法值（按层） */
export function scopeValuesOf(org: OrgType): string[] {
  return SCOPE_OPTS_BY_ORG[org].map((o) => o.value);
}

/** 数据范围中文标签（不依赖 i18n 的兜底展示，如导出/列表） */
export const SCOPE_TEXT: Record<string, string> = {
  self: '自身',
  service: '自身（服务域）',
  provider: '本服务商',
  region: '本辖区',
  agent: '本代理商',
  all: '全平台',
};

/* ══════════════════ 红线裁剪（文档 §9） ══════════════════ */

/**
 * 员工权限池的禁止项。
 * R-03：`role:manage` / `settings:manage` 仅老板持有、不可转授（防自我提权）。
 * R-02：`withdrawal:*` 不进服务商/代理商执行岗权限池（财务发起 / 审批分离；
 *        总台「财务」岗位是审批方，故 CONSOLE 层保留 `withdrawal:review`）。
 * `region:manage` 属平台级区域治理，不下放给服务商 / 代理商员工。
 */
export const STAFF_FORBIDDEN_PERMS: Record<OrgType, string[]> = {
  PROVIDER: ['role:manage', 'settings:manage', 'region:manage', 'withdrawal:review', 'withdrawal:operate'],
  AGENT: ['role:manage', 'settings:manage', 'region:manage', 'withdrawal:operate'],
  CONSOLE: ['role:manage', 'settings:manage'],
};

/** 裁剪掉红线禁止项后的权限数组 */
export function sanitizeStaffPerms(org: OrgType, perms?: string[] | null): string[] {
  const forbid = STAFF_FORBIDDEN_PERMS[org] ?? [];
  const pool = staffPermPool(org);
  return (perms ?? []).filter((k) => pool.includes(k) && !forbid.includes(k));
}
