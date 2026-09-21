/**
 * 组织内员工（我的团队）—— 三层（服务商 / 代理商 / 总台）同构页面。
 *
 * 文档：`docs/平台角色边界规范化.md`
 * 设计要点：
 *  - 岗位（staffRole）用 **AutoComplete**：选项来自岗位池，同时允许自填。
 *    原因是存量数据已是自由文本，严格 Select 会让旧值显示为空（文档 §2.2 冲突 2）。
 *  - 服务商层岗位池**随服务类型联动**（原型 `UI_Design/index.html:4691`），
 *    切换服务类型时重置岗位 / 职责并预填特长（trait）。
 *  - 功能权限用 `PermCheckGroup` 复选框，按层过滤：服务商为原型 8 项，
 *    代理商 / 总台为该层可见域全集（已裁红线禁止项）。
 *  - 数据范围按层白名单（self / service / provider / region / agent / all），
 *    服务端二次校验，非法值 400。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Select, AutoComplete, Checkbox, Button, message } from 'antd';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';
import { SettingPage, MemberCard } from '../components/provider/SettingPage';
import { GenericListPage } from '../components/GenericListPage';
import { PermCheckGroup } from '../components/detail/PermCheckGroup';
import { SVC_OPTIONS, TEAM_STATUS } from '../config/providerConstants';
import {
  teamRolesOf,
  teamDutiesOf,
  teamTraitOf,
  staffRoleMetaOf,
  staffPermOptions,
  STAFF_ROLE_POOLS,
  SCOPE_OPTS_BY_ORG,
  SCOPE_TEXT,
  TEAM_PERM_KEYS,
  type OrgType,
} from '../config/staffRoles';
import type { LayerKey } from '../config/permGroups';

const ORG_LAYER: Record<OrgType, LayerKey> = {
  PROVIDER: 'provider',
  AGENT: 'agent',
  CONSOLE: 'console',
};

const fieldLabelStyle = { fontSize: 12.5, color: T.ink2, fontWeight: 600, marginBottom: 6 } as const;

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function Line({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ color: T.ink3, flex: 'none', width: 64 }}>{k}</span>
      <span style={{ color: T.ink1, fontWeight: 500 }}>{v}</span>
    </div>
  );
}

/** 岗位池：服务商随服务类型联动，其余层为静态池 */
function roleOptionsOf(org: OrgType, serviceType?: string): string[] {
  return org === 'PROVIDER' ? teamRolesOf(serviceType) : STAFF_ROLE_POOLS[org];
}

/** 职责池：服务商随服务类型联动，其余层取岗位自带职责 */
function dutyOptionsOf(org: OrgType, serviceType?: string, role?: string): string[] {
  if (org === 'PROVIDER') return teamDutiesOf(serviceType);
  return staffRoleMetaOf(org, role)?.duties ?? [];
}

/** 权限池：服务商=原型 8 项；其余=该层可见域全集（已裁红线） */
function permKeysOf(org: OrgType): string[] {
  return org === 'PROVIDER' ? [...TEAM_PERM_KEYS] : staffPermOptions(org);
}

/** 账号状态胶囊（ACTIVE 正常 / PENDING 待激活 / DISABLED 停用） */
function statusPill(v: string): ReactNode {
  const m = TEAM_STATUS[v];
  const tone = m?.tone ?? 'warn';
  const color = tone === 'ok' ? '#1a7f37' : tone === 'bad' ? '#c0392b' : '#b77a16';
  return <span style={{ color, fontWeight: 600, fontSize: 12.5 }}>{m ? t(m.key) : v || '—'}</span>;
}

/**
 * PermCheckGroup 与 Form.Item 的桥接：
 * PermCheckGroup 用 checkedKeys + onChange（非 value/onChange 语义），
 * 需手动接 Form.Item 注入的 value / onChange。
 */
function PermCheckGroupWrap({
  layer,
  keys,
  value,
  onChange,
  disabled,
}: {
  layer: LayerKey;
  keys: string[];
  value?: string[];
  onChange?: (v: string[]) => void;
  disabled?: boolean;
}) {
  return <PermCheckGroup layer={layer} keys={keys} checkedKeys={value ?? []} disabled={disabled} onChange={onChange} />;
}

/* ══════════════════ 列表页 ══════════════════ */

