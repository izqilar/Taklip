-- 占位符管理 · 多语言列单语言化（C1）
-- 旧：label_i18n / hint_i18n / default_i18n 三 JSONB 存 per-locale。
-- 新：label / hint / default_value 单语言文本列（由管理员在当前语言环境下录入）。
-- 数据迁移：取各 JSONB 的 zh-CN 值回填单语言列（缺省空串），随后删除旧 JSONB 列。

-- 1) 新增单语言列
ALTER TABLE "PlaceholderRegistry" ADD COLUMN "label" text NOT NULL DEFAULT '';
ALTER TABLE "PlaceholderRegistry" ADD COLUMN "hint" text NOT NULL DEFAULT '';
ALTER TABLE "PlaceholderRegistry" ADD COLUMN "default_value" text NOT NULL DEFAULT '';

-- 2) 数据回填：取 zh-CN 值（缺失则空串）
UPDATE "PlaceholderRegistry"
SET
  "label" = COALESCE("label_i18n" ->> 'zh-CN', ''),
  "hint"  = COALESCE("hint_i18n"  ->> 'zh-CN', ''),
  "default_value" = COALESCE("default_i18n" ->> 'zh-CN', '');

-- 3) 删除旧多语言 JSONB 列
ALTER TABLE "PlaceholderRegistry" DROP COLUMN "label_i18n";
ALTER TABLE "PlaceholderRegistry" DROP COLUMN "hint_i18n";
ALTER TABLE "PlaceholderRegistry" DROP COLUMN "default_i18n";
