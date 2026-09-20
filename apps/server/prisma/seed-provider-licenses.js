/**
 * 服务商资质项（证照）样例数据（幂等，id 固定 seed_lic_01..04，可反复运行）
 * 对齐文档 §8.8 样例：ZZ-1001 卫生许可证(已过期) / ZZ-1002 实名认证(待审核)
 *                     ZZ-1003 演出许可证(有效) / ZZ-1004 营业执照(有效)
 */
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, 'prisma-client'));
const prisma = new PrismaClient();
const PROVIDER_ID = 'dev_provider_001';

const LICENSES = [
  { id: 'seed_lic_01', licNo: 'ZZ-1001', name: '卫生许可证', type: '其他', certNo: '650102MA000000001X', issuer: '乌鲁木齐市卫生健康委员会', validTo: '2024-12-31T00:00:00.000Z', longTerm: false, expireRemind: '不提醒', status: '已过期', description: '食品经营卫生许可' },
  { id: 'seed_lic_02', licNo: 'ZZ-1002', name: '实名认证', type: '居民身份证', certNo: '6501021990********1234', issuer: '公安机关', validTo: null, longTerm: true, expireRemind: '不提醒', status: '待审核', description: '实名身份认证' },
  { id: 'seed_lic_03', licNo: 'ZZ-1003', name: '演出许可证', type: '演出许可', certNo: '650102MA3L408021Y', issuer: '新疆维吾尔自治区文化和旅游厅', validTo: '2027-05-31T00:00:00.000Z', longTerm: false, expireRemind: '提前90天', status: '有效', description: '经营性演出许可' },
  { id: 'seed_lic_04', licNo: 'ZZ-1004', name: '营业执照', type: '营业执照', certNo: '91650100MA7K2X2210', issuer: '乌鲁木齐市市场监督管理局', validTo: '2029-02-28T00:00:00.000Z', longTerm: false, expireRemind: '提前90天', status: '有效', description: '市场主体营业执照' },
];

async function main() {
  for (const l of LICENSES) {
    const { id, ...rest } = l;
    await prisma.providerLicense.upsert({
      where: { id },
      update: rest,
      create: { ...rest, providerId: PROVIDER_ID },
    });
  }
  console.log('seeded provider licenses:', LICENSES.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
