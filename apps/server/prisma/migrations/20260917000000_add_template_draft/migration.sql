-- AlterEnum
-- 为「作品升级为服务」落地草稿态：在现有 TemplateStatus 枚举追加 DRAFT
-- PG 12+ 支持 ADD VALUE IF NOT EXISTS，保证可重复执行幂等
ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
