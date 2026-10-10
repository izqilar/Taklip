/* eslint-disable */
// 一次性脚本：把标准名单字段登记为占位符注册表的 legacy 项（v2 占位符管理 §8）。
// 真值源：packages/core/src/guest-fields.ts 的 GUEST_FIELD_DEFS（此处按稳定值登记）。
// 运行：node scripts/seed_placeholders.cjs（需 DATABASE_URL 环境变量）。
const path = require('path');
const { PrismaClient } = require(path.resolve(
  __dirname,
  '../apps/server/prisma/prisma-client',
));

const prisma = new PrismaClient();

const guestFieldDefs = [
  { key: 'guest_name', label: '姓名', required: true },
  { key: 'guest_title', label: '称谓', required: false },
  { key: 'gender', label: '性别', required: false },
  { key: 'unit', label: '单位', required: false },
  { key: 'table_no', label: '桌号', required: false },
  { key: 'phone', label: '手机号', required: false },
  { key: 'address', label: '地址', required: false },
  { key: 'remark', label: '备注', required: false },
];

(async () => {
  for (const f of guestFieldDefs) {
    await prisma.placeholderRegistry.upsert({
      where: { key: f.key },
      update: { label: f.label },
      create: {
        key: f.key,
        type: 'text',
        label: f.label,
        hint: '',
        defaultValue: '',
        scope: 'record',
        requiredDef: f.required,
        status: 'visible',
        legacy: true,
      },
    });
    console.log('upserted legacy placeholder:', f.key);
  }
  console.log('✅ 占位符注册表 legacy 字段登记完成');
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
