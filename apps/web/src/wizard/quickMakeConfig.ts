/**
 * 一键制作（Quick Make）类型与表单配置
 * - 类型对应模板库的 category（7 类场景）
 * - 每个类型定义表单字段，bind 与种子模板元素的 `bind` 一一对应
 * 文案（类型名 / 字段标签）统一放在 i18n 的 common 命名空间下 quickMake 子树：
 *   类型名：t(`quickMake.types.${type.id}`)
 *   字段标签：t(`quickMake.fields.${field.bind}`)
 */

export type QuickMakeFieldType = 'text' | 'textarea' | 'image';

export interface QuickMakeField {
  /** 对应模板元素的 bind 键 */
  bind: string;
  type: QuickMakeFieldType;
  required?: boolean;
}

export interface QuickMakeType {
  /** 类型唯一 id（同时作为 i18n key 与表单分组） */
  id: string;
  /** 对应的模板库 category */
  category: string;
  /** 展示图标（emoji，跨语言通用） */
  icon: string;
  /** 表单字段 */
  fields: QuickMakeField[];
}

export const QUICK_MAKE_TYPES: QuickMakeType[] = [
  {
    id: 'wedding',
    category: 'wedding',
    icon: '💍',
    fields: [
      { bind: 'title', type: 'text', required: true },
      { bind: 'date', type: 'text', required: true },
      { bind: 'invitation', type: 'textarea' },
      { bind: 'location', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
  {
    id: 'recruitment',
    category: 'recruitment',
    icon: '💼',
    fields: [
      { bind: 'slogan', type: 'text' },
      { bind: 'position', type: 'text', required: true },
      { bind: 'requirements', type: 'textarea' },
      { bind: 'contact', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
  {
    id: 'conference',
    category: 'conference',
    icon: '📋',
    fields: [
      { bind: 'title', type: 'text', required: true },
      { bind: 'content', type: 'textarea' },
      { bind: 'info', type: 'textarea' },
      { bind: 'blessing', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
  {
    id: 'marketing',
    category: 'marketing',
    icon: '🚀',
    fields: [
      { bind: 'title', type: 'text', required: true },
      { bind: 'subtitle', type: 'text' },
      { bind: 'slogan', type: 'textarea' },
      { bind: 'cta', type: 'text' },
      { bind: 'website', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
  {
    id: 'birthday',
    category: 'birthday',
    icon: '🎂',
    fields: [
      { bind: 'title', type: 'text', required: true },
      { bind: 'blessing', type: 'textarea' },
      { bind: 'cta', type: 'text' },
      { bind: 'from', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
  {
    id: 'education',
    category: 'education',
    icon: '🎓',
    fields: [
      { bind: 'title', type: 'text', required: true },
      { bind: 'subtitle', type: 'text' },
      { bind: 'highlights', type: 'textarea' },
      { bind: 'cta', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
  {
    id: 'festival',
    category: 'festival',
    icon: '🏮',
    fields: [
      { bind: 'title', type: 'text', required: true },
      { bind: 'blessing', type: 'textarea' },
      { bind: 'content', type: 'textarea' },
      { bind: 'sign', type: 'text' },
      { bind: 'cover', type: 'image' },
    ],
  },
];

export function getQuickMakeType(id: string): QuickMakeType | undefined {
  return QUICK_MAKE_TYPES.find((t) => t.id === id);
}
