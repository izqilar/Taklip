/**
 * 代理商 · 合同管理（辖区，只读）。
 * 复用 GET /api/agent/contracts（后端按 provider.regionPath 辖区隔离）。
 * 签约 / 编辑属服务商自身职能，代理商仅辖区可见，不做写操作。
 */
import { useCallback, useEffect, useState } from 'react';
import { Descriptions, Drawer } from 'antd';
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

const signStagePill = (s?: string) => {
  if (s === 'AWAIT_PROVIDER_SIGN') return pill(t('pages.status.contractStageAwaitProvider', '待服务商签署'), 'warn');
  if (s === 'AWAIT_SENIOR_SIGN') return pill(t('pages.status.contractStageAwaitSenior', '待上级签署'), 'warn');
  if (s === 'APPROVING') return pill(t('pages.status.contractStageApproving', '审批中'), 'warn');
  if (s === 'EFFECTIVE') return pill(t('pages.status.contractStageEffective', '已生效'), 'ok');
  if (s === 'TERMINATED') return pill(t('pages.status.contractStageTerminated', '已终止'), 'bad');
  if (s === 'NEGOTIATING') return pill(t('pages.status.contractStageNegotiating', '协商中'), 'warn');
  if (s === 'EXPIRED') return pill(t('pages.status.contractStageExpired', '已到期'), 'mut');
  return pill(s ?? '—', 'mut');
};

const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const PAGE_SIZE = 15;

export const AgentContracts = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'agent/contracts', method: 'get' });
      setRows(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: any[] = [
    { title: t('col.name', '名称'), dataIndex: 'name', ellipsis: true },
    { title: t('col.partyA', '甲方'), dataIndex: 'partyA', width: 160, ellipsis: true },
    { title: t('col.provider', '服务商'), dataIndex: ['provider', 'nickname'], width: 140, render: (_: any, r: any) => r.provider?.nickname || '—' },
    { title: t('col.signStage', '签署阶段'), dataIndex: 'signStage', width: 120, render: (v: string) => signStagePill(v) },
    { title: t('col.regionProvider', '服务商辖区'), dataIndex: ['provider', 'regionPath'], width: 140, render: (v: string) => v ?? '—' },
    { title: t('col.createdAt', '创建时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    { title: t('col.action', '操作'), key: 'op', width: 90, render: (_: any, r: any) => (
      <span onClick={(e) => { e.stopPropagation(); setCurrent(r); setOpen(true); }} style={{ color: T.ink2, cursor: 'pointer', fontSize: 13 }}>
        {t('common.detail', '详情')}
      </span>
    ) },
  ];

  return (
    <>
      <PageHead
        title={t('sec.agentContract', '辖区合同')}
        sub={t('pages.desc.agentContractSub', '辖区内服务商合同 · 只读可见（签约 / 编辑由服务商自身完成）')}
        chip="代理商 · 合同管理"
      />
      <Panel
        title={t('sec.agentContract', '辖区合同')}
        hint={<>{t('pages.enum.all', '全部')} <b style={{ color: T.accent }}>{rows.length}</b> {t('pages.enum.unit', '条')} · {t('pages.desc.agentContractHint', '辖区可见')}</>}
      >
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState description={t('empty.noContract', '辖区内暂无合同')} /> }}
          columns={columns}
          onRow={(r: any) => ({ onClick: () => { setCurrent(r); setOpen(true); }, style: { cursor: 'pointer' } })}
        />
        <Pager total={rows.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      <Drawer title={current?.name || t('sec.agentContract', '辖区合同')} open={open} width={540} onClose={() => setOpen(false)}>
        {current && (
          <Descriptions column={1} bordered size="small" styles={{ label: { width: 110 } }}>
            <Descriptions.Item label={t('col.name', '名称')}>{current.name || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.partyA', '甲方')}>{current.partyA || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.provider', '服务商')}>{current.provider?.nickname || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.type', '类型')}>{t(`pages.status.${current.type ?? ''}`, current.type || '—')}</Descriptions.Item>
            <Descriptions.Item label={t('col.serviceType', '服务类型')}>{current.serviceType || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.businessMode', '开展方式')}>{t(`pages.status.${current.businessMode ?? ''}`, current.businessMode || '—')}</Descriptions.Item>
            <Descriptions.Item label={t('col.region', '区域')}>{current.region || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.exclusive', '独家')}>{current.exclusive ? t('common.yes', '是') : t('common.no', '否')}</Descriptions.Item>
            <Descriptions.Item label={t('col.platformRate', '平台抽成(%)')}>{current.platformRate ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.deposit', '保证金(分)')}>{current.deposit ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.settlePeriod', '结算周期')}>{t(`pages.status.${current.settlePeriod ?? ''}`, current.settlePeriod || '—')}</Descriptions.Item>
            <Descriptions.Item label={t('col.expireDate', '到期日')}>{current.expireDate ? fmt(current.expireDate) : '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.signStage', '签署阶段')}>{signStagePill(current.signStage)}</Descriptions.Item>
            {Array.isArray(current.negotiation) && current.negotiation.length > 0 && (
              <Descriptions.Item label={t('col.negotiation', '协商记录')}>
                {current.negotiation.map((n: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: T.ink2, marginBottom: 4 }}>{n}</div>
                ))}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('col.createdAt', '创建时间')}>{fmt(current.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  );
};

export default AgentContracts;
