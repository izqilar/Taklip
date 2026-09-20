import { useState, type ReactNode } from 'react';
import { Button, Space, Form, Input, Typography, Alert } from 'antd';
import { t } from "../../i18n/t";
import { T } from '../../config/theme';

const { Text } = Typography;

export interface ReviewActionsProps {
  /** 通过按钮文案，默认「通过」 */
  approveText?: string;
  /** 驳回按钮文案，默认「驳回」 */
  rejectText?: string;
  /** 驳回是否必填原因，默认 true（文档 §9.5 驳回必填并校验拦截） */
  requireReason?: boolean;
  /** 只读态：禁用所有写按钮（文档 §4.3，配合布局黄条） */
  readonly?: boolean;
  /** 提交中 */
  loading?: boolean;
  /** 通过：reason 为审核意见（可选） */
  onApprove?: (reason?: string) => Promise<void> | void;
  /** 驳回：reason 为必填原因 */
  onReject?: (reason: string) => Promise<void> | void;
  /** 额外动作（如下架），渲染在审核区底部 */
  extra?: ReactNode;
}

/**
 * 审核动作组（文档 §9.1 类型 B）。
 * 通过 = 一键更新状态；驳回 = 必填原因 + 校验拦截；只读态锁定。
 * 审核意见在通过时可选、驳回时必填，提交后清空。
 */
export const ReviewActions = ({
  approveText,
  rejectText,
  requireReason = true,
  readonly,
  loading,
  onApprove,
  onReject,
  extra,
}: ReviewActionsProps) => {
  const [form] = Form.useForm<{ reason: string }>();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const run = async (kind: 'approve' | 'reject') => {
    const reason = (form.getFieldValue('reason') || '').trim();
    if (kind === 'reject' && requireReason && !reason) {
      form.setFields([{ name: 'reason', errors: [t('common.reasonRequired')] }]);
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'approve') await onApprove?.(reason || undefined);
      else await onReject?.(reason);
      form.resetFields();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={t('common.reviewComment')}
        description={
          <Text type="secondary">
            {t('common.reviewCommentPlaceholder')}；{requireReason ? t('common.reasonRequired') : ''}
            {readonly ? ` ${t('common.readonly')}。` : ''}
          </Text>
        }
      />
      <Form form={form} layout="vertical">
        <Form.Item name="reason" label={t('common.reviewComment')}>
          <Input.TextArea rows={4} maxLength={500} placeholder={t('common.reviewCommentPlaceholder')} />
        </Form.Item>
      </Form>
      <Space wrap>
        {onApprove && (
          <Button
            type="primary"
            style={{ background: T.accent }}
            disabled={readonly || loading}
            loading={busy === 'approve'}
            onClick={() => run('approve')}
          >
            {approveText ?? t('common.approve')}
          </Button>
        )}
        {onReject && (
          <Button
            danger
            disabled={readonly || loading}
            loading={busy === 'reject'}
            onClick={() => run('reject')}
          >
            {rejectText ?? t('common.reject')}
          </Button>
        )}
      </Space>
      {extra && <div style={{ marginTop: 12 }}>{extra}</div>}
    </div>
  );
};

export default ReviewActions;
