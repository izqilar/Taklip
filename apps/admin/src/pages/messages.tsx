import { useEffect, useMemo, useState } from 'react';
import { Select, Form, Input, Typography, message as antdMessage } from 'antd';
import { dataProvider } from '../providers/dataProvider';
import { getStoredUser } from '../utility';
import { StatusTag } from '../components/common/StatusTag';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { ReviewModal } from '../components/ui/ReviewModal';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { useLayer } from '../providers/layerContext';
import { t } from "../i18n/t";
import { publisherText } from '../config/labels';

const PAGE_SIZE = 15;

const { Text } = Typography;

const MSG_TYPE: Record<string, string> = {
  ANNOUNCEMENT: t("pages.msg.authorityNotice"),
  ANNOUNCED: t("pages.msg.authorityNotice"),
  NOTICE: t("pages.msg.generalMsg"),
  APPEAL: t("pages.fb.appeal"),
};
const MSG_SCOPE: Record<string, string> = {
  GLOBAL: t("pages.lbl.global"),
  REGION: t("pages.col.regionSlash"),
  OWN: t("pages.col.targetRole"),
};
const MSG_STATUS: Record<string, { key: string; color: string }> = {
  DRAFT: { key: 'pages.enum.draft', color: 'default' },
  PENDING: { key: 'pages.enum.pending', color: 'orange' },
  PUBLISHED: { key: 'pages.enum.published', color: 'green' },
  REJECTED: { key: 'pages.enum.rejected', color: 'red' },
};
const ROLE_LABEL: Record<string, string> = {
  USER: 'pages.col.user',
  SERVICE_PROVIDER: 'pages.col.provider',
  AGENT: 'pages.col.agent',
  ADMIN: 'pages.col.admin',
};

