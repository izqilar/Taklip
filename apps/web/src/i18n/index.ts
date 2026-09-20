/**
 * i18n configuration
 * Supports 6 languages: zh-CN, en, ug, kk-CN, ky-CN, uz-CN
 * RTL languages: ug, kk-CN, ky-CN, uz-CN
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNEditor from './locales/zh-CN/editor.json';
import zhcNTemplates from './locales/zh-CN/templates.json';
import zhCNPublish from './locales/zh-CN/publish.json';
import zhCNErrors from './locales/zh-CN/errors.json';

import enCommon from './locales/en/common.json';
import enEditor from './locales/en/editor.json';
import enTemplates from './locales/en/templates.json';
import enPublish from './locales/en/publish.json';
import enErrors from './locales/en/errors.json';

import ugCommon from './locales/ug/common.json';
import ugEditor from './locales/ug/editor.json';
import ugTemplates from './locales/ug/templates.json';
import ugPublish from './locales/ug/publish.json';
import ugErrors from './locales/ug/errors.json';

import kkCNCommon from './locales/kk-CN/common.json';
import kkCNEditor from './locales/kk-CN/editor.json';
import kkCNTemplates from './locales/kk-CN/templates.json';
import kkCNPublish from './locales/kk-CN/publish.json';
import kkCNErrors from './locales/kk-CN/errors.json';

import kyCNCommon from './locales/ky-CN/common.json';
import kyCNEditor from './locales/ky-CN/editor.json';
import kyCNTemplates from './locales/ky-CN/templates.json';
import kyCNPublish from './locales/ky-CN/publish.json';
import kyCNErrors from './locales/ky-CN/errors.json';

import uzCNCommon from './locales/uz-CN/common.json';
import uzCNEditor from './locales/uz-CN/editor.json';
import uzCNTemplates from './locales/uz-CN/templates.json';
import uzCNPublish from './locales/uz-CN/publish.json';
import uzCNErrors from './locales/uz-CN/errors.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文', dir: 'ltr' as const },
  { code: 'en', name: 'English', dir: 'ltr' as const },
  { code: 'ug', name: 'ئۇيغۇرچە', dir: 'rtl' as const },
  { code: 'kk-CN', name: 'қазақشا', dir: 'rtl' as const },
  { code: 'ky-CN', name: 'قىرعىزچا', dir: 'rtl' as const },
  { code: 'uz-CN', name: 'ўзбекча', dir: 'rtl' as const },
];

export const RTL_LANGUAGES = ['ug', 'kk-CN', 'ky-CN', 'uz-CN'];

export function getLanguageDir(lang: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': {
        common: zhCNCommon,
        editor: zhCNEditor,
        templates: zhcNTemplates,
        publish: zhCNPublish,
        errors: zhCNErrors,
      },
      en: {
        common: enCommon,
        editor: enEditor,
        templates: enTemplates,
        publish: enPublish,
        errors: enErrors,
      },
      ug: {
        common: ugCommon,
        editor: ugEditor,
        templates: ugTemplates,
        publish: ugPublish,
        errors: ugErrors,
      },
      'kk-CN': {
        common: kkCNCommon,
        editor: kkCNEditor,
        templates: kkCNTemplates,
        publish: kkCNPublish,
        errors: kkCNErrors,
      },
      'ky-CN': {
        common: kyCNCommon,
        editor: kyCNEditor,
        templates: kyCNTemplates,
        publish: kyCNPublish,
        errors: kyCNErrors,
      },
      'uz-CN': {
        common: uzCNCommon,
        editor: uzCNEditor,
        templates: uzCNTemplates,
        publish: uzCNPublish,
        errors: uzCNErrors,
      },
    },
    fallbackLng: 'en',
    ns: ['common', 'editor', 'templates', 'publish', 'errors'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
