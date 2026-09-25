-- 财务中心「分账费率」：平台全局单例费率配置（id 恒为 'default'）
-- 承载平台抽成比 / 代理商·服务商分账比例 / 结算周期 / 类目费率覆盖 / 最低提现门槛。

-- CreateTable
CREATE TABLE "PlatformFeeConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "platform_rate" INTEGER NOT NULL DEFAULT 10,
    "agent_rate" INTEGER NOT NULL DEFAULT 0,
    "provider_rate" INTEGER NOT NULL DEFAULT 90,
    "settle_period" TEXT NOT NULL DEFAULT 'MONTH',
    "category_rates" JSONB,
    "min_withdraw_cents" INTEGER NOT NULL DEFAULT 0,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeeConfig_pkey" PRIMARY KEY ("id")
);
