import { Typography } from 'antd';
import { type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCustom } from '@refinedev/core';
import { GenericListPage } from '../components/GenericListPage';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { RoleTag, UserDetailDescriptions, useUserActions } from './users';

const { Text } = Typography;

/** 行操作链接（原型 .acts .l） */
const actLink = (label: string, color: string, onClick: () => void) => (
  <span onClick={onClick} style={{ fontSize: 13, cursor: 'pointer', color, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

const dt = (v?: string | Date | null) =>
  v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—';

/* ===================== 回收站 · 僵尸用户列表 ===================== */

export const ZombieUsersList = () => {
  const navigate = useNavigate();
  const { activate, purge } = useUserActions();

  return (
    <GenericListPage
      title={t('pages.sec.zombieUsers')}
      sub="回收站 · 注销 / 停用后回收的用户，可激活恢复或彻底清除"
      chip="回收站"
      resource="admin/zombie-users"
      searchable
      searchField="nickname"
      searchPlaceholder="搜索昵称 / 手机号…"
      columns={[
        {
          title: t('pages.col.nickname'),
          dataIndex: 'nickname',
          width: 130,
          render: (v: string, r: any) => v || r.realName || '—',
        },
        { title: t('pages.col.phone'), dataIndex: 'phone', width: 140 },
        {
          title: t('pages.field.role'),
          dataIndex: 'role',
          width: 110,
          render: (v: string) => <RoleTag role={v} />,
        },
        {
          title: t('pages.field.jurisdiction'),
          dataIndex: 'regionPath',
          width: 150,
          render: (v?: string) => v || <Text type="secondary">{t('pages.col.unassigned')}</Text>,
        },
        {
          title: t('pages.col.status'),
          dataIndex: 'status',
          width: 100,
          render: (v: string) => <Text type="secondary">{v || '—'}</Text>,
        },
        {
          title: t('pages.field.zombieAt'),
          dataIndex: 'zombieAt',
          width: 170,
          render: (v?: string) => dt(v),
        },
      ]}
      rowActions={(record: any) => {
        const name = record.nickname || record.realName || record.phone || '—';
        return (
          <>
            {actLink(t('common.view'), T.ink2, () => navigate(`/admin/zombie-users/show/${record.id}`))}
            {actLink(t('pages.btn.activateUser'), T.ink3, () => activate(record.id, name, () => {}))}
            {actLink(t('pages.btn.purgeUser'), T.down, () => purge(record.id, name, () => {}))}
          </>
        );
      }}
    />
  );
};

/* ===================== 僵尸用户详情（只读 · 完整字段） ===================== */

export const ZombieUserShow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<any>({
    url: `admin/zombie-users/${id}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const user = (data?.data as any)?.data ?? data?.data;
  const { activate, purge } = useUserActions();

  if (isLoading) return <PageHead title={t('pages.sec.zombieUserDetail')} />;
  if (!user) {
    return (
      <>
        <PageHead title={t('pages.sec.zombieUserDetail')} />
        <Panel>
          <div style={{ padding: '64px 20px', textAlign: 'center', color: T.ink3 }}>
            未找到该僵尸用户
          </div>
        </Panel>
      </>
    );
  }

  const name = user.nickname || user.realName || user.phone || '—';

  return (
    <>
      <PageHead
        title={t('pages.sec.zombieUserDetail')}
        chip="回收站 · 僵尸用户"
        extra={
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => activate(user.id, name, () => navigate('/admin/zombie-users'))}
              style={btnStyle(T.ink3)}
            >
              {t('pages.btn.activateUser')}
            </button>
            <button
              type="button"
              onClick={() => purge(user.id, name, () => navigate('/admin/zombie-users'))}
              style={btnStyle(T.down)}
            >
              {t('pages.btn.purgeUser')}
            </button>
          </span>
        }
      />
      <UserDetailDescriptions user={user} />
      <div>
        <button type="button" onClick={() => navigate('/admin/zombie-users')} style={btnStyle(T.ink2)}>
          返回列表
        </button>
      </div>
    </>
  );
};

/** 轻量按钮（与运营端其它页保持一致的原生 button 风格） */
function btnStyle(color: string): CSSProperties {
  return {
    border: `1px solid ${color}`,
    color,
    background: 'transparent',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 13,
    cursor: 'pointer',
  };
}

export default ZombieUsersList;
