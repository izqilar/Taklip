-- 20261012140000_rename_wx_openid
-- 背景：历史上 wxOpenid 列以 camelCase 形式落到库里（列名 "wxOpenid"），
-- 而 schema.prisma 现统一采用 snake_case 约定（与 qq_open_id 一致），
-- 字段已显式 @map("wx_open_id")。执行重命名（ALTER ... RENAME COLUMN）
-- 可保留既有数据，并让库结构与 schema 严格一致。

-- 1) 仅当旧 camelCase 列存在、新列不存在时才重命名，幂等安全
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'wxOpenid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'wx_open_id'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "wxOpenid" TO "wx_open_id";
  END IF;
END $$;

-- 2) 将唯一索引名同步为 Prisma 生成约定名（功能无影响，仅消除迁移噪声）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_wxOpenid_key')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_wx_open_id_key') THEN
    ALTER INDEX "User_wxOpenid_key" RENAME TO "User_wx_open_id_key";
  END IF;
END $$;
