import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { t } from '../i18n/t';

/**
 * 总台治理模块占位页（Phase 0）。
 * 复用 AgentComingSoon 的「该功能即将上线」语义，并在 Panel 内以灰态子栏目卡片
 * 展示规划结构（仅栏目名、无数据），使菜单/布局可见且不伪造实现。
 * 后续接后端阶段（Phase 1–4）按 resources.tsx 注释的「复用参考」迁移为真实页面。
 */
export const AdminModulePlaceholder = ({
  title,
  sections,
}: {
  title: string;
  sections: string[];
}) => (
  <>
    <PageHead
      title={title}
      sub={t('pages.note.comingSoonHint', '该模块后端端点将在后续迭代落地')}
      chip="总台 · 全盘治理"
    />
    <Panel title={title}>
      {sections.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {sections.map((s) => (
            <div
              key={s}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--t-panel-3, #f5f3f1)',
                border: '1px solid var(--t-border, #ececec)',
                color: 'var(--t-ink-3, #8c8c8c)',
                fontSize: 13.5,
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          padding: '40px 0',
          textAlign: 'center',
          color: 'var(--t-ink-3, #8c8c8c)',
        }}
      >
        <div style={{ fontSize: 16, marginBottom: 8 }}>
          {t('pages.desc.comingSoon', '该功能即将上线')}
        </div>
        <div style={{ fontSize: 13 }}>
          {t('pages.note.comingSoonHint', '该模块后端端点将在后续迭代落地')}
        </div>
      </div>
    </Panel>
  </>
);
