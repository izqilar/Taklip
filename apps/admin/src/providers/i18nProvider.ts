import type { I18nProvider } from '@refinedev/core';
import i18n from '../i18n';

/**
 * Refine i18nProvider 适配器（文档 §13）。
 * translate 用 i18next，缺失键回退 zh-CN；changeLocale/getLocale 透传。
 */
export const i18nProvider: I18nProvider = {
  translate: (key: string, params?: Record<string, any>, defaultMessage?: string) =>
    i18n.t(key, { ...(params ?? {}), defaultValue: defaultMessage ?? key }),
  changeLocale: (lang: string) => i18n.changeLanguage(lang),
  getLocale: () => i18n.language,
};
