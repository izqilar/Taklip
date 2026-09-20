/**
 * 字体目录 fetcher 注入（web 端）。
 *
 * SchemaThumbnail 等列表态组件渲染时需要正确的自定义字体；但目录由宿主拉取，
 * 且编辑器内核服务（editorServices）只在 Editor 路由才注册、拉目录。这里在应用
 * 启动最早阶段把 `() => api.fonts()` 注入到 core 的 fetcher 注入点，使缩略图也能
 * 惰性拉取目录，从而与编辑器 / 发布页 / 导出页保持字体一致，不再回退系统字体。
 *
 * 由 main.tsx 在 bootstrap 之后第一个导入触发。
 */
import { setFontCatalogFetcher } from '@h5design/core';
import { api } from '@/api/client';

setFontCatalogFetcher(() => api.fonts());
