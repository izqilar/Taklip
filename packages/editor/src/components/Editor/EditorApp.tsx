/**
 * 编辑器主组件 — 八图 H5 编辑器风格
 * 顶部功能区 + 左侧页面/图层面板 + 中间画布 + 右侧属性面板
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toCanvas } from 'html-to-image';
import PageList from '../Panel/PageList';
import PropertyPanel from '../Panel/PropertyPanel';
import ErrorBoundary from '../ErrorBoundary';
import EditorCanvas from '../Canvas/EditorCanvas';
import PreviewModal from '../Preview/PreviewModal';
import PublishModal from '../Publish/PublishModal';
import type { ImageExportOptions, ImageFormat } from '../Publish/PublishModal';
import DOMRenderer from '../Preview/DOMRenderer';
import VersionHistoryModal from './VersionHistoryModal';
import SettingsPanel from './SettingsPanel';
import MusicManagerModal from './MusicManagerModal';
import ComponentLibraryMenu, {
  COMPONENT_ITEM_MAP,
  type ComponentItemKey,
} from './ComponentLibraryMenu';
import { useEditorStore, useCanUndo, useCanRedo } from '../../store/editorStore';
import { useKeyboard } from '../../hooks/useKeyboard';
import { services } from '../../services';
import { validateImageFile, readImageDimensions } from '../../utils/image';
import { preloadImages, cloneAndInline, TRANSPARENT_PNG } from '../../utils/exportVideo';
import { downloadDataUrl, downloadBlob } from '../../utils/download';
import type { Element, ElementType, Project } from '@h5design/core';
import { sanitizeSchema } from '@h5design/render';
import { buildFontEmbedCSS, collectFontFamilies, createDefaultSettings, drawWatermark } from '@h5design/core';

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

export interface EditorAppProps {
  /**
   * 仅导出模式：编辑器顶栏「发布」按钮变为「导出」，并打开不含「立即发布」页签的
   * 导出对话框。终端用户（web 端）没有发布作品/发布为模板的权限，只能导出文件；
   * 运营端（admin）不传，保留完整发布能力。
   */
  exportOnly?: boolean;
  /**
   * 「退出编辑」要返回的路径 —— 由**宿主注入**。
   * 内核不能写死：web 端是 /dashboard，运营端(admin)没有该路由，
   * 不注入的话运营端点了「退出编辑」会跳到不存在的空路由。
   * 缺省值保持 /dashboard，web 端行为不变。
   */
  exitPath?: string;
}

