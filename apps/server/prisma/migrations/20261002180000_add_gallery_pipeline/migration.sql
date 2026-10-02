-- 图库私有图管线（2026-10）：扩展 Asset + 新增 WorkImageRef
-- 历史公开资源（背景音乐等）的 url 字段保留不动。

ALTER TABLE "Asset"
  ADD COLUMN IF NOT EXISTS "storage_key" TEXT,
  ADD COLUMN IF NOT EXISTS "mime" TEXT,
  ADD COLUMN IF NOT EXISTS "compressed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "derived_from" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Asset_deleted_at_idx" ON "Asset"("deleted_at");

CREATE TABLE IF NOT EXISTS "WorkImageRef" (
  "id" TEXT NOT NULL,
  "work_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "usage" TEXT NOT NULL DEFAULT 'decor',
  "crop" JSONB,
  "z_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkImageRef_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkImageRef_work_id_idx" ON "WorkImageRef"("work_id");
CREATE INDEX IF NOT EXISTS "WorkImageRef_asset_id_idx" ON "WorkImageRef"("asset_id");

ALTER TABLE "WorkImageRef"
  ADD CONSTRAINT "WorkImageRef_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
