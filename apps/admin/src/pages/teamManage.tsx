/**
 * 团队管理（原型 .rlist / 2026-09-23 由「团队与角色」拆分而出）
 *
 * 职责：本组织的**人员引入入口** —— 处理来自 web 端「入驻申请」加入隧道的申请队列。
 *      · 查看：弹窗回放用户申请单（字段与 web 端申请页一一对应）
 *      · 接收：生成组织内员工档案 OrgStaff，记录随即出现在「员工角色」页
 *              （身份仍是普通用户；定岗在审批侧，默认岗位取最小权限内置岗位）
 *      · 拒绝：必填拒绝详情，原样以站内业务消息投递给申请人
 *
 * 说明：本页面仅处理「加入」隧道；「入驻」（资格升级）由总台 ADMIN 审批。
 *      与 roles.tsx（员工角色）分工：前者管「进人」，后者管「已进人员的岗位与权限」。
 *
 * 三层共用：服务商 `/sp/team` 与代理商 `/agent/team` 走同一份实现，
 *           仅按当前视角切换 API 资源（provider/team | agent/team），保证两侧行为一致。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCan } from '@refinedev/core';
import { Button, Modal, Select, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';
import { type LayerKey } from '../config/permGroups';
import type { OrgType } from '../config/staffRoles';
import { roleOptionsOf } from './staffTeamPages';

/** 由路由路径判定当前视角（/agent → 代理商，其余按服务商处理） */
function useLayerContext(): { org: OrgType; layer: LayerKey; resource: string } {
  const { pathname } = useLocation();
  if (pathname.startsWith('/agent')) return { org: 'AGENT', layer: 'agent', resource: 'agent/team' };
  return { org: 'PROVIDER', layer: 'provider', resource: 'provider/team' };
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待接收',
  APPROVED: '已接收',
  REJECTED: '已拒绝',
  WITHDRAWN: '已撤回',
};

const statusTone = (s: string): { bg: string; fg: string } => {
  if (s === 'APPROVED') return { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' };
  if (s === 'REJECTED' || s === 'WITHDRAWN') return { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' };
  return { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' };
};

const statusPill = (s: string) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 999,
      padding: '1px 9px',
      fontSize: 12,
      fontWeight: 600,
      background: statusTone(s).bg,
      color: statusTone(s).fg,
    }}
  >
    {STATUS_TEXT[s] ?? s}
  </span>
);

const fmtTime = (v?: string | Date | null) =>
  v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—';

/** 队列数据 */
function useJoinQueue(resource: string) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({
        url: `${resource}/join-applications?status=ALL`,
        method: 'get',
      });
      const items = r?.data?.items ?? [];
      setRows(Array.isArray(items) ? items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [resource]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, loading, reload };
}

/** 查看：回放用户提交的申请单 */
function JoinViewModal({ open, record, onClose }: { open: boolean; record: any; onClose: () => void }) {
  if (!record) return null;
  const fields: { label: string; value: any }[] = [
    { label: '申请编号', value: record.code ?? record.id },
    { label: '申请类型', value: '加入（身份仍为普通用户）' },
    { label: '申请层次', value: record.orgType === 'AGENT' ? '代理商' : '服务商' },
    { label: '申请人', value: record.user?.realName || record.user?.nickname || '—' },
    { label: '手机号', value: record.user?.phone ?? '—' },
    { label: '所属区域', value: record.regionLabel ?? '—' },
    { label: '提交时间', value: fmtTime(record.createdAt) },
    { label: '状态', value: statusPill(record.status) },
    { label: '申请说明', value: record.reason ?? '—' },
  ];
  return (
    <Modal open={open} title="加入申请详情" onCancel={onClose} footer={null} width={560}>
      <dl style={{ display: 'grid', gridTemplateColumns: '92px 1fr', rowGap: 10, columnGap: 12, fontSize: 13 }}>
        {fields.map((f, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <dt style={{ color: T.ink3, margin: 0 }}>{f.label}</dt>
            <dd style={{ margin: 0, color: T.ink1, fontWeight: 600, wordBreak: 'break-all' }}>{f.value}</dd>
          </div>
        ))}
      </dl>
      <div style={{ marginTop: 18, textAlign: 'right' }}>
        <Button onClick={onClose}>{t('button.close', '关闭')}</Button>
      </div>
    </Modal>
  );
}

/** 拒绝：必填拒绝详情，内容投递到申请人「业务消息」 */
function RejectModal({
  open,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  const submit = () => {
    const v = note.trim();
    if (!v) {
      message.warning(t('team.rejectNoteRequired', '请填写拒绝详情'));
      return;
    }
    onSubmit(v);
  };
  return (
    <Modal open={open} title="拒绝详情" onCancel={onCancel} onOk={submit} confirmLoading={loading} okText="确认拒绝并反馈" cancelText={t('button.cancel', '取消')} okButtonProps={{ danger: true }}>
      <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 8 }}>
        填写的内容会作为业务消息投递给申请人，请写清拒绝原因。
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        maxLength={300}
        placeholder="例如：本团队当前排期已满，暂不接收新成员…"
        style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(74,60,42,0.16)', padding: 10, fontSize: 13 }}
      />
      <div style={{ marginTop: 4, textAlign: 'right', fontSize: 12, color: T.ink3 }}>{note.length} / 300</div>
    </Modal>
  );
}

