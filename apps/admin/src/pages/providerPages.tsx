import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Rate,
  Modal,
  Button,
  message,
} from 'antd';
import { useCustom } from '@refinedev/core';
import { GenericListPage } from '../components/GenericListPage';
import type { ColumnDef, ChipFilter } from '../components/GenericListPage';
import { ReviewModal } from '../components/ui/ReviewModal';
import type { KvField } from '../components/ui/ReviewModal';
import { PageHead } from '../components/ui/PageHead';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { Pill, type PillTone } from '../components/ui/Pill';
import { T, GRID } from '../config/theme';
import { SchemaThumbnail, isProjectLike } from '@h5design/render';
import { formatCents, API_URL, authHeaders } from '../utility';
import { dataProvider, withSubject } from '../providers/dataProvider';
import { cleanCode, categoryText, msgTypeText, publisherText, msgScopeText } from '../config/labels';
import { TICKET_STATUS } from '../config/status';
import { PERIOD, SCHEDULE_STATUS, CONTRACT_TYPE, CONTRACT_STAGE, TEAM_STATUS, TICKET_TYPE, APPLY_STATUS } from '../config/providerConstants';
import { t } from '../i18n/t';
import { useLayer } from '../providers/layerContext';
import { DesignGalleryCard, type DesignActionCaps } from '@h5design/ui';
import { WorkPreviewModal, type WorkPreviewWork } from '../components/user/WorkPreviewModal';
import { WorkShareLinks } from '../components/user/WorkShareLinks';
import type { WorkExportTarget } from '../components/user/WorkExportDialog';

// 导出对话框：与编辑器顶栏「导出」同一个内核弹窗（内含 Konva/GSAP，必须懒加载）
const WorkExportDialog = lazy(() => import('../components/user/WorkExportDialog'));

/** 状态 → 胶囊 */
const stPill = (
  v: string | undefined,
  map: Record<string, { key: string; tone: PillTone }>,
) => {
  const m = map[v ?? ''] ?? { key: v ?? '—', tone: 'mut' as PillTone };
  return <Pill tone={m.tone}>{t(m.key)}</Pill>;
};

const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const money = (v: any) => formatCents(v ?? 0);
const arr = (v: any) => (Array.isArray(v) && v.length ? v.join('、') : '—');

/** 模板审核态（PP 本地，独立于 providerDetailPages 的发布态） */
const TEMPLATE_STATUS: Record<string, { key: string; tone: PillTone }> = {
  PENDING: { key: 'status.draft', tone: 'mut' },
  APPROVED: { key: 'status.PUBLISHED', tone: 'ok' },
  REJECTED: { key: 'status.REJECTED', tone: 'bad' },
  TAKEN_DOWN: { key: 'status.TAKEN_DOWN', tone: 'mut' },
};
/** 前端「我的作品」状态映射（Project.status: draft / published） */
const WORK_STATUS: Record<string, { key: string; tone: PillTone }> = {
  draft: { key: 'status.draft', tone: 'mut' },
  published: { key: 'status.PUBLISHED', tone: 'ok' },
};
const TEAM_SCOPE: Record<string, string> = {
  self: 'pages.status.scopeSelf',
  service: 'pages.status.scopeService',
  provider: 'pages.status.scopeProvider',
};
const TEAM_STATUS_OPTS = (Object.entries(TEAM_STATUS) as [string, { key: string }][]).map(([v, m]) => ({ value: v, label: t(m.key) }));
const TEAM_SCOPE_OPTS = (Object.entries(TEAM_SCOPE) as [string, string][]).map(([v, l]) => ({ value: v, label: t(l) }));
const MSG_TYPE: Record<string, string> = {
  ANNOUNCEMENT: 'pages.status.msgAnnouncement',
  NOTICE: 'pages.status.msgGeneral',
  APPEAL: 'pages.status.tkTypeAppeal',
};
const WD_STATUS: Record<string, { key: string; tone: PillTone }> = {
  pending: { key: 'pages.status.wdPending', tone: 'warn' },
  paid: { key: 'pages.status.wdPaid', tone: 'ok' },
  failed: { key: 'status.REJECTED', tone: 'bad' },
};

const CHIP = '服务商 · 自身作用域';


/** 合同签署流程 5 步（doc §10.6） */
const SIGN_STEPS = [
  { key: 'NEGOTIATING', label: '协商中' },
  { key: 'AWAIT_PROVIDER_SIGN', label: '待服务商签署' },
  { key: 'AWAIT_SENIOR_SIGN', label: '待上级签署' },
  { key: 'APPROVING', label: '审批中' },
  { key: 'EFFECTIVE', label: '已生效' },
];
const signStepIndex = (stage: string) => {
  const i = SIGN_STEPS.findIndex((s) => s.key === stage);
  return i < 0 ? 0 : i;
};

/** ISO 日期 → input[type=date] 值（YYYY-MM-DD），缺失返回空 */
const toDateInput = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

/** 只读星级展示 */
const StarRow = ({ value }: { value: number }) => (
  <Rate disabled allowHalf value={value} style={{ fontSize: 14 }} />
);

/**
 * 列表 + 详情弹窗通用外壳：复用 GenericListPage 的列表/筛选/分页，
 * 行操作「查看」打开统一 ReviewModal（字段经本地枚举映射为可读中文）。
 */
const ListWithDetail = (props: {
  title: string;
  sub?: string;
  resource: string;
  columns: ColumnDef[];
  chipFilters?: ChipFilter[];
  searchable?: boolean;
  searchField?: string | string[];
  searchPlaceholder?: string;
  rowKey?: string;
  pageSize?: number;
  detailTag: string;
  detailTitle: (r: any) => string;
  buildFields: (r: any) => KvField[];
}) => {
  const [sel, setSel] = useState<any>(null);
  const actions = (r: any) => (
    <span
      onClick={() => setSel(r)}
      style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
    >
      查看
    </span>
  );
  return (
    <>
      <GenericListPage
        title={props.title}
        sub={props.sub}
        chip={CHIP}
        resource={props.resource}
        columns={props.columns}
        chipFilters={props.chipFilters}
        searchable={props.searchable}
        searchField={props.searchField}
        searchPlaceholder={props.searchPlaceholder}
        rowKey={props.rowKey}
        pageSize={props.pageSize}
        rowActions={actions}
      />
      <ReviewModal
        open={!!sel}
        tag={props.detailTag}
        title={sel ? props.detailTitle(sel) : ''}
        onClose={() => setSel(null)}
        fields={sel ? props.buildFields(sel) : []}
      />
    </>
  );
};

