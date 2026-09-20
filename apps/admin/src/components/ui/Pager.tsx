import { Button } from 'antd';
import { T } from '../../config/theme';

export interface PagerProps {
  total: number;
  current?: number;
  pageSize?: number;
  onChange?: (page: number) => void;
}

/**
 * 分页条（原型 .pager）：右对齐「共 N 条 + 上一页 / 下一页」。
 * 与原型一致只提供上下页，不展示跳页器。
 */
export const Pager = ({ total, current = 1, pageSize = 10, onChange }: PagerProps) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '10px 16px',
        color: T.ink3,
        fontSize: 12.5,
        borderTop: `1px solid ${T.border}`,
      }}
    >
      <span>
        共{' '}
        <b style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum, color: T.ink1 }}>
          {total}
        </b>{' '}
        条
      </span>
      <Button
        size="small"
        disabled={current <= 1}
        onClick={() => onChange?.(current - 1)}
        style={{ padding: '3px 10px', fontSize: 12 }}
      >
        ‹ 上一页
      </Button>
      <span style={{ color: T.ink3 }}>
        {current} / {pages}
      </span>
      <Button
        size="small"
        disabled={current >= pages}
        onClick={() => onChange?.(current + 1)}
        style={{ padding: '3px 10px', fontSize: 12 }}
      >
        下一页 ›
      </Button>
    </div>
  );
};

export default Pager;
