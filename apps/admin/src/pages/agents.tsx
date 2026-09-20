import { Form, Input, Button, message, Modal, Select } from 'antd';
import { useParsed } from '@refinedev/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenericListPage } from '../components/GenericListPage';
import { StatusTag } from '../components/common/StatusTag';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { RegionCascader } from '../components/RegionCascader';
import { dataProvider } from '../providers/dataProvider';
import { T } from '../config/theme';
import { t } from "../i18n/t";
import { formatCents } from '../utility';


interface IAgent {
  id: string;
  phone?: string;
  nickname?: string;
  regionPath?: string;
  regionId?: string;
  status?: string;
  regionNamePath?: string;
  providerCount?: number;
  monthlyTurnoverCents?: number;
}

type ModalMode = 'view' | 'edit' | null;

const USER_STATUS_OPTIONS = [
  { label: t('status.ACTIVE'), value: 'ACTIVE' },
  { label: t('status.PENDING_RECHECK'), value: 'PENDING_RECHECK' },
  { label: t('status.DISABLED'), value: 'DISABLED' },
];

/** 行操作链接（原型 .acts .l） */
const actLink = (label: string, color: string, onClick: () => void) => (
  <span onClick={onClick} style={{ fontSize: 13, cursor: 'pointer', color, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

/** 弹窗标题头（原型 .modal h3） */
const ModalHead = ({ tag, title, onClose }: { tag: string; title: string; onClose: () => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: T.ink1 }}>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: T.accentSoft,
        color: T.accent,
      }}
    >
      {tag}
    </span>
    <span>{title}</span>
    <span onClick={onClose} style={{ marginLeft: 'auto', color: T.ink3, cursor: 'pointer', fontSize: 14 }}>
      ✕
    </span>
  </div>
);

/** 查看弹窗：kv 布局（原型 .modal .kv） */
const ViewModal = ({
  open,
  agent,
  onClose,
  onEdit,
}: {
  open: boolean;
  agent?: IAgent;
  onClose: () => void;
  onEdit: () => void;
}) => {
  if (!agent) return null;
  const items = [
    { label: t('pages.col.agentName'), value: agent.nickname || agent.phone || '—' },
    { label: t('pages.field.belongRegion'), value: agent.regionNamePath || '—' },
    { label: t('pages.col.providerCount'), value: agent.providerCount ?? '—' },
    { label: t('pages.col.monthlyTurnover'), value: formatCents(agent.monthlyTurnoverCents ?? 0) },
    { label: t('pages.col.status'), value: <StatusTag value={agent.status} /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={520}
      styles={{
        content: { borderRadius: T.rLg, padding: 20, background: T.bg },
        body: { padding: 0 },
      }}
      title={<ModalHead tag={t('pages.tag.agent')} title={t('pages.sec.agentDetail')} onClose={onClose} />}
    >
      <dl style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: '6px 12px', fontSize: 13, margin: '14px 0 0' }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'contents' }}>
            <dt style={{ color: T.ink3 }}>{it.label}</dt>
            <dd style={{ color: T.ink1, fontWeight: 600, margin: 0 }}>{it.value}</dd>
          </div>
        ))}
      </dl>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        <Button onClick={onEdit}>{t('common.edit')}</Button>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
};

