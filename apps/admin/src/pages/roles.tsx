import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useCan } from '@refinedev/core';
import { Button, Drawer, Form, Input, Select, AutoComplete, Checkbox, Modal, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { PermCheckGroup } from '../components/detail/PermCheckGroup';
import { MemberCard } from '../components/provider/SettingPage';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';
import { SVC_OPTIONS, TEAM_STATUS } from '../config/providerConstants';
import {
  staffRoleMetaOf,
  teamRolesOf,
  teamDutiesOf,
  teamTraitOf,
  SCOPE_OPTS_BY_ORG,
  SCOPE_TEXT,
  type OrgType,
} from '../config/staffRoles';
import { type LayerKey } from '../config/permGroups';
import { PermGraph } from '../components/perm/PermGraph';
import {
  StaffAuditTimeline,
  statusPill,
  permKeysOf,
  roleOptionsOf,
  dutyOptionsOf,
  PermCheckGroupWrap,
  ORG_LAYER,
} from './staffTeamPages';

/* ══════════════════ 视角识别 ══════════════════ */

const CHIP: Record<LayerKey, string> = {
  console: '总台 · 系统',
  agent: '代理商 · 系统',
  provider: '服务商 · 系统',
  user: '用户 · 系统',
};

/** 由路由路径判定当前视角（/admin → 总台，/agent → 代理商，/sp → 服务商） */
function useLayerContext(): { org: OrgType; layer: LayerKey; resource: string } {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return { org: 'CONSOLE', layer: 'console', resource: 'admin/team' };
  if (pathname.startsWith('/agent')) return { org: 'AGENT', layer: 'agent', resource: 'agent/team' };
  return { org: 'PROVIDER', layer: 'provider', resource: 'provider/team' };
}

/* ══════════════════ 员工列表数据 ══════════════════ */

function useStaffList(resource: string) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!resource) return;
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: `${resource}?pageSize=200`, method: 'get' });
      const items: any[] = r?.data?.items ?? r?.data ?? [];
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

/* ══════════════════ 新建 / 编辑抽屉（角色权限建立页面，按层严格限定范围） ══════════════════ */

const FIELD_LABEL = { fontSize: 12.5, color: T.ink2, fontWeight: 600, marginBottom: 6 } as const;

