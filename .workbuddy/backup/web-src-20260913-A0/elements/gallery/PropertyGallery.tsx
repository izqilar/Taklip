import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { GalleryElement, GalleryTransition } from '@h5design/core';
import { api } from '@/api/client';

interface PropertyGalleryProps {
  el: GalleryElement;
  update: (patch: Partial<GalleryElement>) => void;
  commit: () => void;
}

const TRANSITIONS: GalleryTransition[] = [
  'random',
  'blinds',
  'blinds3d',
  'randomBlocks',
  'blocks',
  'flipBook',
  'camera',
  'concentric',
  'cube',
  'explode',
  'fade',
  'fall',
  'transition',
  'circle',
  'slide',
  'swipe',
  'twist',
  'waterfall',
  'wave',
  'zipper',
];

/** 剪刀图标 */
function CropIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

/** 刷新/替换图标 */
function ReplaceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

/** 删除图标 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** 加号图标 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function PropertyGallery({ el, update, commit }: PropertyGalleryProps) {
  const { t } = useTranslation(['editor', 'common', 'errors']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const { images, currentIndex, switchMode, switchInterval, transition, alias } = el;

  const handleAliasChange = (value: string) => {
    update({ alias: value });
    commit();
  };

  const handleSwitchMode = (mode: 'manual' | 'auto') => {
    update({ switchMode: mode });
    commit();
  };

  const handleIntervalChange = (value: number) => {
    const clamped = Math.max(1, Math.min(10, Number.isNaN(value) ? 1 : value));
    update({ switchInterval: clamped });
    commit();
  };

  const handleTransitionChange = (value: GalleryTransition) => {
    update({ transition: value });
    commit();
  };

  const uploadFile = useCallback(
    async (file: File, onSuccess: (url: string) => void) => {
      setUploading(true);
      try {
        const asset = await api.uploadAsset(file);
        onSuccess(asset.url);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[gallery] upload failed:', err);
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
      const next = [...images, url];
      update({ images: next, currentIndex: next.length - 1 });
      commit();
    });
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceIndex === null) return;
    await uploadFile(file, (url) => {
      const next = images.map((src, idx) => (idx === replaceIndex ? url : src));
      update({ images: next });
      commit();
    });
  };

  const triggerReplace = (idx: number) => {
    setReplaceIndex(idx);
    replaceInputRef.current?.click();
  };

  const handleDelete = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    const newIndex = Math.min(currentIndex, Math.max(0, next.length - 1));
    update({ images: next, currentIndex: newIndex });
    commit();
  };

  const handleCrop = () => {
    // 裁剪功能暂用提示，后续可接入图片裁剪弹窗
    alert(t('editor:tool.comingSoon'));
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

      {/* 切换方式 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.switchMode')}</label>
        <div className="flex flex-1 rounded border border-gray-300 p-0.5">
          {(['manual', 'auto'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleSwitchMode(mode)}
              className={`flex-1 rounded px-2 py-1 text-sm transition ${
                switchMode === mode ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`editor:switchMode.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* 切换时间 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.switchInterval')}</label>
        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={switchInterval}
          onChange={(e) => handleIntervalChange(parseFloat(e.target.value))}
          className="h-1.5 flex-1 max-w-[140px] min-w-0 cursor-pointer appearance-none rounded bg-gray-200 accent-blue-500"
        />
        <input
          type="number"
          min={1}
          max={10}
          step={0.5}
          value={switchInterval}
          onChange={(e) => handleIntervalChange(parseFloat(e.target.value))}
          className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1 text-center text-sm text-gray-700 outline-none focus:border-blue-400 ml-auto"
        />
      </div>

      {/* 切换动画 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.transition')}</label>
        <select
          value={transition}
          onChange={(e) => handleTransitionChange(e.target.value as GalleryTransition)}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        >
          {TRANSITIONS.map((tKey) => (
            <option key={tKey} value={tKey}>
              {t(`editor:transition.${tKey}`)}
            </option>
          ))}
        </select>
      </div>

      {/* 编辑图片 */}
      <div>
        <label className="mb-2 block text-sm text-gray-700">{t('editor:property.editImages')}</label>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAdd} className="hidden" />
        <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleReplace} className="hidden" />
        <div className="grid grid-cols-2 gap-3">
          {images.map((src, idx) => (
            <div
              key={`${idx}-${src}`}
              className={`group relative aspect-video overflow-hidden rounded border bg-gray-100 ${
                idx === currentIndex ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
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
              {/* 裁剪 + 替换 */}
              <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-2 opacity-90 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={handleCrop}
                  disabled={uploading}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition hover:text-blue-500"
                  title={t('editor:property.crop')}
                >
                  <CropIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => triggerReplace(idx)}
                  disabled={uploading}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition hover:text-blue-500"
                  title={t('editor:property.replace')}
                >
                  <ReplaceIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* 当前帧标记 */}
              {idx === currentIndex && (
                <div className="absolute left-1 top-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">{t('editor:property.current')}</div>
              )}
            </div>
          ))}
          {/* 添加图片 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-video items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 transition hover:border-blue-400 hover:text-blue-500"
          >
            {uploading ? (
              <span className="text-xs">{t('common:status.loading')}</span>
            ) : (
              <PlusIcon className="h-8 w-8" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
