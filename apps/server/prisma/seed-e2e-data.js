/**
 * 端到端验证数据种子 —— 补齐四类角色与订单，覆盖各业务状态。
 * 业务辖区统一为新疆维吾尔自治区（65），地名与人名参照 UI_Design 原型样例数据风格。
 *
 * 设计原则：
 *  1. 幂等：所有记录使用固定 id，重复运行只更新不重复插入。
 *  2. 不破坏既有账号：13900001001~1003 / 13900002001~2002 / 13900003001 / 13800000001~2 凭据保持不变。
 *  3. 确定性：用固定种子伪随机数生成订单，保证每次运行结果一致、趋势图可复现。
 *  4. 与服务端聚合口径对齐：
 *     - 总台 regionBars 按买家 region.name 聚合；
 *     - 总台 trend14d 取近 14 日订单按日汇总 → 订单必须跨天分布；
 *     - agentTop / 代理商辖区按 regionPath 前缀匹配 → 代理商与用户须在同一前缀链上。
 *
 * 运行：node prisma/seed-e2e-data.js
 */
const { PrismaClient } = require('./prisma-client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const PW = 'Test123456';

/* ── 确定性伪随机（mulberry32）────────────────────── */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = rng(20260829);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/** 取某自然日内的随机时刻 */
function dayAt(daysAgo, hour = null, minute = null) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour ?? between(9, 21), minute ?? between(0, 59), 0, 0);
  return d;
}

/**
 * 用户幂等写入（按 id）。
 * 手机号是唯一键：若目标手机号已被既有种子账号占用（如 13900003001 属于 test_agent_x），
 * 则接管该既有账号而不是新建 —— 这样既能修正历史账号的辖区错配，也不会产生重复账号。
 */
async function upsertUser(id, data) {
  try {
    return await prisma.user.upsert({ where: { id }, update: data, create: { id, ...data } });
  } catch (e) {
    if (e?.code !== 'P2002' || !data.phone) throw e;
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (!existing) throw e;
    const { password, ...rest } = data;
    return prisma.user.update({ where: { id: existing.id }, data: rest });
  }
}

/* ── 区域基准：按国标 code 定位，缺失时回退首个同级区域 ── */
async function regionByCode(code, level) {
  return (
    (await prisma.region.findFirst({ where: { code } })) ||
    (await prisma.region.findFirst({ where: { level }, orderBy: { code: 'asc' } }))
  );
}