function StaffFormDrawer({
  open,
  mode,
  org,
  resource,
  record,
  withServiceType,
  prefillPerms,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  org: OrgType;
  resource: string;
  record?: any;
  /** 服务商层展示「服务类型」并联动岗位池 / 职责 / 特长 */
  withServiceType?: boolean;
  /** 从权限图谱点击权限点带入的预填功能权限（仅新建模式生效） */
  prefillPerms?: string[] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState<any>({});

  const serviceType = vals.serviceType ?? (withServiceType ? SVC_OPTIONS[0]?.value : undefined);
  const role = vals.staffRole;
  const roleOpts = useMemo(() => roleOptionsOf(org, serviceType), [org, serviceType]);
  const dutyOpts = useMemo(() => dutyOptionsOf(org, serviceType, role), [org, serviceType, role]);
  const permKeys = useMemo(() => permKeysOf(org), [org]);
  const scopeOpts = SCOPE_OPTS_BY_ORG[org];

  useEffect(() => {
    if (!open) return;
    const initSvc = withServiceType ? SVC_OPTIONS[0]?.value : undefined;
    if (mode === 'edit' && record) {
      const init: any = {
        name: record.name,
        phone: record.phone,
        accountStatus: record.accountStatus || 'ACTIVE',
        staffRole: record.staffRole ?? record.teamRole,
        duties: record.duties ?? [],
        funcPerms: record.funcPerms ?? [],
        dataScope: record.dataScope || 'self',
        personality: record.personality || '',
      };
      if (withServiceType) init.serviceType = record.serviceType ?? initSvc;
      form.setFieldsValue(init);
      setVals(init);
    } else {
      const initRole = roleOptionsOf(org, initSvc)[0];
      const meta = staffRoleMetaOf(org, initRole);
      const seedPerms = Array.from(
        new Set<string>([...(meta?.perms ?? []), ...(prefillPerms ?? [])]),
      );
      const init: any = {
        accountStatus: 'ACTIVE',
        staffRole: initRole,
        duties: dutyOptionsOf(org, initSvc, initRole),
        funcPerms: seedPerms,
        dataScope: meta?.dataScope ?? 'self',
      };
      if (withServiceType) {
        init.serviceType = initSvc;
        init.personality = teamTraitOf(initSvc);
      }
      form.setFieldsValue(init);
      setVals(init);
    }
    // 依赖中刻意不含 roleOpts/serviceType：否则切换服务类型会触发重算 → 整个表单被重置
  }, [open, mode, record, org, withServiceType, form, prefillPerms]);

  const onValuesChange = (changed: any, all: any) => {
    // 服务类型变更：重置岗位 / 职责，预填特长（岗位池随服务类型联动）
    if (changed.serviceType) {
      const svc = changed.serviceType;
      const nextRoles = teamRolesOf(svc);
      const nextRole = nextRoles.includes(all.staffRole) ? all.staffRole : nextRoles[0];
      const meta = staffRoleMetaOf(org, nextRole);
      const patch = {
        staffRole: nextRole,
        duties: teamDutiesOf(svc),
        personality: teamTraitOf(svc),
        funcPerms: meta?.perms ?? [],
        dataScope: meta?.dataScope ?? 'self',
      };
      form.setFieldsValue(patch);
      setVals({ ...all, ...patch, serviceType: svc });
      return;
    }
    if (changed.staffRole) {
      const meta = staffRoleMetaOf(org, changed.staffRole);
      const patch: any = { duties: dutyOptionsOf(org, all.serviceType, changed.staffRole) };
      if (meta) {
        patch.funcPerms = meta.perms;
        patch.dataScope = meta.dataScope;
      }
      form.setFieldsValue(patch);
      setVals({ ...all, ...patch });
      return;
    }
    setVals(all);
  };

  const save = async () => {
    let v: any;
    try {
      v = await form.validateFields();
    } catch {
      message.warning(t('pages.msg.fixForm', '请先修正表单中的校验项'));
      return;
    }
    setSaving(true);
    const payload = {
      name: (v.name ?? '').trim(),
      phone: (v.phone ?? '').trim(),
      accountStatus: v.accountStatus || 'ACTIVE',
      serviceType: withServiceType ? (v.serviceType || '') : undefined,
      staffRole: (v.staffRole ?? '').trim(),
      duties: v.duties ?? [],
      funcPerms: v.funcPerms ?? [],
      dataScope: v.dataScope || 'self',
      personality: v.personality || '',
    };
    try {
      if (mode === 'edit' && record) {
        await dataProvider.custom!({ url: `${resource}/${record.id}`, method: 'patch', payload });
        message.success(t('pages.team.saved', '成员已更新'));
      } else {
        await dataProvider.custom!({ url: resource, method: 'post', payload });
        message.success(t('pages.team.created', '成员已添加'));
      }
      onSaved();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.msg.saveFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={mode === 'edit' ? t('pages.team.editMember', '编辑成员') : t('pages.team.createMember', '新建成员')}
      open={open}
      onClose={onClose}
      width={540}
      destroyOnClose
      footer={
        <>
          <Button onClick={onClose}>{t('pages.action.cancel', '取消')}</Button>
          <Button type="primary" loading={saving} onClick={save}>
            {t('pages.team.save', '保存')}
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onValuesChange={onValuesChange} style={{ marginTop: 8 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 14 }}>
          <div>
            <div style={FIELD_LABEL}>{t('pages.team.name', '成员姓名')}</div>
            <Form.Item name="name" noStyle rules={[{ required: true, message: t('pages.msg.requiredName', '请填写成员姓名') }]}>
              <Input placeholder={t('pages.team.namePlaceholder', '如：古丽娜尔')} />
            </Form.Item>
          </div>
          <div>
            <div style={FIELD_LABEL}>{t('pages.team.phone', '手机号')}</div>
            <Form.Item
              name="phone"
              noStyle
              rules={[
                { required: true, message: t('pages.msg.requiredPhone', '请填写手机号') },
                { pattern: /^\d{11}$/, message: t('pages.msg.phoneFormat', '须为 11 位数字') },
              ]}
            >
              <Input placeholder="11 位手机号" maxLength={11} />
            </Form.Item>
          </div>
          <div>
            <div style={FIELD_LABEL}>{t('pages.team.accountStatus', '账号状态')}</div>
            <Form.Item name="accountStatus" noStyle>
              <Select options={Object.entries(TEAM_STATUS).map(([v, m]) => ({ value: v, label: t(m.key) }))} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          {withServiceType && (
            <div>
              <div style={FIELD_LABEL}>{t('pages.team.serviceType', '服务类型')}</div>
              <Form.Item name="serviceType" noStyle>
                <Select options={SVC_OPTIONS} showSearch optionFilterProp="label" style={{ width: '100%' }} />
              </Form.Item>
            </div>
          )}
          <div>
            <div style={FIELD_LABEL}>{t('pages.team.role', '团队角色')}</div>
            <Form.Item name="staffRole" noStyle rules={[{ required: true, message: t('pages.msg.requiredRole', '请填写或选择岗位') }]}>
              <AutoComplete
                options={roleOpts.map((r) => ({ value: r, label: r }))}
                filterOption={(input, option) => String(option?.value ?? '').includes(input)}
                placeholder={t('pages.team.rolePlaceholder', '可选择或自行填写岗位')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
          <div>
            <div style={FIELD_LABEL}>{t('pages.team.dataScope', '数据权限')}</div>
            <Form.Item name="dataScope" noStyle>
              <Select options={scopeOpts.map((o) => ({ value: o.value, label: t(o.labelKey) }))} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </div>

        {dutyOpts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={FIELD_LABEL}>{t('pages.team.duties', '职责')}</div>
            <Form.Item name="duties" noStyle>
              <Checkbox.Group options={dutyOpts.map((d) => ({ value: d, label: d }))} />
            </Form.Item>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={FIELD_LABEL}>{t('pages.team.trait', '特长')}</div>
          <Form.Item name="personality" noStyle>
            <Input placeholder={t('pages.team.traitPlaceholder', '可修改')} />
          </Form.Item>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={FIELD_LABEL}>{t('pages.team.funcPerms', '功能权限')}</div>
          <Form.Item name="funcPerms" noStyle>
            <PermCheckGroupWrap layer={ORG_LAYER[org]} keys={permKeys} />
          </Form.Item>
          <div style={{ fontSize: 11, color: T.ink3, marginTop: 6 }}>
            {t('pages.team.scopeHint', '权限范围已按当前层级严格限定，红线权限不可授予。')}
          </div>
        </div>
      </Form>
    </Drawer>
  );
}

/* ══════════════════ 查看抽屉（含操作时间线） ══════════════════ */

function StaffDetailDrawer({
  open,
  org,
  resource,
  record,
  withServiceType,
  writable,
  onClose,
  onChanged,
}: {
  open: boolean;
  org: OrgType;
  resource: string;
  record?: any;
  withServiceType?: boolean;
  /** 是否具备团队写权限（停用 / 移除同样是写操作） */
  writable?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rec, setRec] = useState<any>(record);
  const [audit, setAudit] = useState<any[]>([]);
  const [auditDenied, setAuditDenied] = useState(false);

  useEffect(() => {
    if (!open || !record) return;
    setRec(record);
    setAudit([]);
    setAuditDenied(false);
    dataProvider
      .custom!({ url: `${resource}/${record.id}/audit-logs`, method: 'get' })
      .then((au: any) => setAudit(Array.isArray(au?.data) ? au.data : []))
      .catch((e: any) => {
        if (e?.response?.status === 403) setAuditDenied(true);
      });
  }, [open, record, resource]);

  const toggleStatus = async () => {
    if (!rec) return;
    const next = rec.accountStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    try {
      const r: any = await dataProvider.custom!({ url: `${resource}/${rec.id}`, method: 'patch', payload: { accountStatus: next } });
      setRec(r?.data ?? { ...rec, accountStatus: next });
      message.success(next === 'DISABLED' ? t('pages.team.disabled', '成员已停用') : t('pages.team.enabled', '成员已启用'));
      onChanged();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.msg.saveFailed', '保存失败'));
    }
  };

  const remove = async () => {
    if (!rec) return;
    try {
      await dataProvider.custom!({ url: `${resource}/${rec.id}`, method: 'delete' });
      message.success(t('pages.team.removed', '成员已移除'));
      onChanged();
      onClose();
    } catch (e: any) {
      message.error(e?.message || t('pages.msg.removeFailed', '移除失败'));
    }
  };

  const Line = ({ k, v }: { k: string; v: ReactNode }) => (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ color: T.ink3, flex: 'none', width: 64 }}>{k}</span>
      <span style={{ color: T.ink1, fontWeight: 500 }}>{v}</span>
    </div>
  );

  return (
    <Drawer
      title={t('pages.team.memberDetail', '成员详情')}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
      footer={
        <>
          <Button onClick={onClose}>{t('pages.action.back', '返回')}</Button>
          {writable && (
            <>
              <Button onClick={toggleStatus}>
                {rec?.accountStatus === 'DISABLED' ? t('pages.team.enable', '启用成员') : t('pages.team.disable', '停用成员')}
              </Button>
              <Button danger onClick={remove}>{t('pages.team.remove', '移除成员')}</Button>
            </>
          )}
        </>
      }
    >
      {rec && (
        <>
          <MemberCard
            name={rec.name}
            memberNo={rec.memberNo}
            serviceType={rec.serviceType}
            teamRole={rec.staffRole ?? rec.teamRole}
            status={rec.accountStatus ? t(TEAM_STATUS[rec.accountStatus]?.key ?? rec.accountStatus) : '—'}
            phone={rec.phone}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 14, marginTop: 16 }}>
            <Line k={t('pages.team.colMemberNo', '成员编号')} v={rec.memberNo} />
            <Line k={t('pages.team.name', '姓名')} v={rec.name} />
            <Line k={t('pages.team.phone', '手机号')} v={rec.phone} />
            {withServiceType && <Line k={t('pages.team.serviceType', '服务类型')} v={rec.serviceType || '—'} />}
            <Line k={t('pages.team.role', '团队角色')} v={rec.staffRole ?? (rec.teamRole || '—')} />
            <Line k={t('pages.team.dataScope', '数据权限')} v={SCOPE_TEXT[rec.dataScope] ?? (rec.dataScope || '—')} />
            <Line k={t('pages.team.accountStatus', '账号状态')} v={rec.accountStatus ? t(TEAM_STATUS[rec.accountStatus]?.key ?? rec.accountStatus) : '—'} />
            <Line k={t('pages.team.duties', '职责')} v={Array.isArray(rec.duties) && rec.duties.length ? rec.duties.join('、') : '—'} />
            <Line k={t('pages.team.trait', '特长')} v={rec.personality || '—'} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={FIELD_LABEL}>{t('pages.team.funcPerms', '功能权限')}</div>
            <PermCheckGroup layer={ORG_LAYER[org]} keys={permKeysOf(org)} checkedKeys={rec.funcPerms ?? []} disabled />
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={FIELD_LABEL}>{t('pages.team.auditTitle', '操作时间线')}</div>
            <StaffAuditTimeline items={audit} denied={auditDenied} />
          </div>
        </>
      )}
    </Drawer>
  );
}

/* ══════════════════ 主页面 ══════════════════ */

export const RolesPage = () => {
  const { org, layer, resource } = useLayerContext();

  // 三层统一：员工管理全部收口到本页（服务商层额外带「服务类型」工种概念）
  const withServiceType = org === 'PROVIDER';
  const { rows, loading, reload } = useStaffList(resource);

  // 写操作门控：复用 accessControlProvider 对 `*/team` 的判定
  // （该层拥有者天然可写；员工须持 team:manage，否则只给「查看」，避免点了才 403）
  const { data: canWrite } = useCan({ resource, action: 'create' });
  const writable = !!canWrite?.can;

  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<string[] | null>(null);
  const [editRec, setEditRec] = useState<any>(null);
  const [detailRec, setDetailRec] = useState<any>(null);

  const empColumns: any[] = [
    { title: t('pages.team.colMemberNo', '成员编号'), dataIndex: 'memberNo', width: 120 },
    { title: t('pages.team.colName', '姓名'), dataIndex: 'name', width: 110 },
    { title: t('pages.team.colPhone', '手机'), dataIndex: 'phone', width: 140 },
    ...(withServiceType
      ? [{ title: t('pages.team.serviceType', '服务类型'), dataIndex: 'serviceType', ellipsis: true }]
      : []),
    {
      title: t('pages.team.role', '团队角色'),
      dataIndex: 'teamRole',
      width: 130,
      ellipsis: true,
      render: (v: any, r: any) => v ?? r.staffRole ?? '—',
    },
    {
      title: t('pages.team.dataScope', '数据权限'),
      dataIndex: 'dataScope',
      width: 110,
      render: (v: any) => SCOPE_TEXT[v] ?? v ?? '—',
    },
    {
      title: t('pages.team.funcPerms', '功能权限'),
      dataIndex: 'funcPerms',
      width: 110,
      render: (v: any) => (Array.isArray(v) && v.length ? `${v.length} 项` : '—'),
    },
    { title: t('pages.col.status', '账号状态'), dataIndex: 'accountStatus', width: 100, render: (v: any) => statusPill(v) },
    {
      title: t('pages.col.action', '操作'),
      key: 'op',
      width: 170,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <span onClick={() => setDetailRec(r)} style={{ color: T.ink2, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
            {t('pages.action.view', '查看')}
          </span>
          {writable && (
            <>
              <span onClick={() => setEditRec(r)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                {t('pages.action.edit', '编辑')}
              </span>
              <span
                onClick={() =>
                  Modal.confirm({
                    title: t('pages.team.confirmRemove', '确认移除该成员？'),
                    content: `${r.name}（${r.memberNo ?? ''}）`,
                    okText: t('pages.action.delete', '删除'),
                    okType: 'danger',
                    cancelText: t('pages.action.cancel', '取消'),
                    onOk: async () => {
                      try {
                        await dataProvider.custom!({ url: `${resource}/${r.id}`, method: 'delete' });
                        message.success(t('pages.team.removed', '成员已移除'));
                        reload();
                      } catch (e: any) {
                        message.error(e?.message || t('pages.msg.removeFailed', '移除失败'));
                      }
                    },
                  })
                }
                style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {t('pages.action.delete', '删除')}
              </span>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      // 2026-09-23 拆分：本页定位为组织内「员工角色」；「团队管理」（加入申请队列）
      // 已独立为 /sp/team、/agent/team。总台层仍沿用既有「角色与权限」标题。
      <PageHead title={org === 'CONSOLE' ? t('menu.admin.roles') : '员工角色'} sub="角色分层治理 · 权限位阶由权限组配置（系统权威来源）驱动" chip={CHIP[layer]} />

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
        <span>{t('pages.sec.builtinRoleReadonly')}：{t('pages.note.roleFromRBAC')}</span>
      </div>

      <Panel
        title={t('pages.permGraph.title', '权限图谱')}
        hint={
          <>
            {t('pages.note.layerScoped', '仅显示当前分层')} · {t('pages.note.roleIsolated', '数据隔离由后端强制')} ·{' '}
            {t('pages.permGraph.hint', '点击权限点可预填到新建成员')}
          </>
        }
      >
        <PermGraph
          layer={layer}
          org={org}
          onCreateWithPerms={(perms) => {
            setCreatePrefill(perms);
            setCreateOpen(true);
          }}
        />
      </Panel>

      {/* 员工团队（三层统一收口到本页；按当前分层隔离，仅显示本层记录） */}
      <Panel
        title={t('pages.team.employeeTeam', '员工团队')}
        hint={
          <>
            {t('pages.note.layerScoped', '仅显示当前分层')} · {t('pages.note.memberCount', '共')}{' '}
            <b style={{ color: T.accent }}>{rows.length}</b> {t('pages.note.memberUnit', '名')}
            {!writable && (
              <span style={{ color: T.ink3 }}> · {t('pages.team.readonlyHint', '只读（需团队管理权限）')}</span>
            )}
          </>
        }
      >
        {writable && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              {t('pages.team.create', '＋ 新建成员')}
            </Button>
          </div>
        )}
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 960 }}
          columns={empColumns}
        />
      </Panel>

      <>
        <StaffFormDrawer
          open={createOpen}
          mode="create"
          org={org}
          resource={resource}
          withServiceType={withServiceType}
          prefillPerms={createPrefill}
          onClose={() => {
            setCreateOpen(false);
            setCreatePrefill(null);
          }}
          onSaved={reload}
        />
        <StaffFormDrawer
          open={!!editRec}
          mode="edit"
          org={org}
          resource={resource}
          record={editRec}
          withServiceType={withServiceType}
          onClose={() => setEditRec(null)}
          onSaved={reload}
        />
        <StaffDetailDrawer
          open={!!detailRec}
          org={org}
          resource={resource}
          record={detailRec}
          withServiceType={withServiceType}
          writable={writable}
          onClose={() => setDetailRec(null)}
          onChanged={reload}
        />
      </>
    </>
  );
};

export default RolesPage;
