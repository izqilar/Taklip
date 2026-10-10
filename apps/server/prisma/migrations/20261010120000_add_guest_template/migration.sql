-- 多模板管理：用户/系统预制诚邀名单模板（v1.3，2026-10-10）
-- SYSTEM 模板全局可读；用户模板行级 owner_id 隔离；系统模板不可删除。

CREATE TABLE IF NOT EXISTS "GuestTemplate" (
  "id" TEXT NOT NULL,
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT,
  "name" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]',
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "seq" INTEGER NOT NULL DEFAULT 0,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestTemplate_owner_type_owner_id_idx" ON "GuestTemplate"("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "GuestTemplate_owner_id_idx" ON "GuestTemplate"("owner_id");