export interface StaffTeamListProps {
  org: OrgType;
  /** 后端资源：provider/team | agent/team | admin/team */
  resource: string;
  basePath: string;
  title: string;
  sub?: string;
  chip: string;
  /** 是否展示「服务类型」列（仅服务商层有工种概念） */
  withServiceType?: boolean;
}

export function StaffTeamList({ resource, basePath, title, sub, chip, withServiceType }: StaffTeamListProps) {
  const nav = useNavigate();

  const columns: any[] = [
    { title: t('pages.team.colMemberNo', '成员编号'), dataIndex: 'memberNo', width: 120 },
    { title: t('pages.team.colName', '姓名'), dataIndex: 'name', width: 110 },
    { title: t('pages.team.colPhone', '手机'), dataIndex: 'phone', width: 140 },
    ...(withServiceType
      ? [{ title: t('pages.team.serviceType', '服务类型'), dataIndex: 'serviceType', ellipsis: true }]
      : []),
    // teamRole 是服务端补的契约别名（= staffRole），列表沿用旧字段名
    { title: t('pages.team.role', '团队角色'), dataIndex: 'teamRole', width: 130, ellipsis: true },
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
  ];

  return (
    <GenericListPage
      title={title}
      sub={sub}
      chip={chip}
      resource={resource}
      rowKey="id"
      pageSize={20}
      createLabel={t('pages.team.create', '＋ 新建成员')}
      onCreate={() => nav(`${basePath}/new`)}
      searchable
      searchField="name"
      searchPlaceholder={t('pages.team.searchPlaceholder', '搜索成员姓名…')}
      chipFilters={[
        { label: t('pages.team.filterAll', '全部'), value: 'all' },
        { label: t('pages.team.filterActive', '正常'), value: 'ACTIVE', test: (r: any) => r.accountStatus === 'ACTIVE' },
        { label: t('pages.team.filterPending', '待激活'), value: 'PENDING', test: (r: any) => r.accountStatus === 'PENDING' },
        { label: t('pages.team.filterDisabled', '停用'), value: 'DISABLED', test: (r: any) => r.accountStatus === 'DISABLED' },
      ]}
      columns={columns}
      rowActions={(r: any) => (
        <span onClick={() => nav(`${basePath}/${r.id}`)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
          {t('pages.action.view', '查看')}
        </span>
      )}
    />
  );
}

/* ══════════════════ 新建页 ══════════════════ */

export interface StaffTeamFormProps {
  org: OrgType;
  resource: string;
  basePath: string;
  title: string;
  sub?: string;
  chip: string;
  /** 服务商层展示「服务类型」并联动岗位池 */
  withServiceType?: boolean;
}

export function StaffTeamCreate({ org, resource, basePath, title, sub, chip, withServiceType }: StaffTeamFormProps) {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState<any>({});

  const serviceType = vals.serviceType ?? (withServiceType ? SVC_OPTIONS[0]?.value : undefined);
  const role = vals.staffRole;

  const roleOpts = useMemo(() => roleOptionsOf(org, serviceType), [org, serviceType]);
  const dutyOpts = useMemo(() => dutyOptionsOf(org, serviceType, role), [org, serviceType, role]);
  const permKeys = useMemo(() => permKeysOf(org), [org]);
  const scopeOpts = SCOPE_OPTS_BY_ORG[org];

  // 初始值：服务商层默认第一个服务类型 + 对应岗位池首项；其余层默认岗位池首项
  useEffect(() => {
    const initSvc = withServiceType ? SVC_OPTIONS[0]?.value : undefined;
    const initRole = roleOptionsOf(org, initSvc)[0];
    const meta = staffRoleMetaOf(org, initRole);
    const init: any = {
      accountStatus: 'ACTIVE',
      dataScope: meta?.dataScope ?? 'self',
      staffRole: initRole,
      duties: dutyOptionsOf(org, initSvc, initRole),
      funcPerms: meta?.perms ?? [],
    };
    if (withServiceType) {
      init.serviceType = initSvc;
      init.personality = teamTraitOf(initSvc);
    }
    form.setFieldsValue(init);
    setVals(init);
  }, [org, withServiceType, form]);

  /** 服务类型变更：重置岗位 / 职责，预填特长；岗位变更：带出职责 / 权限 / 数据范围 */
  const onValuesChange = (changed: any, all: any) => {
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
    try {
      await dataProvider.custom!({
        url: resource,
        method: 'post',
        payload: {
          name: (v.name ?? '').trim(),
          phone: (v.phone ?? '').trim(),
          accountStatus: v.accountStatus || 'ACTIVE',
          serviceType: withServiceType ? v.serviceType || '' : undefined,
          staffRole: (v.staffRole ?? '').trim(),
          duties: v.duties ?? [],
          funcPerms: v.funcPerms ?? [],
          dataScope: v.dataScope || 'self',
          personality: v.personality || '',
        },
      });
      message.success(t('pages.team.created', '成员已添加'));
      nav(basePath);
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.msg.saveFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const aside = (
    <MemberCard
      name={vals.name || t('pages.team.memberName', '成员姓名')}
      memberNo={t('pages.team.autoNo', 'MT-（自动生成）')}
      serviceType={vals.serviceType}
      teamRole={vals.staffRole}
      status={vals.accountStatus ? t(TEAM_STATUS[vals.accountStatus]?.key ?? 'status.ACTIVE') : t('status.ACTIVE')}
      phone={vals.phone}
    />
  );

  return (
    <SettingPage
      title={title}
      sub={sub}
      chip={chip}
      backTo={basePath}
      aside={aside}
      footer={
        <>
          <Button onClick={() => nav(basePath)}>{t('pages.action.cancel', '取消')}</Button>
          <Button type="primary" loading={saving} onClick={save}>{t('pages.team.save', '保存成员')}</Button>
        </>
      }
    >
      <Form form={form} layout="vertical" onValuesChange={onValuesChange} style={{ marginTop: 8 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 14 }}>
          <Field label={t('pages.team.name', '成员姓名')}>
            <Form.Item name="name" noStyle rules={[{ required: true, message: t('pages.msg.requiredName', '请填写成员姓名') }]}>
              <Input placeholder={t('pages.team.namePlaceholder', '如：古丽娜尔')} />
            </Form.Item>
          </Field>
          <Field label={t('pages.team.phone', '手机号')}>
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
          </Field>
          <Field label={t('pages.team.accountStatus', '账号状态')}>
            <Form.Item name="accountStatus" noStyle>
              <Select options={Object.entries(TEAM_STATUS).map(([v, m]) => ({ value: v, label: t(m.key) }))} style={{ width: '100%' }} />
            </Form.Item>
          </Field>
          {withServiceType && (
            <Field label={t('pages.team.serviceType', '服务类型')}>
              <Form.Item name="serviceType" noStyle>
                <Select options={SVC_OPTIONS} showSearch optionFilterProp="label" style={{ width: '100%' }} />
              </Form.Item>
            </Field>
          )}
          <Field label={t('pages.team.role', '团队角色')}>
            <Form.Item name="staffRole" noStyle rules={[{ required: true, message: t('pages.msg.requiredRole', '请填写或选择岗位') }]}>
              <AutoComplete
                options={roleOpts.map((r) => ({ value: r, label: r }))}
                filterOption={(input, option) => String(option?.value ?? '').includes(input)}
                placeholder={t('pages.team.rolePlaceholder', '如：花艺师 / 客服专员（可选择或自行填写）')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Field>
          <Field label={t('pages.team.dataScope', '数据权限')}>
            <Form.Item name="dataScope" noStyle>
              <Select options={scopeOpts.map((o) => ({ value: o.value, label: t(o.labelKey) }))} style={{ width: '100%' }} />
            </Form.Item>
          </Field>
        </div>

        {dutyOpts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={fieldLabelStyle}>{t('pages.team.duties', '职责')}</div>
            <Form.Item name="duties" noStyle>
              <Checkbox.Group options={dutyOpts.map((d) => ({ value: d, label: d }))} />
            </Form.Item>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={fieldLabelStyle}>{t('pages.team.trait', '特长')}</div>
          <Form.Item name="personality" noStyle>
            <Input placeholder={t('pages.team.traitPlaceholder', '由服务类型自动带出，可修改')} />
          </Form.Item>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={fieldLabelStyle}>{t('pages.team.funcPerms', '功能权限')}</div>
          <Form.Item name="funcPerms" noStyle>
            <PermCheckGroupWrap layer={ORG_LAYER[org]} keys={permKeys} />
          </Form.Item>
        </div>

        <div style={{ fontSize: 11, color: T.ink3, marginTop: 8 }}>
          {t('pages.team.autoNoHint', '工号（MT-xxxx）由系统按当前最大编号自动生成，无需填写。')}
        </div>
      </Form>
    </SettingPage>
  );
}

/* ══════════════════ 详情页 ══════════════════ */

export interface StaffTeamMemberProps {
  org: OrgType;
  resource: string;
  basePath: string;
  title: string;
  sub?: string;
  chip: string;
  withServiceType?: boolean;
}

/** 取列表并按 id 定位单条（后端无单条 GET） */
async function fetchOne(resource: string, id: string): Promise<any> {
  const r: any = await dataProvider.custom!({ url: `${resource}?pageSize=200`, method: 'get' });
  const items: any[] = r?.data?.items ?? r?.data ?? [];
  return items.find((x) => x.id === id) ?? null;
}

export function StaffTeamMember({ org, resource, basePath, title, sub, chip, withServiceType }: StaffTeamMemberProps) {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRec(await fetchOne(resource, id));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, resource]);

  const remove = async () => {
    try {
      await dataProvider.custom!({ url: `${resource}/${id}`, method: 'delete' });
      message.success(t('pages.team.removed', '成员已移除'));
      nav(basePath);
    } catch (e: any) {
      message.error(e?.message || t('pages.msg.removeFailed', '移除失败'));
    }
  };

  /** 停用 / 启用（PATCH —— 原实现缺失该接口，无法停用成员） */
  const toggleStatus = async () => {
    const next = rec?.accountStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    try {
      const r: any = await dataProvider.custom!({ url: `${resource}/${id}`, method: 'patch', payload: { accountStatus: next } });
      setRec(r?.data ?? { ...rec, accountStatus: next });
      message.success(next === 'DISABLED' ? t('pages.team.disabled', '成员已停用') : t('pages.team.enabled', '成员已启用'));
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.msg.saveFailed', '保存失败'));
    }
  };

  const aside = rec ? (
    <MemberCard
      name={rec.name}
      memberNo={rec.memberNo}
      serviceType={rec.serviceType}
      teamRole={rec.staffRole ?? rec.teamRole}
      status={rec.accountStatus ? t(TEAM_STATUS[rec.accountStatus]?.key ?? rec.accountStatus) : '—'}
      phone={rec.phone}
    />
  ) : null;

  return (
    <SettingPage
      title={title}
      sub={sub}
      chip={chip}
      backTo={basePath}
      aside={aside}
      loading={loading}
      footer={
        <>
          <Button onClick={() => nav(basePath)}>{t('pages.action.back', '返回')}</Button>
          <Button onClick={toggleStatus}>
            {rec?.accountStatus === 'DISABLED' ? t('pages.team.enable', '启用成员') : t('pages.team.disable', '停用成员')}
          </Button>
          <Button danger onClick={remove}>{t('pages.team.remove', '移除成员')}</Button>
        </>
      }
    >
      {rec && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 14 }}>
            <Line k={t('pages.team.colMemberNo', '成员编号')} v={rec.memberNo} />
            <Line k={t('pages.team.name', '姓名')} v={rec.name} />
            <Line k={t('pages.team.phone', '手机号')} v={rec.phone} />
            {withServiceType && <Line k={t('pages.team.serviceType', '服务类型')} v={rec.serviceType || '—'} />}
            <Line k={t('pages.team.role', '团队角色')} v={rec.staffRole ?? (rec.teamRole || '—')} />
            <Line k={t('pages.team.dataScope', '数据权限')} v={SCOPE_TEXT[rec.dataScope] ?? (rec.dataScope || '—')} />
            <Line k={t('pages.team.duties', '职责')} v={Array.isArray(rec.duties) && rec.duties.length ? rec.duties.join('、') : '—'} />
            <Line k={t('pages.team.accountStatus', '账号状态')} v={rec.accountStatus ? t(TEAM_STATUS[rec.accountStatus]?.key ?? rec.accountStatus) : '—'} />
            <Line k={t('pages.team.trait', '特长')} v={rec.personality || '—'} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={fieldLabelStyle}>{t('pages.team.funcPerms', '功能权限')}</div>
            <PermCheckGroupWrap layer={ORG_LAYER[org]} keys={permKeysOf(org)} value={rec.funcPerms ?? []} disabled />
          </div>
        </>
      )}
    </SettingPage>
  );
}
