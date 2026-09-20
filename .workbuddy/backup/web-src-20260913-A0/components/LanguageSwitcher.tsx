/**
 * Language switcher dropdown component
 * 支持 dark / light / globe 三种视觉变体：
 * - dark：浅色文字，用于深色编辑器头部
 * - light：深色文字，用于浅色营销页头部
 * - globe：仅显示地球图标，用于新版红色固定顶栏
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';

interface LanguageSwitcherProps {
  variant?: 'dark' | 'light' | 'globe';
}

export default function LanguageSwitcher({ variant = 'dark' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function changeLang(code: string) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  const isGlobe = variant === 'globe';
  const isLight = variant === 'light';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
          isGlobe
            ? 'text-white hover:bg-white/10'
            : isLight
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 hover:bg-white/10'
        }`}
        aria-label="switch language"
      >
        {isGlobe ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ) : (
          <>
            <span>{current.name}</span>
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div
          className={`absolute end-0 z-50 mt-1 w-40 rounded-lg border py-1 shadow-xl ${
            isGlobe || !isLight
              ? 'border-white/10 bg-gray-800'
              : 'border-gray-100 bg-white'
          }`}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLang(lang.code)}
              className={`block w-full px-3 py-1.5 text-start text-sm transition ${
                isGlobe || !isLight
                  ? `hover:bg-white/10 ${lang.code === i18n.language ? 'text-blue-400' : 'text-gray-300'}`
                  : `hover:bg-gray-50 ${lang.code === i18n.language ? 'text-brand-600' : 'text-gray-700'}`
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
