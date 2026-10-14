/**
 * InvitationJobs — 用户端「请柬批量生成」详情页（§18 二次优化 + 配对记录项目级化）。
 *
 * 全程在用户端闭环，不跳转编辑器：
 *  1. 「请柬模板选择」按钮 → InvitationTemplatePicker 实时预览弹窗，返回 {id,title,schema}；
 *  2. 「宾客名单选择」按钮 → PersonPickerDialog（复刻编辑器批量生成 UI），返回 {projectId,listId,selectedRecordIds}；
 *  3. 「字段配对」→ 生成前体检 + 变量映射对话框，保存/跳过即标记第③步完成；
 *  4. 「配对记录」区：GET /api/invitations/projects 列出全部配对项目，radio 互斥选中其一作为操作对象；
 *  5. 「任务队列」区按**人员逐条**展示：任务编号/宾客字段/状态/操作(预览·生成)/次数；
 *  6. 工具条：全选 / 删除选择 / 打包下载 + 每行复选框（§18.4）。
 *
 * 数据源：聚合端点 GET /api/invitations/projects/:id/results（跨 job、按锁定快照顺序）。
 *
 * 本轮改造（缺陷修复 + 优化 + 双选项卡）：
 *  - 缺陷一：行 checkbox 仅超额锁定(paywalled)不可选；批量生成在勾选子集时按 targetRecordIds 渲；
 *  - 优化1：表头首列内嵌全选 checkbox；
 *  - 优化2：任务队列可点开编辑弹窗（字段回填 + 编辑闸门）；
 *  - 优化3：行内操作统一为「生成」文案；
 *  - 优化4：新增「宾客信息」列；
 *  - 优化5：新增「次数」列；
 *  - 三：任务进度区改造为「当前任务 / 历史任务」双选项卡。
 *  - 四：新增「配对记录」区，预览/批量生成/购买配额全部项目级化（以选中配对记录为准）；
 *    批量生成前先刷新最新配额把关；batchGenerate 402 错误体透出 remaining，按同口径缺口引导购买。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  api,
  getToken,
  ApiError,
  type BatchProjectView,
  type ProjectResultRow,
  type BindingHealth,
  RERENDER_LIMIT,
} from '@/api/client';
import {
  VariableMappingDialog,
  type ProjectElement,
  type ElementBindings,
  type InvitationHealth,
} from '@h5design/invitation-mapping';
import { InvitationTemplatePicker, type PickedTemplate } from './InvitationTemplatePicker';
import { PersonPickerDialog, type PickedPersons } from './PersonPickerDialog';
import { getGuestFieldDef, personalizeSchema, normalizeSchema, type GuestData, type Project } from '@h5design/core';
import { SchemaRenderer } from '@h5design/render';

/** 宾客名单字段设计（GET /api/guest-lists/field-design 返回，用于编辑弹窗渲染表单） */
interface FieldDesign {
  key: string;
  label: string;
  type?: string;
  options?: Array<string | { label: string; value: string }>;
}

/** 逐人预览手机框宽度（设计稿基准宽 375，按 schema 实际宽度等比缩放） */
const PREVIEW_FRAME_W = 343;

/**
 * 从错误对象还原服务端 402 额度不足体里的全局剩余额度。
 * client.ts 的 request() 非 2xx 时把响应 JSON 附到 ApiError.body；
 * 命中 402 或 body.code=QUOTA_EXCEEDED 时返回 body.remaining，否则返回 null（非该类错误）。
 */
function quotaRemainingFromError(e: unknown): number | null {
  if (!(e instanceof ApiError)) return null;
  const body = e.body as { code?: string; remaining?: number } | undefined;
  if (e.statusCode !== 402 && body?.code !== 'QUOTA_EXCEEDED') return null;
  return typeof body?.remaining === 'number' ? body.remaining : null;
}