/* ===================== 档期管理（可编辑 + 冲突检测） ===================== */

export const ScheduleList = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const link = { color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' };
  return (
    <GenericListPage
      title="档期管理"
      sub="服务档期排期 · 接单自动锁定 · 冲突检测"
      chip={CHIP}
      resource="provider/schedules"
      rowKey="id"
      pageSize={20}
      key={tick}
      createLabel="＋ 新建档期"
      onCreate={() => nav('/sp/schedule/new')}
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '可接单', value: 'available', field: 'status', match: 'available' },
        { label: '已锁定', value: 'locked', field: 'status', match: 'locked' },
        { label: '已完成', value: 'done', field: 'status', match: 'done' },
      ]}
      columns={[
        { title: '编号', dataIndex: 'id', width: 130, render: (v: any) => cleanCode(v) },
        { title: '日期', dataIndex: 'date', width: 120, render: (v: any) => (v ? String(v).replace(/^\d{4}-/, '') : '—') },
        { title: '时段', dataIndex: 'period', width: 130, render: (v: any) => t(PERIOD[v]) ?? v },
        { title: '服务', dataIndex: 'serviceType', ellipsis: true },
        { title: '客户', dataIndex: 'customer', width: 110 },
        { title: '状态', dataIndex: 'status', width: 100, render: (v: any) => stPill(v, SCHEDULE_STATUS) },
      ]}
      rowActions={(r: any) => (
        <span onClick={() => nav(`/sp/schedule/${r.id}`)} style={link}>查看 / 编辑</span>
      )}
    />
  );
};

/* ===================== 模板卡片（卡片网格，镜像 web 我的作品 WorkCard） ===================== */
const TemplateCard = ({
  r,
  onDetail,
  onEdit,
  onDelete,
  onUpgrade,
  onPublish,
  onPreview,
}: {
  r: any;
  onDetail: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpgrade?: () => void;
  onPublish?: () => void;
  onPreview?: (w: WorkPreviewWork) => void;
}) => {
  const isWork = r.kind === 'work';
  const { readonly } = useLayer();
  const canWrite = !readonly;
  const meta = (r.schema && r.schema.meta) || {};
  const coverColor = meta.coverColor || (isWork ? '#6a1b4d' : '#D24830');
  const statusMap = isWork ? WORK_STATUS : TEMPLATE_STATUS;
  const st: { key: string; tone: PillTone; text?: string } =
    statusMap[r.status] ?? { key: String(r.status ?? '—'), tone: 'mut' as PillTone };
  const cover = isProjectLike(r.schema) ? (
    <SchemaThumbnail schema={r.schema} />
  ) : (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 18,
        opacity: 0.85,
        letterSpacing: 2,
        background: `linear-gradient(135deg, ${coverColor}, ${coverColor}cc)`,
      }}
    >
      {isWork ? '作品' : categoryText(r.category) || 'H5'}
    </div>
  );

  const [exportFor, setExportFor] = useState<WorkExportTarget | null>(null);

  const capabilities: DesignActionCaps = {
    detail: true,
    preview: true,
    edit: canWrite && !!onEdit,
    export: true,
    delete: canWrite && !!onDelete,
    submitAsTemplate: isWork && canWrite && !!onUpgrade,
    publish: isWork && canWrite && !!onPublish,
  };

  const labels: Record<string, string> = {
    detail: '详情',
    preview: '预览',
    edit: '编辑',
    export: '导出',
    delete: '删除',
    submitAsTemplate: '提交为模板',
    publish: '发布',
  };

  const on: Partial<Record<keyof DesignActionCaps, (it: any) => void>> = {
    detail: () => onDetail(),
    preview: () =>
      onPreview?.({ id: r.id, title: r.name, schema: r.schema, status: r.status, publishCode: r.publishCode }),
    edit: () => onEdit?.(),
    export: () => setExportFor({ id: r.id, title: r.name, schema: r.schema }),
    delete: () => {
      if (confirm(isWork ? '确定删除此作品？不可恢复' : '确定删除此模板？不可恢复')) onDelete?.();
    },
    submitAsTemplate: () => onUpgrade?.(),
    publish: () => onPublish?.(),
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: T.rMd,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(20,24,40,.05)',
        transition: 'box-shadow .18s, transform .18s',
      }}
    >
      <DesignGalleryCard
        kind={isWork ? 'work' : 'template'}
        badgeLabel={st.text ?? t(st.key)}
        capabilities={capabilities}
        labels={labels}
        item={r}
        coverNode={cover}
        on={on}
        aspectRatio="375 / 667"
      />

      {/* 信息区：模板名称 / 分类 / 价格 / 使用次数 / 状态 */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: T.ink1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {r.name || '—'}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 6,
            fontSize: 12,
            color: T.ink2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {!isWork && <span>分类：{categoryText(r.category)}</span>}
          {!isWork && <span>{money(r.price)}</span>}
          {!isWork && <span>使用 {r.useCount ?? 0}</span>}
          {isWork && <span>浏览 {r.viewCount ?? 0}</span>}
          <Pill tone={st.tone}>{t(st.key)}</Pill>
        </div>
        {isWork && r.status === 'published' && r.publishCode && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
            <WorkShareLinks publishCode={r.publishCode} />
          </div>
        )}
      </div>

      {exportFor && (
        <Suspense fallback={null}>
          <WorkExportDialog target={exportFor} onClose={() => setExportFor(null)} />
        </Suspense>
      )}
    </div>
  );
};

