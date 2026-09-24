/**
 * 代理商 · 提现初审（辖区，代理一审 → 总台终审）。
 * 复用 GET /api/agent/withdrawals（后端按 provider.regionPath 辖区隔离）。
 * 代理商仅做「一审」标记（reviewStage：AGENT_PENDING → AGENT_PASSED / AGENT_REJECTED），**不触碰资金闸门**
 * （status 仍 pending）；资金放行（status pending→paid）与驳回退款仅总台 ADMIN 终审执行。
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, message as antdMessage, Descriptions, Drawer, Button, Input } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';
import { formatCents } from '../utility';

const REVIEW_TONE: Record<string, { bg: string; fg: string }> = {
  AGENT_PENDING: { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' },
  AGENT_PASSED: { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' },
  AGENT_REJECTED: { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' },
};
const reviewStagePill = (s?: string) => {
  const key = s ?? 'AGENT_PENDING';
  const tone = REVIEW_TONE[key] ?? REVIEW_TONE.AGENT_PENDING;
  const text =
    key === 'AGENT_PASSED'
      ? t('enum.agentReviewPassed', '初审通过')
      : key === 'AGENT_REJECTED'
        ? t('enum.agentReviewRejected', '初审驳回')
        : t('enum.agentReviewPending', '待初审');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.fg }}>
      {text}
    </span>
  );
};

const WD_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' },
  paid: { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' },
  failed: { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' },
};
const wdStatusPill = (s?: string) => {
  const tone = WD_TONE[s ?? 'pending'] ?? WD_TONE.pending;
  const text = s === 'paid' ? t('pages.status.wdPaid', '已到账') : s === 'failed' ? t('pages.status.wdFailed', '已驳回') : t('pages.status.wdPending', '审核中');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.fg }}>
      {text}
    </span>
  );
};

const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const PAGE_SIZE = 15;

export const AgentWithdrawReview = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectMode, setRejectMode] = useState<'single' | 'batch'>('single');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'agent/withdrawals', method: 'get' });
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

  const review = async (id: string, pass: boolean, note?: string) => {
    setBusy(true);
    try {
      await dataProvider.custom!({
        url: `agent/withdrawals/${id}/review`,
        method: 'patch',
        payload: { pass, note: note ?? null },
      });
      antdMessage.success(t('toast.agentReviewed', '一审已提交'));
      setOpen(false);
      setCurrent(null);
      load();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
    } finally {
      setBusy(false);
    }
  };

  const batchReview = async (pass: boolean, note?: string) => {
    if (!selectedKeys.length) return;
    setBusy(true);
    try {
      const r: any = await dataProvider.custom!({
        url: 'agent/withdrawals/batch-review',
        method: 'patch',
        payload: { ids: selectedKeys, pass, note: note ?? null },
      });
      const d = r?.data ?? r ?? {};
      const ok = d.success ?? 0;
      const fail = Array.isArray(d.failed) ? d.failed : [];
      if (fail.length === 0) {
        antdMessage.success(`${t('toast.batchReviewed', '批量一审已提交')} · ${ok}`);
      } else {
        antdMessage.warning(`${t('toast.batchPartial', '批量一审部分完成')} · ${ok} / ${fail.length}`);
      }
      setSelectedKeys([]);
      load();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
    } finally {
      setBusy(false);
    }
  };

  const openBatchReject = () => {
    if (!selectedKeys.length) return;
    setRejectMode('batch');
    setRejectNote('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    const note = rejectNote.trim();
    if (!note) {
      antdMessage.error(t('pages.toast.rejectReasonRequired', '请填写驳回意见'));
      return;
    }
    setRejectOpen(false);
    try {
      if (rejectMode === 'single' && rejectTargetId) {
        await review(rejectTargetId, false, note);
      } else {
        await batchReview(false, note);
      }
    } finally {
      setRejectNote('');
      setRejectTargetId(null);
    }
  };

  const ask = (row: any, pass: boolean) => {
    if (pass) {
      Modal.confirm({
        title: t('btn.withdrawFirstPass', '初审通过'),
        content: `${row.provider?.nickname || '—'} · ${formatCents(row.amount)}`,
        okText: t('common.detail', '确定'),
        cancelText: t('button.cancel', '取消'),
        okButtonProps: { disabled: busy },
        onOk: () => review(row.id, true),
      });
      return;
    }
    setRejectMode('single');
    setRejectTargetId(row.id);
    setRejectNote('');
    setRejectOpen(true);
  };

  const columns: any[] = [
    { title: t('col.provider', '服务商'), dataIndex: ['provider', 'nickname'], width: 140, render: (_: any, r: any) => r.provider?.nickname || '—' },
    { title: t('col.phone', '手机'), dataIndex: ['provider', 'phone'], width: 140 },
    { title: t('col.amount', '金额'), dataIndex: 'amount', width: 120, render: (v: number) => formatCents(v ?? 0) },
    { title: t('col.status', '资金状态'), dataIndex: 'status', width: 110, render: (v: string) => wdStatusPill(v) },
    { title: t('col.stage', '初审状态'), dataIndex: 'reviewStage', width: 110, render: (v: string) => reviewStagePill(v) },
    { title: t('col.region', '辖区'), dataIndex: ['provider', 'regionPath'], width: 160, render: (v: string) => v ?? '—' },
    { title: t('col.createdAt', '提交时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 200,
      render: (_: any, r: any) =>
        r.status === 'pending' && r.reviewStage === 'AGENT_PENDING' ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <span onClick={(e) => { e.stopPropagation(); ask(r, true); }} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
              {t('btn.withdrawFirstPass', '初审通过')}
            </span>
            <span onClick={(e) => { e.stopPropagation(); ask(r, false); }} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
              {t('btn.withdrawFirstReject', '初审驳回')}
            </span>
          </div>
        ) : (
          <span style={{ color: T.ink3, fontSize: 13 }}>{t('pages.status.consoleFinalReview', '待总台终审')}</span>
        ),
    },
  ];

  const rowSelection: any = {
    selectedRowKeys: selectedKeys,
    onChange: (keys: any[]) => setSelectedKeys(keys as string[]),
    getCheckboxProps: (r: any) => ({ disabled: !(r.status === 'pending' && r.reviewStage === 'AGENT_PENDING') }),
  };

  const pendingTotal = rows.filter((r) => r.status === 'pending' && r.reviewStage === 'AGENT_PENDING').length;

  return (
    <>
      <PageHead
        title={t('sec.agentWithdraw', '提现初审')}
        sub={t('pages.desc.agentWithdrawSub', '辖区服务商提现 · 代理一审标记（不触碰资金）· 放行/驳回由总台终审')}
        chip="代理商 · 提现初审"
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
          marginBottom: 12,
        }}
      >
        <span>{t('lbl.agentFbHint', '代理商仅做一审，身份变更与资金放行仅总台终审。')}</span>
      </div>
      {selectedKeys.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '8px 14px',
            borderRadius: T.rMd,
            background: T.panel2,
            border: `1px solid ${T.border}`,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, color: T.ink2 }}>
            {t('lbl.selectedCount', '已选')} <b style={{ color: T.accent }}>{selectedKeys.length}</b> {t('pages.enum.unit', '条')}
          </span>
          <Button type="primary" size="small" loading={busy} onClick={() => batchReview(true)}>
            {t('btn.batchPass', '批量通过')}
          </Button>
          <Button danger size="small" loading={busy} onClick={openBatchReject}>
            {t('btn.batchReject', '批量驳回')}
          </Button>
          <Button size="small" onClick={() => setSelectedKeys([])}>
            {t('btn.clearSelection', '清空')}
          </Button>
        </div>
      )}
      <Panel
        title={t('sec.agentWithdraw', '提现初审')}
        hint={
          <>
            {t('enum.agentReviewPending', '待初审')} <b style={{ color: T.accent }}>{pendingTotal}</b> {t('pages.enum.unit', '条')} ·{' '}
            {t('pages.enum.all', '全部')} <b>{rows.length}</b> {t('pages.enum.unit', '条')}
          </>
        }
      >
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description={t('empty.noWithdraw', '辖区内暂无提现')} /> }}
          columns={columns}
          rowSelection={rowSelection}
          onRow={(r: any) => ({
            onClick: (e: any) => {
              if ((e.target as HTMLElement).closest('.ant-table-selection-column')) return;
              setCurrent(r);
              setOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
        <Pager total={rows.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      <Drawer title={current?.provider?.nickname || t('sec.agentWithdraw', '提现初审')} open={open} width={520} onClose={() => setOpen(false)}>
        {current && (
          <Descriptions column={1} bordered size="small" styles={{ label: { width: 96 } }}>
            <Descriptions.Item label={t('col.provider', '服务商')}>{current.provider?.nickname || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.phone', '手机')}>{current.provider?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.amount', '金额')}>{formatCents(current.amount ?? 0)}</Descriptions.Item>
            <Descriptions.Item label={t('col.status', '资金状态')}>{wdStatusPill(current.status)}</Descriptions.Item>
            <Descriptions.Item label={t('col.stage', '初审状态')}>{reviewStagePill(current.reviewStage)}</Descriptions.Item>
            <Descriptions.Item label={t('col.region', '辖区')}>{current.provider?.regionPath ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.createdAt', '提交时间')}>{fmt(current.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal
        open={rejectOpen}
        title={t('pages.modal.rejectReason', '填写驳回意见')}
        okText={t('common.detail', '确定')}
        cancelText={t('button.cancel', '取消')}
        okButtonProps={{ danger: true, disabled: busy }}
        onOk={confirmReject}
        onCancel={() => setRejectOpen(false)}
        destroyOnClose
      >
        <Input.TextArea
          rows={4}
          value={rejectNote}
          maxLength={500}
          showCount
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t('pages.ph.rejectReason', '请说明驳回原因，将记入审计日志')}
        />
      </Modal>
    </>
  );
};

export default AgentWithdrawReview;
