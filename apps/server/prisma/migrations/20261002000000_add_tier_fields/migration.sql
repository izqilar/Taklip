-- 代理商/服务商贡献等级字段（P-tier）
-- 对应 schema.prisma User 模型新增：agentTier / providerTier / tierScore / tierUpdatedAt
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agent_tier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provider_tier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tier_score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tier_updated_at" TIMESTAMP(3);
