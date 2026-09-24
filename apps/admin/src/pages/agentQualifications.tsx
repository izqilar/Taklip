/**
 * 代理商 · 入驻审批（辖区，代理一审）。
 * 复用 GET /api/agent/qualifications（后端按代理商 regionPath 强制辖区隔离）。
 * 代理商仅做「代理一审」：FIRST_PENDING → FIRST_PASSED（通过）/ REJECTED（驳回），**不触碰身份变更**；
 * 身份变更（role 落地）仅总台 ADMIN 终审执行。终审环节由总台处理，代理商侧对 FINAL_PENDING 显示「待总台终审」。
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, message as antdMessage, Descriptions, Drawer, Button } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';

const STATUS_TEXT: Record<string, string> = {
  FIRST_PENDING: '待初审',
  FIRST_PASSED: '待补资料',
  FINAL_PENDING: '待终审',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

const statusPill = (s: string) => {
  const tone =
    s === 'APPROVED'
      ? { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' }
      : s === 'REJECTED'
        ? { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' }
        : { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '1px 9px',
        fontSize: 12,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {STATUS_TEXT[s] ?? s}
    </span>
  );
};

const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const PAGE_SIZE = 15;

export const AgentQualifications = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'agent/qualifications', method: 'get' });
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

  const review = async (id: string, pass: boolean) => {
    setBusy(true);
    try {
      await dataProvider.custom!({
        url: `agent/qualifications/${id}/review`,
        method: 'patch',
        payload: { pass },
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

  const batchReview = async (pass: boolean) => {
    if (!selectedKeys.length) return;
    setBusy(true);
    try {
      const r: any = await dataProvider.custom!({
        url: 'agent/qualifications/batch-review',
        method: 'patch',
        payload: { ids: selectedKeys, pass },
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

  const ask = (row: any, pass: boolean) => {
    Modal.confirm({
      title: pass ? t('btn.agentFirstPass', '一审通过') : t('btn.agentFirstReject', '一审驳回'),
      content: `${row.user?.realName || row.user?.nickname || '—'} · ${row.kind === 'agent' ? '代理商' : '服务商'} · ${row.regionLabel ?? '—'}`,
      okText: t('common.detail', '确定'),
      cancelText: t('button.cancel', '取消'),
      okButtonProps: { danger: !pass, disabled: busy },
      onOk: () => review(row.id, pass),
    });
  };

  const columns: any[] = [
    { title: t('col.applicant', '申请人'), dataIndex: ['user'], width: 140, render: (_: any, r: any) => r.user?.realName || r.user?.nickname || '—' },
    { title: t('col.phone', '手机'), dataIndex: ['user', 'phone'], width: 140 },
    { title: t('col.kind', '入驻层次'), dataIndex: 'kind', width: 110, render: (v: string) => (v === 'agent' ? '代理商' : '服务商') },
    { title: t('col.region', '区域'), dataIndex: 'regionLabel', width: 160, render: (v: string) => v ?? '—' },
    { title: t('col.reason', '申请说明'), dataIndex: 'reason', ellipsis: true },
    { title: t('col.status', '状态'), dataIndex: 'status', width: 110, render: (v: string) => statusPill(v) },
    { title: t('col.createdAt', '提交时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 220,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {r.status === 'FIRST_PENDING' && (
            <>
              <span onClick={(e) => { e.stopPropagation(); ask(r, true); }} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
                {t('btn.agentFirstPass', '一审通过')}
              </span>
              <span onClick={(e) => { e.stopPropagation(); ask(r, false); }} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
                {t('btn.agentFirstReject', '一审驳回')}
              </span>
            </>
          )}
          {r.status === 'FINAL_PENDING' && (
            <span style={{ color: T.ink3, fontSize: 13 }}>{t('pages.status.consoleFinalReview', '待总台终审')}</span>
          )}
          {(r.status === 'APPROVED' || r.status === 'REJECTED' || r.status === 'FIRST_PASSED') && (
            <span style={{ color: T.ink3, fontSize: 13 }}>—</span>
          )}
        </div>
      ),
    },
  ];

  const rowSelection: any = {
    selectedRowKeys: selectedKeys,
    onChange: (keys: any[]) => setSelectedKeys(keys as string[]),
    getCheckboxProps: (r: any) => ({ disabled: r.status !== 'FIRST_PENDING' }),
  };

  const pendingTotal = rows.filter((r) => ['FIRST_PENDING', 'FINAL_PENDING'].includes(r.status)).length;

  return (
    <>
      <PageHead
        title={t('sec.agentQualification', '入驻审批')}
        sub={t('pages.desc.agentQualificationSub', '辖区入驻资格升级隧道 · 代理一审（不触碰身份变更）· 终审由总台裁定')}
        chip="代理商 · 入驻审批"
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
          <Button danger size="small" loading={busy} onClick={() => batchReview(false)}>
            {t('btn.batchReject', '批量驳回')}
          </Button>
          <Button size="small" onClick={() => setSelectedKeys([])}>
            {t('btn.clearSelection', '清空')}
          </Button>
        </div>
      )}
      <Panel
        title={t('sec.agentQualification', '入驻审批')}
        hint={
          <>
            {t('pages.enum.pending', '待审')} <b style={{ color: T.accent }}>{pendingTotal}</b> {t('pages.enum.unit', '条')} ·{' '}
            {t('pages.enum.all', '全部')} <b>{rows.length}</b> {t('pages.enum.unit', '条')}
          </>
        }
      >
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description={t('empty.noQualification', '辖区内暂无入驻申请')} /> }}
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

      <Drawer title={current?.user?.realName || current?.user?.nickname || t('sec.agentQualification', '入驻审批')} open={open} width={520} onClose={() => setOpen(false)}>
        {current && (
          <Descriptions column={1} bordered size="small" styles={{ label: { width: 96 } }}>
            <Descriptions.Item label={t('col.applicant', '申请人')}>{current.user?.realName || current.user?.nickname || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.phone', '手机')}>{current.user?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.kind', '入驻层次')}>{current.kind === 'agent' ? '代理商' : '服务商'}</Descriptions.Item>
            <Descriptions.Item label={t('col.region', '区域')}>{current.regionLabel ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.status', '状态')}>{statusPill(current.status)}</Descriptions.Item>
            <Descriptions.Item label={t('col.reason', '申请说明')}>{current.reason || '—'}</Descriptions.Item>
            {current.applicantName && <Descriptions.Item label={t('col.name', '名称')}>{current.applicantName}</Descriptions.Item>}
            {current.certNo && <Descriptions.Item label={t('col.certNo', '证件编号')}>{current.certNo}</Descriptions.Item>}
            <Descriptions.Item label={t('col.createdAt', '提交时间')}>{fmt(current.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  );
};

export default AgentQualifications;
