import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {useEditorStore} from '@h5design/editor';
import {getAllRegisteredElements} from '@h5design/editor';
import { api, type AssetItem } from '@/api/client';
import type { Element, ElementType } from '@h5design/core';

/**
 * 素材面板（左侧）— 元素列表 + 图片上传 + 快捷键
 */
export default function MaterialPanel() {
  const { t } = useTranslation(['editor', 'common', 'errors']);
  const addElement = useEditorStore((s) => s.addElement);
  const elements = getAllRegisteredElements();

  /** 由视图层注入本地化占位内容（core 工厂保持语言中立） */
  const localizedDefaults = useCallback(
    (type: ElementType): Partial<Element> | undefined =>
      type === 'text'
        ? ({ text: t('editor:defaults.textContent') } as Partial<Element>)
        : undefined,
    [t],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [recentAssets, setRecentAssets] = useState<AssetItem[]>([]);
  const [showAssets, setShowAssets] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const asset = await api.uploadAsset(file);
      setRecentAssets((prev) => [asset, ...prev]);
      // 直接以 overrides 注入图片地址，避免异步竞态；
      // 同时按画布尺寸缩放，避免原图（常达上千像素）远超 375 画布导致
      // 选中后变换框/锚点几乎全部落在画布外、看似「无边界框」。
      const w = asset.width ?? 200;
      const h = asset.height ?? 200;
      const scale = Math.min(w > 320 ? 320 / w : 1, h > 480 ? 480 / h : 1);
      addElement('image', {
        src: asset.url,
        width: Math.round(w * scale),
        height: Math.round(h * scale),
      } as Partial<Element>);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[asset] upload failed:', err);
      alert(t('errors:error.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addElement, t]);

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const list = await api.listAssets('image');
      setRecentAssets(list);
    } catch {
      // Ignore
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  const toggleAssets = useCallback(() => {
    const next = !showAssets;
    setShowAssets(next);
    if (next && recentAssets.length === 0) {
      loadAssets();
    }
  }, [showAssets, recentAssets.length, loadAssets]);

  const handleSelectAsset = useCallback(
    (asset: AssetItem) => {
      const w = asset.width ?? 200;
      const h = asset.height ?? 200;
      const scale = Math.min(w > 320 ? 320 / w : 1, h > 480 ? 480 / h : 1);
      addElement('image', {
        src: asset.url,
        width: Math.round(w * scale),
        height: Math.round(h * scale),
      } as Partial<Element>);
    },
    [addElement],
  );

  return (
    <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {t('editor:panel.assets')}
      </h2>

      {/* 元素列表 */}
      {elements.map((item) => (
        <button
          key={item.type}
          onClick={() => addElement(item.type, localizedDefaults(item.type))}
          className="flex items-center gap-2.5 rounded-md border border-gray-700 bg-gray-700/50 px-2.5 py-2 text-start text-sm text-gray-200 transition hover:border-blue-500 hover:bg-gray-700"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded bg-gray-700 text-base font-medium text-blue-400">
            {item.icon}
          </span>
          {t(item.labelKey)}
        </button>
      ))}

      {/* 图片上传 */}
      <div className="mt-2 border-t border-gray-700 pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef?.current?.click()}
          disabled={uploading}
          className="w-full rounded-md border border-blue-600 bg-blue-600/20 px-2.5 py-2 text-sm text-blue-300 transition hover:bg-blue-600/30 disabled:opacity-50"
        >
          {uploading ? t('common:status.loading') : `+ ${t('common:button.upload')}`}
        </button>

        {/* 素材库切换 */}
        <button
          onClick={toggleAssets}
          className="mt-1 w-full rounded-md px-2.5 py-1.5 text-xs text-gray-400 transition hover:text-gray-200"
        >
          {showAssets ? '▼' : '▶'} {t('editor:panel.assets')}
        </button>

        {/* 素材列表 */}
        {showAssets && (
          <div className="mt-1 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {loadingAssets ? (
              <span className="px-2 py-1 text-xs text-gray-500">{t('common:status.loading')}</span>
            ) : recentAssets.length === 0 ? (
              <span className="px-2 py-1 text-xs text-gray-500">{t('common:status.empty')}</span>
            ) : (
              recentAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset)}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-gray-300 transition hover:bg-gray-700"
                >
                  <img
                    src={asset.url}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                    loading="lazy"
                  />
                  <span className="truncate">{asset.url.split('/').pop()}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 快捷键 */}
      <div className="mt-3 border-t border-gray-700 pt-2">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t('editor:panel.shortcuts')}
        </h3>
        <div className="flex flex-col gap-0.5 text-xs text-gray-500">
          <span>{t('editor:shortcuts.undo')}</span>
          <span>{t('editor:shortcuts.copy')}</span>
          <span>{t('editor:shortcuts.duplicate')}</span>
          <span>{t('editor:shortcuts.delete')}</span>
          <span>{t('editor:shortcuts.arrow')}</span>
          <span>{t('editor:shortcuts.layer')}</span>
        </div>
      </div>
    </div>
  );
}
