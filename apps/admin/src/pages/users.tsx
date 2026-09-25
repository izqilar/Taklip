import { Typography, Form, Select, Button, Descriptions, Space, Modal, Tag, Divider, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useCustom, useCustomMutation, useCan, useInvalidate } from '@refinedev/core';
import { useState, type ReactNode } from 'react';
import { GenericListPage } from '../components/GenericListPage';
import { StatusTag } from '../components/common/StatusTag';
import { Pill, type PillTone } from '../components/ui/Pill';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { serviceRolesText, roleText } from '../config/labels';
import { formatCents } from '../utility';
import { dataProvider } from '../providers/dataProvider';
import { t } from "../i18n/t";

const { Title, Text } = Typography;

/** 角色色板（仅颜色映射，标签文案统一走 config/labels 的 roleText） */
const ROLE_TONE: Record<string, PillTone> = {
  USER: 'mut',
  SERVICE_PROVIDER: 'ac',
  AGENT: 'warn',
  ADMIN: 'bad',
};

export function RoleTag({ role }: { role?: string }) {
  return <Pill tone={ROLE_TONE[role || ''] ?? 'mut'}>{roleText(role)}</Pill>;
}

/** 行操作链接（原型 .acts .l） */
const actLink = (label: string, color: string, onClick: () => void) => (
  <span onClick={onClick} style={{ fontSize: 13, cursor: 'pointer', color, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

/* ===================== 详情渲染辅助 ===================== */

/** 时间格式化（ISO → 本地可读串；空值回退 —） */
const dt = (v?: string | Date | null) =>
  v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—';

/** 实名状态小标签（覆盖 StatusTag 未收录的 UNVERIFIED） */
const REALNAME_META: Record<string, { text: string; tone: PillTone }> = {
  UNVERIFIED: { text: '未实名', tone: 'mut' },
  PENDING: { text: '待审核', tone: 'warn' },
  APPROVED: { text: '已实名', tone: 'ok' },
  REJECTED: { text: '已驳回', tone: 'bad' },
};
function RealNameTag({ v }: { v?: string }) {
  const m = REALNAME_META[v || ''] ?? { text: v || '—', tone: 'mut' as PillTone };
  return <Pill tone={m.tone}>{m.text}</Pill>;
}

/** 单字段行 */
const Field = ({ label, children }: { label: string; children?: ReactNode }) => (
  <Descriptions.Item label={label}>{children ?? '—'}</Descriptions.Item>
);

/**
 * 四类分区用户详情（查看 / 编辑只读区共用）。
 * 完整呈现：基本资料 / 账户与资产 / 角色权限 / 注册及活跃记录，
 * 服务商额外展示「经营概览（钱包）」分区，确保两种模式字段一致。
 */
function UserDetailDescriptions({ user }: { user: any }) {
  const w = user?.providerWallet;
  return (
    <>
      <Panel title={t('pages.sec.basicInfo')}>
        <Descriptions column={2} bordered size="small" styles={{ label: { width: 120 } }}>
          <Field label={t('pages.field.userId')}>{user.id}</Field>
          <Field label={t('pages.col.phone')}>{user.phone || '—'}</Field>
          <Field label={t('pages.col.nickname')}>{user.nickname || '—'}</Field>
          <Field label={t('pages.col.realName')}>{user.realName || '—'}</Field>
          <Field label={t('pages.field.idCard')}>{user.idCard || '—'}</Field>
          <Field label={t('pages.field.realNameStatus')}><RealNameTag v={user.realNameStatus} /></Field>
          <Field label={t('pages.col.email')}>{user.email || '—'}</Field>
          <Field label={t('pages.field.locale')}>{user.locale || '—'}</Field>
          <Field label={t('pages.field.wxOpenid')}>{user.wxOpenid || '—'}</Field>
          <Field label={t('pages.field.bio')}>{user.bio || '—'}</Field>
        </Descriptions>
      </Panel>

      <Panel title={t('pages.sec.accountAsset')}>
        <Descriptions column={2} bordered size="small" styles={{ label: { width: 120 } }}>
          <Field label={t('pages.col.accountStatus')}><StatusTag value={user.status} /></Field>
          <Field label={t('pages.field.vipLevel')}>{user.vipLevel ?? '—'}</Field>
          <Field label={t('pages.field.points')}>{user.points ?? '—'}</Field>
          <Field label={t('pages.field.walletBalance')}>{formatCents(user.userBalance ?? 0)}</Field>
          <Field label={t('pages.field.totalSpent')}>{formatCents(user.totalSpent ?? 0)}</Field>
          <Field label={t('pages.field.followingProviders')}>{user.followingProviderCount ?? '—'}</Field>
          <Field label={t('pages.field.lastLogin')}>{dt(user.lastLoginAt)}</Field>
        </Descriptions>
      </Panel>

      <Panel title={t('pages.sec.rolePerm')}>
        <Descriptions column={2} bordered size="small" styles={{ label: { width: 120 } }}>
          <Field label={t('pages.field.role')}><RoleTag role={user.role} /></Field>
          <Field label={t('pages.col.serviceSubRole')}>{serviceRolesText(user.serviceRoles) || '—'}</Field>
          <Field label={t('pages.col.pendingServices')}>{serviceRolesText(user.pendingServiceRoles) || '—'}</Field>
          <Field label={t('pages.col.supplyStatus')}><StatusTag value={user.providerStatus} /></Field>
          <Field label={t('pages.field.jurisdiction')}>{user.regionPath || t('pages.col.unassigned')}</Field>
          <Field label={t('pages.field.regionName')}>{user.region?.name || '—'}</Field>
          <Field label={t('pages.field.agentName')}>{user.agent?.nickname || user.agent?.phone || '—'}</Field>
        </Descriptions>
      </Panel>

      <Panel title={t('pages.sec.activity')}>
        <Descriptions column={2} bordered size="small" styles={{ label: { width: 120 } }}>
          <Field label={t('pages.col.registeredAt')}>{dt(user.createdAt)}</Field>
          <Field label={t('pages.col.updatedAt')}>{dt(user.updatedAt)}</Field>
          <Field label={t('pages.field.realNameVerifiedAt')}>{dt(user.realNameVerifiedAt)}</Field>
        </Descriptions>
      </Panel>

      {user.role === 'SERVICE_PROVIDER' && w && (
        <Panel title={t('pages.sec.businessOverview')}>
          <Descriptions column={2} bordered size="small" styles={{ label: { width: 120 } }}>
            <Field label={t('pages.field.walletBalance')}>{formatCents(w.balance ?? 0)}</Field>
            <Field label={t('pages.field.walletFrozen')}>{formatCents(w.frozen ?? 0)}</Field>
            <Field label={t('pages.field.walletIncome')}>{formatCents(w.totalIncome ?? 0)}</Field>
            <Field label={t('pages.field.walletWithdrawn')}>{formatCents(w.withdrawn ?? 0)}</Field>
          </Descriptions>
        </Panel>
      )}
    </>
  );
}

export { UserDetailDescriptions };

/**
 * 用户相关写操作封装（软删除 / 激活 / 彻底删除）。
 * 软删除：移入回收站（防误删二次确认）；激活：恢复僵尸用户；彻底删除：级联硬删。
 * 每个操作均带二次确认弹窗，失败时保留弹窗并提示错误信息。
 */
export function useUserActions() {
  const invalidate = useInvalidate();

  const softDelete = (id: string, name: string, onDone?: () => void) => {
    Modal.confirm({
      title: t('pages.modal.deleteUserTitle'),
      content: (
        <div>
          <p style={{ marginBottom: 4 }}>{t('pages.modal.deleteUserContent', { name })}</p>
          <p style={{ color: T.ink3, fontSize: 12, margin: 0 }}>{t('pages.note.deleteGuard')}</p>
        </div>
      ),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await dataProvider.custom!({ url: `admin/users/${id}`, method: 'delete' });
          message.success(t('pages.msg.userDeleted'));
          await invalidate({ resource: 'admin/users', invalidates: ['list', 'detail'] });
          onDone?.();
        } catch (e: any) {
          message.error(e?.message || t('pages.msg.opFailed'));
          throw e;
        }
      },
    });
  };

  const activate = (id: string, name: string, onDone?: () => void) => {
    Modal.confirm({
      title: t('pages.modal.activateUserTitle'),
      content: t('pages.modal.activateUserContent', { name }),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await dataProvider.custom!({ url: `admin/zombie-users/${id}/activate`, method: 'post' });
          message.success(t('pages.msg.userActivated'));
          await invalidate({ resource: 'admin/zombie-users', invalidates: ['list', 'detail'] });
          onDone?.();
        } catch (e: any) {
          message.error(e?.message || t('pages.msg.opFailed'));
          throw e;
        }
      },
    });
  };

  const purge = (id: string, name: string, onDone?: () => void) => {
    Modal.confirm({
      title: t('pages.modal.purgeUserTitle'),
      content: t('pages.modal.purgeUserContent', { name }),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await dataProvider.custom!({ url: `admin/zombie-users/${id}`, method: 'delete' });
          message.success(t('pages.msg.userPurged'));
          await invalidate({ resource: 'admin/zombie-users', invalidates: ['list', 'detail'] });
          onDone?.();
        } catch (e: any) {
          message.error(e?.message || t('pages.msg.opFailed'));
          throw e;
        }
      },
    });
  };

  return { softDelete, activate, purge };
}

