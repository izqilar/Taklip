import { useLayer } from '../../providers/layerContext';
import { T } from '../../config/theme';

/**
 * 只读模式横幅（原型 .notice.ro）：琥珀底 + 深琥珀字，带锁形图标。
 * 文档 §4.3：只读下可查看全部数据，写操作（通过/驳回/编辑/调整）已锁定。
 */
export const ReadonlyBanner = () => {
  const { readonly } = useLayer();
  if (!readonly) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '11px 14px',
        borderRadius: T.rMd,
        background: T.warnBg,
        color: T.warnInk,
        fontSize: 13,
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 256 256"
        fill="currentColor"
        style={{ marginTop: 2, flex: 'none' }}
      >
        <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
      </svg>
      <span>
        当前为 <b>运维管理员（只读）</b>{' '}
        视角：可查看全部数据，操作（通过/驳回/编辑/调整）已锁定，后端将拒绝非 GET 请求（403）；
        如须代操作，请切换为超级管理员或由管理员单独授权。
      </span>
    </div>
  );
};

export default ReadonlyBanner;
