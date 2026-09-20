import { useEffect, useState } from 'react';
import { Modal, Input, Button, Select } from 'antd';
import { T } from '../../config/theme';

/** 会员等级（原型 TIERS 四档；0=普通用户 1=银卡 2=金卡 3=黑金） */
export const TIERS = [
  { key: '普通用户', label: '普通', value: 0 },
  { key: '银卡会员', label: '银卡', value: 1 },
  { key: '金卡会员', label: '金卡', value: 2 },
  { key: '黑金会员', label: '黑金', value: 3 },
] as const;

/** 等级 key ↔ vipLevel 互转 */
export const tierKeyOf = (vipLevel?: number | null): string =>
  TIERS.find((x) => x.value === (vipLevel ?? 0))?.key ?? '普通用户';
export const vipLevelOf = (key: string): number =>
  TIERS.find((x) => x.key === key)?.value ?? 0;

/** 各等级权益（原型 .perks） */
export const TIER_PERKS: Record<string, string[]> = {
  普通用户: ['新人礼包 ¥20', '在线浏览 · 搜索服务商', '提交预约申请', '基础在线客服'],
  银卡会员: ['含普通用户全部权益', '生日券', '全场服务 9.8 折', '专属客服'],
  金卡会员: ['含银卡会员全部权益', '优先券 / 免排期', '全场服务 9.5 折', '优先排期'],
  黑金会员: ['含金卡会员全部权益', '季度礼 / 专属管家', '全场服务 9 折', '金牌管家 1 对 1'],
};

export interface AdjustTarget {
  id: string;
  name: string;
  city?: string | null;
  tierKey: string;
  /** 余额（元） */
  balance: number;
  points: number;
}

export interface AdjustUserModalProps {
  open: boolean;
  target?: AdjustTarget | null;
  onClose: () => void;
  onSubmit: (payload: { vipLevel: number; balance: number; points: number }) => Promise<void> | void;
}

/**
 * 调整用户数据弹窗（原型 #uAdjModal）。
 * 用于等级测试与功能验证：调整会员等级 / 余额 / 积分，保存后刷新工作台 KPI 与标签。
 */
export const AdjustUserModal = ({ open, target, onClose, onSubmit }: AdjustUserModalProps) => {
  const [tier, setTier] = useState<string>('普通用户');
  const [balance, setBalance] = useState('0');
  const [points, setPoints] = useState('0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && target) {
      setTier(target.tierKey);
      setBalance(String(target.balance ?? 0));
      setPoints(String(target.points ?? 0));
    }
  }, [open, target]);

  const submit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        vipLevel: vipLevelOf(tier),
        balance: Number(balance) || 0,
        points: Number(points) || 0,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={480}
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
          调整
        </span>
        调整用户数据
        <span
          onClick={onClose}
          style={{ marginLeft: 'auto', color: T.ink3, cursor: 'pointer', fontSize: 14 }}
          role="button"
          aria-label="关闭"
        >
          ✕
        </span>
      </h3>

      <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 12 }}>
        {target
          ? `${target.name}（${target.id}）· ${target.city ?? '未归属区域'} · 当前等级 ${target.tierKey}`
          : '—'}
      </div>

      <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
          会员等级
          <Select
            value={tier}
            onChange={setTier}
            options={TIERS.map((x) => ({ value: x.key, label: x.key }))}
          />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
          账户余额（元）
          <Input type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
          积分
          <Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        <Button onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button type="primary" onClick={submit} loading={loading}>
          保存
        </Button>
      </div>
    </Modal>
  );
};

export default AdjustUserModal;