/** 编辑弹窗（原型 .modal .fd） */
const EditModal = ({
  open,
  agent,
  onClose,
  onSaved,
}: {
  open: boolean;
  agent?: IAgent;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !agent) return;
    form.setFieldsValue({
      nickname: agent.nickname,
      regionId: agent.regionId,
      status: agent.status,
      phone: agent.phone,
    });
  }, [open, agent, form]);

  const save = async () => {
    const values = (await form.validateFields().catch(() => null)) as
      | { nickname?: string; regionId?: string; status?: string; phone?: string }
      | null;
    if (!values?.regionId) {
      message.warning(t('pages.toast.selectRegion'));
      return;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({
        url: `admin/agents/${agent?.id}`,
        method: 'patch',
        payload: values,
      });
      message.success(t('pages.toast.saveOk'));
      onSaved();
    } catch (e: any) {
      message.error(e?.message || t('pages.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={520}
      styles={{
        content: { borderRadius: T.rLg, padding: 20, background: T.bg },
        body: { padding: 0 },
      }}
      title={<ModalHead tag={t('pages.tag.agent')} title={t('pages.sec.agentDetail')} onClose={onClose} />}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 14 }}>
        <Form.Item
          label={t('pages.col.agentName')}
          name="nickname"
          rules={[{ required: true, message: t('pages.msg.required') }]}
        >
          <Input placeholder={t('pages.col.agentName')} />
        </Form.Item>
        <Form.Item
          label={t('pages.field.bindRegion')}
          name="regionId"
          rules={[{ required: true, message: t('pages.toast.selectRegion') }]}
        >
          <RegionCascader />
        </Form.Item>
        <Form.Item
          label={t('pages.col.status')}
          name="status"
          rules={[{ required: true, message: t('pages.msg.required') }]}
        >
          <Select options={USER_STATUS_OPTIONS} placeholder={t('pages.ph.pleaseSelect')} />
        </Form.Item>
        <Form.Item
          label={t('pages.field.contactPhone')}
          name="phone"
          rules={[{ required: true, message: t('pages.msg.required') }]}
        >
          <Input placeholder={t('pages.col.agentPhone')} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button type="primary" loading={saving} onClick={save}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </Form>
    </Modal>
  );
};

export const AgentList = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ModalMode>(null);
  const [current, setCurrent] = useState<IAgent | undefined>();
  const [refreshTick, setRefreshTick] = useState(0);

  const openView = (record: IAgent) => {
    setCurrent(record);
    setMode('view');
  };

  const openEdit = (record: IAgent) => {
    setCurrent(record);
    setMode('edit');
  };

  const close = () => {
    setMode(null);
    setCurrent(undefined);
  };

  const onSaved = () => {
    close();
    setRefreshTick((n) => n + 1);
  };

  return (
    <>
      <GenericListPage
        key={refreshTick}
        title={t('pages.sec.agentManage')}
        sub="代理商与辖区绑定 · 绩效排行"
        chip="总台"
        resource="admin/agents"
        searchable
        searchField="nickname"
        searchPlaceholder="搜索代理商名称 / 手机号…"
        chipFilters={[
          { label: '全部', value: 'all' },
          { label: '正常', value: 'ACTIVE', field: 'status' },
          { label: '待复核', value: 'PENDING_RECHECK', field: 'status' },
          { label: '停用', value: 'DISABLED', field: 'status' },
        ]}
        createPath="/admin/agents/create"
        onCreate={() => navigate('/admin/agents/create')}
        columns={[
          {
            title: t('pages.col.agent'),
            dataIndex: 'nickname',
            width: 160,
            render: (v: string, r: IAgent) => v || r.phone || '—',
          },
          { title: t('pages.col.phone'), dataIndex: 'phone', width: 140 },
          {
            title: t('pages.field.jurisdictionRegion'),
            dataIndex: 'regionNamePath',
            ellipsis: true,
            render: (v?: string) => (
              <span style={{ color: T.ink3 }}>{v || '—'}</span>
            ),
          },
          {
            title: t('pages.col.status'),
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <StatusTag value={v} />,
          },
        ]}
        rowActions={(record: IAgent) => (
          <>
            {actLink(t('common.view'), T.accent, () => openView(record))}
            {actLink(t('common.edit'), T.ink2, () => openEdit(record))}
          </>
        )}
      />
      <ViewModal open={mode === 'view'} agent={current} onClose={close} onEdit={() => setMode('edit')} />
      <EditModal open={mode === 'edit'} agent={current} onClose={close} onSaved={onSaved} />
    </>
  );
};

