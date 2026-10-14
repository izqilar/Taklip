/**
 * 诚邀名单模板种子脚本 — 向 GuestTemplate 表插入三套不可删除的系统默认模板。
 *
 * 运行方式：
 *   - 独立运行：npx tsx prisma/seed-guest-templates.ts
 *   - 已接入默认种子链：在 prisma/seed.ts 的 main() 中通过 seedGuestTemplates(prisma) 调用，
 *     故 `npm run seed` / `npx prisma db seed` 也会一并播种（幂等 upsert by id）。
 *
 * 三套系统模板（ownerType=SYSTEM, isSystem=true）：
 *   ① 简易宾客模板：男宾客、女宾客（均为文本，非必填；每行可录入多位夫妻姓名）
 *   ② 婚礼请柬诚邀模板：丈夫姓名(必填)、夫人姓名(必填)、桌号、手机号、微信号、地址、备注
 *   ③ 通用诚邀模板：沿用系统现有 8 字段（姓名/称谓/性别/单位/桌号/手机号/地址/备注）
 *
 * 注：字段定义在此内联，避免对 @h5design/core 构建产物的依赖；与
 * packages/core/src/guest-fields.ts 的 GUEST_FIELD_DEFS 保持一致。
 */
import { PrismaClient } from './prisma-client';

type FieldDef = {
  key: string;
  label: string;
  type: 'string' | 'enum';
  required: boolean;
  maxLen?: number;
  values?: string[];
  enum?: string[];
  pattern?: string;
  example: string;
};

/** ③ 简易宾客模板字段：仅男宾客 / 女宾客两列，文本类型，非必填 */
const SIMPLE_GUEST_FIELDS: FieldDef[] = [
  { key: 'gentleman', label: '男宾客', type: 'string', required: false, maxLen: 200, example: '张三、李四' },
  { key: 'gentlewoman', label: '女宾客', type: 'string', required: false, maxLen: 200, example: '张三夫人、李四夫人' },
];

/** ② 通用诚邀模板字段（与 GUEST_FIELD_DEFS 一致） */
const GENERAL_FIELDS: FieldDef[] = [
  { key: 'guest_name', label: '姓名', type: 'string', required: true, maxLen: 20, example: '张三' },
  { key: 'guest_title', label: '称谓', type: 'string', required: false, maxLen: 10, enum: ['先生', '女士', '博士', '教授', '同学', '同仁'], example: '' },
  { key: 'gender', label: '性别', type: 'enum', required: false, values: ['M', 'F', 'U'], example: 'M' },
  { key: 'unit', label: '单位', type: 'string', required: false, maxLen: 50, example: '新疆大学' },
  { key: 'table_no', label: '桌号', type: 'string', required: false, maxLen: 10, example: '8' },
  { key: 'phone', label: '手机号', type: 'string', required: false, pattern: '^1[3-9]\d{9}$', example: '13900001001' },
  { key: 'address', label: '地址', type: 'string', required: false, maxLen: 100, example: '' },
  { key: 'remark', label: '备注', type: 'string', required: false, maxLen: 100, example: '' },
];

/** ① 婚礼请柬诚邀模板字段 */
const WEDDING_FIELDS: FieldDef[] = [
  { key: 'husband_name', label: '丈夫姓名', type: 'string', required: true, maxLen: 20, example: '张伟' },
  { key: 'wife_name', label: '夫人姓名', type: 'string', required: true, maxLen: 20, example: '李娜' },
  { key: 'table_no', label: '桌号', type: 'string', required: false, maxLen: 10, example: '8' },
  { key: 'phone', label: '手机号', type: 'string', required: false, pattern: '^1[3-9]\d{9}$', example: '13900001001' },
  { key: 'wechat', label: '微信号', type: 'string', required: false, maxLen: 30, example: 'weixin_example' },
  { key: 'address', label: '地址', type: 'string', required: false, maxLen: 100, example: '' },
  { key: 'remark', label: '备注', type: 'string', required: false, maxLen: 100, example: '' },
];

const SYSTEM_TEMPLATES: {
  id: string;
  name: string;
  fields: FieldDef[];
  seq: number;
}[] = [
  { id: 'sys_simple_guest', name: '简易宾客模板', fields: SIMPLE_GUEST_FIELDS, seq: 0 },
  { id: 'sys_wedding_invite', name: '婚礼请柬诚邀模板', fields: WEDDING_FIELDS, seq: 10 },
  { id: 'sys_general_invite', name: '通用诚邀模板', fields: GENERAL_FIELDS, seq: 20 },
];

/**
 * 幂等写入两套系统默认模板（按 id upsert），可被 seed.ts 复用（传入已有 PrismaClient）。
 */
export async function seedGuestTemplates(prisma: PrismaClient): Promise<void> {
  console.log(`\n开始插入 ${SYSTEM_TEMPLATES.length} 套系统默认模板...`);

  for (const tpl of SYSTEM_TEMPLATES) {
    await prisma.guestTemplate.upsert({
      where: { id: tpl.id },
      update: {
        name: tpl.name,
        fields: tpl.fields as object,
        ownerType: 'SYSTEM',
        ownerId: null,
        isSystem: true,
        seq: tpl.seq,
        version: '1.0',
      },
      create: {
        id: tpl.id,
        name: tpl.name,
        fields: tpl.fields as object,
        ownerType: 'SYSTEM',
        ownerId: null,
        isSystem: true,
        seq: tpl.seq,
        version: '1.0',
      },
    });
    console.log(`  ✅ ${tpl.name}`);
  }

  const count = await prisma.guestTemplate.count({ where: { isSystem: true } });
  console.log(`\n✅ Seed 完成：共 ${count} 套系统默认模板`);
}

// 独立运行入口：仅当直接 `npx tsx prisma/seed-guest-templates.ts` 时触发；
// 被 seed.ts 引入时不自动执行（避免重复建连 / 重复播种）。
if (process.argv[1]?.includes('seed-guest-templates')) {
  const prisma = new PrismaClient();
  seedGuestTemplates(prisma)
    .catch((e) => {
      console.error('Seed 失败:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
