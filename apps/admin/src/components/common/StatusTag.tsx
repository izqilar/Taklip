import type { ReactNode } from 'react';
import { Pill, type PillTone } from '../ui/Pill';
import { t } from '../../i18n/t';

/**
 * 全局唯一状态标签（文档 §11.4）。
 * 列表与详情对话框共用，杜绝页面内自定义颜色与英文键值残留。
 * 映射：#ok→ok #warn→warn #bad→bad #mut→mut #ac→ac（原型「状态双角色：浅底深字」）
 * 文案走 i18n（status.* 键），缺失回退 zh-CN。
 */

type PillToneName = PillTone;

interface StatusMeta {
  text: string;
  tone: PillToneName;
  i18nKey: string;
}

// 规范键 → 中文文案 + 颜色 + i18n 键（覆盖四层全部状态枚举值）
const STATUS_MAP: Record<string, StatusMeta> = {
  // #ok success：正常/已通过/已上架/已发布
  ACTIVE: { text: '正常', tone: 'ok', i18nKey: 'status.ACTIVE' },
  APPROVED: { text: '已通过', tone: 'ok', i18nKey: 'status.APPROVED' },
  PUBLISHED: { text: '已发布', tone: 'ok', i18nKey: 'status.PUBLISHED' },
  published: { text: '已发布', tone: 'ok', i18nKey: 'status.PUBLISHED' },
  ON_SALE: { text: '在售', tone: 'ok', i18nKey: 'status.ON_SALE' },
  PAID: { text: '已支付', tone: 'ok', i18nKey: 'status.PAID' },
  VALID: { text: '有效', tone: 'ok', i18nKey: 'status.VALID' },
  // #warn warning：待审核/待复核/待处理
  PENDING: { text: '待审核', tone: 'warn', i18nKey: 'status.PENDING' },
  PENDING_REVIEW: { text: '待审核', tone: 'warn', i18nKey: 'status.PENDING_REVIEW' },
  PENDING_RECHECK: { text: '待复核', tone: 'warn', i18nKey: 'status.PENDING_RECHECK' },
  PENDING_PROCESS: { text: '待处理', tone: 'warn', i18nKey: 'status.PENDING_PROCESS' },
  REVIEWING: { text: '审核中', tone: 'warn', i18nKey: 'status.REVIEWING' },
  CREATING: { text: '待初审', tone: 'warn', i18nKey: 'status.CREATING' },
  // #bad error：停用/已驳回/售后
  DISABLED: { text: '停用', tone: 'bad', i18nKey: 'status.DISABLED' },
  REJECTED: { text: '已驳回', tone: 'bad', i18nKey: 'status.REJECTED' },
  rejected: { text: '已驳回', tone: 'bad', i18nKey: 'status.REJECTED' },
  AFTERSALE: { text: '售后', tone: 'bad', i18nKey: 'status.AFTERSALE' },
  REFUNDED: { text: '已退款', tone: 'bad', i18nKey: 'status.REFUNDED' },
  EXPIRED: { text: '已过期', tone: 'bad', i18nKey: 'status.EXPIRED' },
  // #mut default：草稿/待复审/未激活
  INACTIVE: { text: '未激活', tone: 'mut', i18nKey: 'status.INACTIVE' },
  draft: { text: '草稿', tone: 'mut', i18nKey: 'status.draft' },
  archived: { text: '已归档', tone: 'mut', i18nKey: 'status.archived' },
  TAKEN_DOWN: { text: '已下架', tone: 'mut', i18nKey: 'status.TAKEN_DOWN' },
  // #ac processing：履约中/升级仲裁/内置角色
  PROCESSING: { text: '履约中', tone: 'ac', i18nKey: 'status.PROCESSING' },
  ESCALATED: { text: '升级仲裁', tone: 'ac', i18nKey: 'status.ESCALATED' },
  BUILTIN: { text: '内置角色', tone: 'ac', i18nKey: 'status.BUILTIN' },
  cancelled: { text: '已取消', tone: 'mut', i18nKey: 'status.cancelled' },
};

export function statusMeta(key: string | undefined | null): StatusMeta {
  if (!key) return { text: '—', tone: 'mut', i18nKey: 'status.unknown' };
  return STATUS_MAP[key] ?? { text: '未知状态', tone: 'mut', i18nKey: 'status.unknown' };
}

export interface StatusTagProps {
  /** 状态枚举值（如 APPROVED / PENDING_REVIEW） */
  value?: string | undefined | null;
  /** 覆盖文案（少数场景需要自定义文字） */
  text?: string;
  /**
   * 显式指定色调（跳过 value→tone 映射）：用于非枚举语义场景，如 ProfilePage 的
   * 角色 / 权限 / 会员等级胶囊。与 value 互斥，指定 type 时按 type 渲染。
   */
  type?: PillToneName;
  /** 自定义子内容（type 模式下与 text 互斥，children 优先） */
  children?: ReactNode;
}

export const StatusTag = ({ value, text, type, children }: StatusTagProps): ReactNode => {
  if (type) {
    return <Pill tone={type}>{children ?? text}</Pill>;
  }
  const meta = statusMeta(value);
  return <Pill tone={meta.tone}>{text ?? t(meta.i18nKey, meta.text)}</Pill>;
};

export default StatusTag;
