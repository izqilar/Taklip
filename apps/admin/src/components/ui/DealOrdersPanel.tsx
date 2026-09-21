import type { CSSProperties } from 'react';
import { Panel } from './Panel';
import { T } from '../../config/theme';

/** 成交订单构成指标（六口径，与四台看板响应一致） */
export interface DealOrdersStats {
  /** 订单总数（全量，含已退款） */
  orderTotal: number;
  /** 成交订单数（已支付且未全额退款的有效交易） */
  dealOrders: number;
  /** 退单数（已全额退款） */
  refundedOrders: number;
  /** 成交率（成交 / 订单总数，%） */
  dealRate: number;
  /** 退单率（退单 / 订单总数，笔数口径，%） */
  returnRate: number;
  /** 退款率（退款金额 / 总支付金额，金额口径，%） */
  refundRate: number;
}

const int = (v: number) => (v ?? 0).toLocaleString('en-US');
const pct = (v: number) => `${(v ?? 0).toFixed(1)}%`;

/**
 * 成交订单构成面板（原型 .panel 网格）。
 * 2×3 小网格承载六指标：订单总数 / 成交订单数 / 成交率 / 退单数 / 退单率 / 退款率。
 * 退单相关用 down 色、成交相关用 up 色，与原型状态双角色一致。
 */
export const DealOrdersPanel = ({ stats }: { stats: DealOrdersStats }) => {
  const tiles: { label: string; value: string; tone: 'up' | 'down' | 'normal' }[] = [
    { label: '订单总数', value: int(stats.orderTotal), tone: 'normal' },
    { label: '成交订单数', value: int(stats.dealOrders), tone: 'up' },
    { label: '成交率', value: pct(stats.dealRate), tone: 'up' },
    { label: '退单数', value: int(stats.refundedOrders), tone: 'down' },
    { label: '退单率', value: pct(stats.returnRate), tone: 'down' },
    { label: '退款率', value: pct(stats.refundRate), tone: 'down' },
  ];
  return (
    <Panel title="成交订单构成" hint="已支付且未全额退单为有效成交 · 退单从成交统计冲减">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{
          gap: 1,
          background: T.border,
          border: `1px solid ${T.border}`,
          borderRadius: T.rMd,
          overflow: 'hidden',
        }}
      >
        {tiles.map((tile) => (
          <div key={tile.label} style={{ background: T.bg, padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: T.ink3 }}>{tile.label}</div>
            <div
              style={{
                fontSize: 23,
                fontWeight: 750,
                marginTop: 5,
                color:
                  tile.tone === 'up' ? T.upInk : tile.tone === 'down' ? T.downInk : T.ink1,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: T.fontNum,
              }}
            >
              {tile.value}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
};

export default DealOrdersPanel;
