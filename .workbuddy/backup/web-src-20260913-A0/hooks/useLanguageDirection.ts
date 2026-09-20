/**
 * Hook for managing text direction (LTR/RTL) based on current language
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageDir } from '@/i18n';

export function useLanguageDirection() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const dir = getLanguageDir(lang);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return { dir, lang };
}
