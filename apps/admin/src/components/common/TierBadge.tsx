import { T } from '../../config/theme';
import { t } from '../../i18n/t';

type TierKind = 'agent' | 'provider';

interface TierPalette {
  bg: string;
  ink: string;
  border: string;
}

/**
 * 牌级配色（与中国传统五金牌级对应，区别于用户 VIP「卡级」红金系）：
 *  L0 灰（见习/新锐）→ L1 铜 → L2 银 → L3 金 → L4 钻（青蓝）
 * 文案走 i18n（pages.tier.{kind}.L{n}），缺失回退到键对应的中文名（已入库）。
 */
const TIER_PALETTE: Record<number, TierPalette> = {
  0: { bg: '#eef0f3', ink: '#6e5f4a', border: 'rgba(42,33,24,.08)' },
  1: { bg: '#f6ece3', ink: '#b06a3b', border: 'rgba(176,106,59,.28)' },
  2: { bg: '#eef1f6', ink: '#707a8c', border: 'rgba(112,122,140,.30)' },
  3: { bg: '#fbf3df', ink: '#b07d10', border: 'rgba(176,125,16,.32)' },
  4: { bg: '#e6f4f9', ink: '#1f8fb0', border: 'rgba(31,143,176,.32)' },
};

export function TierBadge({
  kind,
  tier,
  size = 'md',
}: {
  kind: TierKind;
  tier: number;
  size?: 'sm' | 'md';
}) {
  const level = Math.max(0, Math.min(4, Math.trunc(tier) || 0));
  const c = TIER_PALETTE[level] ?? TIER_PALETTE[0];
  const name = t(`pages.tier.${kind}.L${level}`);
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: size === 'sm' ? 18 : 22,
        padding: size === 'sm' ? '0 7px' : '0 9px',
        borderRadius: 999,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 600,
        lineHeight: 1,
        background: c.bg,
        color: c.ink,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  );
}

export default TierBadge;
