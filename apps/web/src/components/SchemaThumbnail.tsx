/**
 * SchemaThumbnail — Web 端的薄再导出层。
 * 真实渲染逻辑已迁移到 @h5design/render 共享包（保证三端像素级一致）。
 * 缩略图场景固定 animated=false，不播放入场动画，故无需注入动画播放器。
 * 保留原文件导出名（SchemaThumbnail / isProjectLike / ThumbnailBoundary）不变。
 */
export { SchemaThumbnail, isProjectLike, ThumbnailBoundary } from '@h5design/render';
