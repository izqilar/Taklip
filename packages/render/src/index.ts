/**
 * @h5design/render — 框架无关的「设计一次，三端一致」作品渲染器。
 *
 * 消费方（apps/web、apps/admin、微信小程序 web-view）统一 import 本包，
 * 不再各写一套 DOM 渲染逻辑，从根源上消除「同一份 JSON 模板在两端渲染不一致」。
 *
 * 动画解耦：元素入场/循环动画通过可选的注入式 `animationPlayer` 实现，
 * 共享包自身零 GSAP 依赖；Web 端注入自己的 playElementAnimation 即可。
 */

// 核心渲染器
export { default, default as SchemaRenderer } from './SchemaRenderer';
export { SchemaThumbnail, isProjectLike, ThumbnailBoundary } from './SchemaThumbnail';
export { PublishedH5 } from './SchemaRenderer';
export type { SchemaRendererProps, AnimationPlayer } from './SchemaRenderer';

// 颜色 / 安全 / 外链视频 纯函数
export {
  parseCssColor,
  rgbaToCss,
  rgbaToHex,
  isValidCssColor,
  applyAlphaToColor,
  type RgbaColor,
} from './lib/color';
export { safeLink, safeMedia, safeBackgroundImage, sanitizeEmbedHtml, sanitizeSchema, looksLikeEmbedCode } from './lib/sanitize';
export { resolveExternalVideo, type ResolvedVideo } from './lib/externalVideo';

// 元素级 helper（供编辑器/管理端读取或复用）
export { getCalendarGrid, WEEKDAYS_EN, WEEKDAYS_ZH, CalendarMarkerSvg, CALENDAR_PULSE_KEYFRAMES } from './elements/calendar/calendarShared';
export { getUnitLabels, getRemaining, isoToLocalInput, localInputToIso, padDigits } from './elements/countdown/countdownShared';
export { resolveTransition, getTransitionTotalMs } from './elements/gallery/galleryTransitionLayer';
// 画廊转场组件（web 的 DOMGallery 直接复用；此前只从 @h5design/editor 转出，
// 迫使 web 端渲染层依赖整个编辑器内核，故在此单点导出）
export { default as GalleryTransitionLayer } from './elements/gallery/galleryTransitionLayer';
export {
  heartPathD,
  heartLeftPathD,
  heartRightPathD,
  getShapePathD,
  drawShapeInClip,
  PUZZLE_LAYOUTS,
  getPuzzleLayout,
  PUZZLE_LAYOUT_IDS,
} from './elements/puzzle/puzzleLayouts';
export { getFormCount, incFormCount, WIDGET_REGISTRY, getWidgetDefault } from './elements/widget/widgetModules';

// 把 core 的 schema 归一化工具一并 re-export，方便消费端「从 render 单点取用」
export { normalizeSchema, CURRENT_SCHEMA_VERSION } from '@h5design/core';
