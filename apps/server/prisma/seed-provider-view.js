/**
 * 服务商视角样例数据（幂等，id 前缀 pv_，可反复运行）
 *
 * 覆盖：服务管理（模板）、订单处理（订单）、评价与反馈中心（工单）。
 * 目的：让「真实服务商后台」与「管理总台 · 服务商视角」都能看到真实数据，
 *      便于逐页比对与功能验证（空表比对不出差异）。
 */
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, 'prisma-client'));

const prisma = new PrismaClient();

const PROVIDER_PHONE = '13800000001'; // dev_provider_001
const BUYER_PHONES = ['13900001001', '13900001002', '13900001003'];

const schemaOf = (title) => ({
  id: `pv_${title}`,
  title,
  width: 375,
  height: 667,
  pages: [
    {
      id: 'p1',
      name: '首页',
      background: '#fdf6f0',
      // 元素结构必须与 @h5design/core 的 TextElement / RectElement 对齐（属性扁平化，不嵌套 props），
      // 否则共享渲染器 SchemaRenderer 读不到 text/fontSize/fill，缩略图只会渲染出空白背景。
      elements: [
        {
          id: 'e_band',
          type: 'rect',
          x: 0, y: 0, width: 375, height: 8,
          rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false,
          fill: '#c24b2e',
        },
        {
          id: 'e_orn',
          type: 'rect',
          x: 138, y: 210, width: 99, height: 3,
          rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false,
          fill: '#c24b2e', cornerRadius: 2,
        },
        {
          id: 'e_title',
          type: 'text',
          x: 40, y: 232, width: 295, height: 60,
          rotation: 0, opacity: 1, zIndex: 3, visible: true, locked: false,
          text: title,
          fontSize: 28,
          fontFamily: 'sans-serif',
          fill: '#c24b2e',
          align: 'center',
          verticalAlign: 'middle',
          fontStyle: 'normal',
          lineHeight: 1.4,
          letterSpacing: 0,
          textDecoration: 'none',
          wordBreak: 'normal',
        },
        {
          id: 'e_sub',
          type: 'text',
          x: 40, y: 312, width: 295, height: 28,
          rotation: 0, opacity: 1, zIndex: 4, visible: true, locked: false,
          text: '诚 邀 莅 临',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fill: '#8a7a70',
          align: 'center',
          verticalAlign: 'middle',
          fontStyle: 'normal',
          lineHeight: 1.4,
          letterSpacing: 4,
          textDecoration: 'none',
          wordBreak: 'normal',
        },
      ],
    },
  ],
  settings: {
    description: title,
    pageTurnMode: 'vertical',
    autoFlip: false,
    autoFlipInterval: 5,
    loopFlip: false,
    showPageNumber: true,
    disableManualFlip: false,
    hideFlipArrow: false,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** 服务（模板）：覆盖 在售 / 待审核 / 已下架 / 已驳回 四态 */
const SERVICES = [
  { id: 'pv_svc_01', name: '天山雪莲·婚礼请柬', category: 'wedding', price: 12800, status: 'APPROVED', useCount: 36 },
  { id: 'pv_svc_02', name: '喀什古城·回门宴请柬', category: 'wedding', price: 9800, status: 'APPROVED', useCount: 21 },
  { id: 'pv_svc_03', name: '伊犁草原·户外婚礼', category: 'wedding', price: 16800, status: 'APPROVED', useCount: 12 },
  { id: 'pv_svc_04', name: '巴州寿宴·长寿请柬', category: 'birthday', price: 6800, status: 'APPROVED', useCount: 9 },
  { id: 'pv_svc_05', name: '乌鲁木齐·开业庆典函', category: 'opening', price: 8800, status: 'PENDING', useCount: 0 },
  { id: 'pv_svc_06', name: '吐鲁番·葡萄节邀请函', category: 'festival', price: 0, status: 'TAKEN_DOWN', useCount: 4 },
];

/** 订单：覆盖 已支付 / 已退款 与不同履约态 */
const ORDERS = [
  { id: 'pv_ord_01', svc: 'pv_svc_01', buyer: 0, amount: 12800, status: 'paid', serviceStatus: 'completed', days: 26 },
  { id: 'pv_ord_02', svc: 'pv_svc_02', buyer: 1, amount: 9800, status: 'paid', serviceStatus: 'in_service', days: 20 },
  { id: 'pv_ord_03', svc: 'pv_svc_03', buyer: 2, amount: 16800, status: 'paid', serviceStatus: 'pending', days: 15 },
  { id: 'pv_ord_04', svc: 'pv_svc_01', buyer: 1, amount: 12800, status: 'refunded', serviceStatus: 'refunded', days: 12 },
  { id: 'pv_ord_05', svc: 'pv_svc_04', buyer: 0, amount: 6800, status: 'paid', serviceStatus: 'completed', days: 9 },
  { id: 'pv_ord_06', svc: 'pv_svc_02', buyer: 2, amount: 9800, status: 'paid', serviceStatus: 'completed', days: 6 },
  { id: 'pv_ord_07', svc: 'pv_svc_03', buyer: 0, amount: 16800, status: 'refunded', serviceStatus: 'refunded', days: 4 },
  { id: 'pv_ord_08', svc: 'pv_svc_01', buyer: 2, amount: 12800, status: 'paid', serviceStatus: 'in_service', days: 2 },
];

/** 工单：覆盖 待处理 / 协商中 / 已关闭 */
const TICKETS = [
  {
    id: 'pv_tkt_01',
    type: 'COMPLAINT',
    title: '婚礼现场布置与约定不符',
    content: '约定 8 个花艺点位，实际只布置了 5 个，希望给出处理方案。',
    status: 'OPEN',
    reporter: 0,
    days: 5,
  },
  {
    id: 'pv_tkt_02',
    type: 'CONSULT',
    title: '咨询加急出图是否额外收费',
    content: '婚礼在下周，能否加急？是否需要加收费用？',
    status: 'NEGOTIATING',
    reporter: 1,
    days: 3,
  },
  {
    id: 'pv_tkt_03',
    type: 'PRAISE',
    title: '摄影师非常专业，特来致谢',
    content: '全程跟拍很到位，成片超出预期，感谢团队！',
    status: 'CLOSED',
    reporter: 2,
    days: 1,
  },
];

const dayAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);
/** 业务单号 QD…0316 形态：QD + yyyyMMdd + 4 位序号 */
const orderNo = (d, seq) =>
  `QD${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(
    seq,
  ).padStart(4, '0')}`;

(async () => {
  const provider = await prisma.user.findUnique({ where: { phone: PROVIDER_PHONE } });
  if (!provider) throw new Error(`未找到服务商账号 ${PROVIDER_PHONE}`);
  const buyers = [];
  for (const p of BUYER_PHONES) {
    const u = await prisma.user.findUnique({ where: { phone: p } });
    if (!u) throw new Error(`未找到买家账号 ${p}`);
    buyers.push(u);
  }

  /* ── 服务（模板） ── */
  for (const [i, s] of SERVICES.entries()) {
    await prisma.template.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        category: s.category,
        tags: [s.category],
        schema: schemaOf(s.name),
        authorId: provider.id,
        status: s.status,
        price: s.price,
        useCount: s.useCount,
        createdAt: dayAgo(40 - i * 4),
      },
      update: {
        name: s.name,
        category: s.category,
        authorId: provider.id,
        status: s.status,
        price: s.price,
        useCount: s.useCount,
        // 同步刷新 schema：修正历史 props 嵌套结构，使详情页预览能真实渲染请柬
        schema: schemaOf(s.name),
      },
    });
  }
  console.log(`✓ 服务（模板）${SERVICES.length} 项`);

  /* ── 订单 ── */
  let seq = 316;
  for (const o of ORDERS) {
    const createdAt = dayAgo(o.days);
    const fee = Math.round(o.amount * 0.1);
    await prisma.templateOrder.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        orderNo: orderNo(createdAt, seq++),
        buyerId: buyers[o.buyer].id,
        templateId: o.svc,
        amount: o.amount,
        platformFee: fee,
        designerIncome: o.amount - fee,
        status: o.status,
        serviceStatus: o.serviceStatus,
        createdAt,
      },
      update: {
        orderNo: orderNo(createdAt, seq++),
        amount: o.amount,
        platformFee: fee,
        designerIncome: o.amount - fee,
        status: o.status,
        serviceStatus: o.serviceStatus,
        createdAt,
      },
    });
  }
  console.log(`✓ 订单 ${ORDERS.length} 笔（已支付 / 已退款 全覆盖）`);

  /* ── 工单 ── */
  for (const t of TICKETS) {
    const reporter = buyers[t.reporter];
    await prisma.ticket.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        type: t.type,
        title: t.title,
        content: t.content,
        status: t.status,
        regionPath: reporter.regionPath ?? null,
        reporterId: reporter.id,
        reporterRole: reporter.role,
        targetId: provider.id,
        createdAt: dayAgo(t.days),
      },
      update: {
        title: t.title,
        content: t.content,
        status: t.status,
        targetId: provider.id,
        createdAt: dayAgo(t.days),
      },
    });
  }
  console.log(`✓ 工单 ${TICKETS.length} 条（待处理 / 协商中 / 已关闭）`);

  // 计算服务商累计收入（已支付订单的服务商实得），用于钱包自洽
  const paidOrders = ORDERS.filter((o) => o.status === 'paid');
  const totalIncome = paidOrders.reduce((s, o) => s + Math.round(o.amount * 0.9), 0);
  const paidWd = 20000; // 已到账提现 ¥200
  const pendingWd = 15000; // 审核中提现 ¥150
  const balance = Math.max(0, totalIncome - paidWd - pendingWd);

  /* ── 钱包（自洽：累计收入 − 已提现 − 审核中提现 = 可提现） ── */
  const wallet = await prisma.providerWallet.upsert({
    where: { providerId: provider.id },
    create: {
      providerId: provider.id,
      balance,
      frozen: 0,
      totalIncome,
      withdrawn: paidWd,
    },
    update: { balance, frozen: 0, totalIncome, withdrawn: paidWd },
  });
  console.log(`✓ 钱包：累计收入 ¥${(totalIncome / 100).toFixed(2)} · 可提现 ¥${(balance / 100).toFixed(2)}`);

  /* ── 提现管理 ── */
  const WDS = [
    { id: 'pv_wd_02', amount: paidWd, status: 'paid', days: 10 },
    { id: 'pv_wd_03', amount: pendingWd, status: 'pending', days: 2 },
    { id: 'pv_wd_01', amount: 50000, status: 'failed', days: 25 },
  ];
  for (const w of WDS) {
    await prisma.withdrawal.upsert({
      where: { id: w.id },
      create: {
        id: w.id,
        providerId: provider.id,
        walletId: wallet.id,
        amount: w.amount,
        status: w.status,
        currency: 'CNY',
        createdAt: dayAgo(w.days),
      },
      update: { amount: w.amount, status: w.status, createdAt: dayAgo(w.days) },
    });
  }
  console.log(`✓ 提现 ${WDS.length} 笔（已到账 / 审核中 / 已驳回）`);

  /* ── 我的评价（客户评价我的服务 · 互评基础） ── */
  // reply 字段演示两种状态：pv_rev_01 / pv_rev_02 已回评（互评完成），pv_rev_03 待回评。
  const REVIEWS = [
    { id: 'pv_rev_01', buyer: 2, rating: 5.0, content: '花艺布置很精美，准时交付，非常满意！', days: 9, replyRating: 5, reply: '感谢认可！期待为您呈现更多美好作品～', replyDays: 7 },
    { id: 'pv_rev_02', buyer: 1, rating: 4.5, content: '整体不错，沟通顺畅，细节再打磨下更好。', days: 5, replyRating: 4.5, reply: '已记录您的建议，后续会加强细节打磨，感谢反馈！', replyDays: 4 },
    { id: 'pv_rev_03', buyer: 0, rating: 3.0, content: '与约定点位有出入，已协商解决。', days: 3 },
  ];
  for (const r of REVIEWS) {
    const createdAt = dayAgo(r.days);
    const replyAt = r.replyDays != null ? dayAgo(r.replyDays) : null;
    await prisma.review.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: buyers[r.buyer].id,
        providerId: provider.id,
        rating: r.rating,
        content: r.content,
        reply: r.reply ?? null,
        replyRating: r.replyRating ?? null,
        replyAt,
        createdAt,
      },
      update: {
        rating: r.rating,
        content: r.content,
        reply: r.reply ?? null,
        replyRating: r.replyRating ?? null,
        replyAt,
        createdAt,
      },
    });
  }
  console.log(`✓ 评价 ${REVIEWS.length} 条（好评 / 中评 / 差评 · 含 2 条已互评）`);

  /* ── 档期管理 ── */
  const SCHEDS = [
    { id: 'pv_sc_01', date: '2026-09-03', period: 'AM', serviceType: '婚庆主持', status: 'locked', orderId: 'pv_ord_03', customer: buyers[2].nickname || '张伟', note: '全天彩排' },
    { id: 'pv_sc_02', date: '2026-09-05', period: 'FULL', serviceType: '摄影摄像', status: 'available', customer: null, note: '' },
    { id: 'pv_sc_03', date: '2026-08-27', period: 'PM1', serviceType: '花艺布置', status: 'done', orderId: 'pv_ord_01', customer: buyers[0].nickname || '热依汗', note: '已交付' },
  ];
  for (const s of SCHEDS) {
    await prisma.providerSchedule.upsert({
      where: { id: s.id },
      create: { ...s, providerId: provider.id },
      update: { ...s, providerId: provider.id },
    });
  }
  console.log(`✓ 档期 ${SCHEDS.length} 条（已锁定 / 可接单 / 已完成）`);

  /* ── 合同管理 ── */
  const CONTRACTS = [
    {
      id: 'pv_ht_01',
      contractNo: 'HT-2026-SP001',
      type: 'MAIN',
      name: '特约设计服务合作主合同',
      partyA: '管理总台（庆柬云）',
      serviceType: '特约设计',
      businessMode: 'REGION_EXCLUSIVE',
      region: '乌鲁木齐市天山区',
      exclusive: true,
      platformRate: 10,
      deposit: 500000,
      settlePeriod: 'MONTH',
      signStage: 'EFFECTIVE',
      signDate: dayAgo(120),
      expireDate: dayAgo(-240),
      negotiation: ['2026-05-01 总台发起主合同协商', '2026-05-08 服务商在线签署', '2026-05-12 总台审批通过并生效'],
    },
    {
      id: 'pv_ht_02',
      contractNo: 'HT-2026-BC002',
      type: 'SUPPLEMENT',
      name: '光影纪录线上接单补充协议',
      partyA: '乌鲁木齐天山区代理商',
      serviceType: '光影纪录',
      businessMode: 'ONLINE',
      region: '乌鲁木齐市天山区',
      exclusive: false,
      platformRate: 12,
      deposit: 80000,
      settlePeriod: 'HALF_MONTH',
      signStage: 'AWAIT_PROVIDER_SIGN',
      signDate: null,
      expireDate: dayAgo(-300),
      negotiation: ['2026-08-20 代理商发起补充协议', '2026-08-22 待服务商签署'],
    },
  ];
  for (const c of CONTRACTS) {
    await prisma.providerContract.upsert({
      where: { id: c.id },
      create: { ...c, providerId: provider.id, attachments: [] },
      update: { ...c, attachments: [] },
    });
  }
  console.log(`✓ 合同 ${CONTRACTS.length} 份（已生效主合同 / 待签补充协议）`);

  /* ── 我的团队（P2 起写入统一表 OrgStaff，不再写已删除的 ProviderTeamMember）── */
  const CN_PERM_ALIAS = {
    订单查询: 'order:view', 订单处理: 'order:handle', 售后处理: 'order:aftersale',
    站内信收发: 'message:send', 模板服务上架: 'template:publish', '模板/服务上架': 'template:publish',
    内容下架: 'content:offline', 列表数据导出: 'data:export', 资质管理: 'qualification:manage',
  };
  const TEAM = [
    { memberNo: 'MT-1000', name: '古丽娜尔', phone: '13500000100', accountStatus: 'ACTIVE', serviceType: '花艺布置', teamRole: '花艺师', duties: ['花艺设计', '现场布置'], personality: '细致耐心', dataScope: 'provider', funcPerms: ['订单查询', '内容下架'] },
    { memberNo: 'MT-1001', name: '小马', phone: '13500000101', accountStatus: 'PENDING', serviceType: '婚庆策划', teamRole: '客服专员', duties: ['客户接待', '进度同步'], personality: '热情主动', dataScope: 'service', funcPerms: ['订单查询', '站内信收发'] },
    { memberNo: 'MT-1002', name: '阿依古丽', phone: '13500000102', accountStatus: 'ACTIVE', serviceType: '特约设计', teamRole: '设计助理', duties: ['初稿绘制', '素材整理'], personality: '创意丰富', dataScope: 'self', funcPerms: ['模板/服务上架'] },
    { memberNo: 'MT-1003', name: '麦麦提·艾力', phone: '13800000001', accountStatus: 'ACTIVE', serviceType: '特约设计', teamRole: '负责人', duties: ['统筹', '品质把控', '客户维护', '团队管理', '商务洽谈'], personality: '专业可靠', dataScope: 'provider', funcPerms: ['订单查询', '订单处理', '售后处理', '站内信收发', '模板/服务上架', '内容下架', '列表数据导出', '资质管理'] },
  ];
  for (const m of TEAM) {
    const funcPerms = m.funcPerms.map((p) => CN_PERM_ALIAS[p] ?? p);
    await prisma.orgStaff.upsert({
      where: { memberNo: m.memberNo },
      create: {
        orgType: 'PROVIDER', orgId: provider.id, memberNo: m.memberNo,
        name: m.name, phone: m.phone, accountStatus: m.accountStatus,
        serviceType: m.serviceType, staffRole: m.teamRole, duties: m.duties,
        personality: m.personality, dataScope: m.dataScope, funcPerms,
      },
      update: {
        orgType: 'PROVIDER', orgId: provider.id,
        name: m.name, phone: m.phone, accountStatus: m.accountStatus,
        serviceType: m.serviceType, staffRole: m.teamRole, duties: m.duties,
        personality: m.personality, dataScope: m.dataScope, funcPerms,
      },
    });
  }
  console.log(`✓ 团队成员 ${TEAM.length} 人（负责人 / 设计助理 / 客服 / 花艺师）`);

  /* ── 我的客户 ── */
  const CLIENTS = [
    { id: 'pv_cl_01', clientNo: 'PC-1001', name: '刘倩', phone: '13900001001', totalSpend: 12800, lastService: '摄影摄像', tags: ['重点客户'], prefs: ['电子请柬', 'H5 设计'], channels: ['短信', '站内信'], interactions: 12, lastMaintain: dayAgo(8) },
    { id: 'pv_cl_02', clientNo: 'PC-1002', name: '热依汗', phone: '13900001002', totalSpend: 5200, lastService: '花艺布置', tags: ['普通客户'], prefs: ['桌花布置'], channels: ['短信'], interactions: 5, lastMaintain: dayAgo(20) },
    { id: 'pv_cl_03', clientNo: 'PC-1003', name: '张伟', phone: '13900001003', totalSpend: 8800, lastService: '婚庆主持', tags: ['重点客户'], prefs: ['全流程主持'], channels: ['微信', '电话'], interactions: 9, lastMaintain: dayAgo(4) },
    { id: 'pv_cl_04', clientNo: 'PC-1000', name: '王磊', phone: '13900001004', totalSpend: 3600, lastService: '宴会设计', tags: ['潜力客户'], prefs: ['宴会厅设计'], channels: ['站内信'], interactions: 3, lastMaintain: dayAgo(30) },
  ];
  for (const c of CLIENTS) {
    await prisma.providerClient.upsert({
      where: { id: c.id },
      create: { ...c, providerId: provider.id },
      update: { ...c, providerId: provider.id },
    });
  }
  console.log(`✓ 客户 ${CLIENTS.length} 位（重点 / 普通 / 潜力）`);

  /* ── 通知公告（管理总台 / 代理商权威发布，服务商可见） ── */
  const NOTICES = [
    { id: 'pv_pn_04', type: 'ANNOUNCEMENT', scope: 'GLOBAL', title: '关于服务商入驻审核规范调整的通知', content: '自 2026-09 起，服务商入驻资质审核执行《入驻审核规范 V3.0》，详见附件。', targetRole: null, regionPath: null, days: 12 },
    { id: 'pv_pn_03', type: 'ANNOUNCEMENT', scope: 'OWN', title: '服务商入驻资格初审通过', content: '您的服务商入驻申请已通过辖区初审，请于「业务申请」补全资质资料进入终审。', targetRole: 'SERVICE_PROVIDER', regionPath: null, days: 18 },
    { id: 'pv_pn_02', type: 'ANNOUNCEMENT', scope: 'OWN', title: '业务升级申请初审通过', content: '您申请的「光影纪录」业务升级已通过初审，等待总台终审。', targetRole: 'SERVICE_PROVIDER', regionPath: null, days: 22 },
  ];
  for (const n of NOTICES) {
    await prisma.message.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        type: n.type,
        scope: n.scope,
        title: n.title,
        content: n.content,
        status: 'PUBLISHED',
        authorId: provider.id,
        authorRole: 'ADMIN',
        targetRole: n.targetRole,
        regionPath: n.regionPath,
        approvedAt: dayAgo(n.days),
        createdAt: dayAgo(n.days),
      },
      update: {
        title: n.title,
        content: n.content,
        status: 'PUBLISHED',
        targetRole: n.targetRole,
        createdAt: dayAgo(n.days),
      },
    });
  }
  console.log(`✓ 通知公告 ${NOTICES.length} 条（权威公告 / 初审通过）`);

  /* ── 意见反馈（服务商自己提交的反馈 / 申诉） ── */
  const MY_TICKETS = [
    { id: 'pv_mtkt_01', type: 'APPEAL', title: '申诉：模板被误判下架', content: '模板「天山雪莲·婚礼请柬」被下架，认为判定有误，申请复核。', status: 'NEGOTIATING', days: 6, targetRole: 'ADMIN' },
    { id: 'pv_mtkt_02', type: 'SUGGESTION', title: '建议增加批量导出订单', content: '希望能支持按月份批量导出订单结算明细，便于对账。', status: 'OPEN', days: 2, targetRole: 'ADMIN' },
  ];
  for (const t of MY_TICKETS) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        type: t.type,
        title: t.title,
        content: t.content,
        status: t.status,
        regionPath: provider.regionPath ?? null,
        reporterId: provider.id,
        reporterRole: 'SERVICE_PROVIDER',
        targetId: null,
        assigneeRole: t.targetRole,
        createdAt: dayAgo(t.days),
      },
      update: {
        title: t.title,
        content: t.content,
        status: t.status,
        createdAt: dayAgo(t.days),
      },
    });
  }
  console.log(`✓ 服务商意见反馈 ${MY_TICKETS.length} 条（申诉 / 建议）`);

  /* ── 业务申请（服务商自己的入驻 / 资质申请） ── */
  await prisma.qualificationApplication.upsert({
    where: { id: 'pv_qa_01' },
    create: {
      id: 'pv_qa_01',
      userId: provider.id,
      kind: 'provider',
      status: 'FINAL_PENDING',
      reason: '申请成为庆柬云特约设计服务商，承接 H5 请柬与视觉设计业务。',
      serviceScopes: ['特约设计', '婚庆策划', '司仪主持'],
      regionPath: provider.regionPath ?? '65/6501/650102',
      regionLabel: '乌鲁木齐市天山区',
      applicantName: provider.nickname || '麦麦提·艾力',
      phone: provider.phone,
      certType: '营业执照',
      certNo: '91650100****2210',
      createdAt: dayAgo(40),
    },
    update: { status: 'FINAL_PENDING', serviceScopes: ['特约设计', '婚庆策划', '司仪主持'] },
  });
  console.log('✓ 业务申请 1 条（终审待审）');

  /* ── 我的作品（前端 Project 记录，映射到运营端「模板管理」来源=作品） ──
     让服务商在运营端「模板管理」能看到自己在前端「我的作品」里的请柬，
     来源标签为「作品」，详情页右侧预览区渲染首屏。 */
  const WORKS = [
    { id: 'pv_prj_01', title: '天山雪莲·婚礼请柬', status: 'published', viewCount: 1280, publishCode: 'PUB-PL01', days: 30 },
    { id: 'pv_prj_02', title: '胡杨林·金秋答谢宴', status: 'published', viewCount: 642, publishCode: 'PUB-PL02', days: 18 },
    { id: 'pv_prj_03', title: '伊犁河畔·生日庆典', status: 'draft', viewCount: 0, publishCode: null, days: 3 },
  ];
  for (const w of WORKS) {
    await prisma.project.upsert({
      where: { id: w.id },
      create: {
        id: w.id,
        userId: provider.id,
        title: w.title,
        status: w.status,
        publishCode: w.publishCode,
        viewCount: w.viewCount,
        version: 1,
        cover: null,
        schema: schemaOf(w.title),
        createdAt: dayAgo(w.days),
        updatedAt: dayAgo(w.days),
      },
      update: {
        title: w.title,
        status: w.status,
        publishCode: w.publishCode,
        viewCount: w.viewCount,
        schema: schemaOf(w.title),
        updatedAt: dayAgo(w.days),
      },
    });
  }
  console.log(`✓ 我的作品 ${WORKS.length} 个（已发布 / 草稿，映射到模板管理「作品」来源）`);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
