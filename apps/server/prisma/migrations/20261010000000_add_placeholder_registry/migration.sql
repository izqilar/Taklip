-- 占位符注册表（v2 占位符管理 · 2026-10-10）
-- 运营端「系统设置 → 占位符管理」独占配置唯一真相源，叠加在现有变量（binding.key）之上。
-- 编辑器只绑定、不创建；key 稳定 ASCII；标签/提示/默认值按 locale 存 JSONB；scope 区分名单字段型/批次常量型。

CREATE TABLE IF NOT EXISTS "PlaceholderRegistry" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label_i18n" JSONB NOT NULL DEFAULT '{}',
  "hint_i18n" JSONB NOT NULL DEFAULT '{}',
  "default_i18n" JSONB NOT NULL DEFAULT '{}',
  "scope" TEXT NOT NULL DEFAULT 'batch',
  "required_def" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT NOT NULL DEFAULT 'visible',
  "legacy" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceholderRegistry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlaceholderRegistry_key_key" ON "PlaceholderRegistry"("key");
CREATE INDEX IF NOT EXISTS "PlaceholderRegistry_type_idx" ON "PlaceholderRegistry"("type");
CREATE INDEX IF NOT EXISTS "PlaceholderRegistry_scope_idx" ON "PlaceholderRegistry"("scope");