export const MessageList = () => {
  const { readonly } = useLayer();
  const me = getStoredUser<{ role: string; regionPath?: string | null; id: string }>();
  const role = me?.role;
  const isAdmin = role === 'ADMIN';
  const isAgent = role === 'AGENT';
  const isSp = role === 'SERVICE_PROVIDER';

  // 原型消息中心：收件箱 / 公告审核（仅总台）/ 发布管理 由胶囊筛选切换
  const [tab, setTab] = useState<string>('inbox');
  const [inbox, setInbox] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  // 发布表单
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // 审核抽屉（B 类查看+审核，文档 §9.1 / 消息中心审核流）
  const [auditCurrent, setAuditCurrent] = useState<any>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditBusy, setAuditBusy] = useState(false);

  const msgStatusTag = (s: string) => {
    if (s === 'DRAFT') return <StatusTag value="INACTIVE" />;
    return <StatusTag value={s} />;
  };

  const loadInbox = async () => {
    setLoading(true);
    try {
      const { data } = await dataProvider.custom!({ url: 'messages', method: 'get' });
      setInbox(Array.isArray(data) ? data : []);
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.loadInboxFailed'));
    } finally {
      setLoading(false);
    }
  };
  const loadAudit = async () => {
    setLoading(true);
    try {
      const { data } = await dataProvider.custom!({ url: 'messages/audit', method: 'get' });
      setPending(Array.isArray(data) ? data : []);
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.loadReviewQueueFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'inbox') loadInbox();
    if (tab === 'audit') loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const getTypeOptions = () => {
    if (isSp) return [{ value: 'NOTICE', label: MSG_TYPE.NOTICE }];
    if (isAgent) return [{ value: 'ANNOUNCEMENT', label: MSG_TYPE.ANNOUNCEMENT }, { value: 'NOTICE', label: MSG_TYPE.NOTICE }];
    return [{ value: 'ANNOUNCEMENT', label: MSG_TYPE.ANNOUNCEMENT }, { value: 'NOTICE', label: MSG_TYPE.NOTICE }];
  };
  // 发布范围：代理商固定辖区；服务商固定指定角色；管理员可选全局/区域
  const scopeOptions = isAdmin
    ? [{ value: 'GLOBAL', label: MSG_SCOPE.GLOBAL }, { value: 'REGION', label: MSG_SCOPE.REGION }]
    : isAgent
      ? [{ value: 'REGION', label: MSG_SCOPE.REGION }]
      : [{ value: 'OWN', label: MSG_SCOPE.OWN }];

  const submit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await dataProvider.custom!({ url: 'messages', method: 'post', payload: v });
      antdMessage.success(t('pages.toast.msgSubmitted') + (isAgent && v.type === 'ANNOUNCEMENT' ? t('pages.note.waitConsoleReview') : t('pages.btn.andPublish')));
      setDrawerOpen(false);
      form.resetFields();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.publishFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const audit = async (id: string, action: 'approve' | 'reject', note?: string) => {
    try {
      await dataProvider.custom!({
        url: `messages/${id}/${action}`,
        method: 'patch',
        payload: action === 'reject' ? { note } : {},
      });
      antdMessage.success(action === 'approve' ? t('pages.enum.approvedPublished') : t('pages.enum.rejected'));
      loadAudit();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed'));
    }
  };

  const inboxCols = useMemo(
    () => [
      { title: t("pages.col.type"), dataIndex: 'type', width: 110, render: (t: string) => MSG_TYPE[t] ?? t },
      {
        title: t("pages.lbl.scope"),
        dataIndex: 'scope',
        width: 100,
        render: (s: string, r: any) => (s === 'REGION' ? `${MSG_SCOPE.REGION}${r.regionPath ? `(${r.regionPath})` : ''}` : MSG_SCOPE[s]),
      },
      { title: t("pages.col.title"), dataIndex: 'title', ellipsis: true },
      {
        title: t("pages.col.publisher"),
        dataIndex: ['author', 'nickname'],
        width: 120,
        render: (_: any, r: any) => publisherText(r.author, r.authorRole),
      },
      {
        title: t("pages.col.time"),
        dataIndex: 'createdAt',
        width: 160,
        render: (v: string) => new Date(v).toLocaleString('zh-CN'),
      },
    ],
    [],
  );

  const auditCols = useMemo(
    () => [
      { title: t("pages.col.type"), dataIndex: 'type', width: 110, render: (t: string) => MSG_TYPE[t] ?? t },
      { title: t("pages.col.title"), dataIndex: 'title', ellipsis: true },
      {
        title: t("pages.col.content"),
        dataIndex: 'content',
        ellipsis: true,
        render: (v: string) => <Text type="secondary">{v}</Text>,
      },
      {
        title: t("pages.col.publishAgent"),
        dataIndex: ['author', 'nickname'],
        width: 120,
        render: (_: any, r: any) => publisherText(r.author, r.authorRole),
      },
      {
        title: t("pages.col.action"),
        key: 'op',
        width: 72,
        render: (_: any, r: any) => (
          <div style={{ display: 'flex', gap: 12 }}>
            <span
              onClick={
                readonly
                  ? undefined
                  : () => {
                      setAuditCurrent(r);
                      setAuditOpen(true);
                    }
              }
              style={{
                fontSize: 13,
                cursor: readonly ? 'not-allowed' : 'pointer',
                color: readonly ? T.ink3 : T.ink2,
                opacity: readonly ? 0.55 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {t('common.approve')}
            </span>
          </div>
        ),
      },
    ],
    [t, readonly],
  );

  const rows = tab === 'audit' ? pending : inbox;
  const submitted = tab === 'audit' ? pending.filter((m) => m.status !== 'PENDING') : [];
  const shown = tab === 'publish' ? submitted : rows;

  return (
    <>
      <PageHead
        title={t('menu.admin.messages')}
        sub="收件箱 / 权威公告审核 · 同业务两段合一"
        chip={isAdmin ? '总台 · 消息中心' : '消息中心'}
      />

      <FilterBar
        filters={[
          { label: t("pages.lbl.inbox"), value: 'inbox' },
          ...(isAdmin
            ? [
                {
                  label: `${t('pages.sec.authorityNoticeReview')}${pending.length ? `（${pending.length}）` : ''}`,
                  value: 'audit',
                },
              ]
            : []),
          { label: t("pages.sec.publishManage"), value: 'publish' },
        ]}
        activeFilter={tab}
        onFilterChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        searchable
        searchPlaceholder="搜索消息标题…"
        searchValue={keyword}
        onSearchChange={setKeyword}
        onSearch={setKeyword}
        actions={
          <button
            type="button"
            disabled={readonly}
            onClick={() => setDrawerOpen(true)}
            style={{
              border: `1px solid ${T.accent}`,
              borderRadius: T.rSm,
              padding: '6px 13px',
              background: T.accent,
              color: T.onAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: readonly ? 'not-allowed' : 'pointer',
              opacity: readonly ? 0.45 : 1,
              minHeight: 0,
              lineHeight: 1.6,
            }}
          >
            ＋ 发布公告
          </button>
        }
      />

      {tab === 'publish' && (
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
          <span>
            {isAgent
              ? t('pages.note.publishHintAgent')
              : isSp
                ? t('pages.note.publishHintSp')
                : t('pages.note.publishHintAdmin')}
          </span>
        </div>
      )}

      <Panel
        title={<span>{t('menu.admin.messages')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{shown.length}</b> 条 · 数据隔离由后端强制
          </>
        }
      >
        {tab === 'audit' ? (
          <DataTable<any>
            rowKey="id"
            loading={loading}
            dataSource={shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
            scroll={{ x: 900 }}
            locale={{ emptyText: <EmptyState description={t("pages.empty.noPendingNotice")} /> }}
            columns={auditCols}
          />
        ) : (
          <DataTable<any>
            rowKey="id"
            loading={loading}
            dataSource={shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
            scroll={{ x: 900 }}
            columns={inboxCols}
          />
        )}
        <Pager total={shown.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      {/* 发布公告（原型 .modal）：表单置于弹窗体内，提交按钮在弹窗底部操作组 */}
      <ReviewModal
        open={drawerOpen}
        tag="公告"
        title={t("pages.btn.publishMsg")}
        readonly={readonly}
        loading={submitting}
        approveText={t('common.submit')}
        onApprove={submit}
        onClose={() => setDrawerOpen(false)}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 14 }}
          initialValues={{
            type: isSp ? 'NOTICE' : 'ANNOUNCEMENT',
            scope: isAdmin ? 'GLOBAL' : isAgent ? 'REGION' : 'OWN',
          }}
        >
          <Form.Item name="type" label={t("pages.field.msgType")} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
            <Select options={getTypeOptions()} />
          </Form.Item>
          <Form.Item name="scope" label={t("pages.field.publishScope")} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
            <Select options={scopeOptions} disabled={!isAdmin} />
          </Form.Item>
          {isAdmin && (
            <Form.Item noStyle shouldUpdate={(p: any, c: any) => p.scope !== c.scope}>
              {({ getFieldValue }) =>
                getFieldValue('scope') === 'REGION' ? (
                  <Form.Item
                    name="regionPath"
                    label={t("pages.col.regionPath")}
                    tooltip={t("pages.ph.regionAllHint")}
                    style={{ marginBottom: 12 }}
                  >
                    <Input placeholder={t("pages.ph.regionPathHint")} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          )}
          {!isAdmin && !isAgent && (
            <Form.Item
              name="targetRole"
              label={t("pages.field.receiveRole")}
              rules={[{ required: true, message: '请选择接收角色' }]}
              style={{ marginBottom: 12 }}
            >
              <Select
                options={[
                  { value: 'USER', label: t(ROLE_LABEL.USER) },
                  { value: 'AGENT', label: t(ROLE_LABEL.AGENT) },
                  { value: 'ADMIN', label: t(ROLE_LABEL.ADMIN) },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label={t("pages.col.title")} rules={[{ required: true, message: '请输入标题' }]} style={{ marginBottom: 12 }}>
            <Input maxLength={120} placeholder={t("pages.field.msgTitle")} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t("pages.col.content")}
            rules={[{ required: true, message: t('pages.msg.plsInputContent') }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={6} maxLength={4000} placeholder={t("pages.field.msgContent")} />
          </Form.Item>
        </Form>
      </ReviewModal>

      <ReviewModal
        open={auditOpen}
        tag="公告"
        title={
          auditCurrent
            ? `${t('pages.sec.authorityNoticeReview')} · ${auditCurrent.title}`
            : t('pages.sec.authorityNoticeReview')
        }
        readonly={readonly}
        loading={auditBusy}
        opinion
        opinionRequired
        approveText={t("pages.btn.approvePublish")}
        onApprove={async () => {
          if (!auditCurrent) return;
          setAuditBusy(true);
          try {
            await audit(auditCurrent.id, 'approve');
            setAuditOpen(false);
          } finally {
            setAuditBusy(false);
          }
        }}
        onReject={async (reason: string) => {
          if (!auditCurrent) return;
          setAuditBusy(true);
          try {
            await audit(auditCurrent.id, 'reject', reason);
            setAuditOpen(false);
          } finally {
            setAuditBusy(false);
          }
        }}
        onClose={() => setAuditOpen(false)}
        fields={
          auditCurrent
            ? [
                { label: t("pages.col.type"), value: MSG_TYPE[auditCurrent.type] ?? auditCurrent.type },
                { label: t("pages.col.title"), value: auditCurrent.title },
                {
                  label: t("pages.col.content"),
                  value: auditCurrent.content || '—',
                },
                {
                  label: t("pages.col.publishAgent"),
                  value: publisherText(auditCurrent.author, auditCurrent.authorRole),
                },
                {
                  label: t("pages.col.status"),
                  value: msgStatusTag(auditCurrent.status),
                },
                {
                  label: t("pages.col.time"),
                  value: auditCurrent.createdAt
                    ? new Date(auditCurrent.createdAt).toLocaleString('zh-CN', { hour12: false })
                    : '—',
                },
              ]
            : []
        }
      />
    </>
  );
};
