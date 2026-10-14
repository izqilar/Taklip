-- 20261012150000_fix_wx_openid_underscore
-- 修正：上一迁移（20261012140000）误将列重命名为 "wx_open_id"，
-- 但 schema.prisma 中 wxOpenid 字段显式 @map("wx_openid")（单下划线，符合 snake_case 约定，
-- 与 qq_openid 一致）。此处把列名纠正为 wx_openid，并同步唯一索引名。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'wx_open_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'wx_openid'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "wx_open_id" TO "wx_openid";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_wx_open_id_key')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_wx_openid_key') THEN
    ALTER INDEX "User_wx_open_id_key" RENAME TO "User_wx_openid_key";
  END IF;
END $$;
