-- 图库图片需要原始文件名用于展示
ALTER TABLE "Asset"
  ADD COLUMN IF NOT EXISTS "name" TEXT;
