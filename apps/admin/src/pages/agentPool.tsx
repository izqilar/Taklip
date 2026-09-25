/**
 * 代理商 · 意向池（辖区招商意向运营台账）。
 * 复用 GET /api/agent/recruits（stage / keyword 过滤）+ PATCH /api/agent/recruits/:id（阶段推进）。
 * 代理商仅推进阶段（NEW → CONTACTED → WON / LOST），不触碰身份 / 资金。
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, message as antdMessage, Segmented, Input } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';

const pill = (text: string, tone: 'ok' | 'warn' | 'bad' | 'mut') => {
  const c =
    tone === 'ok'
      ? { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' }
      : tone === 'bad'
        ? { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' }
        : tone === 'warn'
          ? { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' }
          : { bg: 'rgba(120,120,130,0.12)', fg: '#4a4a52' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 600, background: c.bg, color: c.fg }}>
      {text}
    </span>
  );
};

const stagePill = (s?: string) => {
  if (s === 'NEW') return pill(t('enum.recruitNew', '新建'), 'mut');
  if (s === 'CONTACTED') return pill(t('enum.recruitContacted', '已联系'), 'warn');
  if (s === 'WON') return pill(t('enum.recruitWon', '已转化'), 'ok');
  if (s === 'LOST') return pill(t('enum.recruitLost', '已流失'), 'bad');
  return pill(s ?? '—', 'mut');
};

const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const PAGE_SIZE = 15;

const STAGE_OPTIONS = [
  { label: t('pages.enum.all', '全部'), value: '' },
  { label: t('enum.recruitNew', '新建'), value: 'NEW' },
  { label: t('enum.recruitContacted', '已联系'), value: 'CONTACTED' },
  { label: t('enum.recruitWon', '已转化'), value: 'WON' },
  { label: t('enum.recruitLost', '已流失'), value: 'LOST' },
];

export const AgentPool = ({ variant = 'agent' }: { variant?: 'agent' | 'admin' }) => {
  const isAdmin = variant === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs: string[] = [];
      if (stage) qs.push(`stage=${encodeURIComponent(stage)}`);
      if (keyword.trim()) qs.push(`keyword=${encodeURIComponent(keyword.trim())}`);
      const url = `agent/recruits${qs.length ? `?${qs.join('&')}` : ''}`;
      const r: any = await dataProvider.custom!({ url, method: 'get' });
      setRows(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [stage, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const moveStage = async (row: any, stageVal: 'CONTACTED' | 'WON' | 'LOST') => {
    const label =
      stageVal === 'CONTACTED'
        ? t('btn.recruitContacted', '标记已联系')
        : stageVal === 'WON'
          ? t('btn.recruitWon', '标记已转化')
          : t('btn.recruitLost', '标记已流失');
    Modal.confirm({
      title: label,
      content: `${row.name} · ${row.phone}`,
      okText: t('common.detail', '确定'),
      cancelText: t('button.cancel', '取消'),
      okButtonProps: { danger: stageVal === 'LOST' },
      onOk: async () => {
        setBusyId(row.id);
        try {
          await dataProvider.custom!({
            url: `agent/recruits/${row.id}`,
            method: 'patch',
            payload: { stage: stageVal },
          });
          antdMessage.success(t('toast.recruitStageUpdated', '阶段已更新'));
          load();
        } catch (e: any) {
          antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const columns: any[] = [
    { title: t('col.name', '名称'), dataIndex: 'name', ellipsis: true },
    { title: t('col.phone', '手机'), dataIndex: 'phone', width: 140 },
    { title: t('col.region', '意向区域'), dataIndex: 'regionLabel', width: 160, ellipsis: true, render: (v: string) => v || '—' },
    { title: t('col.regionProvider', '区域路径'), dataIndex: 'regionPath', width: 160, ellipsis: true, render: (v: string) => v || '—' },
    { title: t('col.intro', '说明'), dataIndex: 'intro', ellipsis: true, render: (v: string) => v || '—' },
    { title: t('col.stage', '阶段'), dataIndex: 'stage', width: 100, render: (v: string) => stagePill(v) },
    { title: t('col.createdAt', '创建时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 230,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <span
            onClick={(e) => { e.stopPropagation(); if (r.stage !== 'CONTACTED') moveStage(r, 'CONTACTED'); }}
            style={{ color: r.stage === 'CONTACTED' ? T.ink3 : T.accent, cursor: r.stage === 'CONTACTED' ? 'default' : 'pointer', fontSize: 13 }}
          >
            {t('btn.recruitContacted', '标记已联系')}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); if (r.stage !== 'WON') moveStage(r, 'WON'); }}
            style={{ color: r.stage === 'WON' ? T.ink3 : T.accent, cursor: r.stage === 'WON' ? 'default' : 'pointer', fontSize: 13 }}
          >
            {t('btn.recruitWon', '标记已转化')}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); if (r.stage !== 'LOST') moveStage(r, 'LOST'); }}
            style={{ color: r.stage === 'LOST' ? T.ink3 : '#c0392b', cursor: r.stage === 'LOST' ? 'default' : 'pointer', fontSize: 13 }}
          >
            {t('btn.recruitLost', '标记已流失')}
          </span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={isAdmin ? t('pages.sec.poolAdmin', '意向池 · 全平台') : t('pages.lbl.intentPool', '意向池')}
        sub={isAdmin ? t('pages.desc.poolAdminSub', '全平台招商意向台账 · 推进接触阶段（不触碰身份 / 资金）') : t('pages.desc.agentPoolSub', '辖区内招商意向台账 · 推进接触阶段（不触碰身份 / 资金）')}
        chip={isAdmin ? '总台 · 全盘治理' : '代理商 · 意向池'}
      />
      <Panel
        title={isAdmin ? t('pages.sec.poolAdmin', '意向池 · 全平台') : t('pages.lbl.intentPool', '意向池')}
        hint={
          <>
            {isAdmin && <span style={{ color: T.ink3, marginRight: 12 }}>全平台（ALL 视角）</span>}
            <Segmented
              options={STAGE_OPTIONS}
              value={stage}
              onChange={(v) => { setStage(v as string); setPage(1); }}
              size="small"
            />
            <span style={{ marginLeft: 12, display: 'inline-block', width: 200 }}>
              <Input.Search
                allowClear
                size="small"
                placeholder={t('pages.ph.searchNamePhone', '搜索名称 / 手机')}
                onSearch={(v) => { setKeyword(v); setPage(1); }}
              />
            </span>
          </>
        }
      >
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description={t('empty.noRecruit', '辖区内暂无招商意向')} /> }}
          columns={columns}
        />
        <Pager total={rows.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>
    </>
  );
};

export default AgentPool;