export default function EditorApp({ exportOnly = false, exitPath = '/dashboard' }: EditorAppProps = {}) {
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
  const hostMeta = useEditorStore((s) => s.hostMeta);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  // 字体授权判定结果：付费字体未授权 → 预览/本地兜底导出叠加水印
  const [fontWatermark, setFontWatermark] = useState(false);
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
  // 退出编辑进行中：连点「退出编辑」不应触发两次保存/两次跳转
  const exitingRef = useRef(false);
  // 正在飞行的保存：并发触发（自动保存 / 退出 / 导出前）复用同一个 promise，
  // 使调用方 await 到的永远是「这次落库的真实结果」，而不是「已有保存进行中」的空返回。
  const saveInFlight = useRef<Promise<boolean> | null>(null);

  /** 保存失败提示：交互型保存（手动保存 / 退出 / 导出前）必须明确告知用户 */
  const notifySaveFailed = useCallback(() => {
    alert(t('errors:error.saveFailed'));
  }, [t]);

  /**
   * 保存草稿。
   * 返回 Promise<boolean>：true = 服务端已接受写入；false = 写入失败。
   * 失败**不在内部吞掉**：交由调用方决定「提示并留在页面」还是「继续」，
   * 否则退出编辑 / 服务端导出会把失败当成成功 —— 改动静默丢失、导出渲染旧草稿。
   */
  const saveProject = useCallback(
    (snapshot = false): Promise<boolean> => {
      if (saveInFlight.current) return saveInFlight.current;
      const run = (async (): Promise<boolean> => {
        setSaving(true);
        try {
          // 草稿闸口：保存前对 schema 做安全校验消毒（封面/外链/富文本），
          // 确保落库的 draftSchema 不含危险内容（XSS / 渲染崩防御）。
          // sanitizeSchema 返回深拷贝，不修改编辑器内 project 状态。
          const safeSchema = sanitizeSchema(project);
          if (projectId) {
            await services.updateProject(projectId, {
              title: project.title,
              schema: safeSchema,
              snapshot,
            });
          } else {
            const res = await services.createProject(project.title);
            await services.updateProject(res.id, { schema: safeSchema, snapshot });
            setProjectId(String(res.id));
          }
          setDirty(false);
          lastSaveAt.current = Date.now();
          return true;
        } catch (err) {
          console.error('Save failed:', err);
          return false;
        } finally {
          setSaving(false);
          saveInFlight.current = null;
        }
      })();
      saveInFlight.current = run;
      return run;
    },
    [projectId, project, setSaving, setDirty, setProjectId],
  );

  /** 后台自动保存：失败只记日志（避免 30s 一次的弹窗骚扰），顶栏「● 未保存」会持续提示 */
  const saveInBackground = useCallback(() => {
    void saveProject().then((ok) => {
      if (!ok) console.error('[autosave] 草稿保存失败，改动尚未落库');
    });
  }, [saveProject]);

  /* ── 自动保存 ── */
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 最新闭包的后台保存：saveProject 的 identity 随每次编辑重建，若把
  // saveInBackground 直接放进 interval 的依赖里，定时器会被反复 clear/re-create，
  // 30s 永远等不到触发（等于自动保存是死的）。用 ref 持有最新回调，interval 只建一次。
  const saveInBackgroundRef = useRef(saveInBackground);
  useEffect(() => {
    saveInBackgroundRef.current = saveInBackground;
  }, [saveInBackground]);

  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (useEditorStore.getState().isDirty) saveInBackgroundRef.current();
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    const sinceLast = Date.now() - lastSaveAt.current;
    const wait = sinceLast < 8000 ? Math.max(0, 8000 - sinceLast) : 3000;
    saveDebounce.current = setTimeout(() => {
      if (useEditorStore.getState().isDirty) saveInBackground();
    }, wait);
    return () => {
      if (saveDebounce.current) clearTimeout(saveDebounce.current);
    };
  }, [isDirty, saveInBackground]);

  useEffect(() => {
    const onBlur = () => {
      if (useEditorStore.getState().isDirty) saveInBackground();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [saveInBackground]);

  /**
   * 刷新字体授权状态（付费字体未授权 → 预览/本地兜底导出加水印）。
   * 判定口径与发布、服务端导出一致，均由服务端给出，客户端只做展示。
   */
  const refreshFontLicense = useCallback(async () => {
    if (!services.getFontLicense || !projectId) {
      setFontWatermark(false);
      return;
    }
    try {
      const r = await services.getFontLicense(project, projectId);
      setFontWatermark(!!r.watermark);
    } catch {
      // 判定不可用时放宽（不误伤正常用户）：水印以服务端导出结果为准
      setFontWatermark(false);
    }
  }, [project, projectId]);

  // 打开预览时刷新授权状态（预览水印判据）
  useEffect(() => {
    if (previewOpen) void refreshFontLicense();
  }, [previewOpen, refreshFontLicense]);

  /**
   * 退出编辑：**必须等保存真正落库后再跳转**，否则最后一段编辑会被丢掉。
   * 保存失败时留在编辑器并明确报错（顶栏同时保持「● 未保存」），
   * 绝不静默跳转 —— 跳走了就等于这次改动无声消失。
   */
  const handleBack = useCallback(async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    try {
      // 取消待触发的防抖保存：它只会在跳转之后才写库，这里改为立即保存并等待结果
      if (saveDebounce.current) {
        clearTimeout(saveDebounce.current);
        saveDebounce.current = null;
      }
      // 最多两轮：第一轮可能复用正在飞行的保存（它用的是稍早的快照），
      // 若等待期间又产生了新改动（isDirty 再次为 true）则补存一次，确保退出前无残留。
      for (let i = 0; i < 2; i += 1) {
        if (!useEditorStore.getState().isDirty) break;
        if (!(await saveProject())) {
          notifySaveFailed();
          return;
        }
      }
      navigate(exitPath);
    } finally {
      exitingRef.current = false;
    }
  }, [saveProject, navigate, notifySaveFailed, exitPath]);

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
        // ─── 服务端导出（导出硬门槛，优先走这条路）────────────────────────
        // 为什么必须用服务端渲染：客户端贴图（toDataURL/MediaRecorder）可被直接调用绕过付费校验。
        // 服务端按 projectId 读取最新的 draftSchema 渲染，分辨率与水印由 Authorization 判定，
        // 客户端改代码也拿不到高清无水印成品（详见 docs/font-licensing-dev-doc.md §Phase 3）。
        if (services.exportImage && projectId) {
          try {
            // 服务端按草稿渲染，导出前必须先把当前改动落为草稿；
            // 保存失败必须中止 —— 否则服务端渲染的是上一次的旧草稿，导出结果与画布不一致。
            if (isDirty) {
              const saved = await saveProject();
              if (!saved) {
                notifySaveFailed();
                return;
              }
            }
            const r = await services.exportImage({
              projectId,
              page,
              mode: mode === 'all' ? 'all' : 'current',
              format,
            });
            const suffix = mode === 'all' ? '-长图' : `-${page + 1}`;
            downloadBlob(r.blob, `${project.title || 'h5'}${suffix}${formatExt(format)}`);
            if (!r.licensed && r.missing?.length) {
              alert(
                `本次导出为「试用版」（含水印、分辨率已降级）。\n\n原因：使用到未授权付费字体 ${r.missing.join(
                  '、',
                )}。\n购买包含该字体的付费模板后，即可导出高清无水印版本。`,
              );
            }
            return;
          } catch (err) {
            // 服务端导出不可用时（未配置无头浏览器等）降级为本地导出，不阻断用户
            console.warn('[export] 服务端导出失败，回退本地导出：', err);
          }
        }
        // 服务端导出不可用时的本地兜底路径：仍须遵守字体授权 —— 未授权时在 canvas 上
        // 叠加与预览一致的水印，避免「服务端故障」成为绕过付费的旁路。
        let localWatermark = false;
        if (services.getFontLicense && projectId) {
          try {
            localWatermark = !!(await services.getFontLicense(project, projectId)).watermark;
          } catch {
            localWatermark = false;
          }
        }
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

        // 内嵌本页用到的自定义字体（@font-face + base64 data URL）后再截图。
        // 为什么必须内嵌：本地导出把 DOM 克隆进 SVG 的 <foreignObject> 再当**图片**渲染，
        // 那是独立文档，页面里用 FontFace API 注册的字体在其中不可见 → 文字静默回退系统字体
        // （即「导出图里所有文本都变成默认字体」）。html-to-image 的 skipFonts 会直接丢掉字体，
        // 故改为由 core 生成 fontEmbedCSS 注入。详见 core `buildFontEmbedCSS()`。
        const exportPages = (mode === 'all' ? project.pages ?? [] : [project.pages?.[page]]).filter(Boolean);
        let fontEmbedCSS = '';
        try {
          fontEmbedCSS = await buildFontEmbedCSS(collectFontFamilies(exportPages));
        } catch (err) {
          console.warn('[export] 内嵌自定义字体失败，导出文字可能回退系统字体：', err);
        }
        console.log('[export] fontEmbedCSS length =', fontEmbedCSS.length);

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
            // 不走 html-to-image 自带的字体抓取（它只扫 document.styleSheets，扫不到
            // FontFace 注册的字体，且跨域拉 CSS 失败会整体 reject）；改用上面由 core 生成的
            // fontEmbedCSS —— 含 @font-face + base64 data URL，无需任何网络请求。
            skipFonts: true,
            fontEmbedCSS,
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
            fontEmbedCSS,
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
          // 未授权付费字体：本地兜底导出同样打水印（与服务端导出口径一致）
          if (localWatermark) {
            const ctx = canvas.getContext('2d');
            if (ctx) drawWatermark(ctx, { width, height });
          }
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
    [project, t, projectId, isDirty, saveProject, notifySaveFailed],
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
        const asset = await services.uploadAsset(file, dims ?? undefined);
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
    <div className="editor-canvas-wrap flex h-screen flex-col overflow-hidden bg-white text-gray-800">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {/* ── 顶部功能区 ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        {/* 左侧：Logo + 标题（无返回按钮，统一用右上角「退出编辑」） */}
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
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
                  className="flex flex-col items-center justify-center rounded px-5 py-1.5 text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
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
                    className="absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
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
                        className="flex w-full items-center justify-center px-4 py-2.5 text-center text-gray-700 transition hover:bg-blue-50 hover:text-blue-600"
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
                    className="absolute left-1/2 top-full z-50 mt-1 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
                    onMouseEnter={openShapeMenu}
                    onMouseLeave={closeShapeMenu}
                  >
                    {SHAPE_MENU_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => addShape(item.key)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-600"
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
                    className="absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
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
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-600"
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

        {/* 右侧操作按钮：宿主信息 + 状态提示、发布（含导出）、退出 */}
        <div className="flex items-center gap-2">
          {/* 宿主注入的项目元信息（运营端显示模板/作品名+版本号，web 端为空不渲染） */}
          {hostMeta && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <span className="max-w-[200px] truncate text-sm font-semibold text-gray-700">{hostMeta.title}</span>
              {hostMeta.version != null && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">v{hostMeta.version}</span>
              )}
              {hostMeta.hasDraft && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600">草稿</span>
              )}
              {hostMeta.actions}
            </div>
          )}
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
            {exportOnly ? t('editor:toolbar.exportWork') : t('editor:toolbar.publish')}
          </button>
          <button
            onClick={handleBack}
            className="rounded bg-gray-500 px-3 py-1.5 text-sm text-white transition hover:bg-gray-600"
          >
            {t('editor:toolbar.exitEdit')}
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
              onSave={async () => {
                // 手动保存：必须等真实结果再反馈，失败要明确提示（点了 ≠ 保存成功）
                const saved = await saveProject(true);
                if (!saved) notifySaveFailed();
              }}
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
        exportOnly={exportOnly}
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
