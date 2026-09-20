/**
 * 服务商三页面（providerPages / providerSettingsPages / providerDetailPages）
 * 共享字典型常量的单一真值源。
 *
 * 历史问题：这三份文件在各自顶部 clone 了一份几乎相同的模块级常量
 *（枚举字典、色板、下拉选项等），形成「改一处漏三处」的隐患。
 * 此处收敛为单一来源，三页面按需 import。
 *
 * 冲突裁决（同名不同值，禁止盲目合并）：
 * - PERIOD / REACH_TYPE：以 providerSettingsPages 的 i18n-key 形态为准（消费端统一走 t()）。
 * - TEMPLATE_CAT_OPTS：以 providerPages 的 categoryText(slug) 形态为准（15 类 slug 与后端/原型口径一致）。
 * - TEMPLATE_STATUS_OPTS：模板「审核态」(PP) 与模板「发布态」(PDet) 是两套状态机，
 *   语义不同，PDet 侧改名为 TEMPLATE_PUBLISH_STATUS_OPTS 独立保留，不在此收敛。
 */

import { t } from '../i18n/t';
import { categoryText } from './labels';
import type { PillTone } from '../components/ui/Pill';

// —— 排期 / 合同 / 团队 状态映射（含 i18n key + Pill 色调）——
export const SCHEDULE_STATUS: Record<string, { key: string; tone: PillTone }> = {
  available: { key: 'pages.status.schAvailable', tone: 'ok' },
  locked: { key: 'pages.status.schLocked', tone: 'ac' },
  done: { key: 'pages.status.svcCompleted', tone: 'mut' },
};

export const CONTRACT_TYPE: Record<string, string> = {
  MAIN: 'pages.status.contractMain',
  SUPPLEMENT: 'pages.status.contractSupplement',
  RENEW: 'pages.status.contractRenew',
  TERMINATE: 'pages.status.contractTerminate',
};

export const CONTRACT_STAGE: Record<string, { key: string; tone: PillTone }> = {
  NEGOTIATING: { key: 'pages.status.contractStageNegotiating', tone: 'warn' },
  AWAIT_PROVIDER_SIGN: { key: 'pages.status.contractStageAwaitProvider', tone: 'warn' },
  AWAIT_SENIOR_SIGN: { key: 'pages.status.contractStageAwaitSenior', tone: 'warn' },
  APPROVING: { key: 'pages.status.contractStageApproving', tone: 'ac' },
  EFFECTIVE: { key: 'pages.status.contractStageEffective', tone: 'ok' },
  EXPIRED: { key: 'pages.status.contractStageExpired', tone: 'mut' },
  TERMINATED: { key: 'pages.status.contractStageTerminated', tone: 'bad' },
};

export const CONTRACT_MODE: Record<string, string> = {
  REGION_EXCLUSIVE: 'pages.status.contractModeRegionExclusive',
  ONLINE: 'pages.status.contractModeOnline',
  ON_SITE: 'pages.status.contractModeOnSite',
  JOINT: 'pages.status.contractModeJoint',
};

export const SETTLE: Record<string, string> = {
  MONTH: 'pages.status.settleMonth',
  HALF_MONTH: 'pages.status.settleHalfMonth',
  WEEK: 'pages.status.settleWeek',
};

export const TEAM_STATUS: Record<string, { key: string; tone: PillTone }> = {
  ACTIVE: { key: 'status.ACTIVE', tone: 'ok' },
  PENDING: { key: 'pages.status.teamPending', tone: 'warn' },
  DISABLED: { key: 'status.DISABLED', tone: 'bad' },
};

// —— 标签 / 分类 / 色板 ——
export const CLIENT_TAG_OPTS = ['重点客户', '普通客户', '潜力客户', 'VIP 客户'].map((v) => ({ value: v, label: v }));

/** 模板分类（15 类，slug 与后端/原型口径一致；label 走 categoryText 中文映射） */
export const TEMPLATE_CAT_SLUGS = [
  'wedding', 'birth_celebration', 'birthday', 'festival', 'housewarming',
  'school_promotion', 'social_gathering', 'memorial', 'brand', 'recruitment',
  'conference', 'opening', 'education', 'biz_social', 'marketing',
];
export const TEMPLATE_CAT_OPTS = TEMPLATE_CAT_SLUGS.map((c) => ({ value: c, label: categoryText(c) }));

export const TEMPLATE_TAG_OPTS = ['中式', '国潮', '喜庆', '简约', '手绘', '浪漫', '复古', '森系', '商务', '科技', '童趣', '实景', 'H5互动', '电子请柬'].map((v) => ({ value: v, label: v }));

/** 封面底色色板（10 色） */
export const COVER_COLORS = ['#c24b2e', '#1f3a5f', '#2e7d52', '#8a5a00', '#6a1b4d', '#37474f', '#b71c1c', '#00695c', '#4527a0', '#f3f4f6'];

