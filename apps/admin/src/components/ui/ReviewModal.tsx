import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Input, Button } from 'antd';
import { T } from '../../config/theme';

export interface KvField {
  label: string;
  value: ReactNode;
}

export interface ReviewModalProps {
  open: boolean;
  /** 左上角小标签（原型 #modalTag：审核 / 用户 / 角色…） */
  tag?: ReactNode;
  title?: ReactNode;
  /** 只读键值对（原型 .modal .kv） */
  fields?: KvField[];
  /** 显示审核意见（原型 #mOpinionWrap） */
  opinion?: boolean;
  opinionRequired?: boolean;
  /** 底部操作：通过 / 驳回 / 编辑 */
  onApprove?: (opinion: string) => void;
  onReject?: (opinion: string) => void;
  onEdit?: () => void;
  approveText?: string;
  editText?: string;
  /** 驳回按钮文案（默认「驳回」） */
  rejectText?: string;
  /** 只读模式（运维管理员）：锁掉写操作 */
  readonly?: boolean;
  /** 提交中：按钮进入 loading 防重复点击 */
  loading?: boolean;
  onClose?: () => void;
  /** 自定义表单区（编辑态渲染在 kv 之下） */
  children?: ReactNode;
}

/**
 * 审核 / 详情弹窗（原型 .modal）。
 * 结构：标签 + 标题 + 键值定义表 + 审核意见 + 底部操作组。
 * 与原型一致：驳回时意见必填，只读态禁用通过/驳回。
 */
export const ReviewModal = ({
  open,
  tag,
  title,
  fields,
  opinion,
  opinionRequired,
  onApprove,
  onReject,
  onEdit,
  approveText = '通过',
  editText = '编辑',
  rejectText = '驳回',
  readonly,
  loading,
  onClose,
  children,
}: ReviewModalProps) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const doReject = () => {
    if (opinionRequired && !text.trim()) {
      return;
    }
    onReject?.(text.trim());
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={520}
      footer={null}
      closable={false}
      destroyOnHidden
      styles={{ body: { padding: 20 } }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: T.ink1,
        }}
      >
        {tag != null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 999,
              background: T.accentSoft,
              color: T.accent,
              fontWeight: 600,
            }}
          >
            {tag}
          </span>
        )}
        {title}
        <span
          onClick={onClose}
          style={{ marginLeft: 'auto', color: T.ink3, cursor: 'pointer', fontSize: 14 }}
          role="button"
          aria-label="关闭"
        >
          ✕
        </span>
      </h3>

      {fields && fields.length > 0 && (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '86px 1fr',
            gap: '6px 12px',
            fontSize: 13,
            marginTop: 14,
          }}
        >
          {fields.map((f, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <dt style={{ color: T.ink3, margin: 0 }}>{f.label}</dt>
              <dd style={{ color: T.ink1, fontWeight: 600, margin: 0 }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {opinion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
          <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            审核意见{opinionRequired ? '（驳回必填）' : ''}
          </label>
          <Input.TextArea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="填写通过 / 驳回的理由，将同步通知申请人…"
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        {onEdit && (
          <Button onClick={onEdit} disabled={readonly || loading} loading={loading}>
            {editText}
          </Button>
        )}
        <Button onClick={onClose} disabled={loading}>
          关闭
        </Button>
        {onReject && (
          <Button
            danger
            onClick={doReject}
            disabled={readonly || loading}
            loading={loading}
          >
            {rejectText}
          </Button>
        )}
        {onApprove && (
          <Button
            type="primary"
            onClick={() => onApprove(text.trim())}
            disabled={readonly || loading}
            loading={loading}
          >
            {approveText}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default ReviewModal;
