-- 消息 authorId 改为可空：支持「系统通知」（平台自动发送、无真实作者用户）。
-- 约束：author 关系从必填改为可选；已存在行均有 authorId，DROP NOT NULL 不影响存量。
ALTER TABLE "Message" ALTER COLUMN "author_id" DROP NOT NULL;