/* ===================== 模板管理（合并前端「我的作品」） =====================
   来源标签区分：模板(template) / 作品(work，来自前端「我的作品」)。
   卡片网格展示（镜像 web 我的作品）：封面 + 信息区（名称/分类/价格/使用次数/状态）+ hover 中央「详情 / 编辑」。
   详情 → SPTemplateDetail（元数据表单） / 作品只读页；编辑 → 画布编辑器（/sp/templates/:id/editor，Phase B 落地前的占位见 App.tsx）。 */
/**
 * 作品管理（仅 kind=work）——「服务于内容」分组内、模板管理之上（文档 §2.1）。
 * 数据源 provider/catalog?kind=work（staticFilters 服务端过滤）；复用 TemplateCard 的「作品」渲染分支。
 * 「＋ 新建作品」走 POST /api/provider/works（与 web 端同源，归属按 subjectId 解析）创建空白稿后进入编辑器。
 */
export const WorksList = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  // 预览 / 发布后分享弹窗（提升到此级，便于发布成功后自动弹出含二维码的预览）
  const [previewFor, setPreviewFor] = useState<WorkPreviewWork | null>(null);

  // 新建空白作品：复用 web 端项目创建端点（同一后端、同一 JWT），归属当前服务商
  const handleCreateWork = useCallback(async () => {
    try {
      // 走 provider 域 POST works（与读/删/发布同一归属口径）：subjectId 解析归属，
      // ADMIN 视察服务商视角经 withSubject 注入 ?subject=<服务商id> 代其创建空白稿；
      // 服务商自身视角 subject 为空，归属 req.user.id。
      // 旧实现走 web 域 /api/projects（仅认登录者），视察视角创建的稿归属 ADMIN 而非
      // 被视察服务商，随后 /sp/works/:id/editor 按 subject 读会 404「加载作品失败」。
      const res = await fetch(`${API_URL}/${withSubject('provider/works', 'POST')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: '未命名作品' }),
      });
      if (!res.ok) throw new Error(`创建失败 (${res.status})`);
      const created = (await res.json()) as any;
      const id = created?.id ?? created?.data?.id;
      if (!id) throw new Error('创建作品未返回 id');
      nav(`/sp/works/${id}/editor`);
    } catch (e: any) {
      message.error(e?.message || '新建作品失败');
    }
  }, [nav]);

  // 作品级设计稿：删除（与 web 端作品 hover 统一）。
  // 走 provider 域 DELETE works/:id：ADMIN 视察视角经 withSubject 注入 ?subject= 代删；
  // 旧实现走 web 域 projects/:id（仅认登录者），视察视角必 404「作品不存在」。
  const handleDeleteWork = useCallback(async (id: string) => {
    try {
      await dataProvider.custom!({ url: `provider/works/${id}`, method: 'delete' });
      message.success('作品已删除');
      setTick((t) => t + 1); // 刷新列表
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '删除失败');
    }
  }, []);

  // 作品级设计稿：发布为可见 H5（与 web 端作品 hover 统一）。
  // 走 provider 域 POST works/:id/publish（subject 口径同上），替代 web 域 publish/:id。
  // 发布成功后直接弹出带二维码的预览/分享弹窗，让运营端「发布后能看到去哪了」。
  const handlePublishWork = useCallback(async (r: any) => {
    try {
      const res: any = await dataProvider.custom!({ url: `provider/works/${r.id}/publish`, method: 'post' });
      const code: string | undefined = res?.data?.publishCode;
      // 立即弹出预览（已发布态 + publishCode 命中 WorkPreviewModal 的二维码分享区）
      setPreviewFor({
        id: r.id,
        title: r.name,
        schema: r.schema,
        status: 'published',
        publishCode: code,
      });
      setTick((t) => t + 1); // 刷新列表
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '发布失败');
    }
  }, []);

  return (
    <>
      <GenericListPage
        title="作品管理"
        sub="个人作品（Project）· 设计稿 / 发布 H5 / 升级为模板"
        chip={CHIP}
        resource="provider/catalog"
        rowKey="id"
        pageSize={20}
        key={tick}
        createLabel="＋ 新建作品"
        onCreate={handleCreateWork}
        searchable
        searchField="name"
        searchPlaceholder="搜索名称…"
        staticFilters={[{ field: 'kind', operator: 'eq', value: 'work' }]}
        gridCard={(r: any) => (
          <TemplateCard
            r={r}
            onDetail={() => nav(`/sp/works/${r.id}`)}
            onEdit={() => nav(`/sp/works/${r.id}/editor`)}
            onDelete={() => handleDeleteWork(r.id)}
            onUpgrade={() => nav(`/sp/works/${r.id}/upgrade`)}
            onPublish={() => handlePublishWork(r)}
            onPreview={setPreviewFor}
          />
        )}
      />
      {previewFor && <WorkPreviewModal work={previewFor} onClose={() => setPreviewFor(null)} />}
    </>
  );
};

/**
 * 模板管理（仅 kind=template）—— 与作品管理分离后只承载服务商模板（文档 §2.1）。
 */
export const TemplatesList = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await dataProvider.custom!({ url: `provider/services/${id}`, method: 'delete' });
      message.success('模板已删除');
      setTick((t) => t + 1); // 刷新列表
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '删除失败');
    }
  }, []);

  return (
    <GenericListPage
      title="模板管理"
      sub="模板发布 / 付费服务"
      chip={CHIP}
      resource="provider/catalog"
      rowKey="id"
      pageSize={20}
      key={tick}
      createLabel="＋ 新建模板"
      onCreate={() => nav('/sp/templates/new')}
      searchable
      searchField="name"
      searchPlaceholder="搜索名称…"
      staticFilters={[{ field: 'kind', operator: 'eq', value: 'template' }]}
      gridCard={(r: any) => (
        <TemplateCard
          r={r}
          onDetail={() => nav(`/sp/templates/${r.id}`)}
          onEdit={() => nav(`/sp/templates/${r.id}/editor`)}
          onDelete={() => handleDelete(r.id)}
        />
      )}
    />
  );
};

/* ===================== 合同管理（可编辑详情页 pg-ctrcfg） ===================== */

/** 签署流程 5 步时间轴（doc §10.6） */
const SignFlow = ({ stage }: { stage: string }) => {
  const cur = signStepIndex(stage);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginTop: 4 }}>
      {SIGN_STEPS.map((s, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <div key={s.key} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                margin: '0 auto 6px',
                background: done ? T.up : active ? T.accent : T.panel2,
                border: `2px solid ${active ? T.accent : done ? T.up : T.border}`,
                color: '#fff',
                fontSize: 11,
                lineHeight: '14px',
                fontWeight: 700,
              }}
            >
              {done ? '✓' : i + 1}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: active ? T.accent : done ? T.upInk : T.ink3,
                fontWeight: active ? 700 : 400,
              }}
            >
              {t(s.label)}
            </div>
            {i < SIGN_STEPS.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 'calc(50% + 10px)',
                  right: '-calc(50% - 10px)',
                  height: 2,
                  background: i < cur ? T.up : T.border,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/** 合同可编辑详情弹窗：左表单（校验）+ 右预览 / 签署流程 + 协商记录 */
export const SPContract = () => {
  const nav = useNavigate();
  return (
    <GenericListPage
      title="合同管理"
      sub="我的合同 / 补充协议 · 在线协商与签署"
      chip={CHIP}
      resource="provider/contracts"
      rowKey="id"
      pageSize={20}
      rowActions={(r: any) => (
        <span
          onClick={() => nav(`/sp/contract/${r.id}`)}
          style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          编辑
        </span>
      )}
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '已生效', value: 'EFFECTIVE', field: 'status', match: 'EFFECTIVE' },
        { label: '审批中', value: 'APPROVING', field: 'status', match: 'APPROVING' },
        { label: '已到期', value: 'EXPIRED', field: 'status', match: 'EXPIRED' },
      ]}
      columns={[
        { title: '合同编号', dataIndex: 'contractNo', width: 160, ellipsis: true },
        { title: '类型', dataIndex: 'type', width: 100, render: (v: any) => CONTRACT_TYPE[v] ?? v },
        { title: '签订日期', dataIndex: 'signDate', width: 120, render: dt },
        { title: '到期日期', dataIndex: 'expireDate', width: 120, render: dt },
        { title: '状态', dataIndex: 'signStage', width: 110, render: (v: any) => stPill(v, CONTRACT_STAGE) },
      ]}
    />
  );
};

/* ===================== 我的评价（互评 · p-feedback） ===================== */

const REVIEW_FILTERS: ChipFilter[] = [
  { label: '全部', value: 'all' },
  { label: '好评 (★5)', value: 'good', test: (r: any) => r.rating >= 4.8 },
  { label: '中评 (★4)', value: 'mid', test: (r: any) => r.rating >= 3.8 && r.rating < 4.8 },
  { label: '差评 (★3)', value: 'bad', test: (r: any) => r.rating < 3.8 },
];

/** 互评弹窗：展示客户评价 + 已有回评 + 服务商回评（打分 + 评语，必填） */
const ReviewReplyModal = ({
  review,
  mode,
  onClose,
  onSaved,
}: {
  review: any;
  mode: 'view' | 'reply';
  onClose: () => void;
  onSaved?: () => void;
}) => {
  const replied = !!review.replyAt;
  const [rate, setRate] = useState<number>(
    review.replyRating ?? (Number.isFinite(review.rating) ? Math.round(review.rating) : 5),
  );
  const [text, setText] = useState(review.reply ?? '');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!text.trim()) {
      message.warning('回评内容必填');
      return;
    }
    if (!rate || rate < 1 || rate > 5) {
      message.warning('请选择回评星级');
      return;
    }
    setSubmitting(true);
    try {
      await dataProvider.custom!({
        url: `provider/reviews/${review.id}/reply`,
        method: 'post',
        payload: { replyRating: rate, reply: text.trim() },
      });
      message.success(replied ? '追评已更新' : '互评已提交，双方评价将公开展示');
      onSaved?.();
      onClose();
    } catch (e: any) {
      message.error(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onCancel={onClose} footer={null} destroyOnHidden width={560} styles={{ body: { padding: 20 } }}>
      <h3 style={{ margin: 0, fontSize: 16, color: T.ink1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: T.accentSoft, color: T.accent, fontWeight: 600 }}>评价</span>
        我的评价 · 互评
        <span style={{ marginLeft: 'auto', fontSize: 12, color: T.ink3 }} onClick={onClose} role="button" aria-label="关闭">✕</span>
      </h3>

      {/* 头部 订单 / 客户 信息行 */}
      <div style={{ display: 'flex', gap: 24, fontSize: 12.5, color: T.ink2, margin: '12px 0' }}>
        <span>订单：<b style={{ color: T.ink1 }}>{review.orderId ? cleanCode(review.orderId) : '—'}</b></span>
        <span>客户：<b style={{ color: T.ink1 }}>{review.user?.nickname || '—'}</b></span>
        <span>时间：<b style={{ color: T.ink1 }}>{dt(review.createdAt)}</b></span>
      </div>

      {/* 客户对我的评价 */}
      <div style={{ background: T.panel2, borderRadius: T.rSm, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>客户对我的评价</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <StarRow value={review.rating} />
          <span style={{ color: T.ink2, fontSize: 12.5 }}>{review.rating}</span>
        </div>
        <div style={{ fontSize: 13, color: T.ink1 }}>{review.content}</div>
      </div>

      {/* 已有回评 */}
      {replied && (
        <div style={{ background: T.accentSoft, borderRadius: T.rSm, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.accent, marginBottom: 6 }}>
            我的回评（{dt(review.replyAt)}）
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <StarRow value={review.replyRating ?? 0} />
            <span style={{ color: T.ink2, fontSize: 12.5 }}>{review.replyRating}</span>
          </div>
          <div style={{ fontSize: 13, color: T.ink1 }}>{review.reply}</div>
        </div>
      )}

      {/* 我的回评表单（仅 reply 模式） */}
      {mode === 'reply' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>
            我的回评（{replied ? '追加追评' : '首次互评'}）· 综合评分
          </div>
          <Rate allowHalf value={rate} onChange={(v) => setRate(v)} />
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="填写回评内容（必填）"
            style={{ marginTop: 8 }}
          />
          <div style={{ fontSize: 11.5, color: T.ink3, margin: '8px 0' }}>
            提示：服务商与客户双方评价完成后，将在双方评价区公开展示，实现完整互评。
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose}>关闭</Button>
            <Button type="primary" onClick={submit} loading={submitting}>
              {replied ? '提交追评' : '提交互评'}
            </Button>
          </div>
        </div>
      )}
      {mode === 'view' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" onClick={onClose}>知道了</Button>
        </div>
      )}
    </Modal>
  );
};

export const SPReviews = () => {
  const [sel, setSel] = useState<{ r: any; mode: 'view' | 'reply' } | null>(null);
  const actions = (r: any) => (
    <>
      <span
        onClick={() => setSel({ r, mode: 'view' })}
        style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', marginRight: 12 }}
      >
        查看
      </span>
      <span
        onClick={() => setSel({ r, mode: 'reply' })}
        style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
      >
        {r.replyAt ? '追评' : '评价客户'}
      </span>
    </>
  );
  return (
    <>
      <GenericListPage
        title="我的评价"
        sub="客户评价我的服务 · 支持服务商回评客户（互评）"
        chip={CHIP}
        resource="provider/reviews"
        rowKey="id"
        pageSize={20}
        rowActions={actions}
        chipFilters={REVIEW_FILTERS}
        searchable
        searchField="user.nickname"
        searchPlaceholder="搜索客户姓名…"
        columns={[
          { title: '订单', dataIndex: 'orderId', width: 160, render: (v: any) => (v ? cleanCode(v) : '—') },
          { title: '客户', dataIndex: ['user', 'nickname'], width: 120, render: (_: any, r: any) => r.user?.nickname || '—' },
          { title: '评分', dataIndex: 'rating', width: 160, render: (v: any) => <StarRow value={v} /> },
          { title: '评价内容', dataIndex: 'content', ellipsis: true },
          { title: '时间', dataIndex: 'createdAt', width: 160, render: dt },
          {
            title: '互评状态',
            dataIndex: 'replyAt',
            width: 110,
            render: (_: any, r: any) =>
              r.replyAt ? <Pill tone="ok">已互评</Pill> : <Pill tone="warn">待互评</Pill>,
          },
        ]}
      />
      {sel && (
        <ReviewReplyModal
          review={sel.r}
          mode={sel.mode}
          onClose={() => setSel(null)}
          onSaved={() => setSel(null)}
        />
      )}
    </>
  );
};

/* ===================== 我的团队 ===================== */
export const SPTeam = () => {
  const nav = useNavigate();
  return (
    <GenericListPage
      title="我的团队"
      sub="角色化团队建设 · 按服务类型差异化角色"
      chip={CHIP}
      resource="provider/team"
      rowKey="id"
      pageSize={20}
      createLabel="＋ 新建成员"
      onCreate={() => nav('/sp/team/new')}
      searchable
      searchField="name"
      searchPlaceholder="搜索成员姓名…"
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '正常', value: 'ACTIVE', test: (r) => r.accountStatus === 'ACTIVE' },
        { label: '待激活', value: 'PENDING', test: (r) => r.accountStatus === 'PENDING' },
        { label: '停用', value: 'DISABLED', test: (r) => r.accountStatus === 'DISABLED' },
      ]}
      columns={[
        { title: '成员编号', dataIndex: 'memberNo', width: 120 },
        { title: '姓名', dataIndex: 'name', width: 110 },
        { title: '手机', dataIndex: 'phone', width: 140 },
        { title: '服务类型', dataIndex: 'serviceType', ellipsis: true },
        { title: '团队角色', dataIndex: 'teamRole', width: 130, ellipsis: true },
        { title: '账号状态', dataIndex: 'accountStatus', width: 100, render: (v: any) => stPill(v, TEAM_STATUS) },
      ]}
      rowActions={(r: any) => (
        <span onClick={() => nav(`/sp/team/${r.id}`)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>查看</span>
      )}
    />
  );
};

/* ===================== 我的客户 ===================== */

type ReachRecord = {
  id: string;
  type: string;
  channel: string;
  amount: number | null;
  validTo: string | null;
  subject: string;
  content: string;
  createdAt: string;
};

export const SPClients = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const link = { color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' } as const;
  return (
    <GenericListPage
      title="我的客户"
      sub="客户档案与精准维护触达"
      chip={CHIP}
      resource="provider/clients"
      rowKey="id"
      pageSize={20}
      key={tick}
      createLabel="＋ 新建客户"
      onCreate={() => nav('/sp/clients/new')}
      searchable
      searchField="name"
      searchPlaceholder="搜索客户姓名…"
      columns={[
        { title: '客户编号', dataIndex: 'clientNo', width: 120 },
        { title: '姓名', dataIndex: 'name', width: 110 },
        { title: '手机', dataIndex: 'phone', width: 140 },
        { title: '累计消费', dataIndex: 'totalSpend', width: 120, render: money },
        { title: '标签', dataIndex: 'tags', width: 180, render: arr },
        { title: '互动次数', dataIndex: 'interactions', width: 100 },
        { title: '最近维护', dataIndex: 'lastMaintain', width: 160, render: dt },
      ]}
      rowActions={(r: any) => (
        <span onClick={() => nav(`/sp/clients/${r.id}`)} style={link}>查看 / 维护</span>
      )}
    />
  );
};

/* ===================== 意见反馈（服务商自己提交的反馈/申诉） ===================== */
export const SPComplaints = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const link = { color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' } as const;
  return (
    <GenericListPage
      title="意见反馈"
      sub="向平台提交意见 / 申诉 · 自下而上升级"
      chip={CHIP}
      resource="provider/complaints"
      rowKey="id"
      pageSize={20}
      key={tick}
      createLabel="＋ 新增反馈"
      onCreate={() => nav('/sp/complaints/new')}
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '待回应', value: 'OPEN', test: (r) => r.status === 'OPEN' },
        { label: '协商中', value: 'NEGOTIATING', test: (r) => r.status === 'NEGOTIATING' },
        { label: '已关闭', value: 'CLOSED', test: (r) => r.status === 'CLOSED' },
      ]}
      columns={[
        { title: '编号', dataIndex: 'id', width: 130, render: (v: any) => cleanCode(v) },
        { title: '类型', dataIndex: 'type', width: 100, render: (v: any) => TICKET_TYPE[v] ?? v },
        { title: '对象', dataIndex: ['target', 'nickname'], width: 110, render: (_: any, r: any) => r.target?.nickname || r.target?.phone || '—' },
        { title: '标题', dataIndex: 'title', ellipsis: true },
        { title: '状态', dataIndex: 'status', width: 100, render: (v: any) => stPill(v, TICKET_STATUS) },
        { title: '时间', dataIndex: 'createdAt', width: 160, render: dt },
      ]}
      rowActions={(r: any) => (
        <span onClick={() => nav(`/sp/complaints/${r.id}`)} style={link}>查看</span>
      )}
    />
  );
};

/* ===================== 业务申请（入驻 / 资质） ===================== */
/* ===================== 业务申请 ===================== */
export const SPApply = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const link = { color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' } as const;
  return (
    <GenericListPage
      title="业务申请"
      sub="入住 / 资质申请全流程跟踪"
      chip={CHIP}
      resource="provider/applications"
      rowKey="id"
      pageSize={20}
      key={tick}
      createLabel="＋ 新建申请"
      onCreate={() => nav('/sp/apply/new')}
      searchable
      searchField="applicantName"
      searchPlaceholder="搜索申请主体…"
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '待初审', value: 'FIRST_PENDING', test: (r) => r.status === 'FIRST_PENDING' },
        { label: '初审通过', value: 'FIRST_PASSED', test: (r) => r.status === 'FIRST_PASSED' },
        { label: '待终审', value: 'FINAL_PENDING', test: (r) => r.status === 'FINAL_PENDING' },
        { label: '已通过', value: 'APPROVED', test: (r) => r.status === 'APPROVED' },
      ]}
      columns={[
        { title: '编号', dataIndex: 'id', width: 130, render: (v: any) => cleanCode(v) },
        { title: '申请主体', dataIndex: 'applicantName', width: 130, render: (v: any) => v || '—' },
        { title: '类型', dataIndex: 'kind', width: 100, render: (v: any) => (v === 'provider' ? '服务商' : v === 'agent' ? '代理商' : v) },
        { title: '区域', dataIndex: 'regionLabel', width: 160, ellipsis: true, render: (v: any) => v || '—' },
        { title: '状态', dataIndex: 'status', width: 110, render: (v: any) => stPill(v, APPLY_STATUS) },
        { title: '时间', dataIndex: 'createdAt', width: 160, render: dt },
      ]}
      rowActions={(r: any) => (
        <span onClick={() => nav(`/sp/apply/${r.id}`)} style={link}>查看 / 编辑</span>
      )}
    />
  );
};

/* ===================== 通知公告 / 业务消息（服务商消息中心） ===================== */

/** 公告 / 消息详情专业排版（原型：标题 + 元信息栏 + 正文卡片） */
const MsgDetailShell = ({
  title,
  meta,
  content,
  backTo,
}: {
  title: string;
  meta: { label: string; value: ReactNode }[];
  content: string | null | undefined;
  backTo: string;
}) => {
  const nav = useNavigate();
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span
          onClick={() => nav(backTo)}
          style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          ← 返回列表
        </span>
      </div>
      <PageHead title={title} sub="详情内容" chip={CHIP} />
      <Panel title="基本信息" hint="平台权威发布">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px 24px',
            padding: '4px 4px 16px',
          }}
        >
          {meta.map((m) => (
            <div key={m.label} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <span style={{ color: T.ink3, whiteSpace: 'nowrap' }}>{m.label}</span>
              <span style={{ color: T.ink1 }}>{m.value}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '16px 18px',
            background: T.panel2,
            borderRadius: T.rMd,
            border: `1px solid ${T.border}`,
            fontSize: 14,
            lineHeight: 1.9,
            color: T.ink1,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content || '—'}
        </div>
      </Panel>
    </>
  );
};

/** 详情页通用：取当前视察对象作用域（ADMIN 视察服务商时拼 ?subject=）
 *
 * ⚠️ 只用于「不经 dataProvider 的裸 fetch」（如已读回执 markRead）。
 * 凡是走 useCustom / dataProvider.custom 的请求【禁止】再手工拼 ?subject= ——
 * dataProvider.custom 内部会自行调用 withSubject() 注入一次，这里再拼一次会变成
 * ?subject=X&subject=X，Express 把它解析成数组，服务端 InspectSubjectGuard /
 * subjectId() 拿到的就不是字符串而是 ['X','X']，归属判定直接失效
 * （表现为详情面板空白且无任何报错）。一次请求只允许一次 subject 注入。
 */
const useSubjectQs = () => {
  const { objectScope } = useLayer();
  return objectScope?.id ? `?subject=${objectScope.id}` : '';
};

/**
 * 标记已读（失败不影响查看）。
 *
 * ⚠️ 这里是**裸 fetch，不经过 dataProvider**，所以它是唯一必须自己拼 `?subject=` 的调用：
 * dataProvider.custom 里的 withSubject() 帮不上它，少了就注入 0 次。
 * 与之相对，同页面的详情请求走 useCustom → withSubject 已注入 1 次，绝不能再手工拼。
 */
const markRead = async (url: string) => {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: '{}',
    });
  } catch {
    /* 已读回执失败不影响查看 */
  }
};

export const SPNotices = () => {
  const nav = useNavigate();
  return (
    <GenericListPage
      title="通知公告"
      sub="平台公告 / 通知 · 管理总台与代理商权威发布"
      chip={CHIP}
      resource="provider/notices"
      rowKey="id"
      pageSize={20}
      searchable
      searchField="title"
      searchPlaceholder="搜索公告标题…"
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '权威公告', value: 'ANNOUNCEMENT', test: (r: any) => r.type === 'ANNOUNCEMENT' },
        { label: '一般消息', value: 'NOTICE', test: (r: any) => r.type === 'NOTICE' },
        { label: '未读', value: 'unread', test: (r: any) => r.status === '未读' },
      ]}
      columns={[
        { title: '编号', dataIndex: 'code', width: 110 },
        { title: '标题', dataIndex: 'title', ellipsis: true },
        { title: '类型', dataIndex: 'type', width: 110, render: (v: any) => MSG_TYPE[v] ?? v },
        { title: '发布范围', dataIndex: 'scope', width: 130, render: (v: any, r: any) => msgScopeText(v, r.regionPath) },
        { title: '时间', dataIndex: 'createdAt', width: 160, render: dt },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (v: any) => <Pill tone={v === '未读' ? 'warn' : 'ok'}>{v ?? '—'}</Pill>,
        },
      ]}
      rowActions={(r: any) => (
        <span
          onClick={() => nav(`/sp/notices/${r.id}`)}
          style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          查看
        </span>
      )}
    />
  );
};

export const SPNoticeDetail = () => {
  const { id } = useParams();
  // subjectQs 只给下方裸 fetch 的 markRead 用；本请求走 useCustom → dataProvider.custom
  // → withSubject()，subject 由那里统一注入，URL 里不能再带一次。
  const subjectQs = useSubjectQs();
  const { data, isLoading } = useCustom<any>({
    url: `provider/notices/${id}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const m = data?.data;
  useEffect(() => {
    if (id) markRead(`${API_URL}/provider/notices/${id}/read${subjectQs}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, subjectQs]);
  if (isLoading || !m)
    return (
      <Panel title="通知公告详情" hint="加载中…">
        <div style={{ padding: 24, color: T.ink3 }}>加载中…</div>
      </Panel>
    );
  return (
    <MsgDetailShell
      title={m.title}
      backTo="/sp/notices"
      content={m.content}
      meta={[
        { label: '编号', value: m.code ?? cleanCode(m.id) },
        { label: '类型', value: t(MSG_TYPE[m.type] ?? m.type) },
        { label: '发布范围', value: msgScopeText(m.scope, m.regionPath) },
        { label: '发布人', value: publisherText(m.author, m.authorRole) },
        { label: '发布时间', value: dt(m.createdAt) },
        { label: '状态', value: m.status ?? (m.read ? '已读' : '未读') },
      ]}
    />
  );
};

/* ===================== 业务消息（服务商收件箱） ===================== */
export const SPMessages = () => {
  const nav = useNavigate();
  const subjectQs = useSubjectQs();
  return (
    <GenericListPage
      title="业务消息"
      sub="平台业务消息 · 服务商收件箱"
      chip={CHIP}
      resource="provider/messages"
      rowKey="id"
      pageSize={15}
      searchable
      searchField="title"
      searchPlaceholder="搜索消息标题…"
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '未读', value: 'unread', test: (r: any) => r.status === '未读' },
        { label: '已读', value: 'read', test: (r: any) => r.status === '已读' },
      ]}
      columns={[
        { title: '编号', dataIndex: 'code', width: 110 },
        { title: '标题', dataIndex: 'title', ellipsis: true },
        { title: '类型', dataIndex: 'type', width: 110, render: (v: any) => msgTypeText(v) },
        {
          title: '发布人',
          dataIndex: ['author', 'nickname'],
          width: 170,
          ellipsis: true,
          render: (_: any, r: any) => publisherText(r.author, r.authorRole),
        },
        { title: '时间', dataIndex: 'createdAt', width: 160, render: dt },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (v: any) => <Pill tone={v === '未读' ? 'warn' : 'ok'}>{v ?? '—'}</Pill>,
        },
      ]}
      rowActions={(r: any) => (
        <span
          onClick={() => {
            markRead(`${API_URL}/provider/messages/${r.id}/read${subjectQs}`);
            nav(`/sp/messages/${r.id}`);
          }}
          style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          查看
        </span>
      )}
    />
  );
};

export const SPMessageDetail = () => {
  const { id } = useParams();
  // 同 SPNoticeDetail：subjectQs 只服务于裸 fetch 的 markRead，useCustom 自身会注入一次。
  const subjectQs = useSubjectQs();
  const { data, isLoading } = useCustom<any>({
    url: `provider/messages/${id}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const m = data?.data;
  useEffect(() => {
    if (id) markRead(`${API_URL}/provider/messages/${id}/read${subjectQs}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, subjectQs]);
  if (isLoading || !m)
    return (
      <Panel title="业务消息详情" hint="加载中…">
        <div style={{ padding: 24, color: T.ink3 }}>加载中…</div>
      </Panel>
    );
  return (
    <MsgDetailShell
      title={m.title}
      backTo="/sp/messages"
      content={m.content}
      meta={[
        { label: '编号', value: m.code ?? '—' },
        { label: '类型', value: msgTypeText(m.type) },
        { label: '发布人', value: publisherText(m.author, m.authorRole) },
        { label: '发布时间', value: dt(m.createdAt) },
        { label: '状态', value: m.status ?? (m.read ? '已读' : '未读') },
      ]}
    />
  );
};

/* ===================== 收入明细（财务统计卡 + 列表） ===================== */
interface IncomeData {
  items: any[];
  totalIncomeCents: number;
  pendingCents: number;
  settleCycle: string;
}

export const SPIncome = () => {
  const { data, isLoading } = useCustom<IncomeData>({
    url: 'provider/income',
    method: 'get',
    queryOptions: { retry: false },
  });
  const d = data?.data as IncomeData | undefined;
  const items = d?.items ?? [];
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading || !d) {
    return (
      <>
        <PageHead title="收入明细" sub="订单收入 / 结算明细" chip={CHIP} />
        <Panel title="收入明细" hint="加载中…">
          <DataTable<any> rowKey="id" dataSource={[]} columns={[]} loading />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHead title="收入明细" sub="订单收入 / 结算明细" chip={CHIP} />
      <div style={GRID.kpis}>
        <KpiCard main label="累计入账" value={money(d.totalIncomeCents)} delta="订单结算入账" deltaTrend="up" />
        <KpiCard label="待结算挂账" value={money(d.pendingCents)} delta="待 T+3 入账" />
        <KpiCard label="结算周期" value={d.settleCycle} delta="自动入账" />
      </div>
      <Panel title="收入流水" hint={`共 ${items.length} 条 · 数据隔离由后端强制`}>
        <DataTable<any>
          rowKey="id"
          dataSource={paged}
          scroll={{ x: 800 }}
          columns={[
            { title: '流水号', dataIndex: 'no', width: 180, ellipsis: true, render: (v: any) => cleanCode(v) },
            { title: '科目', dataIndex: 'subject', width: 120 },
            { title: '关联', dataIndex: 'relate', ellipsis: true, render: (v: any) => v || '—' },
            { title: '客户', dataIndex: 'buyer', width: 110 },
            { title: '类型', dataIndex: 'type', width: 90 },
            { title: '金额', dataIndex: 'amountCents', width: 130, align: 'right', render: money },
            { title: '时间', dataIndex: 'date', width: 160, render: dt },
            { title: '状态', dataIndex: 'status', width: 100 },
          ]}
        />
        <Pager total={items.length} current={page} pageSize={pageSize} onChange={setPage} />
      </Panel>
    </>
  );
};

/* ===================== 提现管理（财务统计卡 + 列表 + 发起提现） ===================== */
interface WithdrawData {
  items: any[];
  summary: { appliedCents: number; paidCents: number; pendingCents: number; failedCents: number };
}
interface WalletBalance {
  balance: number;
}

export const SPWithdraw = () => {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [createOpen, setCreateOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, refetch } = useCustom<WithdrawData>({
    url: 'provider/withdrawals',
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: balData } = useCustom<WalletBalance>({
    url: 'wallet/mine',
    method: 'get',
    queryOptions: { retry: false },
  });
  const d = data?.data as WithdrawData | undefined;
  const balance = (balData?.data as WalletBalance | undefined)?.balance ?? 0;
  const items = d?.items ?? [];
  const summary = d?.summary;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  const submit = async () => {
    const amt = Math.round(Number(amount) * 100);
    // 金额非数字 / <=0 必须显式提示：直接 return 会让用户以为已提交。
    if (!Number.isFinite(amt) || amt <= 0) {
      message.warning('请输入大于 0 的提现金额');
      return;
    }
    // 提交前先在本地卡「不超过可提现余额」：服务端余额不足会 400 拒绝，
    // 若不前置校验，该错误会以未处理 rejection 的形式掉出去，界面上表现为「点了没反应」。
    if (amt > balance) {
      message.warning(`提现金额不可超过可提现余额 ${money(balance)}`);
      return;
    }
    setSubmitting(true);
    try {
      await dataProvider.custom!({
        url: 'provider/withdrawals',
        method: 'post',
        payload: { amount: amt, account: account || undefined },
      });
      setCreateOpen(false);
      setAmount('');
      setAccount('');
      message.success('提现申请已提交');
      refetch?.();
    } catch (e: any) {
      // 失败必须给出口反馈，否则界面会停在「已提交」的假成功状态
      message.error(e?.message || '提现申请失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHead title="提现管理" sub="提现申请 / 到账记录" chip={CHIP} />
      <div style={GRID.kpis}>
        <KpiCard main label="累计申请" value={money(summary?.appliedCents)} delta="含全部状态" deltaTrend="up" />
        <KpiCard label="已到账" value={money(summary?.paidCents)} />
        <KpiCard label="审核中" value={money(summary?.pendingCents)} delta="待打款" />
        <KpiCard label="已驳回" value={money(summary?.failedCents)} />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            border: `1px solid ${T.accent}`,
            borderRadius: T.rSm,
            padding: '6px 13px',
            background: T.accent,
            color: T.onAccent,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 0,
            lineHeight: 1.6,
          }}
        >
          发起提现
        </button>
      </div>
      <Panel
        title="提现记录"
        hint={`共 ${items.length} 条 · 可提现余额 ${money(balance)}`}
      >
        <DataTable<any>
          rowKey="id"
          loading={isLoading}
          dataSource={paged}
          scroll={{ x: 800 }}
          columns={[
            { title: '提现单号', dataIndex: 'id', width: 180, ellipsis: true, render: (v: any) => cleanCode(v) },
            { title: '申请金额', dataIndex: 'amount', width: 130, align: 'right', render: money },
            { title: '收款账户', dataIndex: 'account', width: 160, render: (v: any) => v || '—' },
            { title: '申请时间', dataIndex: 'createdAt', width: 160, render: dt },
            { title: '状态', dataIndex: 'status', width: 100, render: (v: any) => stPill(v, WD_STATUS) },
          ]}
        />
        <Pager total={items.length} current={page} pageSize={pageSize} onChange={setPage} />
      </Panel>

      <ReviewModal
        open={createOpen}
        tag="提现"
        title="发起提现"
        loading={submitting}
        approveText="提交申请"
        onApprove={submit}
        onClose={() => setCreateOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <div style={{ fontSize: 12.5, color: T.ink2 }}>
            可提现余额：<b style={{ color: T.accent }}>{money(balance)}</b> · 提现金额不可超过可提现余额
          </div>
          <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>提现金额（元）</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="请输入提现金额"
          />
          <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>收款账户（选填）</label>
          <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="如 招商银行 ****2210" />
        </div>
      </ReviewModal>
    </>
  );
};
