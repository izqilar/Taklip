import i18n from './index';

/**
 * 全局翻译函数（模块级）。
 * 与 Refine i18nProvider 一致：缺失键回退为 key 本身（永不出现空白）。
 * 语言切换时 App.tsx 的 Shell 会重渲染整棵树，此处 t() 实时读取当前语言。
 */
export const t = (key: string, params?: any): string => {
  // i18next 支持 t(key, 'fallback') 写法：字符串第二参数即默认值
  if (typeof params === 'string') {
    return i18n.t(key, { defaultValue: params }) as string;
  }
  // 不再注入 `defaultValue: key`：i18next 在 lng 查不到时会沿 fallbackLng（本项目
  // admin 为 zh-CN）回退，注入 defaultValue 并不能触发回退、反而让调用方传的
  // options.defaultValue 被覆盖。整条回退链都查不到时 i18next 本来就返回 key 本身，
  // 行为等价且更干净。详见 i18n audit 报告（step 5 实测）。
  return i18n.t(key, { ...(params ?? {}) }) as string;
};
