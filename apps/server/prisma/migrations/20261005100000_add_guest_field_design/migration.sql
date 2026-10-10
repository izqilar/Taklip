-- 模板字段设计：允许用户/服务商自定义「下载模板」中出现的可填写字段（2026-10-05）
-- 按归属作用域唯一一份：SELF(userId) / ORG(orgId，代客与自营共用组织级设计)

CREATE TABLE IF NOT EXISTS "GuestListFieldDesign" (
  "id" TEXT NOT NULL,
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]',
  "version" TEXT NOT NULL DEFAULT '1.0',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestListFieldDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestListFieldDesign_owner_type_owner_id_key" ON "GuestListFieldDesign"("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "GuestListFieldDesign_owner_id_idx" ON "GuestListFieldDesign"("owner_id");