/* ===================== 用户管理（总台 · 运营监管） ===================== */

export const UserList = () => {
  const navigate = useNavigate();
  const { data: canDelete } = useCan({ resource: 'admin/users', action: 'delete' });
  const { softDelete } = useUserActions();

  return (
    <GenericListPage
      title={t("pages.sec.userManage")}
      sub="全量用户监督 · 角色/状态/启停"
      chip="总台"
      resource="admin/users"
      searchable
      searchField="nickname"
      searchPlaceholder="搜索昵称 / 手机号…"
      chipFilters={[
        { label: '全部用户', value: 'all' },
        { label: '客户', value: 'USER', field: 'role' },
        { label: '服务商', value: 'SERVICE_PROVIDER', field: 'role' },
        { label: '代理商', value: 'AGENT', field: 'role' },
        { label: '管理员', value: 'ADMIN', field: 'role' },
      ]}
      columns={[
        {
          title: t("pages.col.nickname"),
          dataIndex: 'nickname',
          width: 130,
          render: (v: string, r: any) => v || r.realName || '—',
        },
        { title: t("pages.col.phone"), dataIndex: 'phone', width: 140 },
        {
          title: t("pages.field.role"),
          dataIndex: 'role',
          width: 110,
          render: (v: string) => <RoleTag role={v} />,
        },
        {
          title: t("pages.col.serviceSubRole"),
          dataIndex: 'serviceRoles',
          render: (v?: string[]) =>
            (v || []).length ? (
              <span style={{ color: T.ink2 }}>{serviceRolesText(v)}</span>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: t("pages.field.jurisdiction"),
          dataIndex: 'regionPath',
          width: 150,
          render: (v?: string) => v || <Text type="secondary">{t("pages.col.unassigned")}</Text>,
        },
        {
          title: t("pages.col.status"),
          dataIndex: 'status',
          width: 100,
          render: (v: string) => <StatusTag value={v} />,
        },
      ]}
      rowActions={(record: any) => {
        const name = record.nickname || record.realName || record.phone || '—';
        return (
          <>
            {actLink(t("common.view"), T.ink2, () => navigate(`/admin/users/show/${record.id}`))}
            {actLink(t("common.edit"), T.ink3, () => navigate(`/admin/users/edit/${record.id}`))}
            {canDelete?.can && (
              <Tag
                color="error"
                style={{ cursor: 'pointer', marginInlineStart: 4 }}
                onClick={() => softDelete(record.id, name, () => {})}
              >
                {t("pages.btn.deleteUser")}
              </Tag>
            )}
          </>
        );
      }}
    />
  );
};

/* ===================== 用户详情（只读 · 完整字段） ===================== */

export const UserShow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<any>({
    url: `admin/users/${id}`,
    method: 'get',
    // 守卫：route 初次挂载时 useParams().id 可能暂为 undefined，避免向 /api/admin/users/undefined 发请求（401）
    queryOptions: { retry: false, enabled: !!id },
  });
  const user = (data?.data as any)?.data ?? data?.data;
  const { data: canDelete } = useCan({ resource: 'admin/users', action: 'delete' });
  const { softDelete } = useUserActions();

  if (isLoading) return <PageHead title={t("pages.sec.userDetail")} />;
  if (!user) {
    return (
      <>
        <PageHead title={t("pages.sec.userDetail")} />
        <Panel>
          <div style={{ padding: '64px 20px', textAlign: 'center', color: T.ink3 }}>
            未找到该用户
          </div>
        </Panel>
      </>
    );
  }

  const name = user.nickname || user.realName || user.phone || '—';

  return (
    <>
      <PageHead
        title={t("pages.sec.userDetail")}
        chip="总台 · 用户管理"
        extra={
          canDelete?.can ? (
            <Button danger onClick={() => softDelete(user.id, name, () => navigate('/admin/users'))}>
              {t("pages.btn.deleteUser")}
            </Button>
          ) : undefined
        }
      />
      <UserDetailDescriptions user={user} />
      <div>
        <Button onClick={() => navigate('/admin/users')}>返回列表</Button>
      </div>
    </>
  );
};

