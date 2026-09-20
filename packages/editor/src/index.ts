/**
 * @h5design/editor —— 编辑器共享内核入口
 *
 * 读写分层：`@h5design/render` 只负责"读"（渲染/消毒/缩略图），本包负责"写"（编辑/保存）。
 * 内核是**持久化无关**的：所有后端交互经 `services` 适配层由宿主注入
 * （web 注入 Project API；运营端注入 Template 草稿/发布 API），见 ./services.ts。
 *
 * 宿主接入最少三步：
 *   1. setEditorServices({ uploadAsset, updateProject, ... })   // 启动时注入
 *   2. import { EditorApp } from '@h5design/editor'
 *   3. <EditorApp projectId=... initialSchema={draftSchema ?? schema} onExit=... />
 */

// —— 宿主适配层 ——
export { setEditorServices, getEditorServices, services } from './services';
export type { EditorServices, UploadedAsset } from './services';
export type { PublishResult } from './types';

// —— 编辑器主体 ——
export { default as EditorApp } from './components/Editor/EditorApp';
export { default as SettingsPanel } from './components/Editor/SettingsPanel';
export { default as ComponentLibraryMenu } from './components/Editor/ComponentLibraryMenu';
export { default as MusicManagerModal } from './components/Editor/MusicManagerModal';
export { default as VersionHistoryModal } from './components/Editor/VersionHistoryModal';
export { default as PublishModal } from './components/Publish/PublishModal';
// 导出参数契约：宿主复用 PublishModal 时需要传给 onExport 的形状
export type {
  ImageExportOptions,
  ImageFormat,
} from './components/Publish/PublishModal';
export { default as PreviewModal } from './components/Preview/PreviewModal';

// —— 面板 / 预览渲染 ——
export { default as PropertyPanel } from './components/Panel/PropertyPanel';
export { default as PageList } from './components/Panel/PageList';
export { default as LayerList } from './components/Panel/LayerList';
export { default as ComponentSettingsPanel } from './components/Panel/ComponentSettingsPanel';
export { default as DOMRenderer, PublishedH5 } from './components/Preview/DOMRenderer';

// —— 状态 ——
export * from './store/editorStore';

// —— 元素注册 ——
export * from './elements/registry';

// —— 元素共享逻辑（编辑器 Canvas* 与 web 发布页 DOM* 共用，保单一事实源；
//     长期应下沉到 @h5design/render，见文档 §0-D8）——
export {
  getCalendarGrid,
  WEEKDAYS_EN,
  WEEKDAYS_ZH,
  CalendarMarkerSvg,
  CALENDAR_PULSE_KEYFRAMES,
} from './elements/calendar/calendarShared';
export { getRemaining, getUnitLabels, padDigits } from './elements/countdown/countdownShared';
export {
  default as GalleryTransitionLayer,
  resolveTransition,
  getTransitionTotalMs,
} from './elements/gallery/galleryTransitionLayer';
export { getPuzzleLayout, getShapePathD } from './elements/puzzle/puzzleLayouts';
export { WIDGET_REGISTRY } from './elements/widget/widgetModules';
