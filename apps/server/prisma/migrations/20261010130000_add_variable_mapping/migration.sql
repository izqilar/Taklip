-- 批量请柬变量映射层（D4 反转）：新增 variableMapping 持久化列
-- BatchRenderProject：项目级映射（模板变量 key → 名单字段 key）
-- RenderSnapshot：渲染时快照，保证重渲取值稳定

ALTER TABLE "BatchRenderProject" ADD COLUMN "variable_mapping" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "RenderSnapshot" ADD COLUMN "variable_mapping" JSONB NOT NULL DEFAULT '{}'::jsonb;
