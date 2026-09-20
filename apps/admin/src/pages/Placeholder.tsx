import { Button } from 'antd';
import { useGo } from '@refinedev/core';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { t } from '../i18n/t';

/**
 * 通用占位页：用于尚未实现的后台模块，避免点击菜单 404。
 * 严格遵守项目规范 —— 未实现功能统一以「该功能即将上线」占位，禁止伪造实现。
 */
export const PlaceholderPage = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const go = useGo();
  return (
    <>
      <PageHead title={title} chip="即将上线" />
      <Panel>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            gap: 12,
            padding: '64px 20px',
            textAlign: 'center',
            color: T.ink2,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 256 256"
            fill="currentColor"
            style={{ color: T.ink3, opacity: 0.6 }}
          >
            <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,148,144Z" />
          </svg>
          <b style={{ color: T.ink1, fontSize: 15 }}>{title}</b>
          <span style={{ color: T.ink3, fontSize: 13 }}>
            {description ?? t('pages.desc.comingSoon')}
          </span>
          <Button type="primary" onClick={() => go({ to: '/admin/dashboard' })}>
            返回首页
          </Button>
        </div>
      </Panel>
    </>
  );
};

export default PlaceholderPage;
