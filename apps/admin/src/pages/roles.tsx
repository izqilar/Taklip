import { useState } from 'react';
import { layerDomains, type LayerKey } from '../config/permGroups';
import { StatusTag } from '../components/common/StatusTag';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pill } from '../components/ui/Pill';
import { ReviewModal } from '../components/ui/ReviewModal';
import { T } from '../config/theme';
import { t } from '../i18n/t';

/**
 * 内置角色（与后端 RBAC 枚举一致）。
 * 当前无 Role 持久化模型，本页为「真实只读视图」：
 * 角色定义 / 层级 / 数据作用域 / 功能权限域均取自 permGroups.ts（系统权威来源），
 * 编辑保存需后端 Role 模型 + 迁移，规划中，不伪造实现。
 */
interface BuiltinRole {
  key: string;
  name: string;
  layer: LayerKey;
  layerLabel: string;
  scope: string;
  scopeLabel: string;
}

const BUILTIN_ROLES: BuiltinRole[] = [
  { key: 'ADMIN', name: t("pages.col.consoleAdmin"), layer: 'console', layerLabel: t("pages.lbl.console"), scope: 'ALL', scopeLabel: t("pages.lbl.full") },
  { key: 'AGENT', name: t("pages.col.agent"), layer: 'agent', layerLabel: t("pages.col.agent"), scope: 'REGION', scopeLabel: t("pages.field.jurisdiction") },
  { key: 'SERVICE_PROVIDER', name: t("pages.col.provider"), layer: 'provider', layerLabel: t("pages.col.provider"), scope: 'SELF', scopeLabel: t("pages.col.self") },
  { key: 'USER', name: t("pages.col.normalUser"), layer: 'user', layerLabel: t("pages.col.user"), scope: 'SELF', scopeLabel: t("pages.col.self") },
];

const actLink = (label: string, color: string, onClick: () => void) => (
  <span onClick={onClick} style={{ fontSize: 13, cursor: 'pointer', color, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

/** 角色与权限（原型 总台 · 系统）：角色分层治理，只读视图 */
export const RolesPage = () => {
  const [current, setCurrent] = useState<BuiltinRole | null>(null);

  return (
    <>
      <PageHead
        title={t('menu.admin.roles')}
        sub="角色分层治理 · 权限位阶由权限组配置（系统权威来源）驱动"
        chip="总台 · 系统"
      />

      {/* 只读说明条（原型 .notice，青底） */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '11px 14px',
          borderRadius: T.rMd,
          background: T.accent2Soft,
          color: T.accent2,
          fontSize: 13,
        }}
      >
        <span>{t("pages.sec.builtinRoleReadonly")}：{t("pages.note.roleFromRBAC")}</span>
      </div>

      <Panel
        title={<span>{t('menu.admin.roles')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{BUILTIN_ROLES.length}</b> 个内置角色 · 数据隔离由后端强制
          </>
        }
      >
        <DataTable<BuiltinRole>
          rowKey="key"
          dataSource={BUILTIN_ROLES}
          scroll={{ x: 800 }}
          columns={[
            {
              title: t("pages.field.role"),
              dataIndex: 'name',
              width: 140,
              render: (_: any, r: BuiltinRole) => (
                <span style={{ fontWeight: 600 }}>{r.name}</span>
              ),
            },
            { title: t("pages.col.ownerLayer"), dataIndex: 'layerLabel', width: 120 },
            {
              title: t("pages.col.dataScope"),
              dataIndex: 'scopeLabel',
              width: 140,
              render: (_: any, r: BuiltinRole) => <Pill tone="ac">{r.scopeLabel}</Pill>,
            },
            {
              title: t("pages.col.funcPermDomain"),
              key: 'domain',
              render: (_: any, r: BuiltinRole) => {
                const ds = layerDomains(r.layer);
                return (
                  <span style={{ color: T.ink3 }}>
                    {ds.length} 域 / {ds.reduce((n, d) => n + d.points.length, 0)} 点
                  </span>
                );
              },
            },
            {
              title: t("pages.col.type"),
              dataIndex: 'key',
              width: 110,
              render: () => <StatusTag value="BUILTIN" />,
            },
            {
              title: t("pages.col.action"),
              key: 'op',
              width: 72,
              render: (_: any, r: BuiltinRole) => (
                <div style={{ display: 'flex', gap: 12 }}>
                  {actLink('查看', T.ink2, () => setCurrent(r))}
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <ReviewModal
        open={!!current}
        tag="角色"
        title={current ? `${t('pages.col.roleDetail')} · ${current.name}` : t('pages.col.roleDetail')}
        onClose={() => setCurrent(null)}
        fields={
          current
            ? [
                { label: t("pages.col.roleName"), value: current.name },
                { label: t("pages.col.ownerLayer"), value: current.layerLabel },
                {
                  label: t("pages.col.dataScope"),
                  value: <Pill tone="ac">{current.scopeLabel}</Pill>,
                },
                { label: t("pages.col.type"), value: <StatusTag value="BUILTIN" /> },
              ]
            : []
        }
      />
    </>
  );
};

export default RolesPage;
