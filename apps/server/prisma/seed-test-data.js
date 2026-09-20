const { PrismaClient } = require('./prisma-client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const PW = 'Test123456';

async function main() {
  const hashed = await bcrypt.hash(PW, 10);

  // 优先把代理商绑定到「乌鲁木齐市」(code 6501)，并让辖区内测试账号落入同一辖区，
  // 以便 AgentStudio 的 REGION 作用域能真实展示数据（与 seed-e2e-data.js 口径一致）。
  const city =
    (await prisma.region.findFirst({ where: { code: '6501' } })) ||
    (await prisma.region.findFirst({ where: { level: 2, regionPath: { startsWith: '65' } }, orderBy: { code: 'asc' } }));
  // 用户挂到具体的区/县，保证与代理商辖区在同一 regionPath 前缀链上
  const district =
    (await prisma.region.findFirst({ where: { code: '650102' } })) || // 天山区
    (await prisma.region.findFirst({ where: { level: 3, regionPath: { startsWith: city?.regionPath ?? '65' } }, orderBy: { code: 'asc' } }));

  const regionId = district ? district.id : null;
  const regionPath = district ? district.regionPath : null;
  if (district) {
    console.log('用户挂点：' + district.name + '（' + district.code + '，regionPath=' + district.regionPath + '）');
  } else {
    console.log('⚠️ 未找到区域数据，辖区留空（请先运行 region 种子）');
  }

  const now = new Date();
  const users = [
    { id: 'test_user_alice', phone: '13900001001', nickname: '迪丽努尔', realName: '迪丽努尔·艾山', role: 'USER', points: 860, totalSpent: 268000, userBalance: 32000, followingProviderCount: 2, vipLevel: 0 },
    { id: 'test_user_bob', phone: '13900001002', nickname: '艾力江', realName: '艾力江·吐尔逊', role: 'USER', points: 1200, totalSpent: 89000, userBalance: 1500, followingProviderCount: 1, vipLevel: 1 },
    { id: 'test_user_carol', phone: '13900001003', nickname: '热娜古丽', realName: '热娜古丽·玉山', role: 'USER', points: 50, totalSpent: 0, userBalance: 0, followingProviderCount: 0, vipLevel: 0 },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { nickname: u.nickname, realName: u.realName, role: u.role, regionId, regionPath, points: u.points, totalSpent: u.totalSpent, userBalance: u.userBalance, followingProviderCount: u.followingProviderCount, vipLevel: u.vipLevel, lastLoginAt: now },
      create: {
        id: u.id, phone: u.phone, password: hashed, nickname: u.nickname, realName: u.realName,
        role: u.role, locale: 'zh-CN', regionId, regionPath,
        points: u.points, totalSpent: u.totalSpent, userBalance: u.userBalance, followingProviderCount: u.followingProviderCount, vipLevel: u.vipLevel, lastLoginAt: now,
      },
    });
  }

  const providers = [
    { id: 'test_provider_design', phone: '13900002001', nickname: '麦麦提·艾力', serviceRoles: ['DESIGN'] },
    { id: 'test_provider_photo', phone: '13900002002', nickname: '古丽娜尔', serviceRoles: ['PHOTO', 'VENUE'] },
  ];
  for (const p of providers) {
    await prisma.user.upsert({
      where: { id: p.id },
      update: { nickname: p.nickname, role: 'SERVICE_PROVIDER', serviceRoles: p.serviceRoles, providerStatus: 'APPROVED', regionId, regionPath },
      create: {
        id: p.id, phone: p.phone, password: hashed, nickname: p.nickname,
        role: 'SERVICE_PROVIDER', serviceRoles: p.serviceRoles, providerStatus: 'APPROVED',
        locale: 'zh-CN', regionId, regionPath,
      },
    });
    await prisma.providerWallet.upsert({ where: { providerId: p.id }, update: {}, create: { providerId: p.id } });
  }

  // 代理商绑定辖区（与测试账号同辖区，便于演示辖区内视图）
  if (city) {
    await prisma.user.upsert({
      where: { id: 'test_agent_x' },
      update: { role: 'AGENT', regionId: city.id, regionPath: city.regionPath, nickname: '阿依古丽·乌鲁木齐', lastLoginAt: now },
      create: {
        id: 'test_agent_x', phone: '13900003001', password: hashed, nickname: '阿依古丽·乌鲁木齐',
        role: 'AGENT', regionId: city.id, regionPath: city.regionPath, locale: 'zh-CN', lastLoginAt: now,
      },
    });
    console.log('代理商已绑定辖区：' + city.name + '（' + city.code + '）');
  } else {
    console.log('⚠️ 未找到区域数据，代理商辖区留空（请先运行 region 种子）');
  }

  const wedding = await prisma.template.findFirst({ where: { status: 'APPROVED', category: 'wedding' } });
  const other = await prisma.template.findFirst({ where: { status: 'APPROVED', category: { not: 'wedding' } } });
  if (wedding) await prisma.template.update({ where: { id: wedding.id }, data: { authorId: 'test_provider_design' } });
  if (other) await prisma.template.update({ where: { id: other.id }, data: { authorId: 'test_provider_photo' } });

  const tplForDesign = wedding || other;
  const tplForPhoto = other || wedding;

  const orders = [
    { id: 'test_order_1', buyerId: 'test_user_alice', templateId: tplForDesign && tplForDesign.id, amount: 9900, platformFee: 990, designerIncome: 8910, status: 'paid' },
    { id: 'test_order_2', buyerId: 'test_user_bob', templateId: tplForDesign && tplForDesign.id, amount: 9900, platformFee: 990, designerIncome: 8910, status: 'paid' },
    { id: 'test_order_3', buyerId: 'test_user_carol', templateId: tplForPhoto && tplForPhoto.id, amount: 19900, platformFee: 1990, designerIncome: 17910, status: 'paid' },
  ].filter((o) => o.templateId);
  for (const o of orders) {
    await prisma.templateOrder.upsert({ where: { id: o.id }, update: o, create: o });
  }

  const designWallet = await prisma.providerWallet.findUnique({ where: { providerId: 'test_provider_design' } });
  const photoWallet = await prisma.providerWallet.findUnique({ where: { providerId: 'test_provider_photo' } });
  await prisma.providerWallet.update({ where: { providerId: 'test_provider_design' }, data: { balance: 50000, frozen: 5000, totalIncome: 47820, withdrawn: 30000 } });
  await prisma.providerWallet.update({ where: { providerId: 'test_provider_photo' }, data: { balance: 80000, frozen: 0, totalIncome: 17910, withdrawn: 0 } });

  await prisma.withdrawal.upsert({
    where: { id: 'test_wd_pending_1' }, update: {},
    create: { id: 'test_wd_pending_1', providerId: 'test_provider_design', walletId: designWallet.id, amount: 20000, currency: 'CNY', status: 'pending' },
  });
  await prisma.withdrawal.upsert({
    where: { id: 'test_wd_paid_1' }, update: {},
    create: { id: 'test_wd_paid_1', providerId: 'test_provider_design', walletId: designWallet.id, amount: 30000, currency: 'CNY', status: 'paid' },
  });
  await prisma.withdrawal.upsert({
    where: { id: 'test_wd_pending_2' }, update: {},
    create: { id: 'test_wd_pending_2', providerId: 'test_provider_photo', walletId: photoWallet.id, amount: 5000, currency: 'CNY', status: 'pending' },
  });

  console.log('✅ 跨角色测试数据已就绪（密码统一：' + PW + '）');
  console.log('   普通用户 : 13900001001 迪丽努尔 / 13900001002 艾力江 / 13900001003 热娜古丽');
  console.log('   服务商   : 13900002001 麦麦提·艾力（设计） / 13900002002 古丽娜尔（影像+场地）');
  console.log('   代理商   : 13900003001 阿依古丽（辖区：' + (city ? city.name : '无') + '）');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
