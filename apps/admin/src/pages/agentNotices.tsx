import { useEffect, useMemo, useState } from 'react';
import { Drawer, Descriptions } from 'antd';
import { dataProvider } from '../providers/dataProvider';
import { getStoredUser } from '../utility';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { publisherText } from '../config/labels';

const PAGE_SIZE = 15;

const MSG_TYPE: Record<string, string> = {
  ANNOUNCEMENT: 'pages.msg.authorityNotice',
  ANNOUNCED: 'pages.msg.authorityNotice',
  NOTICE: 'pages.msg.generalMsg',
};
const MSG_SCOPE: Record<string, string> = {
  GLOBAL: 'pages.lbl.global',
  REGION: 'pages.col.regionSlash',
  OWN: 'pages.col.targetRole',
};

/**
 * 代理商 · 通知公告（只读收件箱）。
 * 复用 GET /api/messages 收件箱：后端已按代理商 regionPath 强制隔离可见范围，
 * 与「该代理商账号登录」看到的收件箱严格一致；本页仅展示权威公告 / 一般消息，纯查看。
 */
export const AgentNotices = () => {
  const me = getStoredUser<{ role: string; regionPath?: string | null; id: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await dataProvider.custom!({ url: 'messages', method: 'get' });
      const all = Array.isArray(data) ? data : [];
      // 仅展示权威公告 / 一般消息（与 agent/messages 发布中心的审核/发布职能区分）
      const notices = all.filter((m: any) => m.type === 'ANNOUNCEMENT' || m.type === 'NOTICE' || m.type === 'ANNOUNCED');
      setRows(notices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (keyword ? rows.filter((r) => String(r.title ?? '').includes(keyword)) : rows),
    [rows, keyword],
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    {
      title: t('pages.col.type'),
      dataIndex: 'type',
      width: 120,
      render: (v: string) => <span style={{ color: T.ink3 }}>{t(MSG_TYPE[v] ?? v ?? '—')}</span>,
    },
    { title: t('pages.col.title'), dataIndex: 'title', ellipsis: true },
    {
      title: t('pages.col.publisher'),
      dataIndex: ['author', 'nickname'],
      width: 130,
      render: (_: any, r: any) => publisherText(r.author, r.authorRole),
    },
    {
      title: t('pages.lbl.scope'),
      dataIndex: 'scope',
      width: 150,
      render: (s: string, r: any) =>
        s === 'REGION'
          ? `${t(MSG_SCOPE.REGION)}${r.regionPath ? `（${r.regionPath}）` : ''}`
          : t(MSG_SCOPE[s] ?? s),
    },
    { title: t('pages.col.time'), dataIndex: 'createdAt', width: 170, render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—') },
  ];

  return (
    <>
      <PageHead
        title={t('menu.agent.notices')}
        sub="辖区可见的权威公告与一般通知 · 数据隔离由后端强制"
        chip="代理商 · 通知公告"
      />

      <FilterBar
        filters={[{ label: t('pages.enum.all'), value: 'all' }]}
        activeFilter="all"
        onFilterChange={() => {}}
        searchable
        searchPlaceholder="搜索公告标题…"
        searchValue={keyword}
        onSearchChange={setKeyword}
        onSearch={setKeyword}
      />

      <Panel
        title={<span>{t('menu.agent.notices')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{filtered.length}</b> 条 · 仅展示本人辖区可见公告
          </>
        }
      >
        <DataTable<any>
          rowKey="id"
          loading={loading}
          dataSource={paged}
          scroll={{ x: 900 }}
          locale={{ emptyText: <EmptyState description={t('pages.empty.noPendingNotice')} /> }}
          columns={columns}
          onRow={(r: any) => ({
            onClick: () => {
              setCurrent(r);
              setOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
        <Pager total={filtered.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      <Drawer
        title={current?.title || t('menu.agent.notices')}
        open={open}
        width={520}
        onClose={() => setOpen(false)}
      >
        {current && (
          <Descriptions column={1} bordered size="small" styles={{ label: { width: 96 } }}>
            <Descriptions.Item label={t('pages.col.type')}>{t(MSG_TYPE[current.type] ?? current.type ?? '—')}</Descriptions.Item>
            <Descriptions.Item label={t('pages.lbl.scope')}>
              {current.scope === 'REGION'
                ? `${t(MSG_SCOPE.REGION)}${current.regionPath ? `（${current.regionPath}）` : ''}`
                : t(MSG_SCOPE[current.scope] ?? current.scope)}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.col.publisher')}>{publisherText(current.author, current.authorRole)}</Descriptions.Item>
            <Descriptions.Item label={t('pages.col.time')}>
              {current.createdAt ? new Date(current.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.col.content')}>{current.content || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  );
};
