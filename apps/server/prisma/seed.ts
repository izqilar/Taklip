import { PrismaClient } from './prisma-client';
import * as bcrypt from 'bcrypt';
import { seedGuestTemplates } from './seed-guest-templates';

const prisma = new PrismaClient();

async function main() {
  // 开发阶段固定用户，便于联调（后续接入 JWT 鉴权后移除）
  await prisma.user.upsert({
    where: { id: 'dev_user_001' },
    update: {},
    create: {
      id: 'dev_user_001',
      nickname: '开发者',
    },
  });

  // 三角色联调用账号：服务商 / 管理员（带手机号 + 密码，可登录）
  const devPassword = await bcrypt.hash('dev123456', 10);
  await prisma.user.upsert({
    where: { id: 'dev_provider_001' },
    update: { role: 'SERVICE_PROVIDER', phone: '13800000001', password: devPassword, nickname: '开发服务商', serviceRoles: ['DESIGN'], providerStatus: 'APPROVED' },
    create: {
      id: 'dev_provider_001',
      nickname: '开发服务商',
      phone: '13800000001',
      password: devPassword,
      role: 'SERVICE_PROVIDER',
      serviceRoles: ['DESIGN'],
      providerStatus: 'APPROVED',
      locale: 'zh-CN',
    },
  });
  // 服务商钱包（收益账户）
  await prisma.providerWallet.upsert({
    where: { providerId: 'dev_provider_001' },
    update: {},
    create: { providerId: 'dev_provider_001' },
  });
  await prisma.user.upsert({
    where: { id: 'dev_admin_001' },
    update: { role: 'ADMIN', phone: '13800000002', password: devPassword, nickname: '开发管理员' },
    create: {
      id: 'dev_admin_001',
      nickname: '开发管理员',
      phone: '13800000002',
      password: devPassword,
      role: 'ADMIN',
      locale: 'zh-CN',
    },
  });

  // 普通用户联调账号（登录页演示账号：用户 13800000004 / dev123456）
  const district = await prisma.region.findFirst({ where: { code: '650102' }, select: { id: true, regionPath: true } });
  await prisma.user.upsert({
    where: { id: 'dev_user_004' },
    update: {
      role: 'USER',
      phone: '13800000004',
      password: devPassword,
      nickname: '阿依古丽',
      realName: '阿依古丽·买买提',
      ...(district ? { regionId: district.id, regionPath: district.regionPath } : {}),
    },
    create: {
      id: 'dev_user_004',
      nickname: '阿依古丽',
      realName: '阿依古丽·买买提',
      phone: '13800000004',
      password: devPassword,
      role: 'USER',
      locale: 'zh-CN',
      ...(district ? { regionId: district.id, regionPath: district.regionPath } : {}),
    },
  });

  // ── 占位符注册表种子（v2 占位符管理 §8）：把标准名单字段登记为 legacy 项。
  // 真值源仍是 packages/core/src/guest-fields.ts 的 GUEST_FIELD_DEFS；此处仅做展示/回落登记，
  // key 不变（guest_name…），scope=record（名单字段型），type=text，legacy=true（不可删）。
  const guestFieldDefs: { key: string; label: string; required: boolean }[] = [
    { key: 'guest_name', label: '姓名', required: true },
    { key: 'guest_title', label: '称谓', required: false },
    { key: 'gender', label: '性别', required: false },
    { key: 'unit', label: '单位', required: false },
    { key: 'table_no', label: '桌号', required: false },
    { key: 'phone', label: '手机号', required: false },
    { key: 'address', label: '地址', required: false },
    { key: 'remark', label: '备注', required: false },
  ];
  for (const f of guestFieldDefs) {
    await prisma.placeholderRegistry.upsert({
      where: { key: f.key },
      update: {},
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
  }

  // 系统默认诚邀名单模板（婚礼 / 通用），幂等 upsert by id（ownerType=SYSTEM, isSystem=true）
  await seedGuestTemplates(prisma);

  console.log('✅ Seed 完成：dev_user_001 / dev_provider_001 / dev_admin_001 / dev_user_004 已就绪；占位符注册表 legacy 字段已登记；系统默认模板已播种');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