/* ===================== 用户编辑（状态 / 角色 + 只读全字段） ===================== */

export const UserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useCustom<any>({
    url: `admin/users/${id}`,
    method: 'get',
    queryOptions: { retry: false, enabled: !!id },
  });
  const user = (data?.data as any)?.data ?? data?.data;
  const { mutateAsync: setStatus } = useCustomMutation();
  const { mutateAsync: setRole } = useCustomMutation();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { data: canDelete } = useCan({ resource: 'admin/users', action: 'delete' });
  const { softDelete } = useUserActions();

  const name = user?.nickname || user?.realName || user?.phone || '—';

  const onSave = async (values: { status: string; role: string }) => {
    setSaving(true);
    try {
      if (values.status && values.status !== user?.status) {
        await setStatus({ url: `admin/users/${id}/status`, method: 'post', values: { status: values.status } });
      }
      if (values.role && values.role !== user?.role) {
        await setRole({ url: `admin/users/${id}/role`, method: 'post', values: { role: values.role } });
      }
      message.success(t('pages.toast.saveOk'));
      navigate('/admin/users');
    } catch {
      /* 错误由全局 notification 处理 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead
        title={t("pages.btn.editUser")}
        chip="总台 · 用户管理"
        extra={
          canDelete?.can ? (
            <Button danger onClick={() => softDelete(user?.id, name, () => navigate('/admin/users'))}>
              {t("pages.btn.deleteUser")}
            </Button>
          ) : undefined
        }
      />

      {user && <UserDetailDescriptions user={user} />}

      <Panel title="账户配置">
        <div style={{ padding: 16, maxWidth: 520 }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ status: user?.status, role: user?.role }}
            onFinish={onSave}
          >
            <Form.Item label={t("pages.col.accountStatus")} name="status">
              <Select
                options={[
                  { value: 'ACTIVE', label: t("pages.enum.normal") },
                  { value: 'DISABLED', label: t("pages.btn.disable") },
                ]}
              />
            </Form.Item>
            <Form.Item label={t("pages.field.roleLocked")} name="role">
              <Select
                options={[
                  { value: 'USER', label: t("pages.col.normalUser") },
                  { value: 'SERVICE_PROVIDER', label: t("pages.col.provider") },
                  { value: 'AGENT', label: t("pages.col.agent") },
                ]}
              />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存
              </Button>
              <Button onClick={() => navigate('/admin/users')}>取消</Button>
            </Space>
          </Form>
        </div>
      </Panel>
    </>
  );
};

export default UserList;