async function main() {
  const hashed = await bcrypt.hash(PW, 10);

  // 业务辖区统一为新疆：1 个自治区 + 5 个地/州/市，用户挂到其下区/县
  const R = {};
  for (const [key, code, level] of [
    ['xinjiang', '65', 1], // 新疆维吾尔自治区
    ['wlmq', '6501', 2], // 乌鲁木齐市
    ['tianshan', '650102', 3], // 天山区
    ['saybag', '650103', 3], // 沙依巴克区
    ['xinshi', '650104', 3], // 新市区
    ['shuimogou', '650105', 3], // 水磨沟区
    ['kashi', '6531', 2], // 喀什地区
    ['kashiCity', '653101', 3], // 喀什市
    ['shufu', '653121', 3], // 疏附县
    ['yili', '6540', 2], // 伊犁哈萨克自治州
    ['yining', '654002', 3], // 伊宁市
    ['kuitun', '654003', 3], // 奎屯市
    ['changji', '6523', 2], // 昌吉回族自治州
    ['changjiCity', '652301', 3], // 昌吉市
    ['fukang', '652302', 3], // 阜康市
    ['bazhou', '6528', 2], // 巴音郭楞蒙古自治州
    ['korla', '652801', 3], // 库尔勒市
    ['yanqi', '652826', 3], // 焉耆回族自治县
  ]) {
    R[key] = await regionByCode(code, level);
  }
  const missing = Object.entries(R).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error('区域数据缺失，请先运行 seed-regions：' + missing.join(','));
  console.log('区域基准就绪（新疆 5 地州 / 11 区县）：' + Object.keys(R).length + ' 个');

  /**
   * 辖区挂点：代理商按「地/州/市」前缀管辖，用户挂到具体区/县，
   * 这样代理商 regionPath 前缀能匹配到本区用户（前缀链同口径）。
   */
  const anchor = (r) => ({ regionId: r.id, regionPath: r.regionPath });

  /* ── 预清理：本脚本全量托管 e2e_ 命名空间，先清空再重建 ──────────
   * 数据做过区域重命名（如 e2e_user_bj_1 → e2e_user_wlmq_1），旧 id 的账号
   * 不会自动消失，且仍占用着手机号，会让新 id 的 create 撞唯一键。
   * 故按「外键由内向外」顺序整体清空一次，保证每次运行都是从零重建。
   */
  const E2E = 'e2e_';
  // 注意：不能只按 id 前缀删。端到端验证脚本会真实调用写接口（如「发起提现」），
  // 产生的记录 id 是数据库生成的 cuid，不落在 e2e_ 前缀内，却仍外键引用着 e2e_ 数据。
  // 故先按「外键关联」清理，再按 id 前缀兜底，两道都走。
  const e2eUserIds = (
    await prisma.user.findMany({ where: { id: { startsWith: E2E } }, select: { id: true } })
  ).map((u) => u.id);
  const e2eTplIds = (
    await prisma.template.findMany({ where: { id: { startsWith: E2E } }, select: { id: true } })
  ).map((t) => t.id);
  const e2eWalletIds = e2eUserIds.length
    ? (
        await prisma.providerWallet.findMany({
          where: { providerId: { in: e2eUserIds } },
          select: { id: true },
        })
      ).map((w) => w.id)
    : [];

  // ① 按外键关联清理（覆盖 cuid 记录）
  if (e2eWalletIds.length) {
    await prisma.withdrawal.deleteMany({ where: { walletId: { in: e2eWalletIds } } });
  }
  if (e2eUserIds.length) {
    await prisma.templateOrder.deleteMany({ where: { buyerId: { in: e2eUserIds } } });
    await prisma.ticket.deleteMany({
      where: {
        OR: [
          { reporterId: { in: e2eUserIds } },
          { targetId: { in: e2eUserIds } },
          { assigneeId: { in: e2eUserIds } },
        ],
      },
    });
    await prisma.message.deleteMany({ where: { authorId: { in: e2eUserIds } } });
    await prisma.project.deleteMany({ where: { userId: { in: e2eUserIds } } });
  }
  if (e2eTplIds.length) {
    await prisma.templateOrder.deleteMany({ where: { templateId: { in: e2eTplIds } } });
    await prisma.templateAppeal.deleteMany({ where: { templateId: { in: e2eTplIds } } });
  }

  // ② 按 id 前缀兜底
  await prisma.templateOrder.deleteMany({ where: { id: { startsWith: E2E } } });
  await prisma.withdrawal.deleteMany({ where: { id: { startsWith: E2E } } });
  await prisma.templateAppeal.deleteMany({ where: { id: { startsWith: E2E } } });
  await prisma.ticket.deleteMany({ where: { id: { startsWith: E2E } } });
  await prisma.message.deleteMany({ where: { id: { startsWith: E2E } } });
  await prisma.project.deleteMany({ where: { id: { startsWith: E2E } } });

  // ③ 最后删主体（外键已清干净）
  if (e2eUserIds.length) {
    await prisma.providerWallet.deleteMany({ where: { providerId: { in: e2eUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: e2eUserIds } } });
  }
  if (e2eTplIds.length) {
    await prisma.template.deleteMany({ where: { id: { in: e2eTplIds } } });
  }
  console.log(
    `已清空 e2e_ 命名空间（从零重建）：用户 ${e2eUserIds.length} / 模板 ${e2eTplIds.length} / 钱包 ${e2eWalletIds.length}`,
  );

  /* ══════════════ 1. 代理商 AGENT（五个地州市）══════════════ */
  const agents = [
    { id: 'e2e_agent_wlmq', phone: '13900003001', nickname: '阿依古丽·乌鲁木齐', realName: '阿依古丽·买买提', r: R.wlmq },
    { id: 'e2e_agent_kashi', phone: '13900003002', nickname: '买买提江·喀什', realName: '买买提江·吐尔逊', r: R.kashi },
    { id: 'e2e_agent_yili', phone: '13900003003', nickname: '努尔兰·伊犁', realName: '努尔兰·叶尔江', r: R.yili },
    { id: 'e2e_agent_changji', phone: '13900003004', nickname: '马俊·昌吉', realName: '马俊', r: R.changji },
    { id: 'e2e_agent_bazhou', phone: '13900003005', nickname: '巴图·巴州', realName: '巴图', r: R.bazhou },
  ];
  for (const a of agents) {
    await upsertUser(a.id, {
      ...anchor(a.r), phone: a.phone, password: hashed, nickname: a.nickname,
      realName: a.realName, role: 'AGENT', locale: 'zh-CN', status: 'ACTIVE',
    });
  }
  // 反查真实 id：手机号若被既有账号占用，upsertUser 会接管该账号，id 与计划值不同
  const agentRows = await prisma.user.findMany({
    where: { phone: { in: agents.map((a) => a.phone) } },
    select: { id: true, phone: true, regionPath: true },
  });
  const agentIdByPhone = new Map(agentRows.map((a) => [a.phone, a.id]));
  const agentIdByPrefix = new Map(agentRows.map((a) => [a.regionPath ?? '', a.id]));
  /** 按买家辖区前缀找到归属代理商（前缀最长匹配，与服务端 regionPath 前缀口径一致） */
  const resolveAgentId = (regionPath) => {
    const rp = regionPath ?? '';
    let hit = null;
    for (const [prefix, id] of agentIdByPrefix) {
      if (prefix && rp.startsWith(prefix) && (!hit || prefix.length > hit.prefix.length)) {
        hit = { prefix, id };
      }
    }
    return hit?.id ?? null;
  };
  console.log(`代理商 ${agents.length} 个（乌鲁木齐 / 喀什 / 伊犁 / 昌吉 / 巴州）`);

  /* ══════════════ 2. 普通用户 USER ══════════════ */
  // 分布到 5 个地州，vipLevel 0/1 混合，含 2 个停用账户（验证启停闸门）
  const users = [];
  const userPlan = [
    // 乌鲁木齐市
    ['e2e_user_wlmq_1', '13900011001', '迪丽努尔', '迪丽努尔·艾山', R.tianshan, 1],
    ['e2e_user_wlmq_2', '13900011002', '艾力江', '艾力江·吐尔逊', R.saybag, 0],
    ['e2e_user_wlmq_3', '13900011003', '热娜古丽', '热娜古丽·玉山', R.xinshi, 1],
    ['e2e_user_wlmq_4', '13900011004', '王雪', '王雪', R.shuimogou, 0],
    // 喀什地区
    ['e2e_user_kashi_1', '13900012001', '阿卜杜拉', '阿卜杜拉·热合曼', R.kashiCity, 1],
    ['e2e_user_kashi_2', '13900012002', '祖力皮亚', '祖力皮亚·艾力', R.shufu, 0],
    ['e2e_user_kashi_3', '13900012003', '玉山江', '玉山江·卡德尔', R.kashiCity, 0],
    // 伊犁哈萨克自治州
    ['e2e_user_yili_1', '13900013001', '阿依娜', '阿依娜·努尔兰', R.yining, 1],
    ['e2e_user_yili_2', '13900013002', '叶尔江', '叶尔江·巴合提', R.kuitun, 0],
    ['e2e_user_yili_3', '13900013003', '张萌', '张萌', R.yining, 0],
    // 昌吉回族自治州
    ['e2e_user_changji_1', '13900014001', '马晓梅', '马晓梅', R.changjiCity, 1],
    ['e2e_user_changji_2', '13900014002', '刘涛', '刘涛', R.fukang, 0],
    // 巴音郭楞蒙古自治州
    ['e2e_user_bazhou_1', '13900015001', '巴合提古丽', '巴合提古丽·赛力克', R.korla, 0],
    ['e2e_user_bazhou_2', '13900015002', '陈静', '陈静', R.yanqi, 1],
  ];
  for (const [id, phone, nickname, realName, r, vip] of userPlan) {
    await upsertUser(id, {
      ...anchor(r), phone, password: hashed, nickname, realName,
      role: 'USER', vipLevel: vip, locale: 'zh-CN', status: 'ACTIVE',
    });
    users.push({ id, r });
  }
  // 两个停用账户：验证管理员「停用/启用」闸门与列表状态标签
  const disabled = [
    ['e2e_user_off_1', '13900019001', '伊力哈木', '伊力哈木·阿卜杜', R.xinshi],
    ['e2e_user_off_2', '13900019002', '海俊', '海俊', R.kashiCity],
  ];
  for (const [id, phone, nickname, realName, r] of disabled) {
    await upsertUser(id, {
      ...anchor(r), phone, password: hashed, nickname, realName,
      role: 'USER', vipLevel: 0, locale: 'zh-CN', status: 'DISABLED',
    });
  }
  console.log(`普通用户 ${userPlan.length + disabled.length} 个（含 2 个停用 / vip 混合）`);

  /* ══════════════ 3. 服务商 SERVICE_PROVIDER ══════════════ */
  // 覆盖 6 种服务子角色；资质 PENDING/APPROVED 混合；部分带 pendingServiceRoles（扩展业务审核中）
  // tplTitle：该服务商主打模板的新疆意象命名（原型样例风格，如「红绸喜字」「鎏金岁月」）
  const providers = [
    // 乌鲁木齐市
    { id: 'e2e_sp_wlmq_steward', phone: '13900021001', nickname: '麦麦提·艾力', realName: '麦麦提·艾力', r: R.tianshan, roles: ['STEWARD'], status: 'APPROVED', tplTitle: '天山雪莲·婚礼主持套系' },
    { id: 'e2e_sp_wlmq_photo', phone: '13900021002', nickname: '古丽娜尔', realName: '古丽娜尔·艾山', r: R.saybag, roles: ['PHOTO'], status: 'APPROVED', tplTitle: '丝路光影·婚礼跟拍' },
    { id: 'e2e_sp_wlmq_venue', phone: '13900021003', nickname: '王磊', realName: '王磊', r: R.xinshi, roles: ['VENUE'], status: 'APPROVED', pending: ['FLORAL'], tplTitle: '楼兰盛宴·宴会全案' },
    { id: 'e2e_sp_wlmq_floral', phone: '13900021004', nickname: '阿迪力江', realName: '阿迪力江·吐尔逊', r: R.shuimogou, roles: ['FLORAL'], status: 'PENDING', tplTitle: '红绸喜字·花艺套系' },
    // 喀什地区
    { id: 'e2e_sp_kashi_design', phone: '13900022001', nickname: '李静', realName: '李静', r: R.kashiCity, roles: ['DESIGN'], status: 'APPROVED', pending: ['PERFORM'], tplTitle: '喀什老城·婚礼视觉设计' },
    { id: 'e2e_sp_kashi_perform', phone: '13900022002', nickname: '帕提曼', realName: '帕提曼·热合曼', r: R.shufu, roles: ['PERFORM'], status: 'APPROVED', tplTitle: '十二木卡姆·婚礼演出' },
    { id: 'e2e_sp_kashi_photo', phone: '13900022003', nickname: '张伟', realName: '张伟', r: R.kashiCity, roles: ['PHOTO'], status: 'PENDING', tplTitle: '香妃园·婚纱写真' },
    // 伊犁哈萨克自治州
    { id: 'e2e_sp_yili_venue', phone: '13900023001', nickname: '米热古丽', realName: '米热古丽·赛力克', r: R.yining, roles: ['VENUE', 'FLORAL'], status: 'APPROVED', tplTitle: '赛里木湖·户外宴会布置' },
    { id: 'e2e_sp_yili_steward', phone: '13900023002', nickname: '叶尔肯', realName: '叶尔肯·努尔兰', r: R.kuitun, roles: ['STEWARD'], status: 'APPROVED', tplTitle: '草原牧歌·草原婚礼主持' },
    // 昌吉回族自治州
    { id: 'e2e_sp_changji_all', phone: '13900024001', nickname: '阿依古丽', realName: '阿依古丽·买买提', r: R.changjiCity, roles: ['DESIGN', 'PHOTO', 'STEWARD'], status: 'APPROVED', pending: ['VENUE', 'PERFORM'], tplTitle: '胡杨礼赞·全案设计' },
    { id: 'e2e_sp_changji_perform', phone: '13900024002', nickname: '孙浩', realName: '孙浩', r: R.fukang, roles: ['PERFORM'], status: 'PENDING', tplTitle: '天山脚下·乐队演出' },
    // 巴音郭楞蒙古自治州
    { id: 'e2e_sp_bazhou_design', phone: '13900025001', nickname: '周悦', realName: '周悦', r: R.korla, roles: ['DESIGN'], status: 'APPROVED', tplTitle: '葡萄沟·喜宴视觉设计' },
  ];
  for (const p of providers) {
    await upsertUser(p.id, {
      ...anchor(p.r), phone: p.phone, password: hashed, nickname: p.nickname,
      realName: p.realName, role: 'SERVICE_PROVIDER', serviceRoles: p.roles,
      pendingServiceRoles: p.pending ?? [], providerStatus: p.status,
      locale: 'zh-CN', status: 'ACTIVE',
    });
    await prisma.providerWallet.upsert({
      where: { providerId: p.id },
      update: {},
      create: { providerId: p.id },
    });
  }
  console.log(`服务商 ${providers.length} 个（6 类子角色 / 资质待审 ${providers.filter((p) => p.status === 'PENDING').length} 个 / 扩展业务待审 ${providers.filter((p) => p.pending).length} 个）`);

  /* ══════════════ 4. 模板（覆盖全部审核状态 + 付费/免费）══════════════ */
  const baseSchema = { pages: [{ id: 'p1', elements: [] }] };
  const tplPlan = [];
  // 每个已认证服务商产出 1 个已上架主打模板
  const approvedProviders = providers.filter((p) => p.status === 'APPROVED');
  approvedProviders.forEach((p, i) => {
    tplPlan.push({
      id: `e2e_tpl_on_${i + 1}`, name: p.tplTitle, category: 'wedding',
      price: [0, 2900, 4900, 9900][i % 4], status: 'APPROVED', authorId: p.id, isOfficial: false,
    });
  });
  // 待审核 / 已驳回 / 已下架，供模板审核页与申诉流程使用
  const reviewPlan = [
    ['PENDING', '丝路花雨·待审方案', 'wedding', 1900],
    ['PENDING', '楼兰新娘·待审方案', 'wedding', 3900],
    ['PENDING', '巴音布鲁克·待审方案', 'birthday', 6900],
    ['REJECTED', '火焰山·已驳回方案', 'conference', 0],
    ['REJECTED', '天鹅湖·已驳回方案', 'opening', 2900],
    ['TAKEN_DOWN', '那拉提·已下架方案', 'festival', 4900],
  ];
  reviewPlan.forEach(([status, name, category, price], i) => {
    const p = providers[i % providers.length];
    tplPlan.push({
      id: `e2e_tpl_${status.toLowerCase()}_${i + 1}`,
      name,
      category,
      price,
      status, authorId: p.id, isOfficial: false,
      reviewNote: status === 'REJECTED' ? '素材存在版权风险，请更换后重新提交' : null,
    });
  });
  for (const t of tplPlan) {
    await prisma.template.upsert({
      where: { id: t.id },
      update: {
        name: t.name, category: t.category, price: t.price, status: t.status,
        authorId: t.authorId, reviewNote: t.reviewNote,
      },
      create: {
        id: t.id, name: t.name, category: t.category, tags: ['e2e'],
        price: t.price, status: t.status, authorId: t.authorId,
        reviewNote: t.reviewNote, isOfficial: false, schema: baseSchema,
      },
    });
  }
  console.log(`模板 ${tplPlan.length} 个（已上架 ${approvedProviders.length} / 待审 3 / 已驳回 2 / 已下架 1）`);

  /* ══════════════ 5. 订单（跨 30 天、多区域、含退款）══════════════ */
  const templates = await prisma.template.findMany({ where: { id: { startsWith: 'e2e_tpl_' } } });
  const onSale = templates.filter((t) => t.status === 'APPROVED');
  if (!onSale.length) throw new Error('无可售模板，订单生成中止');

  await prisma.templateOrder.deleteMany({ where: { id: { startsWith: 'e2e_order_' } } });
  const orders = [];
  let seq = 0;
  // 近 30 天，越近越密集（模拟增长曲线）；保证近 14 天每天有单 → 趋势图有形状
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const density = daysAgo < 7 ? between(3, 6) : daysAgo < 14 ? between(2, 4) : between(1, 3);
    for (let k = 0; k < density; k++) {
      const buyer = pick(users);
      const tpl = pick(onSale);
      const amount = pick([1900, 2900, 3900, 4900, 6900, 9900, 12900, 19900]);
      // 退款率控制在 ~8%
      const status = rnd() < 0.08 ? 'refunded' : 'paid';
      const platformFee = Math.round(amount * 0.1);
      seq += 1;
      orders.push({
        id: `e2e_order_${String(seq).padStart(4, '0')}`,
        buyerId: buyer.id,
        templateId: tpl.id,
        amount,
        platformFee,
        designerIncome: amount - platformFee,
        status,
        createdAt: dayAt(daysAgo),
      });
    }
  }
  await prisma.templateOrder.createMany({ data: orders });
  console.log(`订单 ${orders.length} 个（跨 30 天 / 退款 ${orders.filter((o) => o.status === 'refunded').length} 个 / 合计 ¥${(orders.reduce((s, o) => s + o.amount, 0) / 100).toFixed(2)}）`);

  /* ══════════════ 6. 钱包：按订单实得重算，保证账目自洽 ══════════════ */
  const incomeByProvider = new Map();
  for (const o of orders) {
    const tpl = templates.find((t) => t.id === o.templateId);
    if (!tpl?.authorId || o.status !== 'paid') continue;
    incomeByProvider.set(tpl.authorId, (incomeByProvider.get(tpl.authorId) ?? 0) + o.designerIncome);
  }
  for (const p of providers) {
    const totalIncome = incomeByProvider.get(p.id) ?? 0;
    // 已提现按累计收入的一定比例，余额为剩余可提现
    const withdrawn = Math.round(totalIncome * (0.2 + rnd() * 0.3));
    const balance = Math.max(totalIncome - withdrawn, 0);
    await prisma.providerWallet.upsert({
      where: { providerId: p.id },
      update: { totalIncome, withdrawn, balance },
      create: { providerId: p.id, totalIncome, withdrawn, balance },
    });
  }
  console.log(`钱包 ${providers.length} 个已按订单实得重算`);

  /* ══════════════ 7. 提现（pending / paid / failed 全覆盖）══════════════ */
  await prisma.withdrawal.deleteMany({ where: { id: { startsWith: 'e2e_wd_' } } });
  const wallets = await prisma.providerWallet.findMany();
  const wds = [];
  let wseq = 0;
  for (const w of wallets) {
    // 每个服务商 3 笔：待审 / 已打款 / 已驳回，覆盖提现审核三态
    const unit = Math.max(Math.round(w.totalIncome * 0.15), 1000);
    const plan = [
      ['pending', unit],
      ['paid', Math.round(unit * 0.8)],
      ['failed', Math.round(unit * 0.5)],
    ];
    for (const [status, amount] of plan) {
      if (amount < 100) continue;
      wseq += 1;
      wds.push({
        id: `e2e_wd_${String(wseq).padStart(3, '0')}`,
        providerId: w.providerId,
        walletId: w.id,
        amount,
        currency: 'CNY',
        status,
        createdAt: dayAt(between(0, 20)),
      });
    }
  }
  if (wds.length) await prisma.withdrawal.createMany({ data: wds });
  console.log(`提现 ${wds.length} 笔（待审/已打款/已驳回 各 ${wds.filter((w) => w.status === 'pending').length}/${wds.filter((w) => w.status === 'paid').length}/${wds.filter((w) => w.status === 'failed').length}）`);

  /* ══════════════ 8. 模板申诉（pending / approved / rejected）══════════════ */
  await prisma.templateAppeal.deleteMany({ where: { id: { startsWith: 'e2e_appeal_' } } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminId = admin?.id ?? null;
  const appealSources = templates.filter((t) => t.status === 'REJECTED' || t.status === 'TAKEN_DOWN');
  const appeals = [];
  appealSources.forEach((t, i) => {
    const status = ['pending', 'approved', 'rejected'][i % 3];
    appeals.push({
      id: `e2e_appeal_${i + 1}`,
      templateId: t.id,
      providerId: t.authorId,
      reason: '素材已取得商用授权，附授权书扫描件，申请恢复上架。',
      status,
      adminNote: status === 'pending' ? null : status === 'approved' ? '已核验授权书，予以恢复上架。' : '授权书主体与账号实名不一致，维持原处理。',
      reviewedBy: status === 'pending' ? null : adminId,
      reviewedAt: status === 'pending' ? null : dayAt(between(1, 10)),
      createdAt: dayAt(between(5, 25)),
    });
  });
  if (appeals.length) await prisma.templateAppeal.createMany({ data: appeals });
  console.log(`申诉 ${appeals.length} 条（待处理/已通过/已驳回）`);

  /* ══════════════ 9. 评价与反馈工单（5 类型 × 5 状态）══════════════ */
  await prisma.ticket.deleteMany({ where: { id: { startsWith: 'e2e_ticket_' } } });
  const TICKET_PLAN = [
    ['COMPLAINT', 'OPEN', '婚庆主持未按时到场', '约定仪式开始时间已过半小时，主持仍未到场，多次电话无人接听。'],
    ['COMPLAINT', 'NEGOTIATING', '现场花艺与确认稿不符', '花艺主色调与确认稿差异较大，希望协商部分退款。', R.tianshan],
    ['COMPLAINT', 'ESCALATED', '摄影师缺席关键环节', '仪式环节摄影师未到场，已与代理商协商无果，申请总台介入。', R.saybag],
    ['APPEAL', 'ARBITRATING', '对模板下架提出申诉', '模板素材均为原创拍摄，已补充版权证明，申请仲裁复核。', R.kashiCity],
    ['PRAISE', 'CLOSED', '主持人表现超出预期', '麦麦提老师现场氛围调动极好，亲友反馈极佳，特此感谢。', R.yining],
    ['PRAISE', 'OPEN', '花艺设计很有质感', '用了天山雪莲的配色，与婚礼主题高度契合，值得推荐。', R.xinshi],
    ['SUGGESTION', 'NEGOTIATING', '希望增加线上改稿次数', '当前套餐仅含 2 次改稿，建议提供更灵活的加购包。', R.kuitun],
    ['SUGGESTION', 'CLOSED', '建议模板支持批量替换文案', '同系列请柬逐张改文案效率低，希望支持批量替换。', R.korla],
    ['CONSULT', 'OPEN', '咨询跨地州服务费用', '婚礼在喀什，主持团队从乌鲁木齐出发，差旅费用如何计算？', R.kashiCity],
    ['CONSULT', 'CLOSED', '咨询发票开具流程', '单位采购需要专票，请问开具流程与周期。', R.yining],
    ['COMPLAINT', 'CLOSED', '物料数量短少', '签到台物料比约定少 20 份，已补发并致歉，问题关闭。', R.shuimogou],
    ['COMPLAINT', 'ESCALATED', '宴会厅临时变更未告知', '到场发现宴会厅被更换至侧厅，要求退一赔三。', R.fukang],
  ];
  const tickets = TICKET_PLAN.map(([type, status, title, content, region], i) => {
    const reporter = region ? users.find((u) => u.r.id === region.id) ?? pick(users) : pick(users);
    const target = providers.find((p) => p.r.regionPath?.startsWith(reporter.r.regionPath?.slice(0, 7) ?? '')) ?? pick(providers);
    const escalated = status === 'ESCALATED' || status === 'ARBITRATING';
    const assignee = escalated ? adminId : resolveAgentId(reporter.r.regionPath);
    return {
      id: `e2e_ticket_${String(i + 1).padStart(2, '0')}`,
      type, status, title, content,
      regionPath: reporter.r.regionPath,
      reporterId: reporter.id,
      reporterRole: 'USER',
      targetId: target.id,
      assigneeId: assignee,
      assigneeRole: assignee ? (escalated ? 'ADMIN' : 'AGENT') : null,
      escalatedTo: escalated ? 'ADMIN' : null,
      escalatedAt: escalated ? dayAt(between(1, 8)) : null,
      resolvedAt: status === 'CLOSED' ? dayAt(between(0, 12)) : null,
      createdAt: dayAt(between(0, 28)),
    };
  });
  await prisma.ticket.createMany({ data: tickets });
  console.log(`工单 ${tickets.length} 条（5 类型 / 5 状态）`);

  /* ══════════════ 10. 消息（3 范围 × 4 状态）══════════════ */
  await prisma.message.deleteMany({ where: { id: { startsWith: 'e2e_msg_' } } });
  const messages = [
    // 总台全局公告：已发布
    { id: 'e2e_msg_01', type: 'ANNOUNCEMENT', scope: 'GLOBAL', status: 'PUBLISHED', authorRole: 'ADMIN', authorId: adminId, title: '平台服务协议更新通知', content: '新版《平台服务协议》将于次月生效，请各地州服务商及时查阅。', targetRole: null, regionPath: null },
    { id: 'e2e_msg_02', type: 'ANNOUNCEMENT', scope: 'GLOBAL', status: 'PUBLISHED', authorRole: 'ADMIN', authorId: adminId, title: '古尔邦节假期客服排班安排', content: '假期期间客服值班时间调整为 10:00-18:00，紧急工单仍可提交。', targetRole: null, regionPath: null },
    { id: 'e2e_msg_03', type: 'ANNOUNCEMENT', scope: 'GLOBAL', status: 'DRAFT', authorRole: 'ADMIN', authorId: adminId, title: '【草稿】年度优秀服务商评选', content: '拟启动年度优秀服务商评选，评选维度为接单量、好评率与履约时长。', targetRole: null, regionPath: null },
    // 代理商辖区公告：待总台审核 / 已发布 / 已驳回
    { id: 'e2e_msg_04', type: 'ANNOUNCEMENT', scope: 'REGION', status: 'PENDING', authorRole: 'AGENT', authorId: agentIdByPhone.get('13900003001'), title: '乌鲁木齐辖区服务商大会报名', content: '拟定于下月举办辖区服务商交流大会，请各服务商接龙报名。', targetRole: null, regionPath: R.wlmq.regionPath },
    { id: 'e2e_msg_05', type: 'ANNOUNCEMENT', scope: 'REGION', status: 'PUBLISHED', authorRole: 'AGENT', authorId: agentIdByPhone.get('13900003002'), title: '喀什辖区婚庆旺季履约提醒', content: '进入婚礼旺季，请各服务商提前备货并确保响应时效。', targetRole: null, regionPath: R.kashi.regionPath },
    { id: 'e2e_msg_06', type: 'ANNOUNCEMENT', scope: 'REGION', status: 'REJECTED', authorRole: 'AGENT', authorId: agentIdByPhone.get('13900003003'), title: '伊犁辖区临时调价通知', content: '拟对辖区服务指导价进行调整。', targetRole: null, regionPath: R.yili.regionPath, rejectNote: '调价需附成本测算与服务商意见征集结果，请补充后重新提交。' },
    // 一般消息：直发指定角色
    { id: 'e2e_msg_07', type: 'NOTICE', scope: 'OWN', status: 'PUBLISHED', authorRole: 'ADMIN', authorId: adminId, title: '资质材料提交提醒', content: '您的服务商资质尚未通过审核，请尽快补充实名与资质材料。', targetRole: 'SERVICE_PROVIDER', regionPath: null },
    { id: 'e2e_msg_08', type: 'NOTICE', scope: 'OWN', status: 'PUBLISHED', authorRole: 'ADMIN', authorId: adminId, title: '会员权益升级说明', content: '会员用户现可免费使用全部官方模板，感谢您的支持。', targetRole: 'USER', regionPath: null },
    { id: 'e2e_msg_09', type: 'NOTICE', scope: 'OWN', status: 'PUBLISHED', authorRole: 'SERVICE_PROVIDER', authorId: 'e2e_sp_wlmq_steward', title: '婚礼设计方案初稿已上传', content: '您订购的婚礼设计初稿已完成，请登录查看并提出修改意见。', targetRole: 'USER', regionPath: null },
    { id: 'e2e_msg_10', type: 'NOTICE', scope: 'OWN', status: 'DRAFT', authorRole: 'AGENT', authorId: agentIdByPhone.get('13900003001'), title: '【草稿】辖区月度经营简报', content: '本月辖区订单量与好评率数据整理中。', targetRole: 'ADMIN', regionPath: null },
    // 诉求
    { id: 'e2e_msg_11', type: 'APPEAL', scope: 'OWN', status: 'PUBLISHED', authorRole: 'SERVICE_PROVIDER', authorId: 'e2e_sp_wlmq_floral', title: '资质审核进度咨询', content: '提交资质材料已 5 个工作日，想了解当前审核进度。', targetRole: 'ADMIN', regionPath: null },
    { id: 'e2e_msg_12', type: 'APPEAL', scope: 'REGION', status: 'PUBLISHED', authorRole: 'SERVICE_PROVIDER', authorId: 'e2e_sp_kashi_perform', title: '南疆辖区流量扶持申请', content: '南疆辖区订单量偏低，申请参与平台流量扶持计划。', targetRole: null, regionPath: R.kashi.regionPath },
  ].filter((m) => m.authorId);
  await prisma.message.createMany({ data: messages });
  console.log(`消息 ${messages.length} 条（全局/辖区/指定角色 × 草稿/待审/已发布/已驳回）`);

  /* ══════════════ 11. 作品（供用户端与看板使用）══════════════ */
  const PROJECT_TITLES = [
    '天山之约·婚礼请柬', '丝路花雨·婚宴邀请', '草原牧歌·户外婚礼', '喀什老城·订婚请柬',
    '赛里木湖·旅拍邀请', '葡萄沟·乔迁喜宴', '胡杨礼赞·寿宴请柬', '楼兰遗梦·生日邀请',
  ];
  const projPlan = users.slice(0, 8).map((u, i) => ({
    id: `e2e_project_${i + 1}`,
    userId: u.id,
    title: PROJECT_TITLES[i],
    status: i % 3 === 0 ? 'published' : 'draft',
    publishCode: i % 3 === 0 ? `e2e${String(i + 1).padStart(4, '0')}` : null,
    schema: baseSchema,
    viewCount: between(0, 800),
    createdAt: dayAt(between(0, 25)),
  }));
  for (const p of projPlan) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: { title: p.title, status: p.status, viewCount: p.viewCount },
      create: p,
    });
  }
  console.log(`作品 ${projPlan.length} 个（含已发布 ${projPlan.filter((p) => p.status === 'published').length} 个）`);

  /* ══════════════ 12. 监督镜像演示用户的订单与反馈 ══════════════ */
  // /api/user/* 在未指定 userId 时回落到 DEMO_USER_PHONE(13900001001 = test_user_alice)。
  // 该账号原本只有 1 笔订单、0 条反馈，用户工作台的「我的服务商 / 我的评价」会一直是空态。
  // 这里为其补齐订单与反馈，使监督镜像页能真实呈现用户视角全貌。
  const demo = await prisma.user.findUnique({ where: { phone: '13900001001' } });
  if (demo) {
    const demoTpls = onSale.slice(0, 4);
    const demoOrders = demoTpls.map((t, i) => {
      const amount = [2900, 4900, 6900, 12900][i % 4];
      const fee = Math.round(amount * 0.1);
      return {
        id: `e2e_order_demo_${i + 1}`,
        buyerId: demo.id,
        templateId: t.id,
        amount,
        platformFee: fee,
        designerIncome: amount - fee,
        status: i === 3 ? 'refunded' : 'paid',
        createdAt: dayAt(between(1, 20)),
      };
    });
    for (const o of demoOrders) {
      await prisma.templateOrder.upsert({ where: { id: o.id }, update: o, create: o });
    }
    // 演示用户的评价与反馈：好评 / 投诉 / 建议，覆盖「我的评价」列表
    const demoTickets = [
      ['PRAISE', 'CLOSED', '婚礼主持很到位', '麦麦提老师节奏把握得很好，宾主尽欢，特此感谢。'],
      ['SUGGESTION', 'OPEN', '希望支持在线选配色', '希望能提供配色方案在线对比功能，减少来回沟通。'],
      ['COMPLAINT', 'CLOSED', '交付时间略有延迟', '比约定晚了一天交付，已协商解决，整体可接受。'],
    ];
    for (let i = 0; i < demoTickets.length; i++) {
      const [type, status, title, content] = demoTickets[i];
      const tid = `e2e_ticket_demo_${i + 1}`;
      await prisma.ticket.upsert({
        where: { id: tid },
        update: { type, status, title, content },
        create: {
          id: tid, type, status, title, content,
          regionPath: demo.regionPath,
          reporterId: demo.id,
          reporterRole: 'USER',
          targetId: providers[i % providers.length].id,
          assigneeId: null,
          resolvedAt: status === 'CLOSED' ? dayAt(between(0, 10)) : null,
          createdAt: dayAt(between(2, 18)),
        },
      });
    }
    console.log(`监督镜像演示用户 ${demo.phone}：订单 ${demoOrders.length} 笔 / 反馈 ${demoTickets.length} 条`);
  }

  /* ══════════════ 13. 历史遗留账号补齐辖区 ══════════════ */
  // 早期注册的 USER 账号没有辖区，会让「区域对比」出现「未归属」分组、代理商辖区也统计不到。
  // 这里统一补挂到乌鲁木齐天山区；ADMIN 与开发用 SERVICE_PROVIDER 属全局账号，按设计不绑辖区。
  // 注意：只补辖区，不改昵称 —— 其中可能包含真实注册账号，避免动到用户自己的资料。
  const orphans = await prisma.user.findMany({
    where: { role: 'USER', regionId: null },
    select: { id: true, phone: true, nickname: true },
  });
  if (orphans.length) {
    await prisma.user.updateMany({
      where: { id: { in: orphans.map((o) => o.id) } },
      data: { ...anchor(R.tianshan) },
    });
    console.log(`历史 USER 账号补挂辖区 ${orphans.length} 个 → ${R.tianshan.name}`);
  }

  console.log('\n✅ 端到端验证数据已就绪（新疆辖区），统一密码：' + PW);
  console.log('   代理商  : 13900003001 乌鲁木齐 / 002 喀什 / 003 伊犁 / 004 昌吉 / 005 巴州');
  console.log('   服务商  : 13900021xxx 乌鲁木齐 / 22xxx 喀什 / 23xxx 伊犁 / 24xxx 昌吉 / 25xxx 巴州');
  console.log('   普通用户: 13900011xxx 乌鲁木齐 / 12xxx 喀什 / 13xxx 伊犁 / 14xxx 昌吉 / 15xxx 巴州 / 19xxx 停用');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
