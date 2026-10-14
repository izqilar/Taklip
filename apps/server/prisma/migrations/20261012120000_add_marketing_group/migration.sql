-- 服务商营销分组 + 成员（2026-10-12）
-- 分组维度 marketing_group.provider_id；成员唯一约束 (group_id, member_type, member_id)。
-- 成员随分组级联删除（ON DELETE CASCADE，对应 schema onDelete: Cascade）。

CREATE TABLE IF NOT EXISTS "MarketingGroup" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scene" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketingGroupMember" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "member_type" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "label" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingGroup_provider_id_idx" ON "MarketingGroup"("provider_id");

CREATE INDEX IF NOT EXISTS "MarketingGroupMember_group_id_idx" ON "MarketingGroupMember"("group_id");
CREATE INDEX IF NOT EXISTS "MarketingGroupMember_member_type_member_id_idx" ON "MarketingGroupMember"("member_type", "member_id");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingGroupMember_group_id_member_type_member_id_key" ON "MarketingGroupMember"("group_id", "member_type", "member_id");

ALTER TABLE "MarketingGroupMember" ADD CONSTRAINT "MarketingGroupMember_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "MarketingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