export default function InvitationJobs() {
  const { t } = useTranslation(['common']);

  const [template, setTemplate] = useState<PickedTemplate | null>(null);
  const [picked, setPicked] = useState<PickedPersons | null>(null); // {projectId, listId, selectedRecordIds}
  /** 配对记录列表（GET /invitations/projects）与当前选中项（radio 互斥） */
  const [projects, setProjects] = useState<BatchProjectView[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [results, setResults] = useState<ProjectResultRow[]>([]);
  const [rerenderLimit, setRerenderLimit] = useState(RERENDER_LIMIT);
  const [loadingResults, setLoadingResults] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [emptyBatch, setEmptyBatch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);

  // ── 逐人预览弹窗（模板 schema × 名单记录实时个性化渲染，替代原死代码 previewUrl 全屏浮层）──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** 项目 elements 快照的 previewSchema（服务端已注入 elementBindings，可直接个性化） */
  const [previewSchema, setPreviewSchema] = useState<Project | null>(null);
  /** 变量映射（元素 binding.key → 名单字段），来自生成前体检 */
  const [previewMapping, setPreviewMapping] = useState<Record<string, string>>({});
  /** 预览页数据：勾选子集（无勾选则名单全量）映射后的记录 */
  const [previewPages, setPreviewPages] = useState<Array<{ recordId: string; name: string; data: GuestData }>>([]);
  const [previewPage, setPreviewPage] = useState(0);
  // ── 批量生成前「永久绑定」确认弹窗 ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 需求C一：空选点击「批量生成」居中消息弹窗的开关（替代左上方不显眼静态提示）
  const [noSelectOpen, setNoSelectOpen] = useState(false);

  // 生成前体检（D4 反转：含映射改指向）
  const [health, setHealth] = useState<BindingHealth | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [elements, setElements] = useState<ProjectElement[] | undefined>(undefined);
  const [resuming, setResuming] = useState(false);
  // 分步向导：第③步「字段配对」是否已完成（保存映射或点击「跳过」）
  const [fieldPaired, setFieldPaired] = useState(false);

  // 购买渲染人次弹窗与配额
  const [buyOpen, setBuyOpen] = useState(false);
  const [quota, setQuota] = useState<{
    freeSampleCap: number;
    purchasedHeadcount: number;
    totalRenderable: number;
    remaining: number;
  } | null>(null);
  const [buyHeadcount, setBuyHeadcount] = useState(1);
  const [buyMsg, setBuyMsg] = useState('');
  // ── 请求二：购买后自动续跑 + 上锁记录解锁弹窗 ──
  // 挂起的生成请求：「批量生成」因额度不足引导购买时记录 {mode, targetRecordIds}，
  // confirmBuy 购买成功后读取并清空、自动续跑（服务端会为超限记录扣 1 币并重置计数），
  // 避免「购买后仍未解锁、再次点批量生成仍重复弹购买框」。
  const pendingGenerateRef = useRef<{ projectId: string; mode: 'PAID' | 'RERENDER'; targetRecordIds: string[] } | null>(null);
  // 小锁 / 状态列「解锁」/ 单条「生成」（已达上限时）共用的「消耗 1 币解锁重置」确认弹窗
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockRow, setUnlockRow] = useState<ProjectResultRow | null>(null);

  // ── 编辑闸门（后端 projectResults 顶层 editedRecordIds / editLimit）──
  const [editedRecordIds, setEditedRecordIds] = useState<string[]>([]);
  const [editLimit, setEditLimit] = useState(0);
  // ── 全局剩余可渲染额度（来自 projectResults / getBatchProject 顶层 remaining）──
  // 超限重渲与否的唯一真值：>0 → 弹「消耗次数」确认框；=0 → 弹「次数已用完，请购买」。
  const [availableCounts, setAvailableCounts] = useState(0);
  // 需求C二：达重渲上限记录点击「生成」直接引导购买，已移除原 regenDialog 二次确认状态

  // ── 编辑弹窗（单条宾客字段修改）──
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ProjectResultRow | null>(null);
  const [fieldDesign, setFieldDesign] = useState<FieldDesign[] | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editInitial, setEditInitial] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const pollRef = useRef<number | null>(null);
  // 操作对象 = 选中的配对记录；未选中时回退向导②刚创建/复用的项目
  const projectId = selectedProjectId || (picked?.projectId ?? '');

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * 拉取并同步项目配额（可渲染总数 / 剩余），供「购买数量」右侧标签实时显示。
   * freeSampleCap 由 totalRenderable - purchasedHeadcount 反推（等价于服务端 FREE_SAMPLE_CAP）。
   * 失败静默：配额同步失败不应影响主流程。
   * 返回最新 projectView 供「批量生成」把关使用（拿不到时返回 undefined）。
   */
  const refreshQuota = useCallback(async (pid: string) => {
    try {
      const v = await api.getBatchProject(pid);
      setQuota({
        freeSampleCap: v.totalRenderable - v.purchasedHeadcount,
        purchasedHeadcount: v.purchasedHeadcount,
        totalRenderable: v.totalRenderable,
        remaining: v.remaining,
      });
      // 改为全局剩余额度：同一份 remaining 同时驱动「购买数量」标签与超限重渲弹窗口径
      setAvailableCounts(v.remaining ?? 0);
      return v;
    } catch {
      /* 静默：配额同步失败不影响结果列表 */
      return undefined;
    }
  }, []);

  /** 拉取「配对记录」列表（projectView + templateTitle/listName/pairCount/projectCode）；失败静默 */
  const refreshProjects = useCallback(async () => {
    try {
      const list = await api.listInvitationProjects();
      setProjects(list ?? []);
    } catch {
      /* 静默：配对记录列表失败不影响主流程 */
    }
  }, []);

  const loadResults = useCallback(
    async (pid: string) => {
      try {
        const r = await api.projectResults(pid);
        setResults(r.results ?? []);
        setRerenderLimit(r.rerenderLimit ?? RERENDER_LIMIT);
        // 编辑闸门：以 projectResults 顶层 editedRecordIds / editLimit 为准
        setEditedRecordIds(r.editedRecordIds ?? []);
        setEditLimit(r.editLimit ?? 0);
        setAvailableCounts(r.remaining ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingResults(false);
      }
      // 结果变动（生成 / 删除 / 轮询）同步刷新配额，保证标签随库存变动实时更新
      void refreshQuota(pid);
    },
    [refreshQuota],
  );

  // 轮询：有运行中的 job 时刷新逐人状态，job 终态后停止
  useEffect(() => {
    if (!runningJobId || !projectId) return;
    setLoadingResults(true);
    const tick = async () => {
      await loadResults(projectId);
      try {
        const jobs = await api.listInvitationJobs();
        const job = jobs.find((j) => j.id === runningJobId);
        if (!job || job.status === 'SUCCESS' || job.status === 'PARTIAL' || job.status === 'FAILED') {
          stopPoll();
          setRunningJobId(null);
          setGenerating(false);
        }
      } catch {
        /* 忽略轮询中的列表错误，下一轮重试 */
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => stopPoll();
  }, [runningJobId, projectId, loadResults, stopPoll]);

  // 切换项目时拉一次结果
  useEffect(() => {
    // 项目切换（radio 换选 / 向导换项目）即清勾选：A 的 recordIds 对 B 无意义，
    // 残留会虚增 calcNeed（B 中无结果行按 +1 计）并可能把 A-id 当 targetRecordIds
    // 发给 B，被服务端以「不在锁定名单」拒绝
    setChecked(new Set());
    if (projectId) void loadResults(projectId);
    else {
      setResults([]);
      setEditedRecordIds([]);
      setEditLimit(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 挂载时拉一次「配对记录」列表
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  // 逐人预览 / 永久绑定确认弹窗：ESC 可关
  useEffect(() => {
    if (!previewOpen && !confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewOpen(false);
        setConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen, confirmOpen]);

  const onPickTemplate = (p: PickedTemplate) => {
    setTemplate(p);
    // 模板变更 → 旧项目/勾选/配对失效，需重新走向导
    setPicked(null);
    setSelectedProjectId('');
    setResults([]);
    setChecked(new Set());
    setFieldPaired(false);
    setPickerOpen(false);
    void refreshProjects();
  };

  const onPickPersons = (p: PickedPersons) => {
    setPicked(p);
    // 名单变更 → 字段配对需重做
    setFieldPaired(false);
    setPersonOpen(false);
    // 选中向导②创建/复用的项目作为当前配对记录，并刷新列表（新项目随即出现在列表里）
    setSelectedProjectId(p.projectId);
    // 选完名单立即同步配额，使「可渲染 / 剩余」标签即刻显示数值（无需先打开购买弹窗）
    void refreshQuota(p.projectId);
    void refreshProjects();
  };

  /**
   * 还需购买解锁的人数（按钮「需解锁 X 人」标签 + openBuy 无参兜底同源）。
   * 需求3 修复口径：任务总数 − 已购请柬币（purchasedHeadcount），
   * 再加「已达重渲上限(5次)」的行各 +1（引导购买生成次数，使该行可再次重渲）。
   * 修复原 paywalled 计数口径导致的虚高（如 14 条记录、已购 5 → 应购 9，而非 paywalled 误算的 13）。
   * ★ 必须声明在 openBuy 之前：openBuy 的依赖数组渲染期求值，且其闭包内 need = unlockCount
   * 需取当前值（见 openBuy 依赖注释）。
   */
  const unlockCount = useMemo(() => {
    const totalNum = projects.find((p) => p.id === projectId)?.pairCount ?? quota?.totalRenderable ?? 0;
    const purchased = quota?.purchasedHeadcount ?? 0;
    const base = Math.max(0, (typeof totalNum === 'number' ? totalNum : 0) - purchased);
    const atLimit = results.filter((r) => (r.rerenders ?? 0) >= rerenderLimit).length;
    return base + atLimit;
  }, [projectId, projects, quota, results, rerenderLimit]);

  /**
   * 打开「购买渲染人次」弹窗：先拉取最新项目配额（单一收费模式，可渲染上限由 purchasedHeadcount 决定），
   * 计算默认补齐数量（当已选人数超过剩余可渲染数时，默认补齐差额），再弹出购买弹窗。
   * 项目级化：以当前选中的配对记录（projectId）为准，不再依赖向导②的 picked。
   */
  const openBuy = useCallback(
    async (defaultNeed?: number) => {
      if (!projectId) {
        setError(t('common:guest.batch.needPersons', { defaultValue: '请先选择宾客名单' }));
        return;
      }
      try {
        const v = await api.getBatchProject(projectId);
        setQuota({
          freeSampleCap: v.freeSampleCap,
          purchasedHeadcount: v.purchasedHeadcount,
          totalRenderable: v.totalRenderable,
          remaining: v.remaining,
        });
        setAvailableCounts(v.remaining ?? 0);
        // 需购买人次 = 任务总数 − 已购请柬币 + 已达重渲上限行（与 unlockCount 同源口径）
        const need = unlockCount;
        // defaultNeed：调用方（如「批量生成前次数不足」）已按勾选子集算准缺口时优先采用，
        // 否则采用 unlockCount 口径（其余调用方行为不变）
        setBuyHeadcount(defaultNeed && defaultNeed > 0 ? defaultNeed : need > 0 ? need : 1);
        setBuyMsg('');
        setBuyOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    // ★ 依赖必须含 unlockCount：openBuy 内 need = unlockCount 取的是闭包捕获值，
    // 若切项目后不重建（results 变化不触发），会沿用上一个项目的 unlockCount
    // （如全 pending 项目切到混合项目时，兜底预填旧值 3 而非新值 4，与按钮「需解锁 X 人」标签不一致）。
    // admin 端 openBuy 依赖本就含 unlockCount，此处对齐。
    [projectId, projects, picked, unlockCount],
  );

  /**
   * 关闭购买弹窗的统一出口（取消按钮 / 遮罩点击均走此处）：
   * 同时清掉挂起的续跑请求，防止用户取消购买后 ref 残留，
   * 被后续从状态列等处发起的购买误触发自动续跑。
   */
  const closeBuy = useCallback(() => {
    pendingGenerateRef.current = null;
    setBuyOpen(false);
  }, []);

  /**
   * 逐行计算「本次渲染还需消耗的人次」（handleGenerate 与 402 恢复同口径）。
   * 口径与服务端扣费对齐（invitation.service.ts：PAID + 显式 targetRecordIds 时
   * targets 原样接收传入 ids、不过滤已渲染行，每行扣 1；重渲满 5 次行再 +1 周期重置）：
   *   pending / failed / 已出图未满 5 次 → +1（服务端每行原样扣 1）
   *   重渲满 5 次（rerenders ≥ rerenderLimit）→ +2（行 1 + 周期重置 1，保守按有额度计）
   *   无结果行 → +1（保守）
   */
  const calcNeed = useCallback(
    (ids: string[]) =>
      ids.reduce((n, id) => {
        const r = results.find((x) => x.recordId === id);
        if (!r || r.status !== 'ok') return n + 1;
        if ((r.rerenders ?? 0) >= rerenderLimit) return n + 2;
        return n + 1;
      }, 0),
    [results, rerenderLimit],
  );

  /**
   * 需求E：统计给定记录 id 集合中「需消耗请柬币的记录」数（购买数量填回口径，消息E 场景一）：
   *   1) 待生成记录（status !== 'ok'：pending/failed/running 及无结果行——未出图即需消耗）；
   *   2) 已达重渲上限的记录（rerenders ≥ rerenderLimit——需购买请柬币重置周期）。
   * 已出图且未满 5 次的记录不计（可继续重渲）。
   */
  const countNeeding = (ids: string[]) =>
    ids.reduce((n, id) => {
      const r = results.find((x) => x.recordId === id);
      if (!r) return n + 1;
      return n + (r.status !== 'ok' || (r.rerenders ?? 0) >= rerenderLimit ? 1 : 0);
    }, 0);

  const startGenerate = useCallback(
    async (payload: { projectId: string; mode?: 'FREE_SAMPLE' | 'PAID' | 'RERENDER'; targetRecordIds?: string[] }) => {
    setError('');
    setEmptyBatch('');
    setGenerating(true);
      try {
        // 首渲/续渲前确保勾选已落库（重渲无需重设）
        // 仅向导②刚选完（picked 与目标项目一致）时回写，避免把勾选跨项目写进历史配对记录
        // 后端返回「已锁定 ids ∪ 本次提交 ids」的并集，以响应体为准回写本地勾选（后端契约 note 3）
        // 传 targetRecordIds（子集渲染）时不走该分支（由 !payload.targetRecordIds 守卫）
        if (!payload.targetRecordIds && picked && picked.projectId === payload.projectId && !payload.mode) {
          const saved = await api.setGuestSelection({
            projectId: payload.projectId,
            listId: picked.listId,
            selectedRecordIds: picked.selectedRecordIds,
          });
          if (saved?.selectedRecordIds?.length) {
            setPicked((prev) => (prev ? { ...prev, selectedRecordIds: saved.selectedRecordIds } : prev));
          }
        }
        const res = await api.batchGenerate(payload);
        // 空批次：锁定名单中已无待渲染人员（续渲时记录均已出图、或额度已用尽无待渲染项）。
        // 后端返回 jobId:null + status:NO_PENDING，明确跳过当前批次，不抛 400、不中断任务。
        if (!res.jobId) {
          setGenerating(false);
          setEmptyBatch(
            res.message ??
              t('common:guest.batch.nothingToRender', { defaultValue: '锁定名单内已无待渲染人员' }),
          );
          await loadResults(payload.projectId);
          return;
        }
        setRunningJobId(res.jobId);
        // 项目 state 可能在生成事务内提交（DRAFT→LOCKED 等），刷新配对记录卡片徽章
        void refreshProjects();
        await loadResults(payload.projectId);
      } catch (e) {
        setGenerating(false);
        // 402 额度不足：服务端错误体附带最新 remaining（client.ts 已把响应 JSON 透出到 ApiError.body）——
        // 按 handleGenerate 同口径重算缺口并引导购买（原缺陷：只 setError 不读 body，用户没有下一步）。
        const rem = quotaRemainingFromError(e);
        if (rem !== null) {
          const shortfall = Math.max(1, calcNeed(payload.targetRecordIds ?? [...checked]) - rem);
          setError(`渲染次数不足，还需 ${shortfall} 人次，请先购买`);
          void openBuy(shortfall);
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [picked, loadResults, calcNeed, checked, openBuy, refreshProjects],
  );

  /**
   * 第③步「字段配对」入口：先生成前体检 + 拉取可点选元素，弹出「字段配对」对话框。
   * 对话框保存/跳过 → onPaired 标记第③步完成，不再耦合生成（生成由「批量生成」按钮独立负责）。
   */
  const openFieldPair = async () => {
    if (!picked) {
      setError(t('common:guest.batch.needPersons', { defaultValue: '请先选择宾客名单' }));
      return;
    }
    try {
      const h = await api.getInvitationHealth(picked.projectId);
      setHealth(h);
      const els = await api.getProjectElements(picked.projectId);
      setElements(els.elements);
      setHealthOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** 确认购买：调用 POST /api/invitations/purchase，成功后用返回视图刷新配额并提示 */
  const confirmBuy = useCallback(async () => {
    if (!projectId || !quota) return;
    const n = Math.floor(Number(buyHeadcount));
    if (!Number.isFinite(n) || n <= 0) {
      setError(t('common:guest.batch.buyInvalid', { defaultValue: '请输入正整数购买数量' }));
      return;
    }
    try {
      const r = await api.purchaseInvitation({ projectId, headcount: n });
      setQuota({
        freeSampleCap: r.freeSampleCap,
        purchasedHeadcount: r.purchasedHeadcount,
        totalRenderable: r.totalRenderable,
        remaining: r.remaining,
      });
      // 刷新逐行结果：购买后槽位增加，paywalled 行会相应减少，「需解锁 N 人」提示随之更新
      await loadResults(projectId);
      // 购买可能推进项目 state（DRAFT→PAID），刷新配对记录卡片徽章
      void refreshProjects();
      setBuyOpen(false);
      // 请求二：若本次购买由「批量生成」额度不足引导而来 → 立即自动续跑挂起的生成请求。
      // 服务端会为每条已达上限的记录扣 1 币并重置其渲染次数（invitation.service.ts rc 循环），
      // 即「购买后立即解锁上锁记录并渲染」；用户无需再点一次「批量生成」，也不会重复弹购买框。
      const pending = pendingGenerateRef.current;
      if (pending) {
        pendingGenerateRef.current = null;
        setBuyMsg(
          t('common:guest.batch.buySuccessResume', {
            defaultValue: '已成功购买 {{n}} 人次，正在继续渲染所勾选的记录…',
          }).replace('{{n}}', String(n)),
        );
        void startGenerate(pending);
      } else {
        setBuyMsg(
          t('common:guest.batch.buySuccess', {
            defaultValue: '已成功购买 {{n}} 人次。已勾选但显示「待解锁」的宾客，再点一次「批量生成」即可继续渲染（已出图的人不会重复渲染、不重复扣额度）；若要加入新的人员，请重新打开「宾客名单选择」追加。',
          }).replace('{{n}}', String(n)),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, quota, buyHeadcount, loadResults, refreshProjects, startGenerate]);

  /**
   * 请求二：点击上锁记录旁的小锁 / 单条「生成」（已达重渲上限时）的统一入口 ——
   * 复用原「单独执行一条已上锁记录」的操作口径：
   *   1) 先刷新最新配额（防陈旧 state 误判）；
   *   2) 有可用请柬币（remaining > 0）→ 弹「是否消耗 1 个请柬币解锁并重置渲染权限」确认框，
   *      确认后走 RERENDER + targetRecordIds：服务端事务内一次性完成
   *      「扣 1 币 + 计数重置为 1 + 重新渲染」（invitation.service.ts rc 循环）；
   *   3) 无可用请柬币 → 弹「购买请柬币」对话框（默认 1 个）。
   */
  const onUnlock = async (r: ProjectResultRow) => {
    if (!projectId) return;
    const fresh = await refreshQuota(projectId);
    const rem = fresh?.remaining ?? availableCounts;
    if (rem > 0) {
      setUnlockRow(r);
      setUnlockOpen(true);
      return;
    }
    void openBuy(1);
  };

  /**
   * 请求二（用户 2026-10-14 修正）：确认解锁 = **仅消耗 1 个请柬币**把该记录渲染次数
   * 重置为满额 5 次，**不再执行渲染**（此前走 RERENDER + targetRecordIds 会顺带建 job 出图）。
   * 服务端 `POST /projects/:id/unlock-record` 在事务内完成「扣 1 币 + rc 归零」。
   *   - 402 QUOTA_EXCEEDED（body.remaining=0）→ 引导购买；
   *   - 409 NOT_AT_LIMIT → 记录本就可重渲，刷新结果即可（防误扣币由服务端保证）。
   */
  const confirmUnlock = async () => {
    const row = unlockRow;
    if (!projectId || !row) return;
    setUnlockOpen(false);
    setError('');
    try {
      const v = await api.unlockInvitationRecord({ projectId, recordId: row.recordId });
      setQuota({
        freeSampleCap: v.totalRenderable - v.purchasedHeadcount,
        purchasedHeadcount: v.purchasedHeadcount,
        totalRenderable: v.totalRenderable,
        remaining: v.remaining,
      });
      setAvailableCounts(v.remaining ?? 0);
      // 刷新逐行结果：该行 rerenders 归零 → 小锁/「解锁」入口消失、次数列回到 0/5
      await loadResults(projectId);
      void refreshProjects();
      setBuyMsg(
        t('common:guest.batch.unlockSuccess', {
          defaultValue: '已解锁「{{name}}」：消耗 1 个请柬币，渲染次数已重置为满额 5 次（不会自动渲染，需要时点该行「生成」即可）。',
        }).replace('{{name}}', row.taskName ?? row.name ?? row.recordId),
      );
    } catch (e) {
      const rem = quotaRemainingFromError(e);
      if (rem !== null) {
        void openBuy(1);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * 批量生成的渲染模式判定（用户复核修正）：
   * 服务端 `invitation.service.ts` 仅在 `mode !== 'RERENDER'` 时扣减全局请柬币；
   * 已出图记录在「单条 5 次」预算内的重复生成只有走 RERENDER 才不扣币、不会 402。
   * 因此：所选记录**全部已有渲染次数**（rerenders > 0，均为重渲）→ RERENDER；
   * 含从未出图的记录（rerenders === 0，属首渲）→ PAID（需扣币，额度不足由 402 catch 引导购买）。
   * 修复前：批量生成恒用默认 PAID，remaining=0 时必 402 误弹购币框，
   * 而单条「生成」按钮走 RERENDER 却能成功 —— 同页前后矛盾。
   */
  const resolveGenMode = (): 'PAID' | 'RERENDER' => {
    const rows = [...checked]
      .map((id) => results.find((r) => r.recordId === id))
      .filter((r): r is ProjectResultRow => Boolean(r));
    return rows.length > 0 && rows.every((r) => (r.rerenders ?? 0) > 0) ? 'RERENDER' : 'PAID';
  };

  /**
   * 「批量生成」：仅执行生成，激活条件 = 选中配对记录（单选即激活，向导三条件是「新建配对」路径，
   * 由向导按钮自身守卫，不再代管生产按钮）。
   * 缺陷一修复 + 本次优化：有勾选则按 targetRecordIds 子集渲染，
   * 未勾选则提示「你没有选择任何记录」而不再整批兜底生成。
   * 项目级化：以选中的配对记录（projectId）为准；把关前先刷新最新配额，
   * 不再用陈旧 state 误判（曾出现「已购但按钮仍引导购买」）。
   */
  const handleGenerate = async () => {
    if (!projectId) {
      setError(t('common:guest.batch.noPairSelected', { defaultValue: '请先选择配对记录' }));
      return;
    }
    if (generating) return; // 防重复提交（按钮已不再置灰，此处幂等兜底）
    if (checked.size === 0) {
      // 需求C一：空选点击「批量生成」改为居中消息弹窗（替代左上方不显眼静态提示）
      setNoSelectOpen(true);
      return;
    }
    // ── 渲染次数判断（服务端单一收费模式，无免费赠样）──
    // 需求C三：仅对【已勾选】记录逐条判断是否已达重渲上限，而非对全部记录判断。
    // 先刷新最新配额（fresh view），保持可用额度状态最新；
    // 其返回值同时作为「批量生成周期」state 的实时数据源（getBatchProject 即时视图，含 state/locked）：
    const freshProject = await refreshQuota(projectId);
    const checkedRows = [...checked]
      .map((id) => results.find((r) => r.recordId === id))
      .filter((r): r is ProjectResultRow => Boolean(r));
    // 已达重渲上限（无重复渲染权限）的勾选记录数
    const blocked = checkedRows.filter((r) => (r.rerenders ?? 0) >= rerenderLimit).length;
    if (blocked > 0) {
      // 勾选集合含「已达重渲上限」记录时的分流（请求二修复）：
      //  1) 可用请柬币不足 → 预填缺口引导购买，并记录挂起的生成请求；
      //     购买成功后 confirmBuy 自动续跑（服务端为超限行扣 1 币并重置计数），
      //     修复「购买后仍未解锁、再次点批量生成仍重复弹购买框」；
      //  2) 可用请柬币充足 → 直接放行，不再弹购买框（原缺陷：只要有超限行就无条件弹框，
      //     用户买了币再点仍重复弹，记录始终不解锁）。
      // 所需币数按最终 mode 精确计算（与服务端扣费同口径）：
      //   RERENDER：仅超限行各需 1 币（周期重置，见 rc 循环 used>=RERENDER_LIMIT 分支）；
      //   PAID：每行 1 币，超限行额外 +1（行扣费 + 周期重置）。
      const genMode = resolveGenMode();
      const need =
        genMode === 'RERENDER'
          ? blocked
          : checkedRows.reduce((n, r) => n + ((r.rerenders ?? 0) >= rerenderLimit ? 2 : 1), 0);
      const availRemaining = freshProject?.remaining ?? availableCounts;
      if (availRemaining < need) {
        const shortfall = Math.max(1, need - availRemaining);
        pendingGenerateRef.current = { projectId, mode: genMode, targetRecordIds: [...checked] };
        void openBuy(shortfall);
        return;
      }
      // 额度充足：落到下方既有流程（未绑定→永久绑定确认；已绑定→直接 startGenerate），
      // 由服务端在事务内完成超限行的「扣 1 币 + 计数重置 + 重渲」。
    }
    // 需求C三：所选记录全部具备重复渲染权限 → 不弹「购买渲染人次」弹窗，直接进入「永久绑定」确认；
    // 若实际配额不足，服务端 402 会在 startGenerate 的 catch 中重新引导购买。
    // 「批量生成周期」= 项目 DRAFT（未锁定）→ 首次成功生成（state→LOCKED/PAID）之间；
    // 确认弹窗仅在本周期首次弹出：项目已进入生成周期（state !== 'DRAFT'）→ 续渲/重渲不再弹，
    // 直接走 startGenerate（冻结校验由服务端保证）。取消后项目仍为 DRAFT，再点「批量生成」仍弹。
    // 数据源：freshProject 为 getBatchProject 实时视图（最可靠）；刷新失败（undefined）时回退 projects 列表。
    const currentProject = freshProject ?? projects.find((p) => p.id === projectId);
    const alreadyLocked = currentProject ? currentProject.bound === true : false;
    if (alreadyLocked) {
      void startGenerate({ projectId, mode: resolveGenMode(), targetRecordIds: [...checked] });
      return;
    }
    setConfirmOpen(true);
  };

  /**
   * 单条「生成」：已达重渲上限的记录与小锁点击同走 onUnlock（请求二口径统一）——
   * 有可用请柬币 → 弹「消耗 1 币解锁重置」确认框（确认即扣 1 币、重置次数并重渲）；
   * 无可用请柬币 → 弹「购买请柬币」对话框。
   */
  const onRegenerate = (r: ProjectResultRow) => {
    if (!projectId) return;
    const used = r.rerenders ?? 0;
    if (used >= rerenderLimit) {
      void onUnlock(r);
      return;
    }
    void startGenerate({ projectId, mode: 'RERENDER', targetRecordIds: [r.recordId] });
  };

  /** 断点续跑（T6）：找到最近一个 PARTIAL/FAILED 的任务，仅重渲其失败/缺失项 */
  const onResumeFailed = async () => {
    if (!projectId) return;
    setResuming(true);
    setError('');
    try {
      const jobs = await api.listInvitationJobs(projectId);
      const cand = [...jobs]
        .filter((j) => j.status === 'PARTIAL' || j.status === 'FAILED')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
      if (!cand) {
        setError(t('common:guest.batch.noResumeJob', { defaultValue: '未找到可续跑的任务（无失败/部分失败任务）' }));
        return;
      }
      const res = await api.resumeInvitationJob(cand.id);
      setRunningJobId(res.jobId);
      setGenerating(true);
      await loadResults(projectId);
    } catch (e) {
      // 402 额度不足：与批量生成同口径——按失败行数算缺口并引导购买
      const rem = quotaRemainingFromError(e);
      if (rem !== null) {
        const shortfall = Math.max(1, Math.max(failedCount, 1) - rem);
        setError(`渲染次数不足，还需 ${shortfall} 人次，请先购买`);
        void openBuy(shortfall);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResuming(false);
    }
  };

  /**
   * 打开「逐人预览」弹窗：点击后异步准备数据（loading 态）——
   *  1. previewSchema = 项目 elements 快照（服务端已注入 elementBindings，直接可个性化）；
   *  2. mapping = 生成前体检返回的 variableMapping（元素 binding.key → 名单字段）；
   *  3. 记录源双路（项目级化）：向导②刚选完（picked 与当前项目一致）→ 勾选 ∪ picked.selectedRecordIds；
   *     选中历史配对记录 → 该项目的 listId 全量，按 checked 过滤（无勾选则全量）。
   * 渲染侧每页只对当前索引 personalizeSchema（勿一次性全量），animated=false 避免翻页重播入场动画。
   */
  const openPreviewDialog = async () => {
    if (!projectId) {
      setError(t('common:guest.batch.completePrevStep', { defaultValue: '请先完成前一步操作' }));
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewPage(0);
    try {
      const [els, h] = await Promise.all([
        api.getProjectElements(projectId),
        api.getInvitationHealth(projectId),
      ]);
      // 记录源双路：picked 与当前项目一致时沿用向导勾选口径，否则用选中项目的名单
      const fromPicked = !!picked && picked.projectId === projectId;
      const listId = fromPicked ? picked!.listId : (projects.find((p) => p.id === projectId)?.listId ?? '');
      if (!listId) {
        throw new Error(t('common:guest.batch.noListOnProject', { defaultValue: '该配对记录缺少名单信息，无法预览' }));
      }
      const rec = await api.listGuestRecords(listId, 1, 500);
      const selectedSet = fromPicked
        ? checked.size
          ? checked
          : new Set(picked!.selectedRecordIds)
        : checked.size
          ? checked
          : new Set((rec.records ?? []).map((r) => r.id));
      const pages = (rec.records ?? [])
        .filter((r) => selectedSet.has(r.id))
        .map((r) => ({
          recordId: r.id,
          name: r.data?.guest_name ?? '',
          data: (r.data ?? {}) as GuestData,
        }));
      setPreviewSchema((els.previewSchema ?? null) as Project | null);
      setPreviewMapping(h.mapping ?? {});
      setPreviewPages(pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openPreview = async (url: string) => {
    try {
      const token = getToken();
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('preview failed');
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      window.open(obj, '_blank');
      setTimeout(() => URL.revokeObjectURL(obj), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doPack = async () => {
    if (!projectId) return;
    try {
      const ids = [...checked];
      const blob = await api.downloadProjectZip(projectId, ids.length ? ids : undefined);
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = `invitations-${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doDelete = async () => {
    if (!projectId || !checked.size) return;
    if (!window.confirm(t('common:guest.batch.confirmDelete', { defaultValue: '确定清除选中的生成内容？此操作将一并删除已生成的请柬图片文件且不退配额' }))) return;
    try {
      await api.deleteProjectResults({ projectId, recordIds: [...checked] });
      setChecked(new Set());
      await loadResults(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * 记录是否真正上锁（需求4/5 统一口径）：重渲次数已耗尽(atLimit) 且 全局无可用额度(availableCounts===0)。
   * 与行内 checkbox / 生成按钮 / 状态文案同源，避免多处判定分叉。
   */
  const isLocked = (r: ProjectResultRow) =>
    (r.rerenders ?? 0) >= rerenderLimit && availableCounts === 0;
  // 可选行 = 未真正上锁的行（仍有可用重渲次数、或已购未消耗额度的行均可选）
  const selectableCount = results.filter((r) => !isLocked(r)).length;
  const allChecked = results.length > 0 && selectableCount > 0 && checked.size === selectableCount;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  /** 当前选中的配对记录 */
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  /**
   * 逐记录上锁口径（用户复核修正，替代原项目级 projLocked）：
   * 锁定只反映「该记录自身重渲次数是否耗尽」（atLimit = rerenders ≥ rerenderLimit），
   * 与项目是否已进入生成期（bound）解耦 —— 已购币且单条 5 次机会未用满的记录不得上锁。
   * 人员信息不可改的服务端硬闸门由 editGuestRecordForProject 的快照冻结保证（消息 F），
   * 不依赖前端置灰。
   */
  /** 任务总数（需求3）= 当前选中配对记录的配对数（对齐附件「任务总数」＝记录数）；无选中时回落可渲染总量 */
  const taskTotal: number | string = selectedProject?.pairCount ?? quota?.totalRenderable ?? '—';

  /**
   * 逐人预览：仅对当前页索引做个性化（schema × mapping × 当前记录），翻页时按依赖重算。
   * previewSchema 为归一化前的原始快照，normalizeSchema 兜底补全 width/height 等缺字段。
   */
  const personalized = useMemo(() => {
    const p = previewPages[previewPage];
    if (!p || !previewSchema) return null;
    return personalizeSchema(
      normalizeSchema(previewSchema),
      { id: p.recordId, data: p.data },
      previewMapping,
    );
  }, [previewSchema, previewMapping, previewPages, previewPage]);

  /** 需求4/5：全选 = 选所有「未真正上锁」的行（含仍有重渲余次的行；排除已耗尽且无额度的行） */
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(results.filter((r) => !isLocked(r)).map((r) => r.recordId)));

  /** 编辑闸门：已达上限则禁止保存并提示 */
  const editBlocked = editLimit > 0 && editedRecordIds.length >= editLimit;

  /**
   * 宾客名单字段列：每个字段独立一列（替代原先合并的「宾客信息」单列）。
   * schema 取首行即可 —— 后端对每行返回完全相同的 {key,label} 定义，仅 value 不同。
   */
  const fieldCols = results[0]?.fields ?? [];

  /**
   * 打开编辑弹窗：字段严格取自当前所选宾客名单的 columnDefs（后端 projectResults 行 row.fields，
   * 注释「编辑弹窗展示/回填用」），不再调用 /api/guest-lists/field-design —— 该端点返回 owner 级设计，
   * 会回落 GUEST_FIELD_DEFS.slice(0,5)（系统默认 5 字段），与所选名单实际字段不符
   * （典型如婚礼名单仅含 丈夫姓名/妻子姓名）。用 getGuestFieldDef 补 type/options 以还原 select 渲染。
   */
  const openEdit = (r: ProjectResultRow) => {
    setEditRecord(r);
    setEditError('');
    setEditSaving(false);
    // 字段定义 = 当前名单字段（row.fields 已含 key/label/value）；enum 字段还原为 select
    const fd: FieldDesign[] = (r.fields ?? []).map((f) => {
      const def = getGuestFieldDef(f.key);
      return {
        key: f.key,
        label: f.label,
        type: def?.type === 'enum' ? 'select' : undefined,
        options: (def?.values ?? def?.enum ?? []) as Array<string | { label: string; value: string }>,
      };
    });
    setFieldDesign(fd.length > 0 ? fd : null);
    // 回填：row.fields.value 优先，row.data 兜底（历史数据 value 可能为空）
    const initial: Record<string, string> = {};
    for (const f of r.fields ?? []) {
      const v =
        f.value != null && f.value !== ''
          ? f.value
          : r.data?.[f.key] != null
            ? String(r.data[f.key])
            : '';
      initial[f.key] = v;
    }
    setEditInitial(initial);
    setEditForm({ ...initial });
    setEditOpen(true);
  };

  /** 保存编辑：仅提交被改动字段（editForm 与 initial 的差异） */
  const saveEdit = async () => {
    if (!editRecord || !projectId) return;
    if (editBlocked) return; // 闸门：已达上限禁止保存
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editForm)) {
      if (editInitial[k] !== v) changed[k] = v;
    }
    if (!Object.keys(changed).length) {
      setEditOpen(false);
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      await api.editInvitationRecord(projectId, editRecord.recordId, changed);
      setEditOpen(false);
      setEditForm({});
      setEditInitial({});
      // 成功后刷新结果（同步 editedRecordIds / editLimit 闸门状态）
      await loadResults(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEditError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditSaving(false);
    }
  };

  const statusText = (r: ProjectResultRow, locked: boolean) => {
    if (r.status === 'ok') return { label: t('common:guest.batch.ok', { defaultValue: '成功' }), color: '#1a7f37' };
    // 需求4/5：仅当「重渲次数已耗尽(atLimit) 且 全局无可用额度」(locked) 才显示「待解锁」并作为购买入口；
    // 仍有可用重渲次数的行（即使 paywalled）不再被误判为锁定 —— 历史生成记录清空后仍可继续重渲。
    if (locked) return { label: '🔒 待解锁', color: '#a13c6e' };
    if (r.status === 'failed') return { label: t('common:guest.batch.failed', { defaultValue: '失败' }), color: '#cf1322' };
    return runningJobId
      ? { label: t('common:guest.batch.running', { defaultValue: '生成中' }), color: '#2563eb' }
      : { label: t('common:guest.batch.pending', { defaultValue: '待生成' }), color: '#8a919f' };
  };

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        {t('common:userCenter.menu.invitationJobs', { defaultValue: '请柬批量生成' })}
      </h2>

      {error && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      {emptyBatch && (
        <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {emptyBatch}
        </div>
      )}
      {buyMsg && <div className="mb-3 rounded bg-green-50 px-3 py-2 text-xs text-green-700">{buyMsg}</div>}

      {/* 分步向导：①②③ 依次设定「模板 / 名单 / 字段配对」参数 → 在「配对记录」选中一条 → 在下方「任务队列」勾选记录 → 批量生成 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded bg-[#0089e6] px-4 py-1.5 text-sm text-white hover:opacity-90"
        >
          ① {t('common:guest.batch.pickTemplate', { defaultValue: '请柬模板选择' })}
        </button>
        <span className="text-sm text-gray-600">
          {template
            ? `${t('common:guest.batch.template', { defaultValue: '模板' })}：${template.title}`
            : t('common:guest.batch.noTemplate', { defaultValue: '未选择模板' })}
        </span>

        <button
          onClick={() => {
            if (!template) {
              setError(t('common:guest.batch.completePrevStep', { defaultValue: '请先完成前一步操作' }));
              return;
            }
            setPersonOpen(true);
          }}
          disabled={!template}
          className="rounded bg-[#f97316] px-4 py-1.5 text-sm text-white hover:bg-[#ea6a0c] disabled:opacity-50"
        >
          ② {t('common:guest.batch.pickPersons', { defaultValue: '宾客名单选择' })}
        </button>
        <span className="text-sm text-gray-600">
          {picked
            ? `${t('common:guest.batch.persons', { defaultValue: '已选' })} ${picked.selectedRecordIds.length} ${t('common:guest.batch.personsUnit', { defaultValue: '人' })}`
            : t('common:guest.batch.noPersons', { defaultValue: '未选择人员' })}
        </span>

        <button
          onClick={() => {
            if (!template || !picked) {
              setError(t('common:guest.batch.completePrevStep', { defaultValue: '请先完成前一步操作' }));
              return;
            }
            void openFieldPair();
          }}
          disabled={!template || !picked}
          className="rounded bg-[#5cb85c] px-4 py-1.5 text-sm text-white hover:bg-[#4ca24c] disabled:opacity-50"
        >
          ③ {t('common:guest.batch.fieldPair', { defaultValue: '字段配对' })}
          {fieldPaired ? `（${t('common:guest.batch.paired', { defaultValue: '已配对' })}）` : ''}
        </button>
      </div>

      {/* 需求1：六步向导提示标签（纯文本，直接置于 ①②③ 三按钮下方，去除红色虚线框） */}
      <div className="text-center text-sm text-gray-500">
        {t('common:guest.batch.sixStepGuide', {
          defaultValue:
            '六步向导：（1）选择模板，（2）选择宾客名单，（3）字段配对，（4）预览效果，（5）购买请柬币，（6）批量生成',
        })}
      </div>

      {/* 配对记录区（需求2：表头化 —— 序号 / 作品编号 / 作品名称 / 名单名称 / 配对总数）；radio 互斥选中一条作为操作对象 */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
          {t('common:guest.batch.pairRecords', { defaultValue: '配对记录' })}
        </div>
        {projects.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {t('common:guest.batch.pairRecordsEmpty', { defaultValue: '暂无配对记录，请先完成 ①②③ 创建' })}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 font-medium">{t('common:guest.batch.colIndex', { defaultValue: '序号' })}</th>
                <th className="px-3 py-2 font-medium">{t('common:guest.batch.colWorkNo', { defaultValue: '作品编号' })}</th>
                <th className="px-3 py-2 font-medium">{t('common:guest.batch.colWorkName', { defaultValue: '作品名称' })}</th>
                <th className="px-3 py-2 font-medium">{t('common:guest.batch.colListName', { defaultValue: '名单名称' })}</th>
                <th className="px-3 py-2 font-medium">{t('common:guest.batch.colPairTotal', { defaultValue: '配对总数' })}</th>
                <th className="w-24 px-3 py-2 font-medium">{t('common:guest.batch.colState', { defaultValue: '状态' })}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, idx) => {
                const selected = p.id === selectedProjectId;
                const stateText =
                  p.state === 'PAID'
                    ? t('common:guest.batch.statePaid', { defaultValue: '已付费' })
                    : p.state === 'LOCKED'
                      ? t('common:guest.batch.stateLocked', { defaultValue: '已锁定' })
                      : t('common:guest.batch.stateDraft', { defaultValue: '草稿' });
                const stateCls =
                  p.state === 'PAID' ? 'text-green-600' : p.state === 'LOCKED' ? 'text-amber-600' : 'text-gray-500';
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`cursor-pointer border-b border-gray-100 ${
                      selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        name="invitation-pair-record"
                        checked={selected}
                        onChange={() => setSelectedProjectId(p.id)}
                        className="h-4 w-4 accent-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-3 py-2 text-gray-700">{p.projectCode || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{p.templateTitle || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.listName || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.pairCount ?? 0}</td>
                    <td className={`px-3 py-2 ${stateCls}`}>{stateText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 任务队列区 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-medium text-gray-700">
            {t('common:guest.batch.taskQueue', { defaultValue: '任务队列' })}
          </span>
          {/* 实时配额标签（需求3）：任务总数 / 已购请柬币 / 已使用 / 剩余（bg #fdf1f7、字 #c81e42，对齐附件） */}
          <span
            className="inline-flex items-center rounded px-2.5 py-1.5 text-sm"
            style={{ background: '#fdf1f7', color: '#c81e42' }}
            title={t('common:guest.batch.quotaLabelTitle', {
              defaultValue: '当前任务总量与请柬币库存',
            })}
          >
            {t('common:guest.batch.quotaLabelV2', {
              defaultValue: '任务总数：{{a}}，已购请柬币：{{b}}，已使用：{{c}}，剩余：{{d}}',
            })
              .replace('{{a}}', String(taskTotal))
              .replace('{{b}}', String(quota?.purchasedHeadcount ?? '—'))
              .replace('{{c}}', String(quota ? Math.max(0, quota.totalRenderable - quota.remaining) : '—'))
              .replace('{{d}}', String(quota?.remaining ?? '—'))}
          </span>

          {/* 购买请柬币（需求3 颜色 #9d6ff1）：按「已勾选且需消耗请柬币」或「全部需消耗」记录数预填购买数量（需求E） */}
          <button
            onClick={() =>
              void openBuy(
                checked.size > 0
                  ? countNeeding([...checked])
                  : countNeeding(results.map((r) => r.recordId)),
              )
            }
            disabled={!projectId}
            className="rounded bg-[#9d6ff1] px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {t('common:guest.batch.buyCoins', { defaultValue: '④ 购买请柬币' })}
            {unlockCount > 0 ? `（${t('common:guest.batch.needUnlock', { defaultValue: '需解锁' })} ${unlockCount} 人）` : ''}
          </button>

          {/* 预览（需求3 颜色 #8307fc）：按勾选子集（无勾选则名单全量）逐人个性化渲染，确认效果后再批量生成 */}
          <button
            onClick={() => void openPreviewDialog()}
            disabled={!selectedProjectId}
            className="rounded bg-[#8307fc] px-5 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {t('common:guest.batch.preview', { defaultValue: '⑤ 预览' })}
          </button>

          <button
            onClick={() => void handleGenerate()}
            // 需求4/5：选中配对记录即可点（仅有可用重渲次数 / 已购未消耗即保持可点），永不因队列状态置灰；
            // 未勾选时点击会先弹「请勾选需要生成的记录」提示（见 handleGenerate）。
            disabled={!selectedProjectId}
            className="rounded bg-[#e62800] px-5 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? t('common:guest.batch.generating', { defaultValue: '生成中…' }) : t('common:guest.batch.generate', { defaultValue: '⑥ 批量生成' })}
          </button>

          {/* 工具条（全选 / 删除选择 / 打包下载） */}
          {(
            <div className="ml-auto flex gap-2">
              {failedCount > 0 && (
                <button onClick={onResumeFailed} disabled={resuming || generating} className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                  {resuming ? t('common:guest.batch.resuming', { defaultValue: '续跑中…' }) : t('common:guest.batch.resumeFailed', { defaultValue: '续跑失败项', count: failedCount })}
                </button>
              )}
              <button onClick={toggleAll} disabled={!results.length} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50">
                {t('common:guest.batch.selectAllRows', { defaultValue: '全选' })}
              </button>
              <button onClick={doDelete} disabled={!checked.size} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50">
                {t('common:guest.batch.deleteSelected', { defaultValue: '清除生成内容' })}
              </button>
              <button onClick={doPack} disabled={!results.length} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50">
                {t('common:guest.batch.packDownload', { defaultValue: '打包下载' })}
              </button>
            </div>
          )}
        </div>

        {!projectId ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {t('common:guest.batch.emptyHintGuide', { defaultValue: '请在「配对记录」中选择一条记录；如需新建配对，请先依次完成 ①模板选择 → ②宾客名单选择 → ③字段配对' })}
          </div>
        ) : (
          /* ── 当前任务：保留表头全选 checkbox、任务队列点击编辑、宾客信息、次数、操作列 ── */
          loadingResults && !results.length ? (
            <div className="py-12 text-center text-sm text-gray-400">…</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  {/* 优化1：首列内嵌全选 checkbox（已并入首列，不新增列） */}
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      disabled={!results.length}
                      className="h-4 w-4 accent-blue-500"
                      title={t('common:guest.batch.selectAllRows', { defaultValue: '全选' })}
                    />
                  </th>
                  {/* 优化2：列头 "任务队列" → "任务编号"（与配对记录区的任务编号呼应） */}
                  <th className="px-3 py-2 font-medium">{t('common:guest.batch.colTaskNo', { defaultValue: '任务编号' })}</th>
                  {/* 优化4：宾客信息按名单字段拆分为多列（表头=字段标签，单元格=字段值） */}
                  {fieldCols.length ? (
                    fieldCols.map((f) => (
                      <th key={f.key} className="px-3 py-2 font-medium">
                        {f.label}
                      </th>
                    ))
                  ) : (
                    <th className="px-3 py-2 font-medium">
                      {t('common:guest.batch.colGuest', { defaultValue: '宾客信息' })}
                    </th>
                  )}
                  <th className="w-28 px-3 py-2 font-medium">{t('common:guest.batch.colStatus', { defaultValue: '状态' })}</th>
                  <th className="w-40 px-3 py-2 font-medium">{t('common:guest.batch.colOp', { defaultValue: '操作' })}</th>
                  {/* 优化5：次数列 */}
                  <th className="w-24 px-3 py-2 font-medium">{t('common:guest.batch.colRerender', { defaultValue: '次数' })}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const isPending = r.status === 'pending';
                  // 需求4/5：仅「重渲次数已耗尽(atLimit) 且 全局无可用额度(availableCounts===0)」才真正上锁；
                  // 只要记录仍具备可用重复渲染次数（rerenders < 上限），行内「生成」与勾选均保持可用 ——
                  // 修复「历史生成记录被清空后，仍有重渲余次的行被 paywalled 误锁置灰」。
                  // 需求C二：达重渲上限(atLimit)记录不再置灰；复选框与「生成」按钮始终可点击，点击引导购买
                  const atLimit = (r.rerenders ?? 0) >= rerenderLimit;
                  const st = statusText(r, false);
                  const canRegenerate = r.status === 'ok' || r.status === 'failed' || isPending;
                  return (
                    <tr key={r.recordId} className="border-b border-gray-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked.has(r.recordId)}
                          // 需求C二：达重渲上限记录也始终可勾选（不再置灰）
                          disabled={false}
                          onChange={() => toggleCheck(r.recordId)}
                          className="h-4 w-4 accent-blue-500"
                          title={
                            atLimit
                              ? t('common:guest.batch.lockedRowTip', { defaultValue: '已达生成上限，点击购买请柬币' })
                              : ''
                          }
                        />
                      </td>
                      {/* 优化2：任务队列可点击打开编辑弹窗 */}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!editedRecordIds.includes(r.recordId) && !atLimit) void openEdit(r);
                            }}
                            disabled={editedRecordIds.includes(r.recordId) || atLimit}
                            className={
                              editedRecordIds.includes(r.recordId) || atLimit
                                ? 'cursor-not-allowed text-gray-400'
                                : 'text-left text-blue-600 hover:underline'
                            }
                            title={
                              atLimit
                                ? t('common:guest.batch.lockedRowTip', { defaultValue: '已达生成上限，点击购买请柬币' })
                                : editedRecordIds.includes(r.recordId)
                                  ? t('common:guest.batch.editLockedTip', {
                                      defaultValue: '该记录已修改，已锁定，不可再次修改',
                                    })
                                  : t('common:guest.batch.editRecordTip', { defaultValue: '点击编辑宾客字段' })
                            }
                          >
                            {r.taskName ?? r.name ?? r.recordId}
                          </button>
                          {/* 请求二：小锁拆为独立可点元素（disabled 按钮的子元素不派发点击，必须外置）——
                              仅「已达重渲上限」的小锁可点击解锁；已编辑记录的小锁为纯展示（编辑闸门）。 */}
                          {editedRecordIds.includes(r.recordId) ? (
                            <span
                              title={t('common:guest.batch.editLockedTip', {
                                defaultValue: '该记录已修改，已锁定，不可再次修改',
                              })}
                            >
                              🔒
                            </span>
                          ) : atLimit ? (
                            <button
                              type="button"
                              onClick={() => void onUnlock(r)}
                              title={t('common:guest.batch.unlockRowTip', {
                                defaultValue: '已达生成上限，点击消耗 1 个请柬币解锁并重置渲染次数',
                              })}
                              className="cursor-pointer"
                            >
                              🔒
                            </button>
                          ) : null}
                        </span>
                      </td>
                      {/* 优化4：宾客信息 —— 每字段一列，仅展示值（标签已由表头承担） */}
                      {fieldCols.length ? (
                        fieldCols.map((f) => (
                          <td key={f.key} className="px-3 py-2 text-gray-600">
                            {r.fields?.find((x) => x.key === f.key)?.value ?? ''}
                          </td>
                        ))
                      ) : (
                        <td className="px-3 py-2 text-gray-600">-</td>
                      )}
                      <td className="px-3 py-2" style={{ color: st.color }}>
                        {atLimit ? (
                          <button
                            type="button"
                            onClick={() => (availableCounts > 0 ? void onUnlock(r) : void openBuy(1))}
                            title={
                              availableCounts > 0
                                ? t('common:guest.batch.unlockRowTip', {
                                    defaultValue: '已达生成上限，点击消耗 1 个请柬币解锁并重置渲染次数',
                                  })
                                : t('common:guest.batch.lockedRowTip', { defaultValue: '已达生成上限，点击购买请柬币' })
                            }
                            className="cursor-pointer text-left hover:underline"
                            style={{ color: '#c81e42' }}
                          >
                            {availableCounts > 0
                              ? t('common:guest.batch.unlock', { defaultValue: '解锁' })
                              : t('common:guest.batch.buyRender', { defaultValue: '购买请柬币' })}
                          </button>
                        ) : (
                          st.label
                        )}
                        {r.error ? <div className="text-[11px] text-red-500">{r.error}</div> : null}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => r.url && openPreview(r.url)}
                          disabled={!r.url}
                          className="mr-3 text-blue-600 hover:underline disabled:text-gray-300"
                        >
                          {t('common:guest.batch.preview', { defaultValue: '预览' })}
                        </button>
                        {/* 优化3：行内操作统一为「生成」文案（去掉「重新生成」分支） */}
                        <button
                          onClick={() => onRegenerate(r)}
                          disabled={!canRegenerate || generating}
                          title=""
                          className="text-[#c81e42] hover:underline disabled:text-gray-300"
                        >
                          {t('common:guest.batch.singleGenerate', { defaultValue: '生成' })}
                        </button>
                        {/* 重渲 X/5 提示（保留） */}
                        {r.rerenders ? (
                          <span className="ml-2 text-[11px] text-gray-400">
                            {t('common:guest.batch.rerenderCount', { defaultValue: `重渲 ${r.rerenders}/${rerenderLimit}` })}
                          </span>
                        ) : null}
                      </td>
                      {/* 优化5：次数列 */}
                      <td className="px-3 py-2 text-gray-500">
                        {`${(r.rerenders ?? 0)}/${rerenderLimit - (r.rerenders ?? 0)}`}
                      </td>
                    </tr>
                  );
                })}
                {!results.length && (
                  <tr>
                    {/* 列数 = 勾选 + 任务队列 + 宾客字段列 + 状态 + 操作 + 次数 = 5 + fieldCols.length */}
                    <td colSpan={5 + fieldCols.length} className="py-10 text-center text-gray-400">
                      {t('common:guest.batch.noTasks', { defaultValue: '暂无生成任务' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )
        )}
      </div>

      <InvitationTemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onConfirm={onPickTemplate} />
      {template && (
        <PersonPickerDialog
          open={personOpen}
          templateId={template.id}
          projectId={picked?.projectId}
          onClose={() => setPersonOpen(false)}
          onConfirm={onPickPersons}
        />
      )}

      {/* 生成前变量匹配体检对话框（D4 反转：含映射改指向，§2.5） */}
      <VariableMappingDialog
        open={healthOpen}
        health={health as InvitationHealth}
        elements={elements}
        previewSchema={template?.schema}
        onClose={() => setHealthOpen(false)}
        onSaveMapping={async (m) => {
          try {
            await api.saveInvitationMapping(picked!.projectId, m);
          } catch (se) {
            if (!(se instanceof ApiError && se.statusCode === 409)) throw se;
          }
        }}
        onSaveElementBindings={async (eb: ElementBindings) => {
          try {
            await api.saveElementBindings(picked!.projectId, eb);
          } catch (se) {
            if (!(se instanceof ApiError && se.statusCode === 409)) throw se;
          }
        }}
        onPaired={() => setFieldPaired(true)}
      />

      {buyOpen && quota && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 p-4"
          onClick={closeBuy}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-gray-800">
              {t('common:guest.batch.buyQuantityTitle', { defaultValue: '购买请柬币' })}
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              {t('common:guest.batch.buyQuotaTip', {
                defaultValue: '已购 {{paid}} 人次，可渲染 {{total}} 人，剩余 {{rem}} 人',
              })
                .replace('{{paid}}', String(quota.purchasedHeadcount))
                .replace('{{total}}', String(quota.totalRenderable))
                .replace('{{rem}}', String(quota.remaining))}
            </p>
            <label className="mb-1 block text-sm text-gray-700">
              {t('common:guest.batch.buyHeadcountLabel', { defaultValue: '购买数量（正整数）' })}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={buyHeadcount}
              onChange={(e) =>
                setBuyHeadcount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeBuy}
                className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              >
                {t('common:guest.batch.cancel', { defaultValue: '取消' })}
              </button>
              <button
                onClick={confirmBuy}
                className="rounded bg-[#e879b4] px-4 py-1.5 text-sm text-white hover:bg-[#d965a0]"
              >
                {t('common:guest.batch.confirmBuy', { defaultValue: '确认购买' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑宾客记录弹窗（优化2）：字段回填 + 编辑闸门 */}
      {editOpen && editRecord && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 p-4"
          onClick={() => !editSaving && setEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-gray-800">
              {t('common:guest.batch.editRecordTitle', { defaultValue: '编辑宾客记录' })}
            </h3>
            <p className="mb-3 truncate text-xs text-gray-500">
              {editRecord.taskName ?? editRecord.name ?? editRecord.recordId}
            </p>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto">
              {fieldDesign && fieldDesign.length > 0 ? (
                fieldDesign.map((fd) => {
                  const opts = (fd.options ?? []).map((o) =>
                    typeof o === 'string' ? { label: o, value: o } : { label: o.label, value: o.value },
                  );
                  const isSelect = fd.type === 'select' || opts.length > 0;
                  return (
                    <div key={fd.key}>
                      <label className="mb-1 block text-sm text-gray-700">{fd.label}</label>
                      {isSelect ? (
                        <select
                          value={editForm[fd.key] ?? ''}
                          onChange={(e) => setEditForm((p) => ({ ...p, [fd.key]: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">{t('common:guest.batch.editEmptyOption', { defaultValue: '（不填）' })}</option>
                          {opts.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editForm[fd.key] ?? ''}
                          onChange={(e) => setEditForm((p) => ({ ...p, [fd.key]: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-gray-400">
                  {t('common:guest.batch.noFieldDesign', { defaultValue: '暂无字段设计，无法编辑' })}
                </div>
              )}
            </div>

            {editError && (
              <div className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{editError}</div>
            )}
            {editBlocked && (
              <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t('common:guest.batch.editLimitReached', {
                  defaultValue: '修改次数已达上限（{{n}}/{{limit}} 条，约 {{pct}}% 上限），不可再修改',
                })
                  .replace('{{n}}', String(editedRecordIds.length))
                  .replace('{{limit}}', String(editLimit))
                  .replace('{{pct}}', String(Math.round((editLimit / Math.max(1, results.length)) * 100)))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => !editSaving && setEditOpen(false)}
                className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              >
                {t('common:guest.batch.cancel', { defaultValue: '取消' })}
              </button>
              <button
                onClick={saveEdit}
                disabled={editBlocked || editSaving || !fieldDesign || fieldDesign.length === 0}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? t('common:guest.batch.saving', { defaultValue: '保存中…' }) : t('common:guest.batch.save', { defaultValue: '保存' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 需求C二：达重渲上限记录已改为点击「生成」直接引导购买，移除原 regenDialog 二次确认弹窗 */}

      {/* 逐人预览弹窗：手机框 + 上一页/下一页 + 第X/总N页 + 关闭（ESC 可关） */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[1350] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">
                {t('common:guest.batch.previewTitle', { defaultValue: '逐人预览' })}
              </h3>
              {previewPages[previewPage]?.name ? (
                <span className="text-xs text-gray-400">{previewPages[previewPage].name}</span>
              ) : null}
            </div>

            {previewLoading ? (
              <div className="py-16 text-center text-sm text-gray-400">
                {t('common:guest.batch.previewLoading', { defaultValue: '加载中…' })}
              </div>
            ) : previewPages.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                {t('common:guest.batch.previewEmpty', { defaultValue: '没有可预览的记录' })}
              </div>
            ) : (
              <>
                {/* 手机框：宽固定 PREVIEW_FRAME_W，高按 schema 设计稿尺寸等比缩放，仅渲染当前页 */}
                <div
                  className="mx-auto rounded-[28px] bg-gray-900 p-2 shadow-lg"
                  style={{ width: PREVIEW_FRAME_W + 16 }}
                >
                  <div
                    className="relative overflow-hidden rounded-[20px] bg-white"
                    style={{
                      width: PREVIEW_FRAME_W,
                      height: personalized ? (personalized.height || 667) * (PREVIEW_FRAME_W / (personalized.width || 375)) : 0,
                    }}
                  >
                    {personalized && (
                      <SchemaRenderer
                        key={previewPages[previewPage]?.recordId ?? 'preview'}
                        project={personalized}
                        scale={PREVIEW_FRAME_W / (personalized.width || 375)}
                        animated={false}
                      />
                    )}
                  </div>
                </div>

                {/* 底部控制条：上一页 / 第X/总N页 / 下一页 / 关闭 */}
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                    disabled={previewPage <= 0}
                    className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('common:guest.batch.previewPrev', { defaultValue: '上一页' })}
                  </button>
                  <span className="text-sm text-gray-500">
                    {t('common:guest.batch.previewPageIndicator', {
                      defaultValue: '第 {{cur}} / {{total}} 页',
                    })
                      .replace('{{cur}}', String(previewPage + 1))
                      .replace('{{total}}', String(previewPages.length))}
                  </span>
                  <button
                    onClick={() => setPreviewPage((p) => Math.min(previewPages.length - 1, p + 1))}
                    disabled={previewPage >= previewPages.length - 1}
                    className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('common:guest.batch.previewNext', { defaultValue: '下一页' })}
                  </button>
                  <button
                    onClick={() => setPreviewOpen(false)}
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    {t('common:guest.batch.close', { defaultValue: '关闭' })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 批量生成前「永久绑定」确认弹窗：首次批量生成后请柬作品与名单永久绑定，无法撤回配对 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[1360] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-[360px] rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 flex-none text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-base font-semibold text-gray-800">
                {t('common:guest.batch.bindConfirmTitle', {
                  defaultValue: '本操作永久性绑定请柬和名单，是否继续？',
                })}
              </h3>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              {t('common:guest.batch.bindConfirmDesc', {
                defaultValue: '首次批量生成后，本次选定的请柬作品与名单将永久绑定，无法撤回配对。',
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              >
                {t('common:guest.batch.cancel', { defaultValue: '取消' })}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  if (projectId) void startGenerate({ projectId, mode: resolveGenMode(), targetRecordIds: [...checked] });
                }}
                className="rounded bg-[#c81e42] px-4 py-1.5 text-sm text-white hover:opacity-90"
              >
                {t('common:guest.batch.confirm', { defaultValue: '确认' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 请求二：上锁记录「消耗 1 币解锁重置」确认弹窗（小锁 / 状态列「解锁」/ 单条「生成」共用入口） */}
      {unlockOpen && unlockRow && (
        <div
          className="fixed inset-0 z-[1360] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setUnlockOpen(false)}
        >
          <div
            className="w-[360px] rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 flex-none text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm2.5 8V5.5a2.5 2.5 0 10-5 0V9h5z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-base font-semibold text-gray-800">
                {t('common:guest.batch.unlockTitle', {
                  defaultValue: '是否消耗 1 个请柬币解锁该记录的渲染权限？',
                })}
              </h3>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              {t('common:guest.batch.unlockDesc', {
                defaultValue: '「{{name}}」的渲染次数已用完。确认后消耗 1 个请柬币（剩余可用 {{rem}} 个），将其渲染次数重置为满额 5 次。',
              })
                .replace('{{name}}', unlockRow.taskName ?? unlockRow.name ?? unlockRow.recordId)
                .replace('{{rem}}', String(availableCounts))}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUnlockOpen(false)}
                className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
              >
                {t('common:guest.batch.cancel', { defaultValue: '取消' })}
              </button>
              <button
                onClick={() => void confirmUnlock()}
                className="rounded bg-[#c81e42] px-4 py-1.5 text-sm text-white hover:opacity-90"
              >
                {t('common:guest.batch.unlockConfirm', { defaultValue: '确认解锁' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 需求C一：空选点击「批量生成」居中消息弹窗 */}
      {noSelectOpen && (
        <div
          className="fixed inset-0 z-[1360] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setNoSelectOpen(false)}
        >
          <div
            className="w-[320px] rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 flex-none text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <h3 className="text-base font-semibold text-gray-800">
                {t('common:guest.batch.noRecordSelected', { defaultValue: '请勾选需要生成的记录' })}
              </h3>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setNoSelectOpen(false)}
                className="rounded bg-[#c81e42] px-4 py-1.5 text-sm text-white hover:opacity-90"
              >
                {t('common:guest.batch.confirm', { defaultValue: '确定' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
