-- 账户详情「身份认证资料」区块：身份证人像面 / 国徽面影像 URL

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "id_card_front" TEXT,
ADD COLUMN     "id_card_back" TEXT;
