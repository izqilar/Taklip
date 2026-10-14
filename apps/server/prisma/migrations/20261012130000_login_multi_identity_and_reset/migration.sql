-- 登录入口改造（2026-10-12）：多方式登录标识 + 密码找回重置令牌
-- 对应 schema 变更：email @unique、nickname @unique、新增 qqOpenid @unique、新增 reset 令牌列。
-- 铁律：手写 migration.sql → prisma db execute → prisma migrate resolve --applied → prisma generate。

-- 0. 清洗空串（空串非 NULL，会进入部分唯一索引导致重复冲突）
UPDATE "User" SET "email" = NULL WHERE "email" = '';
UPDATE "User" SET "nickname" = NULL WHERE "nickname" = '';

-- 1. nickname 强制唯一（D2）：给重复昵称追加后缀，保留每组首个原始值
UPDATE "User" u
SET "nickname" = u."nickname" || '_' || substr(u."id", 1, 8)
WHERE u."nickname" IS NOT NULL
  AND u."id" NOT IN (
    SELECT MIN("id") FROM "User"
    WHERE "nickname" IS NOT NULL
    GROUP BY "nickname"
  );
CREATE UNIQUE INDEX IF NOT EXISTS "User_nickname_key"
  ON "User"("nickname") WHERE "nickname" IS NOT NULL;

-- 2. email 唯一（G-1 邮箱登录）
UPDATE "User" u
SET "email" = u."email" || '_' || substr(u."id", 1, 8)
WHERE u."email" IS NOT NULL
  AND u."id" NOT IN (
    SELECT MIN("id") FROM "User"
    WHERE "email" IS NOT NULL
    GROUP BY "email"
  );
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"
  ON "User"("email") WHERE "email" IS NOT NULL;

-- 3. 新增 qqOpenid 列 + 唯一（G-3）
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "qq_openid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_qqOpenid_key"
  ON "User"("qq_openid") WHERE "qq_openid" IS NOT NULL;

-- 4. 密码找回 / 重置令牌列（G-4，方案 A 列内存储，D5）
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reset_token_hash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reset_token_expiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reset_token_used" BOOLEAN NOT NULL DEFAULT false;
