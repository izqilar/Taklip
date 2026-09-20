import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { PuzzleElement } from '@h5design/core';
import { services } from '../../services';
import ColorField from '../../components/UI/ColorField';
import { PUZZLE_LAYOUTS, getPuzzleLayout, getShapePathD } from '@h5design/render';

interface PropertyPuzzleProps {
  el: PuzzleElement;
  update: (patch: Partial<PuzzleElement>) => void;
  commit: () => void;
}

/* ── 图标（与图集一致） ── */
function ReplaceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 单个布局缩略图（复用拼图几何路径） */
function LayoutThumb({ layoutId }: { layoutId: string }) {
  const layout = PUZZLE_LAYOUTS.find((l) => l.id === layoutId) ?? PUZZLE_LAYOUTS[0];
  return (
    <svg viewBox="0 0 1 1" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      {layout.pieces.map((p, i) => (
        <path
          key={i}
          d={getShapePathD(p)}
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.03}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export default function PropertyPuzzle({ el, update, commit }: PropertyPuzzleProps) {
  const { t } = useTranslation(['editor', 'common', 'errors']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const { images, layout, gap, padding, bgColor, placeholderColor, alias } = el;

  const handleAliasChange = (value: string) => {
    update({ alias: value });
    commit();
  };

  const handleLayoutChange = (id: typeof layout) => {
    update({ layout: id });
    commit();
  };

  const handleNumberChange = (key: 'gap' | 'padding', value: number) => {
    const clamped = Math.max(0, Math.min(40, Number.isNaN(value) ? 0 : value));
    update({ [key]: clamped } as Partial<PuzzleElement>);
    commit();
  };

  const handleColorChange = (key: 'bgColor' | 'placeholderColor', value: string) => {
    update({ [key]: value } as Partial<PuzzleElement>);
    commit();
  };

  const uploadFile = useCallback(
    async (file: File, onSuccess: (url: string) => void) => {
      setUploading(true);
      try {
        const asset = await services.uploadAsset(file);
        onSuccess(asset.url);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[puzzle] upload failed:', err);
        alert(t('errors:error.uploadFailed'));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (replaceInputRef.current) replaceInputRef.current.value = '';
        setReplaceIndex(null);
      }
    },
    [t],
  );

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, (url) => {
      update({ images: [...images, url] });
      commit();
    });
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceIndex === null) return;
    await uploadFile(file, (url) => {
      update({ images: images.map((src, idx) => (idx === replaceIndex ? url : src)) });
      commit();
    });
  };

  const triggerReplace = (idx: number) => {
    setReplaceIndex(idx);
    replaceInputRef.current?.click();
  };

  const handleDelete = (idx: number) => {
    update({ images: images.filter((_, i) => i !== idx) });
    commit();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 组件别名 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.alias')}</label>
        <input
          type="text"
          value={alias || ''}
          onChange={(e) => handleAliasChange(e.target.value)}
          placeholder={t('editor:property.alias')}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>

      {/* 拼图布局（18 种切换网格） */}
      <div>
        <label className="mb-2 block text-sm text-gray-700">{t('editor:puzzle.title')}</label>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAdd} className="hidden" />
        <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleReplace} className="hidden" />
        <div className="grid grid-cols-4 gap-2">
          {PUZZLE_LAYOUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleLayoutChange(item.id)}
              title={t(`editor:puzzle.layouts.${item.nameKey}`)}
              className={`relative flex aspect-square items-center justify-center rounded border p-1 transition ${
                el.layout === item.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <LayoutThumb layoutId={item.id} />
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          {t('editor:puzzle.currentLayout', {
            name: t(`editor:puzzle.layouts.${PUZZLE_LAYOUTS.find((l) => l.id === el.layout)?.nameKey ?? 'grid2x2Square'}`),
            needed: getPuzzleLayout(el.layout).count,
            have: images.length,
          })}
        </p>
      </div>

      {/* 编辑图片 */}
      <div>
        <label className="mb-2 block text-sm text-gray-700">{t('editor:property.editImages')}</label>
        <div className="grid grid-cols-3 gap-3">
          {images.map((src, idx) => (
            <div
              key={`${idx}-${src}`}
              className="group relative aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100"
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              {/* 序号 */}
              <div className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{idx + 1}</div>
              {/* 删除 */}
              <button
                type="button"
                onClick={() => handleDelete(idx)}
                disabled={uploading}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition hover:text-red-500"
                title={t('common:button.delete')}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
              {/* 替换 */}
              <button
                type="button"
                onClick={() => triggerReplace(idx)}
                disabled={uploading}
                className="absolute bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-white/90 text-gray-600 opacity-90 shadow-sm transition hover:text-blue-500 group-hover:opacity-100"
                title={t('editor:property.replace')}
              >
                <ReplaceIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {/* 添加图片 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 transition hover:border-blue-400 hover:text-blue-500"
          >
            {uploading ? <span className="text-xs">{t('common:status.loading')}</span> : <PlusIcon className="h-8 w-8" />}
          </button>
        </div>
      </div>

      {/* 外观 */}
      <div className="flex flex-col gap-3 rounded border border-gray-100 p-3">
        <span className="text-sm font-medium text-gray-700">{t('editor:puzzle.appearance')}</span>

        {/* 间距 */}
        <div className="flex items-center gap-3">
          <label className="w-16 shrink-0 text-sm text-gray-600">{t('editor:property.gap')}</label>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={gap}
            onChange={(e) => handleNumberChange('gap', parseFloat(e.target.value))}
            className="h-1.5 flex-1 min-w-0 cursor-pointer appearance-none rounded bg-gray-200 accent-blue-500"
          />
          <input
            type="number"
            min={0}
            max={40}
            step={1}
            value={gap}
            onChange={(e) => handleNumberChange('gap', parseFloat(e.target.value))}
            className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1 text-center text-sm text-gray-700 outline-none focus:border-blue-400"
          />
        </div>

        {/* 内边距 */}
        <div className="flex items-center gap-3">
          <label className="w-16 shrink-0 text-sm text-gray-600">{t('editor:property.padding')}</label>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={padding}
            onChange={(e) => handleNumberChange('padding', parseFloat(e.target.value))}
            className="h-1.5 flex-1 min-w-0 cursor-pointer appearance-none rounded bg-gray-200 accent-blue-500"
          />
          <input
            type="number"
            min={0}
            max={40}
            step={1}
            value={padding}
            onChange={(e) => handleNumberChange('padding', parseFloat(e.target.value))}
            className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1 text-center text-sm text-gray-700 outline-none focus:border-blue-400"
          />
        </div>

        {/* 背景色 / 占位色 */}
        <ColorField
          label={t('editor:property.bgColor')}
          labelWidth="w-16"
          value={bgColor}
          onChange={(v) => handleColorChange('bgColor', v)}
        />
        <ColorField
          label={t('editor:property.placeholderColor')}
          labelWidth="w-16"
          value={placeholderColor}
          onChange={(v) => handleColorChange('placeholderColor', v)}
        />
      </div>
    </div>
  );
}
