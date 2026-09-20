import { PrismaClient } from './prisma-client';
import * as bcrypt from 'bcrypt';

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

  console.log('✅ Seed 完成：dev_user_001 / dev_provider_001 / dev_admin_001 / dev_user_004 已就绪');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
