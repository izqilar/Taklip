/**
 * 代理商 · 招商申请（拓客登记入口）。
 * 复用 POST /api/agent/recruits（regionPath 由后端辖区推导，前端无需选择区域，保证辖区隔离）。
 * 表单：意向主体名称（必填）、手机号（必填·11 位）、意向区域/备注（选填）、说明（选填）。
 * 下方同步展示辖区内最近登记的招商意向，便于即时确认落库。
 */
import { useCallback, useEffect, useState } from 'react';
import { Form, Input, Button, Alert, Modal, message as antdMessage } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';
import { API_URL, authHeaders } from '../utility';

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

export const AgentInvest = ({ variant = 'agent' }: { variant?: 'agent' | 'admin' }) => {
  const isAdmin = variant === 'admin';
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [jur, setJur] = useState<{ name?: string; regionPath?: string } | null>(null);

  // 拉取登录者自身辖区（getMe 带 region 关联），用于「归属辖区」只读提示
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_URL + '/auth/me', { headers: authHeaders() });
        if (res.ok) {
          const me: any = await res.json();
          setJur({ name: me?.region?.name, regionPath: me?.regionPath });
        }
      } catch {
        /* 忽略：不阻塞表单 */
      }
    })();
  }, []);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'agent/recruits', method: 'get' });
      const items = Array.isArray(r?.data?.items) ? r.data.items : [];
      setRecent(items.slice(0, 10));
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await dataProvider.custom!({
        url: 'agent/recruits',
        method: 'post',
        payload: {
          name: values.name.trim(),
          phone: values.phone.trim(),
          regionPath: isAdmin ? (values.regionPath || '').toString().trim() || undefined : undefined,
          regionLabel: isAdmin
            ? (values.regionLabel || (values.regionPath || '').toString().trim().split('/').pop() || '').toString().trim() || null
            : (values.regionLabel || '').toString().trim() || null,
          intro: (values.intro || '').toString().trim() || null,
        },
      });
      antdMessage.success(t('toast.recruitCreated', '招商意向已登记'));
      form.resetFields();
      loadRecent();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
    } finally {
      setSubmitting(false);
    }
  };

  /** 招商意向 → 入驻邀请：只置 WON 并产出邀请链接，申请由意向主体本人提交（代理不代客填材料） */
  const convertToInvite = async (row: any) => {
    try {
      const r: any = await dataProvider.custom!({
        url: `agent/recruits/${row.id}/convert`,
        method: 'post',
      });
      Modal.success({
        title: t('pages.lbl.inviteCreated', '已转为入驻邀请'),
        content: (
          <div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              {t('pages.desc.inviteHint', '请将链接发送给意向主体，由其本人完成注册与资料提交（代理商不代填材料，避免既招揽又自审）')}
            </div>
            <Input.TextArea readOnly rows={3} value={r?.data?.inviteUrl ?? ''} />
          </div>
        ),
        okText: t('button.cancel', '关闭'),
      });
      loadRecent();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
    }
  };

  const recentCols: any[] = [
    { title: t('col.name', '名称'), dataIndex: 'name', ellipsis: true },
    { title: t('col.phone', '手机'), dataIndex: 'phone', width: 140 },
    { title: t('col.region', '区域'), dataIndex: 'regionLabel', ellipsis: true, render: (v: string) => v || '—' },
    { title: t('col.stage', '阶段'), dataIndex: 'stage', width: 100, render: (v: string) => stagePill(v) },
    { title: t('col.createdAt', '创建时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 110,
      render: (_: any, r: any) =>
        r.stage === 'WON' ? (
          <span style={{ color: T.ink3, fontSize: 13 }}>—</span>
        ) : (
          <span
            onClick={() => convertToInvite(r)}
            style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {t('btn.convertToInvite', '转为入驻')}
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHead
        title={isAdmin ? t('pages.sec.investAdmin', '招商申请 · 全平台') : t('sec.recruit', '招商意向')}
        sub={isAdmin ? t('pages.desc.investAdminSub', '全平台招商意向登记 · 请指定归属区域路径，提交后纳入对应辖区台账') : t('pages.desc.agentInvestSub', '辖区内拓客登记 · 提交后归属本代理商，区域由系统按辖区自动锁定')}
        chip={isAdmin ? '总台 · 全盘治理' : '代理商 · 招商申请'}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 16, alignItems: 'start' }}>
        <Panel title={t('pages.lbl.registerRecruit', '登记招商意向')}>
          {isAdmin ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('pages.lbl.regionPath', '归属区域路径')}
              description={t('pages.desc.investAdminRegionHint', '总台登记需指定意向主体所属区域路径（如：新疆/乌鲁木齐/天山区），提交后纳入对应辖区台账')}
            />
          ) : (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('pages.lbl.lockedJurisdiction', '归属辖区（系统自动锁定）')}
              description={
                jur?.name
                  ? `${jur.name}${jur.regionPath ? ` · ${jur.regionPath}` : ''}`
                  : t('pages.desc.loadingJurisdiction', '正在读取您的辖区…')
              }
            />
          )}
          <Form form={form} layout="vertical" requiredMark="optional">
            {isAdmin && (
              <Form.Item
                label={t('pages.lbl.regionPath', '归属区域路径')}
                name="regionPath"
                rules={[{ required: true, message: t('pages.rule.regionPathRequired', '请填写归属区域路径') }]}
              >
                <Input placeholder={t('pages.ph.regionPath', '如：新疆/乌鲁木齐/天山区')} maxLength={120} />
              </Form.Item>
            )}
            <Form.Item
              label={t('col.name', '名称')}
              name="name"
              rules={[{ required: true, message: t('pages.rule.nameRequired', '请填写意向主体名称') }]}
            >
              <Input placeholder={t('pages.ph.recruitName', '如：某某文化传媒有限公司')} maxLength={60} />
            </Form.Item>
            <Form.Item
              label={t('col.phone', '手机')}
              name="phone"
              rules={[
                { required: true, message: t('pages.rule.phoneRequired', '请填写联系电话') },
                { pattern: /^\d{11}$/, message: t('pages.rule.phone11', '手机号须为 11 位数字') },
              ]}
            >
              <Input placeholder="13800000000" maxLength={11} inputMode="numeric" />
            </Form.Item>
            <Form.Item label={t('col.region', '意向区域/备注')} name="regionLabel">
              <Input placeholder={t('pages.ph.recruitRegion', '选填 · 例如：高新区')} maxLength={60} />
            </Form.Item>
            <Form.Item label={t('col.intro', '说明')} name="intro">
              <Input.TextArea rows={3} placeholder={t('pages.ph.recruitIntro', '选填 · 意向来源 / 对接人 / 诉求')} maxLength={300} />
            </Form.Item>
            <Button type="primary" loading={submitting} onClick={onSubmit} block>
              {t('btn.submit', '提交登记')}
            </Button>
          </Form>
        </Panel>

        <Panel
          title={t('pages.lbl.recentRecruit', '最近登记')}
          hint={<>{isAdmin ? '全平台 ' : ''}{t('pages.enum.all', '全部')} <b style={{ color: T.accent }}>{recent.length}</b> {t('pages.enum.unit', '条')}</>}
        >
          <DataTable<any>
            rowKey="id"
            dataSource={recent}
            loading={loadingRecent}
            scroll={{ x: 700 }}
            locale={{ emptyText: <EmptyState description={t('empty.noRecruit', '辖区内暂无招商意向')} /> }}
            columns={recentCols}
          />
        </Panel>
      </div>
    </>
  );
};

export default AgentInvest;
