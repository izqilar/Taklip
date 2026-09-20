import { PrismaClient } from './prisma-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PW = 'Test123456';

/**
 * 跨角色测试数据（可重复执行，幂等 upsert）。
 * 覆盖 USER / SERVICE_PROVIDER / AGENT，并铺设钱包余额、成交订单、提现申请，
 * 用于验证管理后台用户/审核/代理商/钱包/订单/提现审核全链路。
 * 不改动既有 dev_user_001 / dev_provider_001 / dev_admin_001。
 */
async function main() {
  const hashed = await bcrypt.hash(PW, 10);
  const log: string[] = [];

  // —— 1) 普通用户 ——
  const users = [
    { id: 'test_user_alice', phone: '13900001001', nickname: '测试用户·Alice', realName: '艾丽', role: 'USER' as const },
    { id: 'test_user_bob', phone: '13900001002', nickname: '测试用户·Bob', realName: '波布', role: 'USER' as const },
    { id: 'test_user_carol', phone: '13900001003', nickname: '测试用户·Carol', realName: '卡萝', role: 'USER' as const },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { nickname: u.nickname, realName: u.realName, role: u.role },
      create: { id: u.id, phone: u.phone, password: hashed, nickname: u.nickname, realName: u.realName, role: u.role, locale: 'zh-CN' },
    });
  }

  // —— 2) 服务商（已通过资质审核）——
  const providers = [
    { id: 'test_provider_design', phone: '13900002001', nickname: '测试服务商·设计', serviceRoles: ['DESIGN'] as any },
    { id: 'test_provider_photo', phone: '13900002002', nickname: '测试服务商·影像', serviceRoles: ['PHOTO', 'VENUE'] as any },
  ];
  for (const p of providers) {
    await prisma.user.upsert({
      where: { id: p.id },
      update: { nickname: p.nickname, role: 'SERVICE_PROVIDER', serviceRoles: p.serviceRoles, providerStatus: 'APPROVED' },
      create: {
        id: p.id, phone: p.phone, password: hashed, nickname: p.nickname,
        role: 'SERVICE_PROVIDER', serviceRoles: p.serviceRoles, providerStatus: 'APPROVED', locale: 'zh-CN',
      },
    });
    await prisma.providerWallet.upsert({ where: { providerId: p.id }, update: {}, create: { providerId: p.id } });
  }

  // —— 3) 代理商（绑定辖区）——
  const region = await prisma.region.findFirst();
  if (region) {
    await prisma.user.upsert({
      where: { id: 'test_agent_x' },
      update: { role: 'AGENT', regionId: region.id, regionPath: region.regionPath },
      create: {
        id: 'test_agent_x', phone: '13900003001', password: hashed, nickname: '测试代理商·华东',
        role: 'AGENT', regionId: region.id, regionPath: region.regionPath, locale: 'zh-CN',
      },
    });
    log.push(`代理商已绑定辖区：${region.name}（${region.code}）`);
  } else {
    log.push('⚠️ 未找到区域数据，代理商辖区留空（请先运行 region 种子）');
  }

  // —— 4) 取已审核模板，并把作者归属到对应服务商 ——
  const wedding = await prisma.template.findFirst({ where: { status: 'APPROVED', category: 'wedding' } });
  const other = await prisma.template.findFirst({ where: { status: 'APPROVED', category: { not: 'wedding' } } });

  if (wedding) await prisma.template.update({ where: { id: wedding.id }, data: { authorId: 'test_provider_design' } });
  if (other) await prisma.template.update({ where: { id: other.id }, data: { authorId: 'test_provider_photo' } });

  const tplForDesign = wedding ?? other;
  const tplForPhoto = other ?? wedding;

  // —— 5) 成交订单（买家付款，服务商产生收入）——
  const orders = [
    { id: 'test_order_1', buyerId: 'test_user_alice', templateId: tplForDesign?.id, amount: 9900, platformFee: 990, designerIncome: 8910, status: 'paid' },
    { id: 'test_order_2', buyerId: 'test_user_bob', templateId: tplForDesign?.id, amount: 9900, platformFee: 990, designerIncome: 8910, status: 'paid' },
    { id: 'test_order_3', buyerId: 'test_user_carol', templateId: tplForPhoto?.id, amount: 19900, platformFee: 1990, designerIncome: 17910, status: 'paid' },
  ].filter((o) => o.templateId);
  for (const o of orders) {
    await prisma.templateOrder.upsert({
      where: { id: o.id },
      update: { ...o },
      create: { ...o },
    });
  }

  // 同步服务商钱包汇总（基于订单收入）
  await prisma.providerWallet.update({
    where: { providerId: 'test_provider_design' },
    data: { balance: 50000, totalIncome: 17820 + 30000, withdrawn: 30000 },
  });
  await prisma.providerWallet.update({
    where: { providerId: 'test_provider_photo' },
    data: { balance: 80000, totalIncome: 17910, withdrawn: 0 },
  });

  // —— 6) 提现申请（待处理 + 已打款历史）——
  // design 服务商：1 笔待处理 ¥200、1 笔已打款历史 ¥300
  await prisma.withdrawal.upsert({
    where: { id: 'test_wd_pending_1' },
    update: {},
    create: { id: 'test_wd_pending_1', providerId: 'test_provider_design', walletId: (await prisma.providerWallet.findUnique({ where: { providerId: 'test_provider_design' } }))!.id, amount: 20000, currency: 'CNY', status: 'pending' },
  });
  await prisma.withdrawal.upsert({
    where: { id: 'test_wd_paid_1' },
    update: {},
    create: { id: 'test_wd_paid_1', providerId: 'test_provider_design', walletId: (await prisma.providerWallet.findUnique({ where: { providerId: 'test_provider_design' } }))!.id, amount: 30000, currency: 'CNY', status: 'paid' },
  });
  // photo 服务商：1 笔待处理 ¥50
  await prisma.withdrawal.upsert({
    where: { id: 'test_wd_pending_2' },
    update: {},
    create: { id: 'test_wd_pending_2', providerId: 'test_provider_photo', walletId: (await prisma.providerWallet.findUnique({ where: { providerId: 'test_provider_photo' } }))!.id, amount: 5000, currency: 'CNY', status: 'pending' },
  });

  console.log('✅ 跨角色测试数据已就绪（密码统一：' + PW + '）');
  console.log('   普通用户 : 13900001001 / 13900001002 / 13900001003');
  console.log('   服务商   : 13900002001（设计） / 13900002002（影像+场地）');
  console.log('   代理商   : 13900003001');
  log.forEach((l) => console.log('   · ' + l));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
