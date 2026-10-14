-- 批量请柬 · 已单独编辑的宾客记录 id 集合（修改上限闸门）
-- BatchRenderProject 新增 editedRecordIds 列（JSONB，去重 id 数组，默认空数组）
-- 用于「修改上限 = 总记录数 × 10%」闸门判定（editGuestRecordForProject）。

ALTER TABLE "BatchRenderProject" ADD COLUMN "edited_record_ids" JSONB NOT NULL DEFAULT '[]'::jsonb;
