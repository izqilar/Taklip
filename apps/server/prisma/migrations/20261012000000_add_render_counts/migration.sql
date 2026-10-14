-- 批量请柬 · 重渲染次数持久计数 + 额外重渲染额度
-- renderCounts: 每条记录重渲染次数（JSONB，不随历史清理归零）
-- purchasedRerender: 免费 5 次之外的额外重渲染额度（购买获得）
ALTER TABLE "BatchRenderProject" ADD COLUMN "render_counts" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "BatchRenderProject" ADD COLUMN "purchased_rerender" INTEGER NOT NULL DEFAULT 0;