/** 标题色（4 色） */
export const TITLE_COLORS = [
  { value: '#c24b2e', label: '品牌红' },
  { value: '#ffffff', label: '纯白' },
  { value: '#d4af37', label: '香槟金' },
  { value: '#1f3a5f', label: '深藏蓝' },
];

// —— 资质 / 申请流程 / 工单 / 部门 ——
export const CERT_TYPES = ['营业执照', '经营许可证', '居民身份证', '演出许可', '资质证书', '其他'].map((v) => ({ value: v, label: v }));

/** 业务申请 6 步流程（doc §8.7 右侧时间轴） */
export const APPLY_FLOW = [
  { key: 'fill', label: 'pages.status.fillData' },
  { key: 'upload', label: 'pages.status.uploadCert' },
  { key: 'submit', label: 'pages.status.submitReview' },
  { key: 'first', label: 'pages.status.regionFirstReview' },
  { key: 'final', label: 'pages.status.consoleFinalReview' },
  { key: 'sign', label: 'pages.status.signOpen' },
];

export const TICKET_TYPE: Record<string, string> = {
  COMPLAINT: 'pages.fb.complaint',
  PRAISE: 'pages.status.tkTypePraise',
  SUGGESTION: 'pages.fb.suggestion',
  CONSULT: 'pages.col.consult',
  APPEAL: 'pages.status.tkTypeAppeal',
  AFTERSALE: 'pages.status.tkTypeAftersale',
  OTHER: 'pages.status.tkTypeOther',
};

export const TICKET_TYPE_OPTS = (Object.entries(TICKET_TYPE) as [string, string][])
  .filter(([v]) => ['AFTERSALE', 'SUGGESTION', 'CONSULT', 'COMPLAINT', 'OTHER'].includes(v))
  .map(([v, l]) => ({ value: v, label: t(l) }));

export const DEPT_OPTS = [
  { value: 'AGENT', label: 'pages.status.deptAgent' },
  { value: 'ADMIN', label: 'pages.status.deptAdmin' },
];

export const APPLY_STATUS: Record<string, { key: string; tone: PillTone }> = {
  FIRST_PENDING: { key: 'pages.status.applyFirstPending', tone: 'warn' },
  FIRST_PASSED: { key: 'pages.status.applyFirstPassed', tone: 'ac' },
  FINAL_PENDING: { key: 'pages.status.applyFinalPending', tone: 'warn' },
  APPROVED: { key: 'status.APPROVED', tone: 'ok' },
  REJECTED: { key: 'status.REJECTED', tone: 'bad' },
};

// —— 服务类型 / 签约区域（与业务辖区口径一致）——
export const SVC_OPTIONS: { value: string; label: string }[] = [
  '摄影摄像', '插花礼仪', '乐队演出', '礼仪执事', '主持人', '婚庆主持',
  '宴会设计', '花艺布置', '化妆造型', '司仪培训', '婚礼策划', '特约设计',
  '光影纪录', '司仪主持', '灯光音响',
].map((s) => ({ value: s, label: s }));

export const REGION_OPTIONS: { value: string; label: string }[] = [
  '乌鲁木齐市', '喀什市', '伊宁市', '昌吉市', '库尔勒市',
  '克拉玛依市', '石河子市', '阿克苏市', '和田市', '吐鲁番市',
].map((s) => ({ value: s, label: s }));

// —— 排期时段（含全天；i18n-key 形态，消费端统一 t()）——
export const PERIOD: Record<string, string> = {
  FULL: 'pages.status.periodFull', AM: '09:00-12:00', PM1: '12:00-15:00', PM2: '15:00-18:00', PM3: '18:00-21:00', NIGHT: '晚间21:00-23:00',
};
export const PERIOD_OPTS = Object.entries(PERIOD).map(([v, l]) => ({ value: v, label: t(l) }));

export const STATUS_OPTS = Object.entries(SCHEDULE_STATUS).map(([v, m]) => ({ value: v, label: t(m.key) }));

// —— 触达类型 / 渠道（i18n-key 形态）——
export const REACH_TYPE: Record<string, string> = { SERVICE_MSG: 'pages.status.reachServiceMsg', COUPON: 'pages.status.reachCoupon', ACTIVITY: 'pages.status.reachActivity', REWARD: 'pages.status.reachReward' };
export const REACH_CHANNEL: Record<string, string> = { INNER_SMS: 'pages.status.reachInnerSms', SMS: 'pages.status.reachSms', WECHAT: 'pages.status.reachWechat', PHONE: 'pages.status.reachPhone' };

export const TEAM_STATUS_OPTS = (Object.entries(TEAM_STATUS) as [string, { key: string }][]).map(([v, m]) => ({ value: v, label: t(m.key) }));