export const TeamManagePage = () => {
  const { org, layer, resource } = useLayerContext();
  const { rows, loading, reload } = useJoinQueue(resource);

  // 写操作门控：复用 accessControlProvider 对 `*/team` 的判定（同员工角色页）
  const { data: canWrite } = useCan({ resource, action: 'create' });
  const writable = !!canWrite?.can;

  const [viewRec, setViewRec] = useState<any>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [staffRole, setStaffRole] = useState<string | undefined>(undefined);

  // 岗位下拉：默认取最小权限的内置岗位（与服务端 accept 的默认岗位同口径），
  // 由拥有者在接收时确认，细粒度权限随后在「员工角色」页调整。
  const roleOpts = useMemo(
    () => roleOptionsOf(org, undefined).map((r) => ({ value: r, label: r })),
    [org],
  );
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;

  const accept = async (id: string, idRole?: string) => {
    setActing(true);
    try {
      await dataProvider.custom!({
        url: `${resource}/join-applications/${id}/accept`,
        method: 'post',
        payload: idRole ? { staffRole: idRole } : {},
      });
      message.success(t('team.accepted', '已接收，成员已加入「员工角色」列表'));
      await reload();
    } catch (e: any) {
      message.error(e?.message || t('team.acceptFailed', '接收失败'));
    } finally {
      setActing(false);
      setStaffRole(undefined);
    }
  };

  const reject = async (note: string) => {
    if (!rejectId) return;
    setActing(true);
    try {
      await dataProvider.custom!({
        url: `${resource}/join-applications/${rejectId}/reject`,
        method: 'post',
        payload: { reviewNote: note },
      });
      message.success(t('team.rejected', '已拒绝，拒绝详情已发送给申请人'));
      setRejectOpen(false);
      setRejectId(null);
      await reload();
    } catch (e: any) {
      message.error(e?.message || t('team.rejectFailed', '拒绝失败'));
    } finally {
      setActing(false);
    }
  };

  const columns: any[] = [
    { title: t('team.colCode', '申请编号'), dataIndex: 'code', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: t('team.colApplicant', '申请人'), dataIndex: ['user'], width: 140, render: (_: any, r: any) => r.user?.realName || r.user?.nickname || '—' },
    { title: t('team.colPhone', '手机'), dataIndex: ['user', 'phone'], width: 140 },
    { title: t('team.colLayer', '申请层次'), dataIndex: 'orgType', width: 110, render: (v: string) => (v === 'AGENT' ? '代理商' : '服务商') },
    { title: t('team.colRegion', '所属区域'), dataIndex: 'regionLabel', width: 160, ellipsis: true, render: (v: string) => v ?? '—' },
    { title: t('team.colCreatedAt', '申请时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmtTime(v) },
    { title: t('col.status', '状态'), dataIndex: 'status', width: 100, render: (v: string) => statusPill(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 190,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <span onClick={() => setViewRec(r)} style={{ color: T.ink2, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
            {t('action.view', '查看')}
          </span>
          {writable && r.status === 'PENDING' && (
            <>
              <span
                onClick={() => Modal.confirm({
                  title: t('team.confirmAccept', '确认接收该申请？'),
                  content: (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 6 }}>{t('team.acceptNote', '接收后该用户即成为本团队成员，默认岗位如下（可在「员工角色」页调整权限）：')}</div>
                      <Select
                        style={{ width: '100%' }}
                        placeholder={t('team.defaultRole', '默认岗位')}
                        options={roleOpts}
                        onChange={(v) => setStaffRole(v)}
                      />
                    </div>
                  ),
                  okText: t('team.accept', '接收'),
                  cancelText: t('button.cancel', '取消'),
                  onOk: () => accept(r.id, staffRole),
                })}
                style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {t('team.accept', '接收')}
              </span>
              <span
                onClick={() => {
                  setRejectId(r.id);
                  setRejectOpen(true);
                }}
                style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {t('team.reject', '拒绝')}
              </span>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={t('team.manageTitle', '团队管理')}
        sub={t('team.manageSub', '申请员工消息队列 · 成员来源：web 端「入驻申请」加入隧道')}
        chip={layer === 'agent' ? '代理商 · 工作台' : '服务商 · 工作台'}
      />

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
        <span>
          {t('team.manageNotice', '「加入」仅建立团队成员关系，申请人身份仍是普通用户；资格升级（成为服务商 / 代理商）请走「入驻」由总台审批。')}
        </span>
      </div>

      <Panel
        title={t('team.queueTitle', '申请员工消息队列')}
        hint={
          <>
            {t('team.pendingCount', '待接收')} <b style={{ color: T.accent }}>{pendingCount}</b> {t('team.queueUnit', '条')} ·{' '}
            {t('team.totalCount', '累计')} <b>{rows.length}</b> {t('team.queueUnit', '条')}
            {!writable && <span style={{ color: T.ink3 }}> · {t('team.readonlyHint', '只读（需团队管理权限）')}</span>}
          </>
        }
      >
        <DataTable<any> rowKey="id" dataSource={rows} loading={loading} scroll={{ x: 1100 }} columns={columns} />
      </Panel>

      <JoinViewModal open={!!viewRec} record={viewRec} onClose={() => setViewRec(null)} />
      <RejectModal open={rejectOpen} loading={acting} onCancel={() => setRejectOpen(false)} onSubmit={reject} />
    </>
  );
};

export default TeamManagePage;
