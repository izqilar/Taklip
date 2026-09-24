/**
 * 入驻审批台（总台 ADMIN）—— 用户「入驻」资格升级隧道的两阶段审核。
 *
 * 与「加入团队」隧道的区别（勿混用）：
 *   · 加入：由目标团队拥有者审批，只建立员工关系，身份不变；
 *   · 入驻：由总台 ADMIN 审批（初审 → 用户补资料 → 终审），
 *          终审通过后**变更 User.role**（服务商 / 代理商），登录落点自动切换到对应工作台。
 *
 * 数据：GET /api/admin/qualifications；审核：POST /api/user/qualifications/:id/review（ADMIN）。
 * 状态：FIRST_PENDING 待初审 → FIRST_PASSED 待补资料 → FINAL_PENDING 待终审 → APPROVED / REJECTED。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
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

const fmtTime = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

export const QualificationReviewPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'admin/qualifications', method: 'get' });
      setRows(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const review = async (id: string, pass: boolean, final: boolean) => {
    setActing(true);
    try {
      await dataProvider.custom!({
        url: `user/qualifications/${id}/review`,
        method: 'post',
        payload: { pass, final },
      });
      message.success(
        final
          ? pass
            ? t('qual.finalPassed', '终审通过，申请人身份已升级')
            : t('qual.finalRejected', '终审已驳回')
          : pass
            ? t('qual.firstPassed', '初审通过，等待申请人补充资料')
            : t('qual.firstRejected', '初审已驳回'),
      );
      await reload();
    } catch (e: any) {
      message.error(e?.message || t('qual.reviewFailed', '审核失败'));
    } finally {
      setActing(false);
    }
  };

  const ask = (row: any, pass: boolean, final: boolean) => {
    const title = final
      ? pass
        ? t('qual.confirmFinalPass', '确认终审通过？通过后该用户将成为服务商 / 代理商主体')
        : t('qual.confirmFinalReject', '确认终审驳回？')
      : pass
        ? t('qual.confirmFirstPass', '确认初审通过？通过后申请人可补充资质资料')
        : t('qual.confirmFirstReject', '确认初审驳回？');
    Modal.confirm({
      title,
      content: `${row.user?.realName || row.user?.nickname || '—'} · ${row.kind === 'agent' ? '代理商' : '服务商'} · ${row.regionLabel ?? '—'}`,
      okText: t('button.confirm', '确定'),
      cancelText: t('button.cancel', '取消'),
      okButtonProps: { danger: !pass, disabled: acting },
      onOk: () => review(row.id, pass, final),
    });
  };

  const columns: any[] = [
    {
      title: t('qual.colApplicant', '申请人'),
      dataIndex: ['user'],
      width: 150,
      render: (_: any, r: any) => r.user?.realName || r.user?.nickname || '—',
    },
    { title: t('qual.colPhone', '手机'), dataIndex: ['user', 'phone'], width: 140 },
    {
      title: t('qual.colKind', '入驻层次'),
      dataIndex: 'kind',
      width: 110,
      render: (v: string) => (v === 'agent' ? '代理商' : '服务商'),
    },
    { title: t('qual.colRegion', '区域'), dataIndex: 'regionLabel', width: 180, render: (v: string) => v ?? '—' },
    { title: t('qual.colReason', '申请说明'), dataIndex: 'reason', ellipsis: true },
    { title: t('col.status', '状态'), dataIndex: 'status', width: 110, render: (v: string) => statusPill(v) },
    { title: t('qual.colCreatedAt', '提交时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmtTime(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 200,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {r.status === 'FIRST_PENDING' && (
            <>
              <span onClick={() => ask(r, true, false)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
                {t('qual.firstPass', '初审通过')}
              </span>
              <span onClick={() => ask(r, false, false)} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
                {t('qual.firstReject', '初审驳回')}
              </span>
            </>
          )}
          {r.status === 'FINAL_PENDING' && (
            <>
              <span onClick={() => ask(r, true, true)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
                {t('qual.finalPass', '终审通过')}
              </span>
              <span onClick={() => ask(r, false, true)} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
                {t('qual.finalReject', '终审驳回')}
              </span>
            </>
          )}
          {(r.status === 'APPROVED' || r.status === 'REJECTED' || r.status === 'FIRST_PASSED') && (
            <span style={{ color: T.ink3, fontSize: 13 }}>{t('qual.noAction', '—')}</span>
          )}
        </div>
      ),
    },
  ];

  const pendingTotal = rows.filter((r) => ['FIRST_PENDING', 'FINAL_PENDING'].includes(r.status)).length;

  return (
    <>
      <PageHead
        title={t('qual.title', '入驻审批')}
        sub={t('qual.sub', '用户资格升级隧道 · 初审 → 补资料 → 终审（终审通过即变更平台身份）')}
        chip="总台 · 运营监管"
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
        }}
      >
        <span>{t('qual.notice', '「入驻」会变更用户平台身份（USER → 服务商 / 代理商），仅总台可裁定；「加入团队」由各团队拥有者自行审批。')}</span>
      </div>
      <Panel
        title={t('qual.panelTitle', '入驻申请队列')}
        hint={
          <>
            {t('qual.pending', '待审')} <b style={{ color: T.accent }}>{pendingTotal}</b> {t('qual.unit', '条')} ·{' '}
            {t('qual.total', '累计')} <b>{rows.length}</b> {t('qual.unit', '条')}
          </>
        }
      >
        <DataTable<any> rowKey="id" dataSource={rows} loading={loading} scroll={{ x: 1100 }} columns={columns} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px' }}>
          <Button onClick={reload}>{t('button.refresh', '刷新')}</Button>
        </div>
      </Panel>
    </>
  );
};

export default QualificationReviewPage;
