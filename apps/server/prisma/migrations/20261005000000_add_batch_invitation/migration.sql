-- 批量请柬 · 名单导入与个性化专属渲染（2026-10）
-- 规范：docs/批量请柬-名单导入与个性化渲染开发规范.md §6
-- 归属模型：ownerType = SELF（行级 userId）/ CLIENT（orgId+clientId）/ ORG（orgId）

CREATE TABLE IF NOT EXISTS "GuestList" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "owner_type" TEXT NOT NULL DEFAULT 'SELF',
  "org_id" TEXT,
  "client_id" TEXT,
  "name" TEXT NOT NULL,
  "column_defs" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestList_owner_id_deleted_at_idx" ON "GuestList"("owner_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "GuestList_org_id_client_id_idx" ON "GuestList"("org_id", "client_id");

CREATE TABLE IF NOT EXISTS "GuestRecord" (
  "id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestRecord_list_id_seq_idx" ON "GuestRecord"("list_id", "seq");
CREATE INDEX IF NOT EXISTS "GuestRecord_list_id_deleted_at_idx" ON "GuestRecord"("list_id", "deleted_at");

CREATE TABLE IF NOT EXISTS "BatchRenderProject" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "owner_type" TEXT NOT NULL DEFAULT 'SELF',
  "org_id" TEXT,
  "client_id" TEXT,
  "list_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "free_rendered" INTEGER NOT NULL DEFAULT 0,
  "purchased_headcount" INTEGER NOT NULL DEFAULT 0,
  "paid_rendered" INTEGER NOT NULL DEFAULT 0,
  "locked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BatchRenderProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BatchRenderProject_owner_id_state_idx" ON "BatchRenderProject"("owner_id", "state");
CREATE INDEX IF NOT EXISTS "BatchRenderProject_org_id_client_id_idx" ON "BatchRenderProject"("org_id", "client_id");

CREATE TABLE IF NOT EXISTS "RenderSnapshot" (
  "project_id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "record_ids" JSONB NOT NULL,
  "rendered_data" JSONB NOT NULL,
  "template_id" TEXT NOT NULL,
  "template_version" TEXT NOT NULL DEFAULT '1',
  "locked_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RenderSnapshot_pkey" PRIMARY KEY ("project_id")
);

CREATE INDEX IF NOT EXISTS "RenderSnapshot_list_id_idx" ON "RenderSnapshot"("list_id");

CREATE TABLE IF NOT EXISTS "GuestListSelection" (
  "project_id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "selected_record_ids" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestListSelection_pkey" PRIMARY KEY ("project_id")
);

CREATE TABLE IF NOT EXISTS "RenderJob" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "mode" TEXT NOT NULL,
  "target_record_ids" JSONB NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "result_urls" JSONB NOT NULL DEFAULT '[]',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RenderJob_project_id_status_idx" ON "RenderJob"("project_id", "status");

ALTER TABLE "GuestRecord"
  ADD CONSTRAINT "GuestRecord_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "GuestList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
