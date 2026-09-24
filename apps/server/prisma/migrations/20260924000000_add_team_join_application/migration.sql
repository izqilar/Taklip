-- 入驻申请「加入」隧道：TeamJoinApplication 申请单
-- + Message 支持定向投递到单个用户（加入申请的接收 / 拒绝回执）
-- + OrgStaff 防重（同一用户在同一组织仅一条员工档案）

-- AlterEnum
ALTER TYPE "MessageScope" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "recipient_id" TEXT;

-- CreateTable
CREATE TABLE "TeamJoinApplication" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_type" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "region_path" TEXT,
    "region_label" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamJoinApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamJoinApplication_org_type_org_id_status_idx" ON "TeamJoinApplication"("org_type", "org_id", "status");

-- CreateIndex
CREATE INDEX "TeamJoinApplication_user_id_status_idx" ON "TeamJoinApplication"("user_id", "status");

-- CreateIndex
CREATE INDEX "Message_recipient_id_idx" ON "Message"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStaff_org_type_org_id_user_id_key" ON "OrgStaff"("org_type", "org_id", "user_id");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamJoinApplication" ADD CONSTRAINT "TeamJoinApplication_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