export const AgentCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const values = (await form.validateFields().catch(() => null)) as
      | { phone?: string; password?: string; nickname?: string; regionId?: string }
      | null;
    if (!values?.regionId) {
      message.warning(t('pages.toast.selectRegion'));
      return;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({
        url: 'admin/agents',
        method: 'post',
        payload: values,
      });
      message.success(t('pages.toast.saveOk'));
      navigate('/admin/agents');
    } catch (e: any) {
      message.error(e?.message || t('pages.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title="新建代理商" chip="总台 · 代理商管理" />
      <Panel title="代理商资料">
        <div style={{ padding: 16, maxWidth: 520 }}>
          <Form form={form} layout="vertical">
            <Form.Item
              label={t('pages.col.phone')}
              name="phone"
              rules={[{ required: true, message: t('pages.msg.required') }]}
            >
              <Input placeholder={t('pages.col.agentPhone')} />
            </Form.Item>
            <Form.Item
              label={t('pages.field.password')}
              name="password"
              rules={[{ required: true, message: t('pages.msg.required') }]}
            >
              <Input.Password placeholder={t('pages.field.initPassword')} />
            </Form.Item>
            <Form.Item label={t('pages.col.nickname')} name="nickname">
              <Input placeholder={t('pages.col.agentName')} />
            </Form.Item>
            <Form.Item
              label={t('pages.field.jurisdictionArea')}
              name="regionId"
              rules={[{ required: true, message: t('pages.toast.selectRegion') }]}
            >
              <RegionCascader />
            </Form.Item>
            <p style={{ color: T.ink3, fontSize: 13 }}>{t('pages.note.agentScope')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="primary" loading={saving} onClick={submit}>
                {t('common.save')}
              </Button>
              <Button onClick={() => navigate('/admin/agents')}>{t('common.cancel')}</Button>
            </div>
          </Form>
        </div>
      </Panel>
    </>
  );
};

export const AgentEdit = () => {
  const { id } = useParsed<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<IAgent | undefined>();

  useEffect(() => {
    (async () => {
      try {
        const res: any = await dataProvider.custom!({
          url: `admin/agents/${id}`,
          method: 'get',
        });
        const row = (res?.data?.data ?? res?.data) as IAgent | undefined;
        setAgent(row);
        form.setFieldsValue({ phone: row?.phone, regionId: row?.regionId });
      } catch {
        /* 错误交由页面空态承接 */
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  const save = async () => {
    const values = (await form.validateFields().catch(() => null)) as
      | { regionId?: string }
      | null;
    if (!id || !values?.regionId) {
      message.warning(t('pages.toast.selectRegion'));
      return;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({
        url: `admin/agents/${id}/region`,
        method: 'patch',
        payload: { regionId: values.regionId },
      });
      message.success(t('pages.toast.regionUpdated'));
      navigate('/admin/agents');
    } catch (e: any) {
      message.error(e?.message || t('pages.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title={t('common.edit')} chip="总台 · 代理商管理" />
      <Panel title="代理商资料">
        <div style={{ padding: 16, maxWidth: 520 }}>
          {loading ? (
            <p style={{ color: T.ink3 }}>{t('common.loading')}</p>
          ) : (
            <Form form={form} layout="vertical">
              <Form.Item label={t('pages.col.phone')} name="phone">
                <Input disabled />
              </Form.Item>
              <Form.Item
                label={t('pages.field.jurisdictionArea')}
                name="regionId"
                rules={[{ required: true, message: t('pages.toast.selectRegion') }]}
              >
                <RegionCascader />
              </Form.Item>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" loading={saving} onClick={save}>
                  {t('common.save')}
                </Button>
                <Button onClick={() => navigate('/admin/agents')}>{t('common.cancel')}</Button>
              </div>
            </Form>
          )}
        </div>
      </Panel>
    </>
  );
};
