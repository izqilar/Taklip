/**
 * 用户视角（VIEW=user）样例数据种子 —— 用于逐项验证 10 个菜单页的功能与展示。
 *
 * 编号格式严格对齐 UI_Design/index.html 原型样例：
 *   订单   QD…0316   （存 QD202608210316，展示取首 2 位 + … + 尾 4 位）
 *   服务商 SP001     （按注册时间生成的全局稳定序号）
 *   优惠券 CP-2001
 *   流水号 W-1001    （最新在前，跨页稳定）
 *   业务消息 M-1001 / 通知公告 N-901 / 我的反馈 FB-2713（递减）
 *
 * 设计原则：
 *  1. 幂等：所有记录使用 uv_ 前缀固定 id，重复运行只更新不重复插入。
 *  2. 只补数据不改账号凭据：13900001001（迪丽努尔）为默认监督对象，凭据不变。
 *  3. 覆盖全部履约态：待服务 / 履约中 / 已完成 / 已退款，且已完成分「已评价 / 待评价」。
 *
 * 运行：node prisma/seed-user-view.js
 */
const { PrismaClient } = require('./prisma-client');

const prisma = new PrismaClient();

/** 主监督对象（用户视角默认演示用户） */
const DEMO_PHONE = '13900001001';

/** 相对今天的日期锚点 */
function daysAgo(n, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const ymd = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** 单号：QD + yyyymmdd + 4 位序列 */
const orderNo = (d, seq) => `QD${ymd(d)}${String(seq).padStart(4, '0')}`;

/** 生成邀请封面 SVG（base64 data URL），用作样例作品的封面预览（无需外部图片依赖） */
function makeCover(title, c1, c2) {
  const safe = String(title || '未命名作品').replace(/[<>&]/g, '');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="375" height="520" viewBox="0 0 375 520">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
    '<rect width="375" height="520" fill="url(#g)"/>' +
    '<circle cx="305" cy="85" r="64" fill="rgba(255,255,255,0.12)"/>' +
    '<circle cx="64" cy="445" r="86" fill="rgba(255,255,255,0.10)"/>' +
    '<text x="187" y="252" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="25" font-weight="700" fill="#ffffff" text-anchor="middle">' + safe + '</text>' +
    '<text x="187" y="292" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" fill="rgba(255,255,255,0.85)" text-anchor="middle">邀 请 函</text>' +
    '</svg>';
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

/* ── 服务商（沿用 e2e 种子里的新疆服务商，按手机号定位） ── */
const SP = {
  MMT: '13900002001', // 麦麦提·艾力 · 婚礼设计
  GUL: '13900021002', // 古丽娜尔 · 光影记录
  WANG: '13900021003', // 王磊 · 宴会场地
  ADIL: '13900021004', // 阿迪力江 · 仪式执事
  LIJING: '13900022001', // 李静 · 特约设计
  ZHOUYUE: '13900025001', // 周悦 · 特约设计
  SUNHAO: '13900024002', // 孙浩 · 演艺星团
  MIRE: '13900023001', // 米热古丽 · 场地/花艺
};

/* ── 样例模板（uv_tpl_*，按服务类型命名，作者为上述服务商） ── */
const TEMPLATES = [
  { id: 'uv_tpl_01', name: '天山牧歌·婚礼跟拍', phone: SP.GUL, price: 290000 },
  { id: 'uv_tpl_02', name: '楼兰盛宴·宴会全案', phone: SP.WANG, price: 490000 },
  { id: 'uv_tpl_03', name: '丝路花雨·花艺布置', phone: SP.ZHOUYUE, price: 168000 },
  { id: 'uv_tpl_04', name: '十二木卡姆·婚礼演出', phone: SP.SUNHAO, price: 200000 },
  { id: 'uv_tpl_05', name: '喀什老城·请柬视觉设计', phone: SP.LIJING, price: 99000 },
  { id: 'uv_tpl_06', name: '草原牧歌·仪式执事', phone: SP.ADIL, price: 490000 },
  { id: 'uv_tpl_07', name: '赛里木湖·户外宴会布置', phone: SP.MIRE, price: 290000 },
  { id: 'uv_tpl_08', name: '胡杨礼赞·全案设计', phone: SP.MMT, price: 990000 },
];

/* ── 样例订单（覆盖全履约态 + 已评价 / 待评价） ── */
const ORDERS = [
  { id: 'uv_ord_01', tpl: 'uv_tpl_04', days: 3, amount: 200000, service: 'pending_service', status: 'paid' },
  { id: 'uv_ord_02', tpl: 'uv_tpl_03', days: 9, amount: 168000, service: 'in_service', status: 'paid' },
  { id: 'uv_ord_03', tpl: 'uv_tpl_02', days: 18, amount: 490000, service: 'completed', status: 'paid' },
  { id: 'uv_ord_04', tpl: 'uv_tpl_01', days: 26, amount: 290000, service: 'completed', status: 'paid' },
  { id: 'uv_ord_05', tpl: 'uv_tpl_05', days: 34, amount: 99000, service: 'completed', status: 'paid' },
  { id: 'uv_ord_06', tpl: 'uv_tpl_06', days: 45, amount: 490000, service: 'refunded', status: 'refunded' },
  { id: 'uv_ord_07', tpl: 'uv_tpl_07', days: 58, amount: 290000, service: 'completed', status: 'paid' },
  { id: 'uv_ord_08', tpl: 'uv_tpl_08', days: 72, amount: 990000, service: 'completed', status: 'paid' },
];

/** 已完成的订单里给出评价的：订单 id → 评分 / 内容 */
const REVIEWS = [
  { id: 'uv_rev_01', order: 'uv_ord_03', rating: 4.7, content: '宴会全案落地效果超出预期，主舞台花艺很有新疆元素。', days: 16 },
  { id: 'uv_rev_02', order: 'uv_ord_04', rating: 5, content: '婚礼跟拍出片很快，摄影师很会抓瞬间。', days: 24 },
  { id: 'uv_rev_03', order: 'uv_ord_07', rating: 4.2, content: '户外布置整体满意，遮阳棚希望能再加固一些。', days: 55 },
];

/** 钱包流水（按时间升序，balanceAfter 逐笔累加） */
const WALLET = [
  { id: 'uv_wal_01', days: 60, type: 'RECHARGE', amount: 300000, note: '首次充值' },
  { id: 'uv_wal_02', days: 30, type: 'CONSUME', amount: -99900, note: '购买 喀什老城·请柬视觉设计' },
  { id: 'uv_wal_03', days: 20, type: 'GIFT', amount: 2000, note: '新人礼包' },
  { id: 'uv_wal_04', days: 5, type: 'RECHARGE', amount: 50000, note: '本月充值' },
  { id: 'uv_wal_05', days: 2, type: 'CONSUME', amount: -4100, note: '购买 丝路花雨·花艺布置 补差价' },
];

/** 券种（CP-2001 起） */
const COUPONS = [
  { id: 'uv_cp_01', code: 'CP-2001', name: '新人礼包', amount: 2000, benefit: null, minSpend: 0, condition: '满 0 元可用', tier: null, from: -30, to: 30 },
  { id: 'uv_cp_02', code: 'CP-2002', name: '金卡优先券', amount: 0, benefit: '免排期', minSpend: 0, condition: '金卡专享', tier: 2, from: -30, to: 110 },
  { id: 'uv_cp_03', code: 'CP-2003', name: '生日礼券', amount: 5000, benefit: null, minSpend: 19900, condition: '满 199 元可用', tier: null, from: -10, to: 60 },
  { id: 'uv_cp_04', code: 'CP-2004', name: '黑金专属券', amount: 20000, benefit: null, minSpend: 99900, condition: '满 999 元可用', tier: 3, from: -10, to: 90 },
];

/** 用户持券（领取状态） */
const HOLD = [
  { id: 'uv_uc_01', coupon: 'uv_cp_01', status: 'USED', days: 30 },
  { id: 'uv_uc_02', coupon: 'uv_cp_02', status: 'UNUSED', days: 28 },
  { id: 'uv_uc_03', coupon: 'uv_cp_03', status: 'UNUSED', days: 10 },
];

/** 消息（ANNOUNCEMENT → 通知公告；NOTICE/OWN/USER → 业务消息） */
const MESSAGES = [
  {
    id: 'uv_msg_01', type: 'ANNOUNCEMENT', scope: 'GLOBAL', status: 'PUBLISHED', role: 'ADMIN',
    title: '古尔邦节假期服务安排', content: '假期期间客服值班时间调整为 10:00-18:00，紧急工单仍可提交。', days: 6, targetRole: null,
  },
  {
    id: 'uv_msg_02', type: 'ANNOUNCEMENT', scope: 'GLOBAL', status: 'PUBLISHED', role: 'ADMIN',
    title: '平台会员权益升级说明', content: '金卡及以上会员现可免费使用全部官方模板。', days: 14, targetRole: null,
  },
  {
    id: 'uv_msg_03', type: 'NOTICE', scope: 'OWN', status: 'PUBLISHED', role: 'ADMIN',
    title: '请为婚礼跟拍服务评价', content: '您订购的婚礼跟拍已完成，欢迎留下真实评价。', days: 1, targetRole: 'USER',
  },
  {
    id: 'uv_msg_04', type: 'NOTICE', scope: 'OWN', status: 'PUBLISHED', role: 'ADMIN',
    title: '优惠券 金卡优先券 已发放', content: '您的金卡优先券已到账，可在结算时直接使用。', days: 8, targetRole: 'USER',
  },
  {
    id: 'uv_msg_05', type: 'NOTICE', scope: 'OWN', status: 'PUBLISHED', role: 'ADMIN',
    title: '订单 QD…0312 已开始履约', content: '服务商已接单，正在为您安排花艺布置。', days: 3, targetRole: 'USER',
  },
];

/** 我的反馈（FB-2713 递减） */
const TICKETS = [
  { id: 'uv_tk_01', type: 'AFTERSALE', title: '售后申请处理中', content: '婚礼跟拍成片希望补剪一段，已与服务商沟通未果。', status: 'OPEN', target: SP.MMT, days: 4 },
  { id: 'uv_tk_02', type: 'SUGGESTION', title: '建议增加电子请柬双语模板', content: '希望增加维汉双语的请柬模板，方便亲友阅读。', status: 'CLOSED', target: null, days: 12 },
  { id: 'uv_tk_03', type: 'CONSULT', title: '价格咨询', content: '想咨询全案设计的报价构成与付款节点。', status: 'CLOSED', target: SP.GUL, days: 20 },
];

/** 我的作品（前端编辑器设计的个人请柬）— 封面用 makeCover 生成 SVG 预览 */
const PROJECTS = [
  { id: 'uv_wk_01', title: '天山之恋·婚礼邀请函', status: 'published', code: 'uv_pub_01', views: 328, days: 5, c1: '#c24b2e', c2: '#14676b' },
  { id: 'uv_wk_02', title: '胡杨林·金秋婚宴请柬', status: 'published', code: 'uv_pub_02', views: 156, days: 12, c1: '#b5651d', c2: '#7a3b14' },
  { id: 'uv_wk_03', title: '丝路欢歌·生日宴请', status: 'draft', code: null, views: 0, days: 2, c1: '#2b6cb0', c2: '#1a365d' },
  { id: 'uv_wk_04', title: '草原牧歌·订婚仪式', status: 'published', code: 'uv_pub_03', views: 89, days: 21, c1: '#2f855a', c2: '#1c4532' },
  { id: 'uv_wk_05', title: '喀什老城·节庆请柬', status: 'draft', code: null, views: 0, days: 1, c1: '#805ad5', c2: '#44337a' },
];

/**
 * 为指定用户播种一套用户视角样例数据。
 * 全局数据（样例模板 / 券种 / 平台消息）只需种一次，由调用方负责；
 * 本函数只负责「属于该用户」的实体：订单 / 评价 / 钱包流水 / 持券 / 反馈 / 资格申请 / 消息已读，
 * 并用 tag 前缀隔离 id，避免与演示用户（uv_）冲突。
 *
 * @param {object} user   目标用户（含 id / phone / regionPath）
 * @param {object} admin  消息发布人（ADMIN）
 * @param {Map}     spByPhone 服务商手机号 → {id,nickname}
 * @param {string}  tag   id 命名空间前缀，演示用户传 ''，其余用户传唯一短码（如 'nu'）
 * @param {object}  profile 该用户的基础画像 { vipLevel, points, userBalance }
 */
async function seedUserView(user, admin, spByPhone, tag, profile) {
  const P = (s) => (tag ? `${tag}_${s}` : s);

  // 基础画像
  await prisma.user.update({
    where: { id: user.id },
    data: { vipLevel: profile.vipLevel, points: profile.points, userBalance: profile.userBalance },
  });

  // 样例订单（QD… 单号 + 全履约态），单号末 4 位用独立基址避免与演示用户撞号
  let ordCount = 0;
  for (const [i, o] of ORDERS.entries()) {
    const at = daysAgo(o.days, 10 + i, 30);
    const seq = 8001 + i; // 演示用户用 316 起，这里用 8001 起，互不相同
    await prisma.templateOrder.upsert({
      where: { id: P(o.id) },
      create: {
        id: P(o.id),
        orderNo: orderNo(at, seq),
        buyerId: user.id,
        templateId: o.tpl,
        amount: o.amount,
        platformFee: Math.round(o.amount * 0.1),
        designerIncome: o.amount - Math.round(o.amount * 0.1),
        status: o.status,
        serviceStatus: o.service,
        createdAt: at,
      },
      update: {
        orderNo: orderNo(at, seq),
        amount: o.amount,
        status: o.status,
        serviceStatus: o.service,
        createdAt: at,
      },
    });
    ordCount++;
  }

  // 评价（已完成订单）
  for (const r of REVIEWS) {
    await prisma.review.upsert({
      where: { id: P(r.id) },
      create: {
        id: P(r.id),
        userId: user.id,
        orderId: P(r.order),
        rating: r.rating,
        content: r.content,
        createdAt: daysAgo(r.days, 15, 20),
      },
      update: { rating: r.rating, content: r.content },
    });
  }

  // 钱包流水（逐笔累加，末笔余额 = 用户余额）
  const total = WALLET.reduce((s, w) => s + w.amount, 0);
  let bal = profile.userBalance - total;
  for (const w of WALLET) {
    bal += w.amount;
    await prisma.walletLog.upsert({
      where: { id: P(w.id) },
      create: {
        id: P(w.id),
        userId: user.id,
        type: w.type,
        amount: w.amount,
        balanceAfter: bal,
        status: 'SUCCESS',
        note: w.note,
        createdAt: daysAgo(w.days, 11, 0),
      },
      update: { amount: w.amount, balanceAfter: bal, createdAt: daysAgo(w.days, 11, 0) },
    });
  }

  // 持券（券种为全局 uv_cp_*，这里只建立该用户的领取关系）
  for (const h of HOLD) {
    await prisma.userCoupon.upsert({
      where: { id: P(h.id) },
      create: {
        id: P(h.id),
        userId: user.id,
        couponId: h.coupon,
        status: h.status,
        receivedAt: daysAgo(h.days, 9, 0),
        usedAt: h.status === 'USED' ? daysAgo(h.days - 1, 16, 0) : null,
      },
      update: { status: h.status, usedAt: h.status === 'USED' ? daysAgo(h.days - 1, 16, 0) : null },
    });
  }

  // 消息已读（消息为全局，这里只建该用户的已读关系，保留 1 条未读）
  const ownMsgs = MESSAGES.filter((m) => m.type === 'NOTICE');
  for (const m of ownMsgs.slice(0, -1)) {
    await prisma.messageRead.upsert({
      where: { messageId_userId: { messageId: m.id, userId: user.id } },
      create: { messageId: m.id, userId: user.id, readAt: daysAgo(Math.max(0, m.days - 1), 10, 0) },
      update: {},
    });
  }

  // 我的反馈
  for (const t of TICKETS) {
    const target = t.target ? spByPhone.get(t.target) : null;
    await prisma.ticket.upsert({
      where: { id: P(t.id) },
      create: {
        id: P(t.id),
        type: t.type,
        title: t.title,
        content: t.content,
        status: t.status,
        regionPath: user.regionPath ?? null,
        reporterId: user.id,
        reporterRole: 'USER',
        targetId: target?.id ?? null,
        createdAt: daysAgo(t.days, 14, 0),
        resolvedAt: t.status === 'CLOSED' ? daysAgo(Math.max(0, t.days - 2), 17, 0) : null,
      },
      update: { title: t.title, content: t.content, status: t.status, createdAt: daysAgo(t.days, 14, 0) },
    });
  }

  // 资格申请：保留 1 条「初审通过」
  await prisma.qualificationApplication.deleteMany({
    where: { userId: user.id, id: { not: P('uv_qual_01') } },
  });
  await prisma.qualificationApplication.upsert({
    where: { id: P('uv_qual_01') },
    create: {
      id: P('uv_qual_01'),
      userId: user.id,
      kind: 'provider',
      status: 'FIRST_PASSED',
      reason: '本人长期从事婚庆花艺布置，希望入驻平台承接新疆本地订单。',
      serviceScopes: ['FLORAL'],
      regionPath: user.regionPath ?? null,
      regionLabel: '乌鲁木齐市 / 天山区',
    },
    update: { status: 'FIRST_PASSED', kind: 'provider' },
  });

  // 我的作品（前端编辑器设计的个人请柬）：复用全局 PROJECTS 模板，按 tag 隔离 id
  await seedProjectsFor(user, tag);

  console.log(
    `✓ 用户 ${user.phone} 样例数据：画像 会员${profile.vipLevel}级 · 余额 ¥${(profile.userBalance / 100).toFixed(2)} · ` +
      `订单 ${ordCount} 笔 / 评价 ${REVIEWS.length} / 钱包 ${WALLET.length} / 持券 ${HOLD.length} / 反馈 ${TICKETS.length} / 作品 ${PROJECTS.length}`,
  );
}

/** 为指定用户播种「我的作品」（前端编辑器设计的个人请柬）。tag 为 id 命名空间前缀。 */
async function seedProjectsFor(user, tag) {
  const P = (s) => (tag ? `${tag}_${s}` : s);
  for (const p of PROJECTS) {
    const at = daysAgo(p.days, 12, 0);
    await prisma.project.upsert({
      where: { id: P(p.id) },
      create: {
        id: P(p.id),
        userId: user.id,
        title: p.title,
        status: p.status,
        cover: makeCover(p.title, p.c1, p.c2),
        publishCode: p.code ? P(p.code) : null,
        viewCount: p.views,
        schema: { pages: [{ elements: [] }], version: 1 },
        createdAt: at,
        updatedAt: at,
      },
      update: {
        title: p.title,
        status: p.status,
        cover: makeCover(p.title, p.c1, p.c2),
        publishCode: p.code ? P(p.code) : null,
        viewCount: p.views,
        updatedAt: at,
      },
    });
  }
}

async function main() {
  const demo = await prisma.user.findUnique({ where: { phone: DEMO_PHONE } });
  if (!demo) throw new Error(`演示用户 ${DEMO_PHONE} 不存在，请先运行 seed-test-data.js`);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('未找到 ADMIN 账号，无法作为消息发布人');

  /* ── 1. 演示用户基础画像（对齐原型：金卡会员 / 余额 ¥2,480 / 积分 3,260） ── */
  await prisma.user.update({
    where: { id: demo.id },
    data: { vipLevel: 2, points: 3260, userBalance: 248000 },
  });
  console.log('✓ 演示用户画像：金卡会员 · 余额 ¥2,480 · 积分 3,260');

  /* ── 2. 样例模板 ── */
  const spByPhone = new Map();
  for (const phone of Object.values(SP)) {
    const u = await prisma.user.findUnique({ where: { phone }, select: { id: true, nickname: true } });
    if (u) spByPhone.set(phone, u);
  }
  let tplCount = 0;
  for (const t of TEMPLATES) {
    const author = spByPhone.get(t.phone);
    if (!author) continue;
    await prisma.template.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        name: t.name,
        authorId: author.id,
        status: 'APPROVED',
        price: t.price,
        category: 'wedding',
        tags: ['样例'],
        schema: { pages: [], version: 1, sample: true },
      },
      update: { name: t.name, authorId: author.id, status: 'APPROVED', price: t.price },
    });
    tplCount++;
  }
  console.log(`✓ 样例模板 ${tplCount} 个`);

  /* ── 3. 样例订单（QD… 单号 + 全履约态） ── */
  let ordCount = 0;
  for (const [i, o] of ORDERS.entries()) {
    const at = daysAgo(o.days, 10 + i, 30);
    await prisma.templateOrder.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        orderNo: orderNo(at, 316 - i * 4),
        buyerId: demo.id,
        templateId: o.tpl,
        amount: o.amount,
        platformFee: Math.round(o.amount * 0.1),
        designerIncome: o.amount - Math.round(o.amount * 0.1),
        status: o.status,
        serviceStatus: o.service,
        createdAt: at,
      },
      update: {
        orderNo: orderNo(at, 316 - i * 4),
        amount: o.amount,
        status: o.status,
        serviceStatus: o.service,
        createdAt: at,
      },
    });
    ordCount++;
  }
  console.log(`✓ 样例订单 ${ordCount} 笔（待服务/履约中/已完成/已退款 全覆盖）`);

  // 历史订单补单号：按创建时间升序统一派生 QD… 编号，避免评价页出现 id 兜底号
  const legacy = await prisma.templateOrder.findMany({
    where: { OR: [{ orderNo: null }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });
  for (const [i, o] of legacy.entries()) {
    await prisma.templateOrder.update({
      where: { id: o.id },
      data: { orderNo: orderNo(o.createdAt, 2001 + i) },
    });
  }
  if (legacy.length) console.log(`✓ 历史订单补单号 ${legacy.length} 笔`);

  /* ── 4. 评价（已完成订单） ── */
  for (const r of REVIEWS) {
    await prisma.review.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: demo.id,
        orderId: r.order,
        rating: r.rating,
        content: r.content,
        createdAt: daysAgo(r.days, 15, 20),
      },
      update: { rating: r.rating, content: r.content },
    });
  }
  console.log(`✓ 评价记录 ${REVIEWS.length} 条`);

  /* ── 5. 钱包流水（逐笔累加余额，末笔余额 = 用户余额） ── */
  // 目标：末笔 balanceAfter = 248000，倒推起点
  const total = WALLET.reduce((s, w) => s + w.amount, 0);
  let bal = 248000 - total;
  for (const w of WALLET) {
    bal += w.amount;
    await prisma.walletLog.upsert({
      where: { id: w.id },
      create: {
        id: w.id,
        userId: demo.id,
        type: w.type,
        amount: w.amount,
        balanceAfter: bal,
        status: 'SUCCESS',
        note: w.note,
        createdAt: daysAgo(w.days, 11, 0),
      },
      update: { amount: w.amount, balanceAfter: bal, createdAt: daysAgo(w.days, 11, 0) },
    });
  }
  console.log(`✓ 钱包流水 ${WALLET.length} 条（末笔余额 ¥${(bal / 100).toFixed(2)}）`);

  /* ── 6. 券种与持券 ── */
  for (const c of COUPONS) {
    await prisma.coupon.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        code: c.code,
        name: c.name,
        amount: c.amount,
        benefit: c.benefit,
        minSpend: c.minSpend,
        condition: c.condition,
        tier: c.tier,
        validFrom: daysAgo(-c.from, 0, 0),
        validUntil: daysAgo(-c.to, 23, 59),
      },
      update: {
        name: c.name,
        amount: c.amount,
        benefit: c.benefit,
        minSpend: c.minSpend,
        condition: c.condition,
        tier: c.tier,
        validUntil: daysAgo(-c.to, 23, 59),
      },
    });
  }
  for (const h of HOLD) {
    await prisma.userCoupon.upsert({
      where: { id: h.id },
      create: {
        id: h.id,
        userId: demo.id,
        couponId: h.coupon,
        status: h.status,
        receivedAt: daysAgo(h.days, 9, 0),
        usedAt: h.status === 'USED' ? daysAgo(h.days - 1, 16, 0) : null,
      },
      update: { status: h.status, usedAt: h.status === 'USED' ? daysAgo(h.days - 1, 16, 0) : null },
    });
  }
  console.log(`✓ 券种 ${COUPONS.length} 张 / 持券 ${HOLD.length} 张`);

  /* ── 7. 消息（公告 + 业务消息） ── */
  for (const m of MESSAGES) {
    await prisma.message.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        type: m.type,
        scope: m.scope,
        title: m.title,
        content: m.content,
        status: m.status,
        authorId: admin.id,
        authorRole: m.role,
        targetRole: m.targetRole,
        regionPath: null,
        createdAt: daysAgo(m.days, 9, 30),
      },
      update: { title: m.title, content: m.content, status: m.status, createdAt: daysAgo(m.days, 9, 30) },
    });
  }
  // 让最近 1 条业务消息保持未读（其余标记已读），验证「未读 / 已读」与待处理筛选
  const ownMsgs = MESSAGES.filter((m) => m.type === 'NOTICE');
  for (const m of ownMsgs.slice(0, -1)) {
    await prisma.messageRead.upsert({
      where: { messageId_userId: { messageId: m.id, userId: demo.id } },
      create: { messageId: m.id, userId: demo.id, readAt: daysAgo(Math.max(0, m.days - 1), 10, 0) },
      update: {},
    });
  }
  console.log(`✓ 消息 ${MESSAGES.length} 条（保留 1 条未读）`);

  /* ── 8. 我的反馈 ── */
  for (const t of TICKETS) {
    const target = t.target ? spByPhone.get(t.target) : null;
    await prisma.ticket.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        type: t.type,
        title: t.title,
        content: t.content,
        status: t.status,
        regionPath: demo.regionPath ?? null,
        reporterId: demo.id,
        reporterRole: 'USER',
        targetId: target?.id ?? null,
        createdAt: daysAgo(t.days, 14, 0),
        resolvedAt: t.status === 'CLOSED' ? daysAgo(Math.max(0, t.days - 2), 17, 0) : null,
      },
      update: { title: t.title, content: t.content, status: t.status, createdAt: daysAgo(t.days, 14, 0) },
    });
  }
  console.log(`✓ 反馈工单 ${TICKETS.length} 条（待回复 / 已回复）`);

  /* ── 9. 资格申请：保留 1 条「初审通过」以验证「填写资料」链路 ── */
  await prisma.qualificationApplication.deleteMany({
    where: { userId: demo.id, id: { not: 'uv_qual_01' } },
  });
  await prisma.qualificationApplication.upsert({
    where: { id: 'uv_qual_01' },
    create: {
      id: 'uv_qual_01',
      userId: demo.id,
      kind: 'provider',
      status: 'FIRST_PASSED',
      reason: '本人长期从事婚庆花艺布置，希望入驻平台承接新疆本地订单。',
      serviceScopes: ['FLORAL'],
      regionPath: demo.regionPath ?? null,
      regionLabel: '乌鲁木齐市 / 天山区',
    },
    update: { status: 'FIRST_PASSED', kind: 'provider' },
  });
  console.log('✓ 资格申请 1 条（服务商 · 初审通过，可进入填写资料）');

  /* ── 0. 额外用户：13800000004（普通用户演示账号，独立命名空间 nu_） ── */
  const extraUsers = [
    { phone: '13800000004', tag: 'nu', profile: { vipLevel: 1, points: 1250, userBalance: 88000 } },
  ];
  for (const eu of extraUsers) {
    const u = await prisma.user.findUnique({ where: { phone: eu.phone } });
    if (!u) {
      console.warn(`⚠ 用户 ${eu.phone} 不存在，跳过样例数据（请先运行 seed.ts）`);
      continue;
    }
    await seedUserView(u, admin, spByPhone, eu.tag, eu.profile);
  }

  /* ── 0.1 演示用户本人作品（uv_ 前缀，监督视角默认回落对象） ── */
  await seedProjectsFor(demo, '');
  console.log(`✓ 我的作品 ${PROJECTS.length} 件（演示用户本人）`);

  console.log('\n全部用户视角样例数据已就绪。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
