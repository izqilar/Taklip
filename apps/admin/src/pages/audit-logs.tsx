import { useState } from 'react';
import { Typography } from 'antd';
import { GenericListPage } from '../components/GenericListPage';
import { ReviewModal } from '../components/ui/ReviewModal';
import { T } from '../config/theme';
import { t } from '../i18n/t';

const { Text } = Typography;

/** 动作码 → 中文标签 */
const ACTION_TEXT: Record<string, string> = {
  PROVIDER_APPROVE: '通过服务商',
  PROVIDER_REJECT: '驳回服务商',
  PROVIDER_EDIT: '编辑服务商资料',
  WITHDRAWAL_APPROVE: '批准提现',
  WITHDRAWAL_REJECT: '驳回提现',
};

/** 目标类型 → 中文标签 */
const TARGET_TEXT: Record<string, string> = {
  USER: '服务商/用户',
  WITHDRAWAL: '提现单',
};

const actionLabel = (a?: string) => (a ? ACTION_TEXT[a] ?? a : '—');
const targetLabel = (tt?: string) => (tt ? TARGET_TEXT[tt] ?? tt : '—');

/** 角色胶囊（原型 .pill 风格，复刻 StatusTag 的浅底深字双角色） */
const RolePill = ({ role }: { role?: string }) => (
  <span
    style={{
      fontSize: 12,
      padding: '1px 8px',
      borderRadius: 999,
      background: T.accent2Soft,
      color: T.accent2,
      whiteSpace: 'nowrap',
    }}
  >
    {role || '—'}
  </span>
);

const fmt = (v: any) =>
  v == null
    ? '—'
    : typeof v === 'object'
    ? JSON.stringify(v, null, 2)
    : String(v);

interface AuditRow {
  id: string;
  actorId?: string;
  actorRole?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  reason?: string | null;
  before?: any;
  after?: any;
  createdAt?: string;
}

/** 操作日志（运营端 · 系统设置）：全平台审核与关键操作留痕，只读查看 */
export const AuditLogList = () => {
  const [view, setView] = useState<AuditRow | null>(null);

  return (
    <>
      <GenericListPage
        title={t('menu.admin.auditLogs', { defaultValue: '操作日志' })}
        sub="全平台审核与关键操作留痕"
        chip="总台 · 系统"
        resource="admin/audit-logs"
        rowKey="id"
        pageSize={15}
        chipFilters={[
          { label: '全部', value: 'all' },
          {
            label: '服务商审核',
            value: 'provider',
            test: (r: AuditRow) => !!r.action && r.action.startsWith('PROVIDER_'),
          },
          {
            label: '提现审核',
            value: 'withdrawal',
            test: (r: AuditRow) => !!r.action && r.action.startsWith('WITHDRAWAL_'),
          },
          {
            label: '资料编辑',
            value: 'edit',
            test: (r: AuditRow) => r.action === 'PROVIDER_EDIT',
          },
        ]}
        searchable
        searchField={['reason', 'targetId', 'actorId']}
        searchPlaceholder="搜索理由 / 目标ID / 操作人…"
        columns={[
          {
            title: '操作时间',
            dataIndex: 'createdAt',
            width: 168,
            render: (v: string) =>
              v ? (
                new Date(v).toLocaleString('zh-CN', { hour12: false })
              ) : (
                '—'
              ),
          },
          {
            title: '操作人',
            dataIndex: 'actorId',
            width: 180,
            render: (_: any, r: AuditRow) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: T.fontNum }}>{r.actorId || '—'}</Text>
                <RolePill role={r.actorRole} />
              </span>
            ),
          },
          {
            title: '动作',
            dataIndex: 'action',
            width: 132,
            render: (v: string) => (
              <span style={{ color: T.ink1, fontWeight: 600 }}>{actionLabel(v)}</span>
            ),
          },
          {
            title: '目标',
            dataIndex: 'targetType',
            width: 160,
            render: (_: any, r: AuditRow) => (
              <span style={{ color: T.ink2 }}>
                {targetLabel(r.targetType)}
                <Text type="secondary" style={{ fontFamily: T.fontNum, marginLeft: 6 }}>
                  {r.targetId || ''}
                </Text>
              </span>
            ),
          },
          {
            title: '理由',
            dataIndex: 'reason',
            ellipsis: true,
            render: (v: string | null) =>
              v ? (
                <span style={{ color: T.ink2 }}>{v}</span>
              ) : (
                <span style={{ color: T.ink3 }}>—</span>
              ),
          },
        ]}
        rowActions={(r: AuditRow) => (
          <span
            onClick={() => setView(r)}
            style={{
              color: T.accent,
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            详情
          </span>
        )}
      />

      <ReviewModal
        open={!!view}
        tag="日志"
        title="操作详情"
        onClose={() => setView(null)}
        fields={
          view
            ? [
                { label: '操作时间', value: view.createdAt ? new Date(view.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—' },
                { label: '操作人', value: view.actorId || '—' },
                { label: '操作人角色', value: <RolePill role={view.actorRole} /> },
                { label: '动作', value: actionLabel(view.action) },
                { label: '目标类型', value: targetLabel(view.targetType) },
                { label: '目标ID', value: view.targetId || '—' },
                { label: '理由', value: view.reason || '—' },
                {
                  label: '变更前',
                  value: (
                    <pre style={{ margin: 0, fontSize: 12, maxHeight: 180, overflow: 'auto' }}>
                      {fmt(view.before)}
                    </pre>
                  ),
                },
                {
                  label: '变更后',
                  value: (
                    <pre style={{ margin: 0, fontSize: 12, maxHeight: 180, overflow: 'auto' }}>
                      {fmt(view.after)}
                    </pre>
                  ),
                },
              ]
            : []
        }
      />
    </>
  );
};

export default AuditLogList;
