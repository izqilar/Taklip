import { Typography, message } from 'antd';
import { useCustomMutation } from '@refinedev/core';
import { useState } from 'react';
import { GenericListPage } from '../components/GenericListPage';
import { StatusTag } from '../components/common/StatusTag';
import { ReviewModal } from '../components/ui/ReviewModal';
import { T } from '../config/theme';
import { formatCents } from '../utility';
import { useLayer } from '../providers/layerContext';
import { t } from '../i18n/t';

const { Text } = Typography;

interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  provider?: { id: string; nickname: string; phone?: string };
  wallet?: { id: string; balance: number };
}

/** 行操作链接（原型 .acts .l）：通过绿 / 驳回红，只读态置灰 */
const actLink = (label: string, tone: 'ok' | 'bad' | 'dim', onClick: () => void, disabled?: boolean) => {
  const color = tone === 'ok' ? T.upInk : tone === 'bad' ? T.downInk : T.ink3;
  return (
    <span
      onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? T.ink3 : color,
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};

/** 提现审核（原型 总台 · 财务中心）：审核后即时扣减/回退余额由服务端闭环 */
export const WithdrawalList = () => {
  const { readonly } = useLayer();
  const { mutateAsync: approve } = useCustomMutation();
  const { mutateAsync: reject } = useCustomMutation();
  const [current, setCurrent] = useState<WithdrawalRow | null>(null);
  const [mode, setMode] = useState<'ok' | 'no'>('ok');
  const [busy, setBusy] = useState(false);

  const close = () => setCurrent(null);

  const doApprove = async (opinion: string) => {
    if (!current) return;
    setBusy(true);
    try {
      await approve({
        url: `admin/withdrawals/${current.id}/approve`,
        method: 'post',
        values: { note: opinion },
      });
      message.success(t('pages.enum.markedPaid'));
      close();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.toast.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const doReject = async (reason: string) => {
    if (!current) return;
    setBusy(true);
    try {
      await reject({
        url: `admin/withdrawals/${current.id}/reject`,
        method: 'post',
        values: { reason },
      });
      message.success(t('pages.enum.rejectedRefunded'));
      close();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.toast.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <GenericListPage
        title={t('menu.admin.withdrawals')}
        sub="提现审批 · 到账确认"
        chip="总台 · 财务中心"
        resource="admin/withdrawals"
        searchable
        searchField={['provider', 'nickname']}
        searchPlaceholder="搜索服务商昵称…"
        chipFilters={[
          { label: '全部', value: 'all' },
          { label: '待审核', value: 'pending', field: 'status' },
          { label: '已通过', value: 'paid', field: 'status' },
          { label: '已驳回', value: 'failed', field: 'status' },
        ]}
        columns={[
          {
            title: t('pages.col.provider'),
            dataIndex: ['provider', 'nickname'],
            width: 140,
            render: (v: string) => v || '—',
          },
          {
            title: t('pages.col.phone'),
            dataIndex: ['provider', 'phone'],
            width: 140,
            render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
          },
          {
            title: t('pages.col.withdrawAmount'),
            dataIndex: 'amount',
            align: 'right',
            width: 120,
            render: (v: number) => (
              <span
                style={{
                  color: T.accent,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: T.fontNum,
                }}
              >
                {formatCents(v)}
              </span>
            ),
          },
          {
            title: t('pages.col.status'),
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <StatusTag value={v} />,
          },
          {
            title: t('pages.col.appliedAt'),
            dataIndex: 'createdAt',
            width: 170,
            render: (v: string) =>
              v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—',
          },
        ]}
        rowActions={(r: WithdrawalRow) =>
          r.status === 'pending' ? (
            <>
              {actLink('通过', 'ok', () => {
                setCurrent(r);
                setMode('ok');
              }, readonly)}
              {actLink('驳回', 'bad', () => {
                setCurrent(r);
                setMode('no');
              }, readonly)}
            </>
          ) : (
            <Text type="secondary">已处理</Text>
          )
        }
      />

      <ReviewModal
        open={!!current}
        tag="提现"
        title="提现审核"
        readonly={readonly}
        loading={busy}
        onClose={close}
        opinion
        opinionRequired={mode === 'no'}
        approveText={mode === 'no' ? '确认驳回' : '通过'}
        onApprove={mode === 'no' ? doReject : doApprove}
        fields={
          current
            ? [
                { label: t('pages.col.provider'), value: current.provider?.nickname || '—' },
                { label: t('pages.col.phone'), value: current.provider?.phone || '—' },
                { label: t('pages.col.withdrawAmount'), value: formatCents(current.amount) },
                { label: t('pages.col.status'), value: <StatusTag value={current.status} /> },
                {
                  label: t('pages.col.appliedAt'),
                  value: new Date(current.createdAt).toLocaleString('zh-CN', { hour12: false }),
                },
              ]
            : []
        }
      />
    </>
  );
};

export default WithdrawalList;
