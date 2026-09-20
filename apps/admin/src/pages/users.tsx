import { Typography, Form, Select, Button, Descriptions, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { useState } from 'react';
import { GenericListPage } from '../components/GenericListPage';
import { StatusTag } from '../components/common/StatusTag';
import { Pill, type PillTone } from '../components/ui/Pill';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { serviceRolesText, roleText } from '../config/labels';
import { t } from "../i18n/t";

const { Title, Text } = Typography;

/** 角色色板（仅颜色映射，标签文案统一走 config/labels 的 roleText） */
const ROLE_TONE: Record<string, PillTone> = {
  USER: 'mut',
  SERVICE_PROVIDER: 'ac',
  AGENT: 'warn',
  ADMIN: 'bad',
};

function RoleTag({ role }: { role?: string }) {
  return <Pill tone={ROLE_TONE[role || ''] ?? 'mut'}>{roleText(role)}</Pill>;
}

/** 行操作链接（原型 .acts .l） */
const actLink = (label: string, color: string, onClick: () => void) => (
  <span onClick={onClick} style={{ fontSize: 13, cursor: 'pointer', color, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

/* ===================== 用户管理（总台 · 运营监管） ===================== */

export const UserList = () => {
  const navigate = useNavigate();
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
      rowActions={(record: any) => (
        <>
          {actLink(t("common.view"), T.ink2, () => navigate(`/admin/users/show/${record.id}`))}
          {actLink(t("common.edit"), T.ink3, () => navigate(`/admin/users/edit/${record.id}`))}
        </>
      )}
    />
  );
};

/* ===================== 用户详情（原型 kv 卡片） ===================== */

export const UserShow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<any>({
    url: `admin/users/${id}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const user = (data?.data as any)?.data ?? data?.data;

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

  return (
    <>
      <PageHead title={t("pages.sec.userDetail")} chip="总台 · 用户管理" />
      <Panel title="基础信息">
        <Descriptions column={1} bordered size="small" styles={{ label: { width: 110 } }}>
          <Descriptions.Item label={t("pages.col.phone")}>{user.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label={t("pages.col.nickname")}>{user.nickname || '—'}</Descriptions.Item>
          <Descriptions.Item label={t("pages.col.realName")}>{user.realName || '—'}</Descriptions.Item>
          <Descriptions.Item label={t("pages.col.email")}>{user.email || '—'}</Descriptions.Item>
          <Descriptions.Item label={t("pages.field.role")}>
            <RoleTag role={user.role} />
          </Descriptions.Item>
          <Descriptions.Item label={t("pages.col.serviceSubRole")}>
            {serviceRolesText(user.serviceRoles)}
          </Descriptions.Item>
          <Descriptions.Item label={t("pages.col.pendingServices")}>
            {serviceRolesText(user.pendingServiceRoles)}
          </Descriptions.Item>
          <Descriptions.Item label={t("pages.col.supplyStatus")}>
            <StatusTag value={user.providerStatus} />
          </Descriptions.Item>
          <Descriptions.Item label={t("pages.field.jurisdiction")}>
            {user.regionPath || t("pages.col.unassigned")}
          </Descriptions.Item>
          <Descriptions.Item label={t("pages.col.status")}>
            <StatusTag value={user.status} />
          </Descriptions.Item>
        </Descriptions>
      </Panel>
      <div>
        <Button onClick={() => navigate('/admin/users')}>返回列表</Button>
      </div>
    </>
  );
};

/* ===================== 用户编辑（状态 / 角色） ===================== */

export const UserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useCustom<any>({
    url: `admin/users/${id}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const user = (data?.data as any)?.data ?? data?.data;
  const { mutateAsync: setStatus } = useCustomMutation();
  const { mutateAsync: setRole } = useCustomMutation();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const onSave = async (values: { status: string; role: string }) => {
    setSaving(true);
    try {
      if (values.status && values.status !== user?.status) {
        await setStatus({
          url: `admin/users/${id}/status`,
          method: 'post',
          values: { status: values.status },
        });
      }
      if (values.role && values.role !== user?.role) {
        await setRole({
          url: `admin/users/${id}/role`,
          method: 'post',
          values: { role: values.role },
        });
      }
      navigate('/admin/users');
    } catch {
      /* 错误由全局 notification 处理 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title={t("pages.btn.editUser")} chip="总台 · 用户管理" />
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
