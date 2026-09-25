import type { ReactNode } from 'react';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';

export interface PageHeadProps {
  /** 主标题（原型 .pghead h2，18px/750） */
  title: ReactNode;
  /** 副标题（原型 .sub，13px 弱文） */
  sub?: ReactNode;
  /** 右侧角色标签（原型 .rolechip，青底青字） */
  chip?: ReactNode;
  /** 自定义右侧区域（与 chip 互斥优先） */
  extra?: ReactNode;
  /** 左侧返回入口；提供则在标题前渲染一个键盘可达的返回箭头 */
  onBack?: () => void;
}

/**
 * 页面头（原型 .pghead）：主标题 + 副标题 + 右侧角色标签。
 * 四层所有页面统一使用它，保证标题层级与间距一致。
 */
export const PageHead = ({ title, sub, chip, extra, onBack }: PageHeadProps) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
    {onBack != null && (
      <span
        role="button"
        aria-label={t('common.back', '返回')}
        tabIndex={0}
        onClick={onBack}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onBack();
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: T.rSm,
          border: `1px solid ${T.border}`,
          color: T.ink2,
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          flex: '0 0 auto',
        }}
      >
        ←
      </span>
    )}
    <div style={{ minWidth: 0 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 750, color: T.ink1 }}>{title}</h2>
      {sub != null && (
        <div style={{ color: T.ink3, fontSize: 13, marginTop: 2 }}>{sub}</div>
      )}
    </div>
    <span style={{ marginLeft: 'auto' }} />
    {extra}
    {chip != null && (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          padding: '3px 10px',
          borderRadius: 999,
          background: T.accent2Soft,
          color: T.accent2,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {chip}
      </span>
    )}
  </div>
);

export default PageHead;
