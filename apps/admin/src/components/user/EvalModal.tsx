import { useEffect, useState } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { T } from '../../config/theme';

/** 星级 → 满意度文案（原型 openEvalModal） */
export const RATING_TIPS = ['很不满意', '不满意', '一般', '满意', '非常满意'];

/** 实心星 / 空心星（原型 .evstar） */
const STAR_ON = '#f5a623';
const STAR_OFF = '#d8d8d8';

export interface EvalTarget {
  /** 订单 id 或服务商 id，二者其一 */
  orderId?: string;
  providerId?: string;
  /** 展示名：订单为「服务 · 服务商」，服务商为「编号 · 名称」 */
  name: string;
  /** 已评价（原样预填并切换为追评文案） */
  rating?: number | null;
  content?: string | null;
}

export interface EvalModalProps {
  open: boolean;
  /** 'order' 订单评价（仅已完成可评） / 'provider' 服务商评价 */
  kind: 'order' | 'provider';
  target?: EvalTarget | null;
  onClose: () => void;
  onSubmit: (payload: { orderId?: string; providerId?: string; rating: number; content: string }) => Promise<void> | void;
}

/**
 * 评价 / 追评弹窗（原型 openEvalModal）。
 * 结构：对象行 → 综合评分（5 星 + 满意度文案）→ 评语（必填）→ 提交评价。
 * 已评价时标题为「追评」并预填上次星级与评语。
 */
export const EvalModal = ({ open, kind, target, onClose, onSubmit }: EvalModalProps) => {
  const marked = !!target?.rating;
  const [star, setStar] = useState(5);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStar(target?.rating ?? 5);
      setText(target?.content ?? '');
    }
  }, [open, target]);

  const title = `${marked ? '追评' : '评价'}${kind === 'order' ? '订单' : '服务商'}`;

  const submit = async () => {
    const content = text.trim();
    if (!content) {
      message.warning('请填写评语');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        orderId: target?.orderId,
        providerId: target?.providerId,
        rating: star,
        content,
      });
      message.success(
        `${marked ? '追评' : '评价'}已提交（${star} 星）· 评价将在平台审核后公开展示`,
      );
      onClose();
    } finally {
      setLoading(false);
    }
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
          {marked ? '追评' : '评价'}
        </span>
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

      {/* 对象行 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          borderBottom: `1px dashed ${T.border}`,
          fontSize: 13,
          marginTop: 12,
        }}
      >
        <span style={{ color: T.ink3 }}>{kind === 'order' ? '订单服务' : '服务商'}</span>
        <span style={{ color: T.ink1, fontWeight: 600 }}>{target?.name ?? '—'}</span>
      </div>

      {/* 综合评分 */}
      <div style={{ padding: '14px 0 2px', fontWeight: 600, fontSize: 13, color: T.ink1 }}>
        综合评分<span style={{ color: T.down, marginLeft: 2 }}>*</span>
      </div>
      <div style={{ padding: '8px 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            onClick={() => setStar(n)}
            style={{
              cursor: 'pointer',
              fontSize: 26,
              lineHeight: 1,
              color: n <= star ? STAR_ON : STAR_OFF,
              transition: 'color .15s',
              userSelect: 'none',
            }}
            role="button"
            aria-label={`${n} 星`}
          >
            ★
          </span>
        ))}
        <span style={{ marginLeft: 10, color: T.ink3, fontSize: 12.5 }}>
          {RATING_TIPS[star - 1] ?? ''}
        </span>
      </div>

      {/* 评语 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
          评语<span style={{ color: T.down, marginLeft: 2 }}>*</span>
        </label>
        <Input.TextArea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            kind === 'order'
              ? '对本次订单的服务过程与服务商表现给出真实评价…'
              : '对该服务商的服务质量、响应速度、专业程度给出评价…'
          }
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        <Button onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button type="primary" onClick={submit} loading={loading}>
          提交评价
        </Button>
      </div>
    </Modal>
  );
};

export default EvalModal;
