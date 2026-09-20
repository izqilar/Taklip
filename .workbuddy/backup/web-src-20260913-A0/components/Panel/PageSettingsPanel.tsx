import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/store/editorStore';
import { api } from '@/api/client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import ColorPicker, { parseCssColor, rgbaToCss, isValidCssColor } from '@/components/UI/ColorPicker';
import BilingualSelect from '@/components/UI/BilingualSelect';
import Popover from '@/components/UI/Popover';

const BG_SIZE_OPTIONS = [
  { value: 'auto', label: '实际大小' },
  { value: 'contain', label: '自适应' },
  { value: '100% auto', label: '适配宽度' },
  { value: 'auto 100%', label: '适配高度' },
];

const BG_REPEAT_OPTIONS = [
  { value: 'no-repeat', label: '不平铺' },
  { value: 'repeat-x', label: '水平方向' },
  { value: 'repeat-y', label: '垂直方向' },
  { value: 'repeat', label: '平铺' },
];

const CHECKER =
  'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0)';

function CheckerBackground({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: CHECKER,
        backgroundSize: '10px 10px, 10px 10px',
        backgroundPosition: '0 0, 5px 5px',
        ...style,
      }}
    />
  );
}

function EyedropperIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10l5.5-5.5 1.95 1.95L7.16 12H5.21zm12.64 8.5c0 .28-.22.5-.5.5h-3.86c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h3.86c.28 0 .5.22.5.5z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CropIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.13 1L6 16a2 2 0 002 2h15" />
      <path d="M1 6.13L16 6a2 2 0 012 2v15" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function PageSettingsPanel() {
  const { t } = useTranslation(['editor', 'common', 'errors']);
  const activePage = useEditorStore((s) => s.activePage);
  const pages = useEditorStore((s) => s.project.pages);
  const page = pages[activePage];

  const renamePage = useEditorStore((s) => s.renamePage);
  const setPageHeight = useEditorStore((s) => s.setPageHeight);
  const setPageLongPage = useEditorStore((s) => s.setPageLongPage);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);
  const setPageBackgroundImage = useEditorStore((s) => s.setPageBackgroundImage);
  const setPageBackgroundSize = useEditorStore((s) => s.setPageBackgroundSize);
  const setPageBackgroundRepeat = useEditorStore((s) => s.setPageBackgroundRepeat);
  const syncPageBackgroundToAll = useEditorStore((s) => s.syncPageBackgroundToAll);

  const displayName = page.name || t('editor:page.defaultName', { index: activePage + 1 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorAnchorRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  const bg = page.background || 'transparent';
  const parsed = useMemo(() => parseCssColor(bg), [bg]);
  const colorCss = useMemo(() => rgbaToCss(parsed), [parsed]);
  const [colorInput, setColorInput] = useState(colorCss);

  useEffect(() => {
    setColorInput(colorCss);
  }, [colorCss]);

  const commitColorInput = useCallback(() => {
    const trimmed = colorInput.trim();
    if (!trimmed || !isValidCssColor(trimmed)) {
      setColorInput(colorCss);
      return;
    }
    const next = parseCssColor(trimmed);
    setPageBackground(rgbaToCss(next));
    setColorInput(rgbaToCss(next));
  }, [colorInput, colorCss, setPageBackground]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const asset = await api.uploadAsset(file);
        setPageBackgroundImage(asset.url);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[page bg] upload failed:', err);
        alert(t('errors:error.uploadFailed'));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [setPageBackgroundImage, t],
  );

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-gray-700">
      <h2 className="border-b border-gray-200 pb-2 text-center text-base font-semibold text-blue-500">
        {t('editor:panel.pageSettings')}
      </h2>

      {/* 页面名称 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:page.pageName')}</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => renamePage(activePage, e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
        />
      </div>

      {/* 页面长度 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:page.pageLength')}</label>
        <input
          type="number"
          min={300}
          max={3000}
          step={1}
          value={page.height ?? 667}
          onChange={(e) => setPageHeight(Number(e.target.value))}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
        />
      </div>

      {/* 长页面模式 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-sm text-gray-700">
          {t('editor:page.longPageMode')}
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[10px] text-white"
            title={t('editor:page.longPageTip')}
          >
            ?
          </span>
        </label>
        <button
          onClick={() => setPageLongPage(!page.longPage)}
          className={`relative h-5 w-9 rounded-full transition ${
            page.longPage ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition"
            style={{ left: page.longPage ? 18 : 2 }}
          />
        </button>
      </div>

      {/* 背景颜色 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:page.backgroundColor')}</label>
          <div ref={colorAnchorRef} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setColorOpen(!colorOpen)}
              className="flex h-8 w-8 items-center justify-center rounded text-blue-500 hover:bg-blue-50"
              title={t('editor:page.backgroundColor')}
            >
              <EyedropperIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setColorOpen(!colorOpen)}
              className="relative h-8 w-8 overflow-hidden rounded border border-gray-300"
            >
              <CheckerBackground className="absolute inset-0" />
              <span className="absolute inset-0" style={{ backgroundColor: colorCss }} />
              <span className="absolute bottom-0 right-0 flex h-3 w-3 items-center justify-center bg-white text-[8px] text-gray-500">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-2 w-2">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <div className="pl-23">
          <input
            type="text"
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onBlur={commitColorInput}
            onKeyDown={(e) => e.key === 'Enter' && commitColorInput()}
            placeholder="#ff22cc"
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
          />
        </div>

        <Popover anchor={colorAnchorRef.current} open={colorOpen} onClose={() => setColorOpen(false)}>
          <ColorPicker
            value={bg}
            onChange={(v) => setPageBackground(v)}
            onClear={() => setPageBackground('transparent')}
            onConfirm={() => setColorOpen(false)}
            clearLabel={t('common:button.clear')}
            confirmLabel={t('common:button.confirm')}
          />
        </Popover>
      </div>

      {/* 背景图片 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:page.backgroundImage')}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          {!page.backgroundImage ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-blue-500 transition hover:border-blue-400 hover:bg-blue-50"
            >
              <PlusIcon className="h-4 w-4" />
              {uploading ? t('common:status.loading') : t('editor:page.setBackgroundImage')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-500 transition hover:bg-blue-100"
            >
              <PlusIcon className="h-4 w-4" />
              {uploading ? t('common:status.loading') : t('editor:page.changeBackgroundImage')}
            </button>
          )}
        </div>

        {page.backgroundImage && (
          <div className="flex flex-col gap-2">
            <div className="relative overflow-hidden rounded border border-gray-200">
              <CheckerBackground className="absolute inset-0" />
              <img
                src={page.backgroundImage}
                alt=""
                className="relative mx-auto block max-h-48 w-auto object-contain"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-500 transition hover:bg-blue-100"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {t('common:button.change')}
              </button>
              <button
                type="button"
                onClick={() => alert(t('editor:page.cropTip'))}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-500 transition hover:bg-blue-100"
              >
                <CropIcon className="h-3.5 w-3.5" />
                {t('common:button.crop')}
              </button>
              <button
                type="button"
                onClick={() => setPageBackgroundImage('')}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-500 transition hover:bg-blue-100"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {t('common:button.delete')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 背景尺寸 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:page.backgroundSize')}</label>
        <div className="min-w-0 flex-1">
          <BilingualSelect
            value={page.backgroundSize ?? 'cover'}
            options={BG_SIZE_OPTIONS}
            onChange={setPageBackgroundSize}
          />
        </div>
      </div>

      {/* 背景平铺 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:page.backgroundRepeat')}</label>
        <div className="min-w-0 flex-1">
          <BilingualSelect
            value={page.backgroundRepeat ?? 'no-repeat'}
            options={BG_REPEAT_OPTIONS}
            onChange={setPageBackgroundRepeat}
          />
        </div>
      </div>

      {/* 同步到其他页 */}
      <button
        onClick={syncPageBackgroundToAll}
        className="mt-1 w-full rounded bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
      >
        {t('editor:page.syncBackground')}
      </button>
    </div>
  );
}
