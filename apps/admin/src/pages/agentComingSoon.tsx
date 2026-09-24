import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { t } from '../i18n/t';

/**
 * 代理商视角「即将上线」占位页（项目约定：未实现功能统一「该功能即将上线」占位）。
 * 用于本轮尚未落地后端端点的菜单项，保证导航不 404、结构完整。
 */
export const AgentComingSoon = ({ title }: { title?: string }) => (
  <>
    <PageHead
      title={title ?? t('pages.desc.comingSoon', '即将上线')}
      sub={t('pages.note.comingSoonHint', '该模块后端端点将在后续迭代落地')}
      chip="规划中"
    />
    <Panel title={title ?? t('pages.desc.comingSoon', '即将上线')}>
      <div
        style={{
          padding: '48px 0',
          textAlign: 'center',
          color: 'var(--t-ink-3, #8c8c8c)',
        }}
      >
        <div style={{ fontSize: 16, marginBottom: 8 }}>{t('pages.desc.comingSoon', '该功能即将上线')}</div>
        <div style={{ fontSize: 13 }}>
          {t('pages.note.comingSoonHint', '该模块后端端点将在后续迭代落地')}
        </div>
      </div>
    </Panel>
  </>
);
