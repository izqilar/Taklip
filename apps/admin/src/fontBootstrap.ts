/**
 * 字体目录 fetcher 注入（运营端 / admin）。
 *
 * 与 web 端同源：缩略图（SchemaThumbnail）渲染需要正确的自定义字体，但目录由宿主
 * 拉取，且编辑器内核服务只在 SPTemplateEditor 路由才注册。这里在应用启动最早阶段
 * 把字体目录拉取器注入到 core 的 fetcher 注入点，使运营端列表/详情缩略图也能惰性
 * 拉取目录，与编辑器 / 发布页 / 导出页保持字体一致。
 *
 * 由 main.tsx 在 bootstrap 之后导入触发。
 */
import { setFontCatalogFetcher } from '@h5design/core';
import { API_URL, authHeaders } from './utility';

setFontCatalogFetcher(async () => {
  const res = await fetch(`${API_URL}/fonts`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`fonts ${res.status}`);
  return (await res.json()) as import('@h5design/core').FontMeta[];
});
