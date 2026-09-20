/**
 * 模板库分类单一数据源（v2：15 个一级分类 + 每类推荐标签池）
 *
 * - 一级分类 = `Template.category`（自由字符串，slug 语言中立）
 * - 二级子项 = `Template.tags`（受控标签池，见 CATEGORY_TAG_POOLS）
 * - 所有 UI（模板库/首页 tab、提交表单、管理后台）均从此文件取数，避免硬编码漂移。
 *
 * i18n 标签统一放在各语言的 `common.json` 的 `category.*` 命名空间下，
 * 通过 categoryI18nKey(slug) 取得 key（如 `category.wedding`）。
 */

/** 全部 tab 的伪 slug（表示"不过滤，展示全部"） */
export const ALL_TAB = 'all';

/** i18n 命名空间（common.json 下的 key 前缀） */
export const CATEGORY_I18N_NS = 'category';

export interface TemplateCategory {
  /** 稳定 slug，存进 Template.category */
  slug: string;
  /** 展示图标（emoji，跨语言通用） */
  icon: string;
}

/** 15 个一级分类（平铺顺序即模板库/首页 tab 顺序） */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { slug: 'wedding', icon: '💍' }, // 婚庆嫁娶
  { slug: 'birth_celebration', icon: '👶' }, // 诞育庆贺
  { slug: 'birthday', icon: '🎂' }, // 生日寿辰
  { slug: 'festival', icon: '🏮' }, // 节庆贺卡
  { slug: 'housewarming', icon: '🏠' }, // 乔迁新居
  { slug: 'school_promotion', icon: '🎓' }, // 升学庆贺
  { slug: 'social_gathering', icon: '🥳' }, // 社交聚会
  { slug: 'memorial', icon: '🕯️' }, // 追思悼念
  { slug: 'brand', icon: '🏢' }, // 商务企宣
  { slug: 'recruitment', icon: '💼' }, // 招聘招募
  { slug: 'conference', icon: '📋' }, // 会议会展
  { slug: 'opening', icon: '🎉' }, // 开业庆典
  { slug: 'education', icon: '📚' }, // 教育培训
  { slug: 'biz_social', icon: '🤝' }, // 商务社交
  { slug: 'marketing', icon: '🚀' }, // 产品营销
];

/** 全部一级分类 slug 列表（含旧 7 + 新 8） */
export const CATEGORY_SLUGS: string[] = TEMPLATE_CATEGORIES.map((c) => c.slug);

/**
 * 每类推荐标签池（即原"二级子项"）。提交表单以 chips 形式建议；
 * 设计师也可自由输入（提交时归一化 + 内容安全扫描）。
 */
export const CATEGORY_TAG_POOLS: Record<string, string[]> = {
  wedding: ['婚礼', '订婚茶', '银婚', '金婚'],
  birth_celebration: ['满月', '百日', '周岁', '割礼', '成人礼', '抓周'],
  birthday: ['儿童生日', '成人生日', '老人寿宴'],
  festival: [
    '春节',
    '元宵',
    '端午',
    '中秋',
    '新年',
    '情人节',
    '母亲节',
    '父亲节',
    '国庆',
    '五一劳动节',
    '儿童节',
    '38妇女节',
  ],
  housewarming: ['乔迁宴'],
  school_promotion: ['小学', '中学', '大学', '考研'],
  social_gathering: ['同学聚会', '同乡会', '派对', '个人答谢宴'],
  memorial: ['追悼会', '纪念册', '讣告'],
  brand: ['LOGO', '画册', '折页', '名片', 'VI', 'CI'],
  recruitment: ['校招', '社招', '实习生', '引进人才'],
  conference: ['邀请函', '议程', '展板', '胸牌'],
  opening: ['开业', '周年'],
  education: ['招生', '课程', '讲座'],
  biz_social: ['商务宴请', '客户答谢'],
  marketing: ['海报', '传单', '易拉宝', '线上推广'],
};

/** 取某分类的推荐标签池（无则返回空数组） */
export function getTagPool(slug: string): string[] {
  return CATEGORY_TAG_POOLS[slug] ?? [];
}

/** 取某分类的 i18n key（配合 `common:` 命名空间前缀使用） */
export function categoryI18nKey(slug: string): string {
  return `${CATEGORY_I18N_NS}.${slug}`;
}

/** 校验 slug 是否为已知一级分类（用于表单/后端软校验） */
export function isKnownCategory(slug: string): boolean {
  return CATEGORY_SLUGS.includes(slug);
}
