/**
 * 动画选择对话框
 * 提供「入场 / 强调 / 出场」三类动画网格，hover 时在卡片本身的预览舞台里演示，点击后应用。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import type { AnimationCategory } from '@h5design/core';
import { getAnimationsByCategory } from '@/animations/registry';
import { playPreviewAnimation } from '@/animations/presets';

interface AnimationPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (category: AnimationCategory, key: string) => void;
}

const CATEGORIES: { key: AnimationCategory; labelKey: string }[] = [
  { key: 'enter', labelKey: 'editor:animation.category.enter' },
  { key: 'emphasis', labelKey: 'editor:animation.category.emphasis' },
  { key: 'exit', labelKey: 'editor:animation.category.exit' },
];

export default function AnimationPickerDialog({ open, onClose, onSelect }: AnimationPickerDialogProps) {
  const { t } = useTranslation(['editor']);
  const [category, setCategory] = useState<AnimationCategory>('enter');
  const iconRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tweenRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);

  const resetPreview = useCallback(() => {
    tweenRef.current?.kill();
    tweenRef.current = null;
    // 清理所有图标的内联 transform/opacity，回到由 CSS 控制的设计态（颜色等不受影响）
    Object.values(iconRefs.current).forEach((el) => {
      if (el) gsap.set(el, { clearProps: 'all' });
    });
  }, []);

  const handleMouseEnter = useCallback((key: string, cat: AnimationCategory) => {
    const el = iconRefs.current[key];
    if (!el) return;
    resetPreview();
    // 在卡片自身图标上演示：按图标尺寸放大幅度并循环几次，明显展示动画方向与力度
    tweenRef.current = playPreviewAnimation(el, {
      category: cat,
      type: key,
      duration: 0.6,
      delay: 0,
      repeat: 0,
      loop: false,
    });
  }, [resetPreview]);

  const handleMouseLeave = useCallback(() => {
    resetPreview();
  }, [resetPreview]);

  const handleSelect = (key: string, cat: AnimationCategory) => {
    onSelect(cat, key);
    resetPreview();
    onClose();
  };

  useEffect(() => {
    if (!open) resetPreview();
  }, [open, resetPreview]);

  if (!open) return null;

  const items = getAnimationsByCategory(category);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-[560px] flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800">{t('editor:animation.pickerTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common:button.close')}
          >
            ×
          </button>
        </div>

        {/* 分类 Tab */}
        <div className="flex border-b border-gray-200">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition ${
                category === cat.key
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>

        {/* 主体：动画网格 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onMouseEnter={() => handleMouseEnter(item.key, item.category)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleSelect(item.key, item.category)}
                className="group flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 transition hover:border-blue-400 hover:bg-blue-50"
              >
                {/* 预览舞台：裁剪容器保证位移类动画在卡片内清晰可见且不串格；perspective 让翻转类可见 */}
                <div
                  className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-gray-50 transition group-hover:bg-blue-50/60"
                  style={{ perspective: 600 }}
                >
                  <div
                    ref={(el) => { iconRefs.current[item.key] = el; }}
                    className="text-gray-700 transition-colors group-hover:text-blue-500"
                    style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-11 w-11">
                      <path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762" />
                    </svg>
                  </div>
                </div>
                <span className="text-xs text-gray-700 transition group-hover:text-blue-600">{t(item.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
