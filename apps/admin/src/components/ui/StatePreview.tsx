import { Button } from 'antd';
import type { CSSProperties } from 'react';
import { T } from '../../config/theme';
import type { PreviewState } from '../../providers/layerContext';

const center: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  gap: 12,
  padding: '64px 20px',
  textAlign: 'center',
  color: T.ink2,
};

const Ic = ({ size = 40, d }: { size?: number; d: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    style={{ color: T.ink3, opacity: 0.6 }}
  >
    <path d={d} />
  </svg>
);

const D_EMPTY =
  'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,148,144Z';
const D_ERROR =
  'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z';

const Skeleton = ({ w = '100%' }: { w?: string }) => (
  <div
    style={{
      background: `linear-gradient(90deg,${T.panel2},${T.hover},${T.panel2})`,
      height: T.row,
      borderRadius: T.rSm,
      margin: '6px 16px',
      opacity: 0.8,
      width: w,
      maxWidth: `calc(100% - 32px)`,
    }}
  />
);

export interface StatePreviewProps {
  state: Exclude<PreviewState, 'data'>;
  onRetry?: () => void;
  onCreate?: () => void;
}

/**
 * 四态演示（原型 [data-state]）：空 / 加载 / 异常。
 * 由顶栏「空状态 / 加载态 / 异常态」按钮驱动，供验收与走查各态样式。
 */
export const StatePreview = ({ state, onRetry, onCreate }: StatePreviewProps) => {
  if (state === 'loading') {
    return (
      <div
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: T.rMd,
          overflow: 'hidden',
        }}
      >
        <div style={{ ...center, padding: '24px 0' }}>
          <div style={{ width: '100%' }}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton w="60%" />
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: T.rMd,
          overflow: 'hidden',
        }}
      >
        <div style={center}>
          <Ic d={D_ERROR} />
          <b style={{ color: T.ink1, fontSize: 15 }}>数据加载失败</b>
          <span style={{ color: T.ink3, fontSize: 13 }}>
            接口请求超时，可能是网络波动或服务暂不可用。请重试，或联系运维管理员。
          </span>
          <Button onClick={onRetry}>↻ 重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: T.rMd,
        overflow: 'hidden',
      }}
    >
      <div style={center}>
        <Ic d={D_EMPTY} />
        <b style={{ color: T.ink1, fontSize: 15 }}>暂无待处理数据</b>
        <span style={{ color: T.ink3, fontSize: 13 }}>
          当前筛选条件下没有记录。可切换筛选条件，或点击下方按钮创建第一条。
        </span>
        <Button type="primary" onClick={onCreate}>
          ＋ 新建
        </Button>
      </div>
    </div>
  );
};

export default StatePreview;
