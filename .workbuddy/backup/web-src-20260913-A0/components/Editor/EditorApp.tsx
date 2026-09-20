/**
 * 编辑器主组件 — 八图 H5 编辑器风格
 * 顶部功能区 + 左侧页面/图层面板 + 中间画布 + 右侧属性面板
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toCanvas } from 'html-to-image';
import PageList from '@/components/Panel/PageList';
import PropertyPanel from '@/components/Panel/PropertyPanel';
import ErrorBoundary from '@/components/ErrorBoundary';
import EditorCanvas from '@/components/Canvas/EditorCanvas';
import PreviewModal from '@/components/Preview/PreviewModal';
import PublishModal from '@/components/Publish/PublishModal';
import type { ImageExportOptions, ImageFormat } from '@/components/Publish/PublishModal';
import DOMRenderer from '@/components/Preview/DOMRenderer';
import VersionHistoryModal from '@/components/Editor/VersionHistoryModal';
import SettingsPanel from '@/components/Editor/SettingsPanel';
import MusicManagerModal from '@/components/Editor/MusicManagerModal';
import ComponentLibraryMenu, {
  COMPONENT_ITEM_MAP,
  type ComponentItemKey,
} from '@/components/Editor/ComponentLibraryMenu';
import { useEditorStore, useCanUndo, useCanRedo } from '@/store/editorStore';
import { useKeyboard } from '@/hooks/useKeyboard';
import { api } from '@/api/client';
import { validateImageFile, readImageDimensions } from '@/utils/image';
import { preloadImages, cloneAndInline, TRANSPARENT_PNG } from '@/utils/exportVideo';
import { downloadDataUrl } from '@/utils/share';
import type { Element, ElementType, Project } from '@h5design/core';
import { createDefaultSettings } from '@h5design/core';

const TOOLS = [
  { key: 'text', icon: 'T', labelKey: 'editor:tool.text' },
  { key: 'shape', icon: '▭', labelKey: 'editor:tool.shape' },
  { key: 'multimedia', icon: '🎬', labelKey: 'editor:tool.multimedia' },
  { key: 'component', icon: '⊞', labelKey: 'editor:tool.component' },
  { key: 'effect', icon: '✨', labelKey: 'editor:tool.effect' },
] as const;

/** 多媒体下拉项：图片 / 音乐 / 视频（图标沿用顶部工具栏对应的 ImageToolIcon / MusicToolIcon / VideoToolIcon）。 */
const MULTIMEDIA_MENU_ITEMS: { key: 'image' | 'music' | 'video'; labelKey: string }[] = [
  { key: 'image', labelKey: 'editor:tool.image' },
  { key: 'music', labelKey: 'editor:tool.music' },
  { key: 'video', labelKey: 'editor:tool.video' },
];

const TEXT_PRESETS = [
  { key: 'body', labelKey: 'editor:textPreset.body', fontSize: 14, fontWeight: 'normal' as const },
  { key: 'smallTitle', labelKey: 'editor:textPreset.smallTitle', fontSize: 18, fontWeight: 'bold' as const },
  { key: 'subTitle', labelKey: 'editor:textPreset.subTitle', fontSize: 24, fontWeight: 'bold' as const },
  { key: 'title', labelKey: 'editor:textPreset.title', fontSize: 32, fontWeight: 'bold' as const },
  { key: 'bigTitle', labelKey: 'editor:textPreset.bigTitle', fontSize: 48, fontWeight: 'bold' as const },
];

function ShapeMenuIcon({ type }: { type: string }) {
  const iconClass = 'h-4 w-4 text-current';
  switch (type) {
    case 'rect':
      return <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>;
    case 'line':
      return <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="13" x2="13" y2="3" /></svg>;
    case 'arrow':
      return (
        <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="13" x2="13" y2="3" />
          <polyline points="6,3 13,3 13,10" />
        </svg>
      );
    case 'ellipse':
      return <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /></svg>;
    case 'polygon':
      return <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><polygon points="8,2 14,13 2,13" /></svg>;
    case 'star':
      return <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><polygon points="8,2 9.5,6 14,6.5 10.5,9.5 11.5,14 8,11.5 4.5,14 5.5,9.5 2,6.5 6.5,6" /></svg>;
    case 'library':
      return (
        <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <polygon points="11.5,14 9,9.5 14,9.5" />
        </svg>
      );
    default:
      return null;
  }
}

function ComponentToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="7" x="3" y="3" rx="1" />
      <rect width="9" height="7" x="3" y="14" rx="1" />
      <rect width="5" height="7" x="16" y="14" rx="1" />
    </svg>
  );
}

function ShapeToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19.5 7a24 24 0 0 1 0 10" />
      <path d="M4.5 7a24 24 0 0 0 0 10" />
      <path d="M7 19.5a24 24 0 0 0 10 0" />
      <path d="M7 4.5a24 24 0 0 1 10 0" />
      <rect x="17" y="17" width="5" height="5" rx="1" />
      <rect x="17" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="17" width="5" height="5" rx="1" />
      <rect x="2" y="2" width="5" height="5" rx="1" />
    </svg>
  );
}

function ImageToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function TextToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 4v16" />
      <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
      <path d="M9 20h6" />
    </svg>
  );
}

function MusicToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function EffectToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  );
}

function MultimediaToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 15.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997a1 1 0 0 1-1.517-.86z" />
      <path d="M21 12.17V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
      <path d="m6 21 5-5" />
      <circle cx="9" cy="9" r="2" />
    </svg>
  );
}

function VideoToolIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

const SHAPE_MENU_ITEMS: { key: string; labelKey: string; shortcut?: string }[] = [
  { key: 'rect', labelKey: 'editor:shapeMenu.rect', shortcut: 'R' },
  { key: 'line', labelKey: 'editor:shapeMenu.line', shortcut: 'L' },
  { key: 'arrow', labelKey: 'editor:shapeMenu.arrow', shortcut: 'Shift+L' },
  { key: 'ellipse', labelKey: 'editor:shapeMenu.ellipse', shortcut: 'O' },
  { key: 'polygon', labelKey: 'editor:shapeMenu.polygon' },
  { key: 'star', labelKey: 'editor:shapeMenu.star' },
  { key: 'library', labelKey: 'editor:shapeMenu.library', shortcut: '…' },
];

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
  );
}

