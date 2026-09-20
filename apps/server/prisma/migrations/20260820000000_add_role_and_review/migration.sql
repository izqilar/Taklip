-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'DESIGNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CNY',
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "TemplateOrder" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "designerIncome" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignerWallet" (
    "id" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalIncome" INTEGER NOT NULL DEFAULT 0,
    "withdrawn" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateOrder_templateId_idx" ON "TemplateOrder"("templateId");

-- CreateIndex
CREATE INDEX "TemplateOrder_buyerId_idx" ON "TemplateOrder"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignerWallet_designerId_key" ON "DesignerWallet"("designerId");

-- CreateIndex
CREATE INDEX "Template_authorId_idx" ON "Template"("authorId");

-- CreateIndex
CREATE INDEX "Template_status_idx" ON "Template"("status");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

