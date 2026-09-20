import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 通用命名空间（运营端原有）
import zhCN from './locales/zh-CN/common.json';
import en from './locales/en/common.json';
import ug from './locales/ug/common.json';
import kkCN from './locales/kk-CN/common.json';
import kyCN from './locales/ky-CN/common.json';
import uzCN from './locales/uz-CN/common.json';

// 共享编辑器内核所需的命名空间（common 命名空间）
// common = 编辑器 UI 状态文案（status.saved 等）。该资源已从 apps/web 同步到本仓库
// admin/src/i18n/locales/<lang>/web-common.json，解除对 apps/web 源码树的硬依赖
//（原 '../../../web/src/i18n/locales/...' 跨包路径，web 重构即崩）。后续 web 端 common 变更需手动同步此副本。
import zhCN_common from './locales/zh-CN/web-common.json';
import en_common from './locales/en/web-common.json';
import ug_common from './locales/ug/web-common.json';
import kkCN_common from './locales/kk-CN/web-common.json';
import kyCN_common from './locales/ky-CN/web-common.json';
import uzCN_common from './locales/uz-CN/web-common.json';
import zhCN_editor from './locales/zh-CN/editor.json';
import zhCN_errors from './locales/zh-CN/errors.json';
import zhCN_publish from './locales/zh-CN/publish.json';
import en_editor from './locales/en/editor.json';
import en_errors from './locales/en/errors.json';
import en_publish from './locales/en/publish.json';
import ug_editor from './locales/ug/editor.json';
import ug_errors from './locales/ug/errors.json';
import ug_publish from './locales/ug/publish.json';
import kkCN_editor from './locales/kk-CN/editor.json';
import kkCN_errors from './locales/kk-CN/errors.json';
import kkCN_publish from './locales/kk-CN/publish.json';
import kyCN_editor from './locales/ky-CN/editor.json';
import kyCN_errors from './locales/ky-CN/errors.json';
import kyCN_publish from './locales/ky-CN/publish.json';
import uzCN_editor from './locales/uz-CN/editor.json';
import uzCN_errors from './locales/uz-CN/errors.json';
import uzCN_publish from './locales/uz-CN/publish.json';

/**
 * 运营端国际化（文档 §13）。
 * - 默认 zh-CN；支持 6 语言，其中 4 种为 RTL（维吾尔/哈萨克/吉尔吉斯/乌兹别克）。
 * - 缺失键回退 zh-CN（保证永不出现空白 UI）；完整多语言包为后续接入项。
 * - 新增 common/editor/errors/publish 命名空间：供 @h5design/editor 共享内核（运营端画布）读取文案，
 *   与 web 端保持同一份资源，避免内核文案回退成键名。
 */
export const RTL_LANGS = ['ug', 'kk-CN', 'ky-CN', 'uz-CN'] as const;

export const SUPPORTED_LANGS: { key: string; label: string }[] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en', label: 'English' },
  { key: 'ug', label: 'ئۇيغۇرچە' },
  { key: 'kk-CN', label: 'قازاقша' },
  { key: 'ky-CN', label: 'قىرگىزچا' },
  { key: 'uz-CN', label: 'ئۆزبېكچە' },
];

export function isRTL(lang: string | undefined): boolean {
  return !!lang && (RTL_LANGS as readonly string[]).includes(lang);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN, common: zhCN_common, editor: zhCN_editor, errors: zhCN_errors, publish: zhCN_publish },
      en: { translation: en, common: en_common, editor: en_editor, errors: en_errors, publish: en_publish },
      ug: { translation: ug, common: ug_common, editor: ug_editor, errors: ug_errors, publish: ug_publish },
      'kk-CN': { translation: kkCN, common: kkCN_common, editor: kkCN_editor, errors: kkCN_errors, publish: kkCN_publish },
      'ky-CN': { translation: kyCN, common: kyCN_common, editor: kyCN_editor, errors: kyCN_errors, publish: kyCN_publish },
      'uz-CN': { translation: uzCN, common: uzCN_common, editor: uzCN_editor, errors: uzCN_errors, publish: uzCN_publish },
    },
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'admin-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
