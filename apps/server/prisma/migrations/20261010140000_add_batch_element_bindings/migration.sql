-- 批量请柬 · 生成期画布点选元素级绑定（D 方案 / S3）
-- BatchRenderProject 新增 elementBindings 列（项目级，不回写模板）
-- 结构：{ elementId: { key, name?, listField? } }
-- 与 variableMapping（模板变量 key → 名单字段 key）互补：
--   variableMapping 解决「变量↔名单字段」；elementBindings 解决「画布元素↔变量」。

ALTER TABLE "BatchRenderProject" ADD COLUMN "element_bindings" JSONB NOT NULL DEFAULT '{}'::jsonb;