export default function EditorApp() {
  useKeyboard();
  const { t } = useTranslation(['common', 'editor', 'errors']);
  const navigate = useNavigate();

  const title = useEditorStore((s) => s.project.title);
  const setProjectTitle = useEditorStore((s) => s.setProjectTitle);
  const project = useEditorStore((s) => s.project);
  const activePage = useEditorStore((s) => s.activePage);
  const projectId = useEditorStore((s) => s.projectId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const setSaving = useEditorStore((s) => s.setSaving);
  const setDirty = useEditorStore((s) => s.setDirty);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const setProjectSettings = useEditorStore((s) => s.setProjectSettings);
  const addElement = useEditorStore((s) => s.addElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [componentMenuOpen, setComponentMenuOpen] = useState(false);
  const [multimediaMenuOpen, setMultimediaMenuOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const textMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const componentMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const multimediaMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 导出图片：离屏渲染当前页 / 全部页长图并截图下载
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const exportRef = useRef<HTMLDivElement>(null);
  // 记录本次导出指定的页码（供离屏 DOM 渲染当前页时读取，区别于编辑器激活页 activePage）
  const exportPageRef = useRef<number>(0);
  // 长图模式下渲染「全部页」的离屏节点（图片已内联为 dataURL 规避 CORS）
  const exportAllRef = useRef<HTMLDivElement>(null);
  const [exportProject, setExportProject] = useState<Project | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSaveAt = useRef(0);

  const saveProject = useCallback(
    async (snapshot = false) => {
      if (isSaving) return;
      setSaving(true);
      try {
        if (projectId) {
          await api.updateProject(projectId, {
            title: project.title,
            schema: project,
            snapshot,
          });
        } else {
          const res = await api.createProject(project.title);
          await api.updateProject(res.id, { schema: project, snapshot });
          setProjectId(String(res.id));
        }
        setDirty(false);
        lastSaveAt.current = Date.now();
      } catch (err) {
        console.error('Save failed:', err);
        alert(t('errors:error.saveFailed'));
      } finally {
        setSaving(false);
      }
    },
    [isSaving, projectId, project, setSaving, setDirty, setProjectId, t],
  );

  /* ── 自动保存 ── */
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (useEditorStore.getState().isDirty) saveProject();
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [saveProject]);

  useEffect(() => {
    if (!isDirty) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    const sinceLast = Date.now() - lastSaveAt.current;
    const wait = sinceLast < 8000 ? Math.max(0, 8000 - sinceLast) : 3000;
    saveDebounce.current = setTimeout(() => {
      if (useEditorStore.getState().isDirty) saveProject();
    }, wait);
    return () => {
      if (saveDebounce.current) clearTimeout(saveDebounce.current);
    };
  }, [isDirty, saveProject]);

  useEffect(() => {
    const onBlur = () => {
      if (useEditorStore.getState().isDirty) saveProject();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [saveProject]);

  const handleBack = useCallback(() => {
    if (isDirty) saveProject();
    navigate('/dashboard');
  }, [isDirty, saveProject, navigate]);

  // 导出图片：mode='current' 指定页单图，mode='all' 全部页纵向长图；
  // format 对齐发布设置对话框所选图片格式（jpeg / png / webp）。
  const handleExport = useCallback(
    async (opts: ImageExportOptions) => {
      const { mode, format, page } = opts;
      if (exportingRef.current) return;
      exportingRef.current = true;
      setExporting(true);
      // 记录本次导出目标页码，供离屏 DOM 渲染指定页（区别于编辑器激活页 activePage）
      exportPageRef.current = page;
      try {
        const width = project.width ?? 375;
        const height = project.height ?? 667;
        // 预加载并内联所有图片为 dataURL，规避 html-to-image 远程拉取的 CORS 污染（曾整屏空白）
        console.log('[export] preloadImages start');
        const imgMap = await preloadImages(project);
        console.log('[export] preloadImages done, map size', imgMap.size);
        console.log('[export] cloneAndInline start');
        const inlineProject = cloneAndInline(project, imgMap);
        console.log('[export] cloneAndInline done');
        setExportProject(inlineProject);
        // 等待离屏 DOM 提交 + 图片解码
        await new Promise((r) => setTimeout(r, 600));

        // jpeg 必须不透明底色（png/webp 沿用编辑器画布底色 #f0f2f5，与预览一致）
        const backgroundColor = format === 'jpeg' ? '#ffffff' : '#f0f2f5';

        if (mode === 'all') {
          const node = exportAllRef.current;
          if (!node) {
            console.warn('[export] exportAllRef is null');
            return;
          }
          await Promise.all(
            Array.from(node.querySelectorAll('img')).map((img) =>
              img.decode().catch(() => undefined),
            ),
          );
          const imgSrcs = Array.from(node.querySelectorAll('img')).map((img) => img.src.slice(0, 120));
          console.log('[export] DOM ready (all), images=', imgSrcs.length, imgSrcs);
          const pageCount = Math.max(1, inlineProject.pages?.length ?? 1);
          const totalH = height * pageCount;
          // canvas 上限约 16384px，超出则下调 pixelRatio
          let pixelRatio = 2;
          if (totalH * pixelRatio > 16384) {
            pixelRatio = Math.max(1, Math.floor(16384 / totalH));
          }
          console.log('[export] toCanvas(all) start', { width, totalH, pixelRatio, format });
          const canvas = await toCanvas(node, {
            // 已预加载并内联为 dataURL，无需 cacheBust；cacheBust 可能破坏 dataURL 导致 img error。
            cacheBust: false,
            imagePlaceholder: TRANSPARENT_PNG,
            // 跳过 web 字体重新拉取/内联：自定义字体已在本页加载，文字仍按实际字体渲染；
            // 跳过可避免 html-to-image 跨域拉取字体 CSS 失败时整体 reject 导致「导出图片失败」。
            skipFonts: true,
            // 与编辑器画布底色一致：半透明背景色调与编辑器完全一致，
            // 避免导出后在白色查看器/白色录制底上观感偏浅，造成「透明度丢失」的错觉。
            backgroundColor,
            // 单张图片加载失败时记录 URL 并用占位图兜底，避免整张 SVG 加载失败。
            // 注意：html-to-image 只把返回值 resolve，不会自动改写 src；必须手动把 event.target.src
            // 设为占位图，否则克隆出的 <img> 仍保留失败的 data:text/html 或空 src，导出为空白。
            onImageErrorHandler: (event) => {
              const target = event && typeof event === 'object' ? (event as Event).target as HTMLImageElement | undefined : undefined;
              const failedSrc = target?.src;
              console.warn('[export] image load failed, using placeholder. src=', failedSrc);
              if (target && failedSrc !== TRANSPARENT_PNG) {
                try { target.src = TRANSPARENT_PNG; } catch { /* ignore */ }
              }
              return TRANSPARENT_PNG;
            },
            pixelRatio,
            width,
            height: totalH,
          });
          const dataUrl = canvasToDataUrl(canvas, format);
          console.log('[export] toCanvas(all) done, length', dataUrl.length);
          downloadDataUrl(dataUrl, `${project.title || 'h5'}-长图${formatExt(format)}`);
        } else {
          const node = exportRef.current;
          if (!node) {
            console.warn('[export] exportRef is null');
            return;
          }
          await Promise.all(
            Array.from(node.querySelectorAll('img')).map((img) =>
              img.decode().catch(() => undefined),
            ),
          );
          const imgSrcs = Array.from(node.querySelectorAll('img')).map((img) => img.src.slice(0, 120));
          console.log('[export] DOM ready (current), images=', imgSrcs.length, imgSrcs);
          console.log('[export] toCanvas(current) start', { width, height, format, page: page + 1 });
          const canvas = await toCanvas(node, {
            cacheBust: false,
            imagePlaceholder: TRANSPARENT_PNG,
            skipFonts: true,
            // 与编辑器画布底色一致：半透明背景色调与编辑器完全一致。
            backgroundColor,
            onImageErrorHandler: (event) => {
              const target = event && typeof event === 'object' ? (event as Event).target as HTMLImageElement | undefined : undefined;
              const failedSrc = target?.src;
              console.warn('[export] image load failed, using placeholder. src=', failedSrc);
              if (target && failedSrc !== TRANSPARENT_PNG) {
                try { target.src = TRANSPARENT_PNG; } catch { /* ignore */ }
              }
              return TRANSPARENT_PNG;
            },
            pixelRatio: 2,
            width,
            height,
          });
          const dataUrl = canvasToDataUrl(canvas, format);
          console.log('[export] toCanvas(current) done, length', dataUrl.length);
          downloadDataUrl(dataUrl, `${project.title || 'h5'}-${page + 1}${formatExt(format)}`);
        }
      } catch (err) {
        console.error('[export] Export failed:', err);
        let detail = '未知错误';
        if (err instanceof Error) detail = `${err.name}: ${err.message}`;
        else if (err && typeof err === 'object' && 'type' in err) detail = `Event(${(err as { type?: string }).type})`;
        else detail = String(err);
        alert(`${t('editor:toolbar.exportFailed')}\n\n${detail}`);
      } finally {
        exportingRef.current = false;
        setExporting(false);
        setExportProject(null);
      }
    },
    [project, t],
  );

  /** canvas → 目标格式 dataURL（jpeg/webp 带压缩质量，png 无损） */
  function canvasToDataUrl(canvas: HTMLCanvasElement, format: ImageFormat): string {
    if (format === 'jpeg') return canvas.toDataURL('image/jpeg', 0.92);
    if (format === 'webp') return canvas.toDataURL('image/webp', 0.92);
    return canvas.toDataURL('image/png');
  }

  /** 图片格式 → 文件扩展名 */
  function formatExt(format: ImageFormat): string {
    if (format === 'jpeg') return '.jpg';
    if (format === 'webp') return '.webp';
    return '.png';
  }

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        // 上传前先做类型/体积校验，给出具体错误而非笼统的「上传失败」
        const errKey = validateImageFile(file);
        if (errKey) {
          alert(t(errKey));
          return;
        }
        // 前端读取真实像素尺寸，随上传提交，使插入缩放与素材记录尺寸准确
        let dims: { width: number; height: number } | null = null;
        try {
          dims = await readImageDimensions(file);
        } catch {
          dims = null;
        }
        const asset = await api.uploadAsset(file, dims ?? undefined);
        // 通过 addElement 加入：createElement 会补齐唯一 id 与全部基础字段，
        // 避免此前用 addElementData 传裸对象导致 id 为 undefined，
        // 进而多个图片共用 undefined id（拖拽/选中/排序串号、无变换框、无属性面板）。
        // 同时按画布尺寸缩放，避免原图远超 375 画布导致变换框出界。
        const w = dims?.width || asset.width || 200;
        const h = dims?.height || asset.height || 200;
        const scale = Math.min(w > 320 ? 320 / w : 1, h > 480 ? 480 / h : 1);
        addElement('image', {
          src: asset.url,
          width: Math.round(w * scale),
          height: Math.round(h * scale),
          naturalWidth: Math.round(w),
          naturalHeight: Math.round(h),
        } as Partial<Element>);
      } catch (err) {
        console.error(err);
        alert(t('errors:error.uploadFailed'));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [addElement, t],
  );

  const addTextPreset = useCallback(
    (preset: typeof TEXT_PRESETS[number]) => {
      const width = Math.min(300, 360 - preset.fontSize);
      const height = Math.max(40, preset.fontSize * 2.2);
      addElement('text', {
        text: t('editor:defaults.textContent'),
        fontSize: preset.fontSize,
        fontStyle: preset.fontWeight,
        width,
        height,
      } as Partial<Element>);
    },
    [addElement, t],
  );

  const handleToolClick = (key: string) => {
    switch (key) {
      case 'text':
        addTextPreset(TEXT_PRESETS[0]);
        break;
      case 'shape':
        addShape('rect');
        break;
      case 'component':
        addComponentComponent();
        break;
      case 'multimedia':
        openMultimediaMenu();
        break;
      case 'effect':
        alert(t('editor:tool.comingSoon'));
        break;
    }
  };

  const openTextMenu = () => {
    if (textMenuTimer.current) clearTimeout(textMenuTimer.current);
    setTextMenuOpen(true);
  };

  const closeTextMenu = () => {
    textMenuTimer.current = setTimeout(() => {
      setTextMenuOpen(false);
    }, 150);
  };

  const openShapeMenu = () => {
    if (shapeMenuTimer.current) clearTimeout(shapeMenuTimer.current);
    setShapeMenuOpen(true);
  };

  const closeShapeMenu = () => {
    shapeMenuTimer.current = setTimeout(() => {
      setShapeMenuOpen(false);
    }, 150);
  };

  const addShape = (key: string) => {
    if (key === 'library') {
      alert(t('editor:tool.comingSoon'));
      return;
    }
    addElement(key as ElementType);
    setShapeMenuOpen(false);
  };

  const openComponentMenu = () => {
    if (componentMenuTimer.current) clearTimeout(componentMenuTimer.current);
    setComponentMenuOpen(true);
  };

  const closeComponentMenu = () => {
    componentMenuTimer.current = setTimeout(() => {
      setComponentMenuOpen(false);
    }, 150);
  };

  const openMultimediaMenu = () => {
    if (multimediaMenuTimer.current) clearTimeout(multimediaMenuTimer.current);
    setMultimediaMenuOpen(true);
  };

  const closeMultimediaMenu: () => void = () => {
    multimediaMenuTimer.current = setTimeout(() => {
      setMultimediaMenuOpen(false);
    }, 150);
  };

  const addComponentComponent = (key?: ComponentItemKey) => {
    if (!key) {
      // 顶部“组件”按钮默认打开菜单，不直接添加元素
      return;
    }
    const item = COMPONENT_ITEM_MAP[key];
    if (!item.elementType) {
      alert(t('editor:tool.comingSoon'));
      setComponentMenuOpen(false);
      return;
    }
    addElement(item.elementType, (item.preset ?? {}) as Partial<Element>);
    setComponentMenuOpen(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-gray-800">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {/* ── 顶部功能区 ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        {/* 左侧：返回 + Logo + 标题 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="rounded px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100"
            title={t('editor:toolbar.back')}
          >
            ← {t('editor:toolbar.back')}
          </button>
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
              TAKLIP H5
            </span>
            {/* 撤销 / 重做 */}
            <div className="ml-3 flex items-center gap-1 border-l border-gray-200 pl-3">
              <button
                onClick={undo}
                disabled={!canUndo}
                title={t('editor:toolbar.undo')}
                className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                <UndoIcon className="h-5 w-5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title={t('editor:toolbar.redo')}
                className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                <RedoIcon className="h-5 w-5" />
              </button>
            </div>
            {/* 历史版本：移至撤销/重做按钮右侧 */}
            <button
              onClick={() => setVersionOpen(true)}
              title={t('editor:version.title')}
              className="flex h-8 items-center gap-1 rounded border border-gray-200 px-2 text-sm text-gray-600 transition hover:border-blue-300 hover:text-blue-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                <path d="M12 7v5l4 2" />
              </svg>
              <span>{t('editor:version.title')}</span>
            </button>
          </div>
        </div>

        {/* 中央工具按钮 */}
        <div className="flex items-center gap-1">
          {TOOLS.map((tool) => {
            const isText = tool.key === 'text';
            const isShape = tool.key === 'shape';
            const isComponent = tool.key === 'component';
            const isMultimedia = tool.key === 'multimedia';
            return (
              <div
                key={tool.key}
                className="relative"
                onMouseEnter={
                  isText
                    ? openTextMenu
                    : isShape
                      ? openShapeMenu
                      : isComponent
                        ? openComponentMenu
                        : isMultimedia
                          ? openMultimediaMenu
                          : undefined
                }
                onMouseLeave={
                  isText
                    ? closeTextMenu
                    : isShape
                      ? closeShapeMenu
                      : isComponent
                        ? closeComponentMenu
                        : isMultimedia
                          ? closeMultimediaMenu
                          : undefined
                }
              >
                <button
                  onClick={() => handleToolClick(tool.key)}
                  className="flex flex-col items-center justify-center rounded px-4 py-1 text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  {tool.key === 'component' ? (
                    <ComponentToolIcon />
                  ) : tool.key === 'shape' ? (
                    <ShapeToolIcon />
                  ) : tool.key === 'multimedia' ? (
                    <MultimediaToolIcon />
                  ) : tool.key === 'text' ? (
                    <TextToolIcon />
                  ) : tool.key === 'effect' ? (
                    <EffectToolIcon />
                  ) : (
                    <span className="text-lg leading-none">{(tool as (typeof TOOLS)[number]).icon}</span>
                  )}
                  <span className="mt-0.5 text-xs">{t(tool.labelKey)}</span>
                </button>

                {/* 文本工具预设菜单 */}
                {isText && textMenuOpen && (
                  <div
                    className="absolute left-1/2 top-full z-50 mt-1 w-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
                    onMouseEnter={openTextMenu}
                    onMouseLeave={closeTextMenu}
                  >
                    {TEXT_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        onClick={() => {
                          addTextPreset(preset);
                          setTextMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-center px-4 py-2 text-center text-gray-700 transition hover:bg-blue-50 hover:text-blue-600"
                        style={{ fontSize: preset.fontSize, fontWeight: preset.fontWeight }}
                        title={t(preset.labelKey)}
                      >
                        {t(preset.labelKey)}
                      </button>
                    ))}
                  </div>
                )}

                {/* 形状工具下拉菜单 */}
                {isShape && shapeMenuOpen && (
                  <div
                    className="absolute left-1/2 top-full z-50 mt-1 w-52 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
                    onMouseEnter={openShapeMenu}
                    onMouseLeave={closeShapeMenu}
                  >
                    {SHAPE_MENU_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => addShape(item.key)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-600"
                        title={t(item.labelKey)}
                      >
                        <span className="flex items-center gap-3">
                          <ShapeMenuIcon type={item.key} />
                          <span>{t(item.labelKey)}</span>
                        </span>
                        {item.shortcut && (
                          <span className="text-xs text-gray-400">{item.shortcut}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* 组件库下拉面板 */}
                {isComponent && (
                  <ComponentLibraryMenu
                    open={componentMenuOpen}
                    onMouseEnter={openComponentMenu}
                    onMouseLeave={closeComponentMenu}
                    onSelect={(key) => addComponentComponent(key)}
                  />
                )}

                {/* 多媒体下拉菜单（图片 / 音乐） */}
                {isMultimedia && multimediaMenuOpen && (
                  <div
                    className="absolute left-1/2 top-full z-50 mt-1 w-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
                    onMouseEnter={openMultimediaMenu}
                    onMouseLeave={closeMultimediaMenu}
                  >
                    {MULTIMEDIA_MENU_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          if (item.key === 'image') fileInputRef.current?.click();
                          else if (item.key === 'music') setMusicModalOpen(true);
                          else alert(t('editor:tool.comingSoon'));
                          setMultimediaMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-600"
                        title={t(item.labelKey)}
                      >
                        {item.key === 'image' ? (
                          <ImageToolIcon className="h-5 w-5" />
                        ) : item.key === 'music' ? (
                          <MusicToolIcon className="h-5 w-5" />
                        ) : (
                          <VideoToolIcon className="h-5 w-5" />
                        )}
                        <span>{t(item.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 右侧操作按钮：状态提示、发布（含导出）、退出 */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-500">● {t('common:status.unsaved')}</span>
          )}
          {!isDirty && !isSaving && (
            <span className="text-xs text-gray-400">{t('common:status.saved')}</span>
          )}
          {isSaving && (
            <span className="text-xs text-blue-500">{t('common:status.saving')}</span>
          )}
          <button
            onClick={() => setPublishOpen(true)}
            className="rounded bg-red-500 px-3 py-1.5 text-sm text-white transition hover:bg-red-600"
          >
            {t('editor:toolbar.publish')}
          </button>
          <button
            onClick={handleBack}
            className="rounded bg-gray-500 px-3 py-1.5 text-sm text-white transition hover:bg-gray-600"
          >
            {t('editor:toolbar.exit')}
          </button>
        </div>
      </header>

      {/* ── 主体三栏布局 ── */}
      <div className="flex min-h-0 flex-1">
        <PageList />
        <main className="min-w-0 flex-1 overflow-auto bg-[#f0f2f5]">
          <ErrorBoundary name="画布">
            <EditorCanvas
              onPreview={() => setPreviewOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              onSave={() => saveProject(true)}
              isSaving={isSaving}
            />
          </ErrorBoundary>
        </main>
        <ErrorBoundary name="属性面板">
          <PropertyPanel />
        </ErrorBoundary>
      </div>

      {/* ── 预览/发布/版本模态框 ── */}
      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} project={project} />
      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        projectId={projectId}
        project={project}
        currentPage={activePage}
        onExport={handleExport}
      />
      <VersionHistoryModal
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        projectId={projectId}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        onSave={({ title: newTitle, settings: newSettings }) => {
          if (newTitle !== project.title) setProjectTitle(newTitle);
          setProjectSettings(newSettings);
        }}
      />

      <MusicManagerModal
        open={musicModalOpen}
        current={project.settings?.backgroundMusic}
        onClose={() => setMusicModalOpen(false)}
        onSave={(music) => {
          setProjectSettings({
            ...createDefaultSettings(),
            ...(project.settings ?? {}),
            backgroundMusic: music,
          });
          setMusicModalOpen(false);
        }}
      />

      {/* 导出图片：离屏渲染当前页 / 全部页长图，供 html-to-image 截取 */}
      {exporting && exportProject && (
        <>
          {/* 当前页 */}
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: -10000,
              top: 0,
              width: exportProject.width ?? 375,
              height: exportProject.height ?? 667,
              overflow: 'hidden',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: -1,
              // 不强制背景色：DOMRenderer 的 AnimatedPage 会根据 page.background 渲染，
              // 包括半透明背景；若 page.background 为空，AnimatedPage 已默认纯白兜底。
            }}
          >
            <div
              ref={exportRef}
              style={{ width: exportProject.width ?? 375, height: exportProject.height ?? 667, overflow: 'hidden' }}
            >
              <DOMRenderer project={exportProject} currentPage={exportPageRef.current} scale={1} animated={false} />
            </div>
          </div>
          {/* 全部页纵向长图 */}
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: -10000,
              top: 0,
              width: exportProject.width ?? 375,
              height: (exportProject.height ?? 667) * Math.max(1, exportProject.pages?.length ?? 1),
              overflow: 'hidden',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            <div
              ref={exportAllRef}
              style={{
                width: exportProject.width ?? 375,
                height: (exportProject.height ?? 667) * Math.max(1, exportProject.pages?.length ?? 1),
                overflow: 'hidden',
              }}
            >
              {exportProject.pages?.map((_, i) => (
                <div
                  key={i}
                  style={{ width: exportProject.width ?? 375, height: exportProject.height ?? 667, overflow: 'hidden' }}
                >
                  <DOMRenderer project={exportProject} currentPage={i} scale={1} animated={false} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
