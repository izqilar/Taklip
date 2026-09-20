import { GRID, T } from '../../config/theme';
import { PageHead } from './PageHead';
import { todayKey } from '../../utility';

/**
 * 看板首屏骨架（原型 loading 态）。
 * 四层首页共用，保证加载期的标题层级与卡片占位与实际渲染一致，避免布局跳动。
 */
export const HomeSkeleton = ({ title, chip }: { title: string; chip?: string }) => (
  <>
    <PageHead title={title} chip={chip} />
    <div style={GRID.kpis}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: T.rMd,
            height: 104,
          }}
        />
      ))}
    </div>
  </>
);

export { todayKey };
export default HomeSkeleton;
