import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';
import { services } from '../../services';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  CANVAS_PRESETS,
  mmToPx,
  pxToMm,
  MM_TO_PX_DPI,
  CANVAS_DEFAULT,
  type CanvasPreset,
} from '@h5design/core';
import ColorPicker, { parseCssColor, rgbaToCss, isValidCssColor } from '../UI/ColorPicker';
import BilingualSelect from '../UI/BilingualSelect';
import Popover from '../UI/Popover';
import SliderField from '../UI/SliderField';
import ImageCropDialog from './ImageCropDialog';
import { cropAndUploadImage } from '../../utils/cropBackgroundImage';
import type { ImageClip } from '@h5design/core';

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

/** 预览区最大尺寸（px），超出按等比缩放，最大只放到 1:1 */
const PREVIEW_MAX_W = 260;
const PREVIEW_MAX_H = 200;

/**
 * 背景图定位：与画布 PageBackgroundImage 的 x/y 计算保持一致。
 * （CSS 默认 0% 0%，而画布对 cover/contain 是居中的，故逐档对齐）
 */
function previewBgPosition(size: string): string {
  if (size === 'auto') return 'left top';
  if (size === '100%' || size === '100% auto') return 'center top';
  if (size === 'auto 100%') return 'left center';
  return 'center';
}

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

  // 防御：空 schema（pages 为空或 activePage 越界）时避免 crash
  // （坏数据模板 T-1009/T-1010 曾因 pages=[] 导致 page=undefined → "reading name/height"）
  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-gray-400">
        {t('editor:page.noPageData', { defaultValue: '当前页面无数据' })}
      </div>
    );
  }

  const renamePage = useEditorStore((s) => s.renamePage);
  const setPageHeight = useEditorStore((s) => s.setPageHeight);
  const setPageLongPage = useEditorStore((s) => s.setPageLongPage);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);
  const setPageBackgroundImage = useEditorStore((s) => s.setPageBackgroundImage);
  const setPageBackgroundSize = useEditorStore((s) => s.setPageBackgroundSize);
  const setPageBackgroundRepeat = useEditorStore((s) => s.setPageBackgroundRepeat);
  const setPageBackgroundImageOpacity = useEditorStore((s) => s.setPageBackgroundImageOpacity);
  const syncPageBackgroundToAll = useEditorStore((s) => s.syncPageBackgroundToAll);

  // 当前画布真值（px）：width 为项目级（所有页面共享）、height 为页面级
  const project = useEditorStore((s) => s.project);
  const setProjectWidth = useEditorStore((s) => s.setProjectWidth);
  const curWpx = project.width ?? CANVAS_DEFAULT.width;
  const curHpx = page.height ?? CANVAS_DEFAULT.height;

  // 命中预设：px 数值与预设折算 px 完全一致才认为命中（用于下拉框回显 + 单位初始化）
  const presetPxW = (p: CanvasPreset) => (p.unit === 'px' ? p.width : mmToPx(p.width));
  const presetPxH = (p: CanvasPreset) => (p.unit === 'px' ? p.height : mmToPx(p.height));
  const matchedPreset = useMemo(
    () =>
      CANVAS_PRESETS.find(
        (p) => presetPxW(p) === curWpx && presetPxH(p) === curHpx,
      ),
    [curWpx, curHpx],
  );

  // 单位：首次挂载按命中预设的单位初始化（名片/贺卡默认 mm，手机默认 px）
  const [unit, setUnit] = useState<'px' | 'mm'>(matchedPreset ? matchedPreset.unit : 'px');
  const toDisplay = (px: number) =>
    unit === 'px' ? Math.round(px) : Math.round(pxToMm(px) * 10) / 10;
  const fromDisplay = (v: number) => (unit === 'px' ? Math.round(v) : mmToPx(v));

  const applyPreset = (p: CanvasPreset) => {
    setUnit(p.unit);
    setProjectWidth(presetPxW(p));
    setPageHeight(presetPxH(p));
  };
  const onPresetChange = (id: string) => {
    if (id === 'custom') return;
    const p = CANVAS_PRESETS.find((x) => x.id === id);
    if (p) applyPreset(p);
  };
  const onWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '') return;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    setProjectWidth(fromDisplay(n));
  };
  const onHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '') return;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    setPageHeight(fromDisplay(n));
  };
  const onUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUnit(e.target.value as 'px' | 'mm');
  };

  const displayName = page.name || t('editor:page.defaultName', { index: activePage + 1 });

  // 预览框按当前画布比例等比缩放（与画布同一宽高比，所见即画布）
  const previewBox = useMemo(() => {
    const s = Math.min(PREVIEW_MAX_W / curWpx, PREVIEW_MAX_H / curHpx, 1);
    return {
      w: Math.max(48, Math.round(curWpx * s)),
      h: Math.max(48, Math.round(curHpx * s)),
    };
  }, [curWpx, curHpx]);

  // 背景图 URL 用于 CSS url()：剔除引号/反斜杠/换行，避免样式解析被截断
  const cssBgUrl = useMemo(() => {
    const src = page.backgroundImage;
    if (!src) return undefined;
    return `url("${src.replace(/["\\\n\r]/g, '')}")`;
  }, [page.backgroundImage]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorAnchorRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  // 背景图裁剪：对话框开关 / 处理中 / 原图原始尺寸（用于对话框预览比例）
  const [cropOpen, setCropOpen] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropNatural, setCropNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // 原图原始尺寸：预览区改为 CSS 背景层后没有可见 <img>，这里用离屏 Image 量取，
  // 供裁剪对话框计算预览比例（不写入 DOM，避免多余节点）
  useEffect(() => {
    const src = page.backgroundImage;
    if (!src) {
      setCropNatural({ w: 0, h: 0 });
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setCropNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [page.backgroundImage]);

  const openCropDialog = useCallback(() => {
    setCropOpen(true);
  }, []);

  const handleCropApply = useCallback(
    async (clip: ImageClip) => {
      const src = page.backgroundImage;
      if (!src) return;
      setCropping(true);
      try {
        // clip.crop 类型可选（运行时对话框总会给出），缺省按整图处理
        const rect = clip.crop ?? { x: 0, y: 0, width: 1, height: 1 };
        const url = await cropAndUploadImage(src, rect, clip.shape);
        setPageBackgroundImage(url);
        setCropOpen(false);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[page bg] crop failed:', err);
        alert(t('editor:page.cropFailed', { defaultValue: '裁剪失败，请重试' }));
      } finally {
        setCropping(false);
      }
    },
    [page.backgroundImage, setPageBackgroundImage, t],
  );

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
        const asset = await services.uploadAsset(file);
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

      {/* 画布规格（预设列表框） */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-700">{t('editor:page.canvasSize', { defaultValue: '画布规格' })}</label>
        <select
          value={matchedPreset ? matchedPreset.id : 'custom'}
          onChange={(e) => onPresetChange(e.target.value)}
          className="min-w-0 w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
        >
          <optgroup label="手机屏幕">
            {CANVAS_PRESETS.filter((p) => p.category === 'mobile').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="名片">
            {CANVAS_PRESETS.filter((p) => p.category === 'card').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="贺卡 / 请柬">
            {CANVAS_PRESETS.filter((p) => p.category === 'greeting').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="社交媒体 / 海报">
            {CANVAS_PRESETS.filter((p) => p.category === 'social').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="印刷纸张">
            {CANVAS_PRESETS.filter((p) => p.category === 'print').map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </optgroup>
          <option value="custom">{t('editor:page.custom', { defaultValue: '自定义尺寸' })}</option>
        </select>
      </div>

      {/* 宽度 / 高度 / 单位（自定义尺寸） */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1">
          <label className="shrink-0 text-sm text-gray-700">{t('editor:page.width', { defaultValue: '宽度' })}</label>
          <input
            type="number"
            min={1}
            step={unit === 'px' ? 1 : 0.1}
            value={toDisplay(curWpx)}
            onChange={onWidthChange}
            className="min-w-0 flex-1 rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
          />
        </div>
        <div className="flex flex-1 items-center gap-1">
          <label className="shrink-0 text-sm text-gray-700">{t('editor:page.height', { defaultValue: '高度' })}</label>
          <input
            type="number"
            min={1}
            step={unit === 'px' ? 1 : 0.1}
            value={toDisplay(curHpx)}
            onChange={onHeightChange}
            className="min-w-0 flex-1 rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
          />
        </div>
        <select
          value={unit}
          onChange={onUnitChange}
          className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-400"
        >
          <option value="px">{t('editor:page.unitPx', { defaultValue: '像素' })}</option>
          <option value="mm">{t('editor:page.unitMm', { defaultValue: '毫米' })}</option>
        </select>
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
            {/* 预览：与画布同一口径——页面底色 + 背景图(size/repeat) + 图片透明度 */}
            <div className="flex justify-center">
              <div
                className="relative overflow-hidden rounded border border-gray-200"
                style={{ width: previewBox.w, height: previewBox.h }}
              >
                <CheckerBackground className="absolute inset-0" />
                {/* 页面背景色（画布未设置时为纯白） */}
                <div
                  className="absolute inset-0"
                  style={{ background: page.background ? colorCss : '#ffffff' }}
                />
                {/* 背景图片层：opacity 只作用于图片本身，不牵连背景色 */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: cssBgUrl,
                    backgroundSize: page.backgroundSize ?? 'contain',
                    backgroundRepeat: page.backgroundRepeat ?? 'no-repeat',
                    backgroundPosition: previewBgPosition(page.backgroundSize ?? 'contain'),
                    opacity: page.backgroundImageOpacity ?? 1,
                  }}
                />
              </div>
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
                onClick={openCropDialog}
                disabled={cropping}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-500 transition hover:bg-blue-100 disabled:opacity-50"
              >
                <CropIcon className="h-3.5 w-3.5" />
                {cropping ? t('common:status.loading') : t('common:button.crop')}
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

      {/* 背景图片透明度（仅已设置背景图时显示；100 = 完全不透明） */}
      {page.backgroundImage && (
        <SliderField
          label={t('editor:page.backgroundImageOpacity', { defaultValue: '透明度' })}
          value={Math.round((page.backgroundImageOpacity ?? 1) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setPageBackgroundImageOpacity(v / 100)}
        />
      )}

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

      {/* 背景图裁剪对话框（复用图片对象的裁剪对话框，隐藏形状选择） */}
      {page.backgroundImage && (
        <ImageCropDialog
          open={cropOpen}
          src={page.backgroundImage}
          naturalWidth={cropNatural.w || undefined}
          naturalHeight={cropNatural.h || undefined}
          hideShapes
          onApply={handleCropApply}
          onClose={() => setCropOpen(false)}
        />
      )}
    </div>
  );
}
