import { t } from '../i18n/t';

/**
 * 运营端枚举/键值 → 简体中文标签统一入口。
 * 所有直接暴露在 UI 上的英文枚举（角色、服务子角色、消息类型/范围、布尔值等）
 * 都应通过此处转换，避免页面内残留英文键值。
 */

/**
 * 平台角色（User.role）→ i18n 键。
 * 此处只存键，roleText 在「调用时」解析 t()，避免模块加载期把标签冻结为当时的语言
 *（此前直接 t(...) 会随模块首屏语言固化，运行时切换语言不刷新）。
 */
export const ROLE_KEYS: Record<string, string> = {
  USER: 'pages.col.normalUser',
  SERVICE_PROVIDER: 'pages.col.provider',
  AGENT: 'pages.col.agent',
  ADMIN: 'pages.col.admin',
};

/**
 * 角色名兼容别名 → 规范大写键。
 * 兼容历史/外部数据里可能出现的旧写法（如 DESIGNER、Capitalized 形式），
 * 统一映射到 SERVICE_PROVIDER / ADMIN 等规范键，避免界面漏出英文角色名。
 */
export const ROLE_ALIASES: Record<string, string> = {
  ADMIN: 'ADMIN', admin: 'ADMIN', Admin: 'ADMIN',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER', provider: 'SERVICE_PROVIDER', Provider: 'SERVICE_PROVIDER',
  DESIGNER: 'SERVICE_PROVIDER', Designer: 'SERVICE_PROVIDER', designer: 'SERVICE_PROVIDER',
  AGENT: 'AGENT', agent: 'AGENT', Agent: 'AGENT',
  USER: 'USER', user: 'USER', User: 'USER',
};

/** 服务子角色（User.serviceRoles / pendingServiceRoles）→ i18n 键（pages.svc.*） */
export const SERVICE_ROLE_KEYS: Record<string, string> = {
  DESIGN: 'pages.svc.design',
  PHOTO: 'pages.svc.photo',
  VENUE: 'pages.svc.venue',
  FLORAL: 'pages.svc.floral',
  STEWARD: 'pages.svc.steward',
  PERFORM: 'pages.svc.perform',
};

/** 消息类型 → i18n 键 */
export const MSG_TYPE_KEYS: Record<string, string> = {
  ANNOUNCEMENT: 'pages.msg.authorityNotice',
  ANNOUNCED: 'pages.msg.authorityNotice',
  NOTICE: 'pages.msg.generalMsg',
  APPEAL: 'pages.fb.appeal',
};

/** 消息发布范围 → i18n 键 */
export const MSG_SCOPE_KEYS: Record<string, string> = {
  GLOBAL: 'pages.lbl.global',
  REGION: 'pages.col.regionSlash',
  OWN: 'pages.col.targetRole',
};

/** 布尔值 → i18n 键 */
export const BOOL_KEYS: Record<string, string> = {
  true: 'common.bool.yes',
  false: 'common.bool.no',
};

/** 通用键 → 中文标签（保留未识别键本身，便于排查）；键值是 i18n 键，在调用时解析 */
export const labelOf = (map: Record<string, string>, key?: string | null) =>
  key == null ? '—' : t(map[key] ?? key);

/** 服务子角色数组 → 中文拼接 */
export const serviceRolesText = (roles?: string[] | null) =>
  !roles?.length ? '—' : roles.map((r) => labelOf(SERVICE_ROLE_KEYS, r)).join('、');

/** 服务子角色 → 下拉选项（调用时解析标签，避免模块加载期固化语言） */
export const serviceRoleOptions = () =>
  Object.entries(SERVICE_ROLE_KEYS).map(([value, key]) => ({ value, label: t(key) }));

/** 角色名 → 中文（兼容大小写/历史别名，如 Admin/Designer → 中文）；调用时解析 t() */
export const roleText = (role?: string | null) => {
  if (role == null) return '—';
  const norm = ROLE_ALIASES[role] ?? role.toUpperCase();
  const key = ROLE_KEYS[norm];
  return key ? t(key) : role;
};

/**
 * 消息发布人显示：优先用角色中文名（管理员/服务商/代理商），
 * 仅当昵称为可读中文名时才附带，避免漏出英文昵称（如 Admin/Designer）。
 */
export const publisherText = (author?: { nickname?: string; phone?: string; role?: string } | null, authorRole?: string | null) => {
  const role = authorRole || author?.role;
  const cn = roleText(role);
  const name = author?.nickname;
  if (name && name !== cn && !/^[A-Za-z][A-Za-z\s]*$/.test(name)) {
    return `${cn} · ${name}`;
  }
  return cn;
};

/** 消息类型 → 中文 */
export const msgTypeText = (type?: string | null) => labelOf(MSG_TYPE_KEYS, type);

/** 消息范围 → 中文（REGION 附带 regionPath） */
export const msgScopeText = (scope?: string | null, regionPath?: string | null) => {
  const base = labelOf(MSG_SCOPE_KEYS, scope);
  if (scope === 'REGION' && regionPath) return `${base}(${regionPath})`;
  return base;
};

/** 布尔值/是否 → 中文 */
export const boolText = (v?: boolean | string | null) => {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? t('common.bool.yes') : t('common.bool.no');
  return t(BOOL_KEYS[String(v)] ?? String(v));
};

/** 类别 slug → 中文（复用已有的 i18n 键） */
export const categoryText = (cat?: string | null) => {
  if (!cat) return '—';
  const key = `pages.cat.${
    {
      wedding: 'wedding',
      birth_celebration: 'birthCelebration',
      birthday: 'birthday',
      festival: 'festCard',
      housewarming: 'houseMove',
      school_promotion: 'promoStudy',
      social_gathering: 'socialParty',
      memorial: 'memorial',
      brand: 'bizPromo',
      recruitment: 'recruit',
      conference: 'meeting',
      opening: 'opening',
      education: 'edu',
      biz_social: 'bizSocial',
      marketing: 'productMkt',
    }[cat] ?? cat
  }`;
  return t(key, cat);
};

/**
 * 清理测试数据英文前缀（展示用，不改底层 id）。
 * 种子/演示数据常用 e2e_order_0086、test_user_001、tpl_seed_xxx 这类英文前缀，
 * 直接作为编号/订单号展示会漏出英文。剥离已知前缀，仅保留可读后缀。
 * 真实 cuid 等不含这些前缀，原样返回，不受影响。
 */
const CODE_PREFIXES = ['e2e_order_', 'e2e_user_', 'e2e_', 'tpl_seed_', 'test_user_', 'test_', 'dev_', 'demo_', 'order_'];
export const cleanCode = (v?: string | null): string => {
  if (!v) return '—';
  let s = String(v);
  // 反复剥离已知英文前缀，直到不再以任一前缀开头（如 e2e_order_demo_3 → 3）
  for (let i = 0; i < 4; i++) {
    const hit = CODE_PREFIXES.find((p) => s.startsWith(p));
    if (!hit) break;
    s = s.slice(hit.length);
  }
  return s || '—';
};
