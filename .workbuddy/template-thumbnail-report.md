# 模板库 / 首页模板墙 — 渲染第一页内容

## 问题
首页（`/`）与模板库（`/templates`）的模板卡片封面只显示分类文字（wedding / recruitment / birthday…），
不展示模板实际内容，视觉辨识度低。

## 根因
模板列表接口 `template.service.ts findAll` 的 `select` 未返回 `schema`，前端 `TemplateCard`
无真实内容可渲染，只能回退显示 `template.category` 文字占位。

## 改动
- **后端** `apps/server/src/template/template.service.ts`：`findAll` 的 `select` 增加 `schema: true`，
  模板列表现在返回完整 `schema`（含 `width/height/pages`），供前端渲染。
- **前端 API** `apps/web/src/api/client.ts`：`TemplateListItem` 增加 `schema: unknown`。
- **新增共享组件** `apps/web/src/components/SchemaThumbnail.tsx`：
  - `isProjectLike()` 守卫：校验 schema 可当 `Project` 渲染；
  - `ThumbnailBoundary`：class 错误边界，单卡渲染抛错只在该卡显示 H5 占位，绝不整页白屏；
  - `SchemaThumbnail({ schema })`：用 `ResizeObserver` 计算 `scale = 容器宽 / 设计宽`，等比缩放渲染第一页，
    `absolute inset-0` 填充并裁剪溢出，`animated={false}` 避免大量卡片同时播放动画。
- **`apps/web/src/components/TemplateCard.tsx`**：卡片封面与预览弹窗在无 `cover` 时改用
  `<SchemaThumbnail schema={template.schema} />`；封面容器加 `relative`。
- **`apps/web/src/pages/ProjectList.tsx`**：删除重复的本地 `isProjectLike` / `ProjectThumbnail` / `ThumbnailBoundary`，
  统一复用新建的 `SchemaThumbnail`（DRY，单一数据源）。

## 验证
- `apps/web` 与 `apps/server` typecheck 均 **EXIT 0** ✅。
- 后端已重新 `build:compiled` 并重启（端口 3000 监听），`/api/templates` 确认返回 `schema`
  （含 `width:375, height:667, pages:[…]`），`isProjectLike` 判定通过。
- Vite 转译 `SchemaThumbnail.tsx` / `TemplateCard.tsx` 均无错误。
- 复用上一轮已加固的 `DOMRenderer` 防御（`fontStyle ?? ''`、各字段 guard）+ `ThumbnailBoundary`，
  即便个别模板数据缺字段也只会单卡回退，不会整页白屏。

## 用户操作
刷新浏览器 `http://localhost:5173/`（首页）或 `/templates`（模板库），每个模板卡片将直接显示其
第一页内容的实时缩略图（无上传封面时）；点击「预览」弹窗同样展示真实内容。
