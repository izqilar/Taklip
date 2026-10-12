import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { STATIC_URL, API_URL, authHeaders, downloadWithAuth } from '../../utility';
import { getGuestFieldDef, personalizeSchema, normalizeSchema, type GuestFieldDef, type GuestData, type Project } from '@h5design/core';
import {
  apiDelete,
  apiGet,
  apiPost,
  useSubjectScope,
  useSpScope,
  editInvitationRecord,
  ApiError,
  type PerResult,
  type ProjectResults,
  type BatchProjectView,
  type GuestRow,
  RERENDER_LIMIT,
} from './invitationShared';
import { t } from '../../i18n/t';
import { VariableMappingDialog, type InvitationHealth, type ProjectElement, type ElementBindings } from '@h5design/invitation-mapping';
import { SchemaRenderer } from '@h5design/render';
import { ExclamationCircleFilled } from '@ant-design/icons';
import {
  getInvitationHealth,
  getProjectElements,
  saveInvitationMapping,
  saveElementBindings,
  InvitationApiError,
} from '../../api/invitation';
import { UserInvitationTemplatePicker, type PickedTemplate } from './UserInvitationTemplatePicker';
import { UserPersonPickerDialog, type PickedPersons } from './UserPersonPickerDialog';

/**
 * 运营端（用户视角）· 请柬批量生成（§18 二次优化 + 配对记录改造）
 *
 * 唯一基准 = web 端 `apps/web/src/user/InvitationJobs.tsx`，逐模块对齐（布局 / 字段 / 按钮 / 列表 / 交互）：
 *   1. 分步向导区：① 请柬模板选择 → ② 宾客名单选择 → ③ 字段配对（严格顺序，禁止跳步）；
 *   2. 配对记录区：GET /invitations/projects（**必须走 q()**，服务商/监督视角才带得上作用域）
 *      列出本项目域全部配对，radio 单选驱动下方任务队列；行卡 = 模板名 / 名单名 / 配对 N 条 /
 *      任务编号 / 状态徽章（DRAFT 草稿 / LOCKED 已锁定 / PAID 已付费）；
 *   3. 任务队列区头：实时配额标签 + 购买数量 + 预览 + 批量生成（项目级：先刷新配额再判缺口）；
 *      表体按**人员逐条**展示 任务编号 / 宾客信息 / 状态 / 操作(预览 · 生成) / 次数；
 *   4. 工具条：全选 / 删除选择 / 打包下载 + 每行复选框（仅超额锁定的 paywalled 行不可勾）；
 *      任务编号单元格可点击打开编辑弹窗。
 *
 * 轮询完成语义（★防回归）：**不能**仅凭逐人 status 停止（未渲染行恒 pending），
 * 必须以 **job 状态** SUCCESS/PARTIAL/FAILED 为终态信号。
 *
 * 配额新鲜度（★防回归）：loadResults 末尾必带 refreshQuota —— 修「剩余:13 却 402」的
 * 轮询期配额陈旧；批量生成闸门先 await refreshQuota 拿新配额再判 need；
 * 402/QUOTA_EXCEEDED 按错误体 remaining 重算缺口并引导购买。
 *
 * 作用域：用户视角 = ADMIN 监督窗口，`subject` 透传（服务端 subjectId 口径）。
 */

const C = {
  brand: '#c81e42',
  blue: '#2563eb',
  blueDark: '#1d4ed8',
  ink1: '#1f2937',
  ink2: '#4b5563',
  ink3: '#6b7280',
  ink4: '#9ca3af',
  line: '#e5e7eb',
  lineSoft: '#f3f4f6',
  head: '#f9fafb',
  ok: '#1a7f37',
  fail: '#cf1322',
  running: '#2563eb',
  warn: '#b45309',
  err: '#dc2626',
  errBg: '#fef2f2',
};

/** 逐人预览手机框宽度（设计稿基准宽 375，按 schema 实际宽度等比缩放） */
const PREVIEW_FRAME_W = 343;

interface JobRow {
  id: string;
  status: string;
}

export interface UserInvitationCenterProps {
  /** ORG=自营样板 / CLIENT=代客；不传则走用户视角（仅 subject） */
  ownerType?: 'ORG' | 'CLIENT';
  /** CLIENT 时必带客户 id */
  clientId?: string;
}

export default function UserInvitationCenter({ ownerType, clientId }: UserInvitationCenterProps) {
  // 用户视角监督口径：仅 subject + canWrite（向后兼容：用户视角路由不传 ownerType/clientId）
  const { subject, canWrite } = useSubjectScope();
  // 服务商作用域：统一经 useSpScope 拼 subject + ownerType + clientId（修复 SP 页 400 根因）
  const { scopeQuery, scopeBody, scopeForImage } = useSpScope();
  const clientIdForScope = ownerType === 'CLIENT' ? clientId : undefined;
  const q = useCallback(
    (p: string) => scopeQuery(p, ownerType, clientIdForScope),
    [scopeQuery, ownerType, clientIdForScope],
  );
  const body = useCallback(
    (extra?: Record<string, unknown>) => ({
      ...scopeBody,
      ...(ownerType ? { ownerType } : {}),
      ...(clientIdForScope ? { clientId: clientIdForScope } : {}),
      ...extra,
    }),
    [scopeBody, ownerType, clientIdForScope],
  );
  const imgScope = useMemo(
    () => scopeForImage(ownerType, clientIdForScope),
    [scopeForImage, ownerType, clientIdForScope],
  );

  // 变量绑定对话框（S5）态
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState<InvitationHealth | null>(null);
  const [mappingElements, setMappingElements] = useState<ProjectElement[]>([]);
  const [previewSchema, setPreviewSchema] = useState<unknown>(undefined);
  // ── 逐人预览弹窗（生成前逐人核对：模板 schema × 名单记录实时个性化渲染）──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** 变量映射（元素 binding.key → 名单字段），来自生成前体检 */
  const [previewMapping, setPreviewMapping] = useState<Record<string, string>>({});
  /** 预览页数据：勾选子集（无勾选则名单全量）映射后的记录 */
  const [previewPages, setPreviewPages] = useState<Array<{ recordId: string; name: string; data: GuestData }>>([]);
  const [previewPage, setPreviewPage] = useState(0);
  // ── 批量生成前「永久绑定」确认弹窗 ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 分步向导：第③步「字段配对」是否完成
  const [fieldPaired, setFieldPaired] = useState(false);

  const [template, setTemplate] = useState<PickedTemplate | null>(null);
  const [picked, setPicked] = useState<PickedPersons | null>(null);

  const [results, setResults] = useState<PerResult[]>([]);
  const [rerenderLimit, setRerenderLimit] = useState(RERENDER_LIMIT);
  const [loadingResults, setLoadingResults] = useState(false);
  const [generating, setGenerating] = useState(false);
  // 续跑失败项（T6）：防止重复点击
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');
  const [emptyBatch, setEmptyBatch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // 编辑上限闸门（§变量绑定 优化2）
  const [editedRecordIds, setEditedRecordIds] = useState<string[]>([]);
  const [editLimit, setEditLimit] = useState<number>(0);
  // 全局剩余渲染额度（超出上限后的确认/耗尽弹窗以此为准）
  const [availableCounts, setAvailableCounts] = useState<number>(0);
  // 任务队列编辑弹窗（§变量绑定 优化2）
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<PerResult | null>(null);
  const [editFields, setEditFields] = useState<GuestFieldDef[]>([]);
  const [editFormValues, setEditFormValues] = useState<Record<string, string>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm<Record<string, string>>();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);

  // 购买渲染人次弹窗与配额
  const [quota, setQuota] = useState<BatchProjectView | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyHeadcount, setBuyHeadcount] = useState('1');
  const [buyMsg, setBuyMsg] = useState('');
  const [buyError, setBuyError] = useState('');

  // 配对记录：项目列表 + 当前选中项目（radio 单选，驱动下方任务队列与项目级生成操作）
  const [projects, setProjects] = useState<BatchProjectView[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const pollRef = useRef<number | null>(null);
  const projectId = selectedProjectId || picked?.projectId || '';

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * 拉取并同步项目配额（可渲染总数 / 剩余），供「购买数量」右侧标签实时显示。
   * 返回 fresh view：批量生成闸门可拿最新 remaining 判缺口，避免轮询期间配额陈旧。
   */
  const refreshQuota = useCallback(
    async (pid: string): Promise<BatchProjectView | null> => {
      try {
        const v = await apiGet<BatchProjectView>(q(`/invitations/projects/${pid}`));
        setQuota({
          id: v.id,
          state: v.state,
          freeSampleCap: v.freeSampleCap,
          purchasedHeadcount: v.purchasedHeadcount,
          totalRenderable: v.totalRenderable,
          alreadyRendered: v.alreadyRendered,
          purchasedRerender: v.purchasedRerender,
          remaining: v.remaining,
          locked: v.locked,
        });
        setAvailableCounts(v.remaining ?? 0);
        return v;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    [q],
  );

  const loadResults = useCallback(
    async (pid: string) => {
      try {
        const r = await apiGet<ProjectResults>(q(`/invitations/projects/${pid}/results`));
        setResults(r.results ?? []);
        setRerenderLimit(r.rerenderLimit ?? RERENDER_LIMIT);
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
    [q, refreshQuota],
  );

  /** 拉取「配对记录」项目列表（必须走 q()：服务商 / 监督视角才带得上作用域） */
  const loadProjects = useCallback(async () => {
    try {
      const list = await apiGet<BatchProjectView[]>(q('/invitations/projects'));
      setProjects(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [q]);

  // 编辑弹窗字段/初始值异步加载完成后回填 Form（与 destroyOnClose 配合，避免首帧 initialValues 滞后）
  useEffect(() => {
    if (editOpen && editRow) editForm.setFieldsValue(editFormValues);
  }, [editOpen, editRow, editFormValues, editForm]);

  // 轮询：有运行中的 job 时刷新逐人状态；job 终态后停止
  useEffect(() => {
    if (!runningJobId || !projectId) return;
    let alive = true;
    setLoadingResults(true);
    const tick = async () => {
      await loadResults(projectId);
      try {
        const job = await apiGet<JobRow>(q(`/invitations/jobs/${runningJobId}`));
        if (!alive) return;
        if (!job || ['SUCCESS', 'PARTIAL', 'FAILED'].includes(job.status)) {
          stopPoll();
          setRunningJobId(null);
          setGenerating(false);
        }
      } catch {
        /* 忽略轮询中的错误，下一轮重试 */
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      stopPoll();
    };
  }, [runningJobId, projectId, loadResults, stopPoll, q]);

  // 切换项目时拉一次结果
  useEffect(() => {
    if (projectId) {
      void loadResults(projectId);
      void refreshQuota(projectId);
      // 切换项目（含「配对记录」radio）→ 清空上一项目的勾选，防跨项目脏勾选
      setChecked(new Set());
    } else {
      setResults([]);
      setChecked(new Set());
    }
  }, [projectId, loadResults, refreshQuota]);

  // 挂载即拉「配对记录」（服务商 / 监督视角经 q() 拼 subject + ownerType + clientId）
  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const onPickTemplate = (p: PickedTemplate) => {
    setTemplate(p);
    // 模板变更 → 旧项目/勾选/配对失效，需重新走向导
    setPicked(null);
    setSelectedProjectId('');
    setResults([]);
    setChecked(new Set());
    setFieldPaired(false);
    setPickerOpen(false);
    // 重置选中并刷新「配对记录」列表
    void loadProjects();
  };

  const onPickPersons = (p: PickedPersons) => {
    setPicked(p);
    // 选中该项目 → 同步「配对记录」单选并刷新列表（新建项目即时出现）
    setSelectedProjectId(p.projectId);
    // 名单变更 → 字段配对需重做
    setFieldPaired(false);
    setPersonOpen(false);
    void loadProjects();
  };

  /** 勾选子集的渲染次数需求（逐行真值：未渲染 / 失败 / 重渲满上限 → 需 1 人次） */
  const needForChecked = useCallback(
    () =>
      [...checked].reduce((n, id) => {
        const r = results.find((x) => x.recordId === id);
        if (!r || r.status !== 'ok') return n + 1;
        if ((r.rerenders ?? 0) >= RERENDER_LIMIT) return n + 1;
        return n;
      }, 0),
    [checked, results],
  );

  /**
   * 402 / QUOTA_EXCEEDED 缺量识别：读错误体 remaining 重算还需购买人次。
   * 返回 null 表示非配额错误（调用方走原错误提示）。
   */
  const quotaShortfall = (e: unknown, need: number): number | null => {
    if (!(e instanceof ApiError) || (e.status !== 402 && e.code !== 'QUOTA_EXCEEDED')) return null;
    const body = e.body as { remaining?: number } | null | undefined;
    const remaining = typeof body?.remaining === 'number' ? body.remaining : 0;
    return Math.max(1, need - remaining);
  };

  const startGenerate = useCallback(
    async (payload: { projectId: string; mode?: 'FREE_SAMPLE' | 'PAID' | 'RERENDER'; targetRecordIds?: string[] }) => {
      setError('');
      setEmptyBatch('');
      setBuyMsg('');
      setGenerating(true);
      try {
        // 首渲/续渲前确保勾选已落库（重渲无需重设）。
        // picked.selectedRecordIds 已是服务端并集（名单弹窗按响应体回写），原样提交
        // removed = 0，不会被判为「移除已锁定记录」；仍用响应体回写一次，避免本地副本漂移。
        if (!payload.targetRecordIds && picked && !payload.mode) {
          const saved = await apiPost<{ selectedRecordIds?: string[] }>(
            q(`/invitations/projects/${payload.projectId}/selection`),
            { listId: picked.listId, selectedRecordIds: picked.selectedRecordIds, ...body() },
          );
          if (saved?.selectedRecordIds?.length) {
            setPicked((prev) =>
              prev ? { ...prev, selectedRecordIds: saved.selectedRecordIds ?? prev.selectedRecordIds } : prev,
            );
          }
        }
        const res = await apiPost<{ jobId: string | null; status?: string; message?: string }>(
          q('/invitations/batch-generate'),
          { ...payload, ...body() },
        );
        // 空批次：锁定名单中已无待渲染人员 → 后端返回 jobId:null + status:NO_PENDING，
        // 跳过当前批次、不抛 400、不中断任务
        if (!res.jobId) {
          setGenerating(false);
          setEmptyBatch(res.message || '锁定名单内已无待渲染人员');
          await loadResults(payload.projectId);
          return;
        }
        setRunningJobId(res.jobId);
        await loadResults(payload.projectId);
      } catch (e) {
        setGenerating(false);
        // 402/QUOTA_EXCEEDED：按错误体 remaining 重算缺口，引导购买（不再裸抛 message）
        const shortfall = quotaShortfall(e, needForChecked());
        if (shortfall != null) {
          setError(`渲染次数不足，还需 ${shortfall} 人次，请先购买`);
          void openBuy(shortfall);
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picked, loadResults, q],
  );

  /**
   * 打开「购买渲染人次」弹窗：先同步配额，再按已选超额(待解锁)人数预填购买人次。
   * defaultNeed：调用方（如「批量生成前次数不足」）已按勾选子集算准缺口时优先采用，
   * 避免「remaining>0 但不足」时少算；不传则沿用原 paywalled 推算口径（其余调用方行为不变）。
   */
  const openBuy = (defaultNeed?: number) => {
    if (!projectId) {
      setError('请先选择宾客名单，或在「配对记录」中选择一条记录');
      return;
    }
    void refreshQuota(projectId).then(() => {
      const paywalled = results.filter((r) => r.paywalled).length;
      setBuyHeadcount(defaultNeed && defaultNeed > 0 ? String(defaultNeed) : String(paywalled > 0 ? paywalled : 1));
      setBuyError('');
      setBuyMsg('');
      setBuyOpen(true);
    });
  };

  /** 确认购买：POST /api/invitations/purchase（subject 走 body），成功后用返回视图刷新配额并刷新行 */
  const confirmBuy = async () => {
    if (!projectId) return;
    const n = Math.floor(Number(buyHeadcount));
    if (!Number.isFinite(n) || n <= 0) {
      setBuyError('请输入大于 0 的正整数购买人次');
      return;
    }
    setBuyError('');
    try {
      const v = await apiPost<BatchProjectView>('/invitations/purchase', {
        projectId,
        headcount: n,
        ...body(),
      });
      setQuota({
        id: v.id,
        state: v.state,
        freeSampleCap: v.freeSampleCap,
        purchasedHeadcount: v.purchasedHeadcount,
        totalRenderable: v.totalRenderable,
        alreadyRendered: v.alreadyRendered,
        purchasedRerender: v.purchasedRerender,
        remaining: v.remaining,
        locked: v.locked,
      });
      setAvailableCounts(v.remaining ?? 0);
      await loadResults(projectId);
      setBuyMsg('购买成功，已增加渲染人次');
      setBuyOpen(false);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * 第③步「字段配对」入口：先体检 + 拉取可点选元素，弹出「字段配对」对话框。
   * 对话框保存/跳过 → onPaired 标记第③步完成，不再耦合生成（生成由第④步独立负责）。
   */
  const openFieldPair = async () => {
    if (!picked) {
      setError('请先选择宾客名单');
      return;
    }
    try {
      const h = await getInvitationHealth(picked.projectId, { subject });
      setHealth(h);
      const els = await getProjectElements(picked.projectId, { subject });
      setMappingElements(els.elements);
      setPreviewSchema(els.previewSchema);
      setHealthOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * 第④步「批量生成」闸门（对齐 web 端 handleGenerate）：
   * 先 await refreshQuota 拿**新配额**再判 need —— 修「剩余:13 却 402」的轮询期配额陈旧。
   */
  const handleGenerate = async () => {
    if (!template || !picked || !fieldPaired) {
      setError('请先完成前一步操作');
      return;
    }
    if (generating) return; // 防重复提交（按钮已不再置灰，此处幂等兜底）
    if (checked.size === 0) {
      setError('你没有选择任何记录');
      return;
    }
    // ── 渲染次数判断（单一收费模式，无免费赠样）──
    // 逐行真值 = results（recordId 对齐）：
    //   未渲染 / 失败 → 需 1 人次；已渲但重渲满 5 次 → 需 1 人次重置；已渲且重渲未满 → 不消耗。
    const need = needForChecked();
    const fresh = await refreshQuota(projectId);
    const remaining = fresh?.remaining ?? quota?.remaining ?? 0;
    if (remaining < need) {
      // 次数不足 → 引导购买（不开工、不弹确认）
      const shortfall = Math.max(1, need - remaining);
      setError(`渲染次数不足，还需 ${shortfall} 人次，请先购买`);
      void openBuy(shortfall);
      return;
    }
    // 次数足够 → 先弹「永久绑定」确认，用户确认后才真正开工
    setConfirmOpen(true);
  };

  const onRegenerate = (r: PerResult) => {
    if (!projectId) return;
    const used = r.rerenders ?? 0;
    if (used >= rerenderLimit) {
      if (availableCounts > 0) {
        Modal.confirm({
          title: t('guest.batch.rerenderConsumeWarnTitle', { defaultValue: '消耗次数警告' }),
          content: t('guest.batch.rerenderConsumeWarn', { defaultValue: '该记录已达到生成上限，如果希望再生成一次，则会消耗生成次数。是否继续？' }),
          okText: t('guest.batch.rerenderContinue', { defaultValue: '继续' }),
          cancelText: t('guest.batch.rerenderCancel', { defaultValue: '取消' }),
          onOk: () => {
            void startGenerate({ projectId, mode: 'RERENDER', targetRecordIds: [r.recordId] });
          },
        });
      } else {
        Modal.info({
          content: t('guest.batch.rerenderExhausted', { defaultValue: '你的生成次数已用完，请购买次数' }),
          okText: t('guest.batch.rerenderClose', { defaultValue: '关闭' }),
        });
      }
      return;
    }
    void startGenerate({ projectId, mode: 'RERENDER', targetRecordIds: [r.recordId] });
  };

  /**
   * 断点续跑（T6）：找到最近一个 PARTIAL/FAILED 的任务，仅重渲其失败/缺失项。
   * 对齐 web 端 InvitationJobs.onResumeFailed —— 复用本页已有 loadResults / runningJobId / setGenerating 轮询逻辑。
   */
  const onResumeFailed = async () => {
    if (!projectId) return;
    setResuming(true);
    try {
      const jobs = await apiGet<Array<{ id: string; status: string; createdAt?: string }>>(
        q(`/invitations/jobs?projectId=${projectId}`),
      );
      const cand = [...(jobs ?? [])]
        .filter((j) => j.status === 'PARTIAL' || j.status === 'FAILED')
        .sort((a, b) => (a.createdAt && b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1) : 0))[0];
      if (!cand) {
        setError('未找到可续跑的任务');
        return;
      }
      const res = await apiPost<{ jobId: string }>(`/invitations/jobs/${cand.id}/resume`, body());
      setRunningJobId(res.jobId);
      setGenerating(true);
      await loadResults(projectId); // 复用已有的结果加载/轮询
    } catch (e) {
      // 402/QUOTA_EXCEEDED：续跑无额度 → 按失败行数重算缺口，引导购买
      const shortfall = quotaShortfall(e, results.filter((r) => r.status === 'failed').length);
      if (shortfall != null) {
        setError(`渲染次数不足，还需 ${shortfall} 人次，请先购买`);
        void openBuy(shortfall);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setResuming(false);
    }
  };

  /** 带鉴权预览某张生成图（private-assets 不公开，fetch Blob → 新窗口） */
  const previewUrl = async (url: string | null) => {
    if (!url) return;
    try {
      const res = await fetch(`${STATIC_URL}${url}${imgScope}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      window.open(obj, '_blank');
      setTimeout(() => URL.revokeObjectURL(obj), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** 逐人预览（当前任务） */
  const previewOne = (row: PerResult) => previewUrl(row.url);

  /**
   * 打开「逐人预览」弹窗：点击后异步准备数据（loading 态）——
   *  1. previewSchema = 项目 elements 快照（服务端已注入 elementBindings，直接可个性化）；
   *  2. mapping = 生成前体检返回的 variableMapping（元素 binding.key → 名单字段）；
   *  3. 记录源双路：向导所选项目（picked.projectId===projectId）按「勾选子集（无勾选则本次
   *     名单全量）」过滤；「配对记录」里选中的其他项目 → 该项目 listId 全量记录 × checked 过滤。
   * 渲染侧每页只对当前索引 personalizeSchema（勿一次性全量），animated=false 避免翻页重播入场动画。
   * 取数全部经 q() 拼作用域（subject/ownerType/clientId），与既有端点同口径。
   */
  const openPreviewDialog = async () => {
    if (!projectId) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewPage(0);
    try {
      const pickedForProject = picked && picked.projectId === projectId ? picked : null;
      const listId = pickedForProject?.listId ?? projects.find((p) => p.id === projectId)?.listId;
      const [el, hz, rec] = await Promise.all([
        apiGet<{ previewSchema?: unknown }>(q(`/invitations/projects/${projectId}/elements`)),
        apiGet<InvitationHealth>(q(`/invitations/projects/${projectId}/health`)),
        listId
          ? apiGet<{ records?: GuestRow[] }>(q(`/guest-lists/${listId}/records?page=1&size=500`))
          : Promise.resolve({ records: [] as GuestRow[] }),
      ]);
      setPreviewSchema(el.previewSchema ?? null);
      setPreviewMapping(hz.mapping ?? {});
      const set = checked.size ? checked : new Set(pickedForProject?.selectedRecordIds ?? []);
      const pages = (rec.records ?? [])
        .filter((r) => set.has(r.id))
        .map((r) => ({ recordId: r.id, name: r.data?.guest_name ?? '', data: r.data }));
      setPreviewPages(pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * 打开「任务队列」编辑弹窗（§变量绑定 优化2）。
   * 取字段设计 + 用记录的 fields/data 回填 Form；只读（!canWrite）不打开。
   */
  /**
   * 打开编辑弹窗：字段严格取自当前所选宾客名单的 columnDefs（后端 results 行 row.fields），
   * 不再调用 /api/guest-lists/field-design —— 该端点返回 owner 级设计，会回落 GUEST_FIELD_DEFS.slice(0,5)
   * （系统默认 5 字段），与所选名单实际字段不符（典型如婚礼名单仅含 丈夫姓名/妻子姓名）。
   * 用 getGuestFieldDef 补 type/values 以还原 select 渲染；回填 row.fields.value 优先、row.data 兜底。
   */
  const openEdit = (r: PerResult) => {
    if (!canWrite) return;
    setEditRow(r);
    setEditOpen(true);
    setEditLoading(false);
    const fields: GuestFieldDef[] = (r.fields ?? []).map((f) => {
      const def = getGuestFieldDef(f.key);
      return {
        key: f.key,
        label: f.label,
        type: def?.type ?? 'string',
        required: def?.required ?? false,
        maxLen: def?.maxLen,
        values: def?.values ?? def?.enum,
        example: def?.example ?? '',
      } as GuestFieldDef;
    });
    setEditFields(fields);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const fromFields = r.fields?.find((x) => x.key === f.key)?.value;
      const fromData = r.data?.[f.key];
      initial[f.key] =
        fromFields != null && fromFields !== '' ? fromFields : fromData != null ? String(fromData) : '';
    }
    setEditFormValues(initial);
  };

  /** 保存编辑后的宾客字段（§变量绑定 优化2） */
  const saveEdit = async () => {
    if (!editRow || !canWrite) return;
    if (editLimit > 0 && editedRecordIds.length >= editLimit) return;
    setEditLoading(true);
    try {
      const values = editForm.getFieldsValue() as Record<string, string>;
      const editedData: Record<string, string> = {};
      for (const f of editFields) editedData[f.key] = values[f.key] ?? '';
      await editInvitationRecord(projectId, editRow.recordId, editedData);
      setEditOpen(false);
      setEditedRecordIds((prev) =>
        prev.includes(editRow.recordId) ? prev : [...prev, editRow.recordId],
      );
      await loadResults(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditLoading(false);
    }
  };

  const doPack = async () => {
    if (!projectId) return;
    try {
      const ids = [...checked];
      const base = scopeQuery(`/api/invitations/projects/${projectId}/download`, ownerType, clientIdForScope);
      const sep = base.includes('?') ? '&' : '?';
      const suffix = ids.length ? `${sep}recordIds=${ids.join(',')}` : '';
      await downloadWithAuth(`${base}${suffix}`, `invitations-${projectId}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doDelete = async () => {
    if (!projectId || !checked.size) return;
    if (!window.confirm('确定删除选中的生成记录？此操作不退配额')) return;
    try {
      await apiDelete(q(`/invitations/projects/${projectId}/results`), {
        recordIds: [...checked],
        ...body(),
      });
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
  // 缺陷一修复：仅超额锁定（paywalled）不可勾选；全选覆盖所有非 paywalled 行
  // 「续跑失败项」按钮可见性：存在失败（failed）结果行时显示（对齐 web 端 failedCount 口径）
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const selectableIds = results.filter((r) => !r.paywalled).map((r) => r.recordId);
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => checked.has(id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(selectableIds));

  const statusText = (r: { status: PerResult['status']; paywalled?: boolean }) => {    if (r.status === 'ok') return { label: '成功', color: C.ok };
    if (r.status === 'failed') return { label: '失败', color: C.fail };
    // B5：已勾选但剩余渲染额度耗尽、尚未渲染 —— 既非成功也非失败，用琥珀色区别于红色失败态
    if (r.paywalled) return { label: '待解锁', color: C.warn };
    return runningJobId ? { label: '生成中', color: C.running } : { label: '待生成', color: C.ink4 };
  };

  /** 宾客信息按字段拆列：表头 schema 取首行 fields（各行列序一致），每格只渲染该字段的 value */
  const fieldCols = results[0]?.fields ?? [];

  // 「购买数量」右侧实时配额标签
  const used = quota ? Math.max(0, (quota.totalRenderable ?? 0) - (quota.remaining ?? 0)) : 0;
  const quotaText = quota
    ? `生成总数：${quota.totalRenderable ?? '—'}，已使用：${used}，剩余：${quota.remaining ?? '—'}`
    : '生成总数：—，已使用：—，剩余：—';

  /**
   * 逐人预览：仅对当前页索引做个性化（schema × mapping × 当前记录），翻页时按依赖重算。
   * previewSchema 为归一化前的原始快照，normalizeSchema 兜底补全 width/height 等缺字段。
   */
  const personalized = useMemo(() => {
    const p = previewPages[previewPage];
    if (!p || !previewSchema) return null;
    return personalizeSchema(
      normalizeSchema(previewSchema as Project | null),
      { id: p.recordId, data: p.data },
      previewMapping,
    );
  }, [previewSchema, previewMapping, previewPages, previewPage]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: C.ink1 }}>请柬批量生成</h2>

      {error && (
        <div style={{ marginBottom: 12, borderRadius: 4, background: C.errBg, padding: '8px 12px', fontSize: 12, color: C.err }}>
          {error}
        </div>
      )}
      {emptyBatch && (
        <div style={{ marginBottom: 12, borderRadius: 4, background: '#fffbeb', padding: '8px 12px', fontSize: 12, color: '#b45309' }}>
          {emptyBatch}
        </div>
      )}
      {buyMsg && (
        <div style={{ marginBottom: 12, borderRadius: 4, background: '#f0fdf4', padding: '8px 12px', fontSize: 12, color: '#15803d' }}>
          {buyMsg}
        </div>
      )}

      {/* 分步向导：① 选模板 → ② 选名单 → ③ 字段配对（严格顺序，禁止跳步）；预览 / 批量生成等操作在下方「任务队列」区头 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          borderRadius: 8,
          border: `1px solid ${C.line}`,
          background: '#fff',
          padding: 16,
        }}
      >
        <button
          onClick={() => setPickerOpen(true)}
          style={{ borderRadius: 4, border: 'none', background: C.brand, color: '#fff', padding: '6px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          ① 请柬模板选择
        </button>
        <span style={{ fontSize: 14, color: C.ink2 }}>
          {template ? `模板：${template.title}` : '未选择模板'}
        </span>

        <button
          onClick={() => {
            if (!template) {
              setError('请先完成前一步操作');
              return;
            }
            setPersonOpen(true);
          }}
          disabled={!template}
          style={{
            borderRadius: 4,
            border: '1px solid #d1d5db',
            background: '#fff',
            padding: '6px 16px',
            fontSize: 14,
            cursor: template ? 'pointer' : 'not-allowed',
            opacity: template ? 1 : 0.5,
          }}
        >
          ② 宾客名单选择
        </button>
        <span style={{ fontSize: 14, color: C.ink2 }}>
          {picked ? `已选 ${picked.selectedRecordIds.length} 人` : '未选择人员'}
        </span>

        <button
          onClick={() => {
            if (!template || !picked) {
              setError('请先完成前一步操作');
              return;
            }
            void openFieldPair();
          }}
          disabled={!template || !picked || !canWrite}
          style={{
            borderRadius: 4,
            border: '1px solid #d1d5db',
            background: '#fff',
            padding: '6px 16px',
            fontSize: 14,
            cursor: !template || !picked || !canWrite ? 'not-allowed' : 'pointer',
            opacity: !template || !picked || !canWrite ? 0.5 : 1,
          }}
        >
          ③ 字段配对{fieldPaired ? '（已配对）' : ''}
        </button>

        {/* 预览 / 批量生成 / 购买数量 / 配额标签已移至下方「任务队列」区头（项目级操作） */}
        {!canWrite && <span style={{ fontSize: 12, color: C.ink4 }}>监督态只读</span>}
      </div>

      {/* 配对记录区：本项目域全部配对（radio 单选），选中项驱动下方任务队列与项目级生成操作 */}
      <div style={{ marginBottom: 16, borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${C.lineSoft}`,
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>配对记录</span>
        </div>
        {!projects.length ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>
            暂无配对记录，请先完成 ① 请柬模板选择 → ② 宾客名单选择
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16 }}>
            {projects.map((p) => {
              const active = p.id === projectId;
              const st =
                p.state === 'PAID'
                  ? { label: '已付费', color: C.ok }
                  : p.state === 'LOCKED'
                    ? { label: '已锁定', color: C.warn }
                    : { label: '草稿', color: C.ink3 };
              return (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    width: 280,
                    borderRadius: 8,
                    border: `1px solid ${active ? C.blue : C.line}`,
                    background: active ? '#eff6ff' : '#fff',
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="pairing-project"
                    checked={active}
                    onChange={() => setSelectedProjectId(p.id)}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: '#3b82f6' }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: C.ink1, fontWeight: 500 }}>{p.templateTitle || '未命名模板'}</span>
                    <span style={{ color: C.ink2 }}>{p.listName || '未命名名单'}</span>
                    <span style={{ color: C.ink3 }}>{`配对 ${p.pairCount ?? 0} 条`}</span>
                    <span style={{ color: C.ink3 }}>{`任务编号：${p.projectCode || '—'}`}</span>
                    <span style={{ color: st.color }}>{st.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* 任务队列区：区头 = 项目级操作（配额标签 / 购买数量 / 预览 / 批量生成）+ 工具条；表体按人逐条展示 */}
      <div style={{ borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${C.lineSoft}`,
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>任务队列</span>
          {/* 项目级操作区：实时配额 + 购买数量 + 逐人预览 + 批量生成（「配对记录」选中项目后可用） */}
          <span style={{ fontSize: 13, color: C.ink2 }}>{quotaText}</span>
          <button
            onClick={() => void openBuy()}
            disabled={!projectId}
            style={{
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: '#fff',
              padding: '6px 16px',
              fontSize: 14,
              cursor: !projectId ? 'not-allowed' : 'pointer',
              opacity: !projectId ? 0.5 : 1,
            }}
          >
            {t('guest.batch.buyQuantity', { defaultValue: '购买数量' })}
          </button>
          {/* 生成前逐人预览：模板 schema × 勾选名单记录实时个性化（对齐 web 端「预览」按钮） */}
          <button
            onClick={() => {
              if (!template || !picked || !fieldPaired) {
                setError('请先完成前一步操作');
                return;
              }
              void openPreviewDialog();
            }}
            disabled={!template || !picked || !fieldPaired || !selectedProjectId}
            style={{
              borderRadius: 4,
              border: `1px solid ${C.blue}`,
              background: '#fff',
              color: C.blue,
              padding: '6px 16px',
              fontSize: 14,
              cursor: !template || !picked || !fieldPaired || !selectedProjectId ? 'not-allowed' : 'pointer',
              opacity: !template || !picked || !fieldPaired || !selectedProjectId ? 0.5 : 1,
            }}
          >
            预览
          </button>
          <button
            onClick={() => void handleGenerate()}
            // 优化：向导完成即常亮可点，不再因「未勾选 / 生成中 / 队列状态」置灰
            disabled={!picked || !canWrite || !fieldPaired || !selectedProjectId}
            style={{
              borderRadius: 4,
              border: 'none',
              background: C.blue,
              color: '#fff',
              padding: '6px 20px',
              fontSize: 14,
              cursor: !picked || !canWrite || !fieldPaired || !selectedProjectId ? 'not-allowed' : 'pointer',
              opacity: !picked || !canWrite || !fieldPaired || !selectedProjectId ? 0.5 : 1,
            }}
          >
            {generating ? '生成中…' : '④ 批量生成所选'}
          </button>
          {/* 工具栏（全选/删除选择/打包下载） */}
          {(
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {failedCount > 0 && (
                <SmallBtn onClick={onResumeFailed} disabled={resuming || generating}>
                  续跑失败项
                </SmallBtn>
              )}
              <SmallBtn onClick={toggleAll} disabled={!results.length}>
                全选
              </SmallBtn>
              <SmallBtn onClick={doDelete} disabled={!checked.size || !canWrite}>
                删除选择
              </SmallBtn>
              <SmallBtn onClick={doPack} disabled={!results.length}>
                打包下载
              </SmallBtn>
            </div>
          )}
        </div>

        {!projectId ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>
            请先依次完成 ① 请柬模板选择 → ② 宾客名单选择 → ③ 字段配对，然后在「配对记录」中选择一条记录
          </div>
        ) : (
          loadingResults && !results.length ? (
            <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 40 }}>
                    {/* 优化1：首列全选 checkbox（受控 allChecked / toggleAll） */}
                    <input
                      type="checkbox"
                      checked={allChecked}
                      disabled={!selectableIds.length}
                      onChange={toggleAll}
                      style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                    />
                  </th>
                  <th style={th}>任务编号</th>
                  {fieldCols.length ? (
                    fieldCols.map((f) => (
                      <th key={f.key} style={th}>
                        {f.label}
                      </th>
                    ))
                  ) : (
                    <th style={th}>宾客信息</th>
                  )}
                  <th style={{ ...th, width: 112 }}>状态</th>
                  <th style={{ ...th, width: 160 }}>操作</th>
                  <th style={{ ...th, width: 100 }}>次数</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const st = statusText(r);
                  const isPending = r.status === 'pending';
                  // 「已达重渲上限 + 全局无额度」的行不被 paywalled 置灰：点击只弹「已用完」（仅「关闭」）。
                  // ⚠️ 例外收窄到 availableCounts === 0：若 remaining > 0，点击会落在「消耗次数警告」的
                  // 「继续」上，扣全局额度直接出图 —— 会绕过「待解锁」行需先购买人次的设计。
                  const atLimit = (r.rerenders ?? 0) >= rerenderLimit;
                  const canRegenerate =
                    (r.status === 'ok' || r.status === 'failed' || isPending) &&
                    (!r.paywalled || (atLimit && availableCounts === 0));
                  const taskLabel = r.taskName ?? r.name ?? r.recordId;
                  return (
                    <tr key={r.recordId}>
                      <td style={td}>
                        {/* 缺陷一修复：仅超额锁定（paywalled）不可勾选 */}
                        <input
                          type="checkbox"
                          checked={checked.has(r.recordId)}
                          disabled={!!r.paywalled}
                          onChange={() => toggleCheck(r.recordId)}
                          title={r.paywalled ? '超出可渲染额度，需购买人次解锁' : ''}
                          style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                        />
                      </td>
                      <td style={{ ...td, color: C.ink1 }}>
                        {/* 优化2：任务队列可点击打开编辑弹窗（只读态退化为纯文本） */}
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => void openEdit(r)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              color: C.blue,
                              cursor: 'pointer',
                              fontSize: 14,
                            }}
                            title="点击编辑宾客信息"
                          >
                            {taskLabel}
                          </button>
                        ) : (
                          taskLabel
                        )}
                      </td>
                      {/* 优化4：宾客信息按字段拆列，每格只显示该字段的值 */}
                      {fieldCols.length ? (
                        fieldCols.map((f) => (
                          <td key={f.key} style={{ ...td, color: C.ink2 }}>
                            {r.fields?.find((x) => x.key === f.key)?.value ?? ''}
                          </td>
                        ))
                      ) : (
                        <td style={{ ...td, color: C.ink2 }}>—</td>
                      )}
                      <td style={{ ...td, color: st.color }}>
                        {st.label}
                        {r.error ? <div style={{ fontSize: 11, color: '#ef4444' }}>{r.error}</div> : null}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => void previewOne(r)}
                          disabled={!r.url}
                          style={linkBtn(C.blue, !!r.url)}
                        >
                          预览
                        </button>
                        {/* 优化3：统一文案为「生成」 */}
                        <button
                          onClick={() => onRegenerate(r)}
                          disabled={!canRegenerate || generating || !canWrite}
                          title=""
                          style={linkBtn(C.brand, canRegenerate && !generating && canWrite)}
                        >
                          生成
                        </button>
                        {r.rerenders ? (
                          <span style={{ marginLeft: 8, fontSize: 11, color: C.ink3 }}>
                            重渲 {r.rerenders}/{rerenderLimit}
                          </span>
                        ) : null}
                      </td>
                      {/* 优化5：次数列 */}
                      <td style={{ ...td, color: C.ink3 }}>
                        {`${r.rerenders ?? 0}/${rerenderLimit - (r.rerenders ?? 0)}`}
                      </td>
                    </tr>
                  );
                })}
                {!results.length && (
                  <tr>
                    <td colSpan={5 + fieldCols.length} style={{ ...td, textAlign: 'center', color: C.ink4, padding: 40 }}>
                      暂无生成任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )
      )}
      </div>

      <UserInvitationTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={onPickTemplate}
      />
      {template && (
        <UserPersonPickerDialog
          open={personOpen}
          templateId={template.id}
          // 复用既有项目：换名单不新建项目，避免已购人次作废（换模板时 picked 置空 → 走新建）
          projectId={picked?.projectId}
          onClose={() => setPersonOpen(false)}
          onConfirm={onPickPersons}
        />
      )}

      <VariableMappingDialog
        open={healthOpen}
        health={health as InvitationHealth}
        elements={mappingElements}
        previewSchema={previewSchema}
        onClose={() => setHealthOpen(false)}
        onSaveMapping={async (m) => {
          if (!picked) return;
          try {
            await saveInvitationMapping(picked.projectId, m, { subject });
          } catch (se) {
            if (!(se instanceof InvitationApiError && se.status === 429)) throw se;
          }
        }}
        onSaveElementBindings={async (eb) => {
          if (!picked) return;
          try {
            await saveElementBindings(picked.projectId, eb, { subject });
          } catch (se) {
            if (!(se instanceof InvitationApiError && se.status === 429)) throw se;
          }
        }}
        onPaired={() => setFieldPaired(true)}
      />

      {/* 任务队列编辑弹窗（§变量绑定 优化2）：antd Modal + Form */}
      <Modal
        open={editOpen}
        title="编辑宾客信息"
        onCancel={() => setEditOpen(false)}
        onOk={saveEdit}
        okText="保存"
        cancelText="取消"
        confirmLoading={editLoading}
        destroyOnClose
        okButtonProps={{
          disabled: !canWrite || (editLimit > 0 && editedRecordIds.length >= editLimit),
        }}
      >
        {!canWrite ? (
          <div style={{ color: C.ink4, fontSize: 13, marginBottom: 12 }}>监督态只读，不可编辑</div>
        ) : null}
        {editLimit > 0 && editedRecordIds.length >= editLimit ? (
          <div style={{ color: C.warn, fontSize: 13, marginBottom: 12 }}>
            {`修改次数已达上限（${Math.round((editedRecordIds.length / editLimit) * 100)}%），不可再修改`}
          </div>
        ) : null}
        <Form form={editForm} layout="vertical" initialValues={editFormValues}>
          {editFields.map((f) => (
            <Form.Item
              key={f.key}
              name={f.key}
              label={f.label}
              rules={f.required ? [{ required: true, message: `请输入${f.label}` }] : []}
            >
              {f.type === 'enum' && f.values?.length ? (
                <Select
                  options={f.values.map((v) => ({ label: v, value: v }))}
                  placeholder={`请选择${f.label}`}
                />
              ) : (
                <Input maxLength={f.maxLen} placeholder={`请输入${f.label}`} />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* 购买渲染人次弹窗（对齐 web 端「购买数量」） */}
      <Modal
        open={buyOpen}
        title={t('guest.batch.buyTitle', { defaultValue: '购买渲染人次' })}
        onCancel={() => setBuyOpen(false)}
        onOk={confirmBuy}
        okText={t('guest.batch.confirmBuy', { defaultValue: '确认购买' })}
        cancelText="取消"
      >
        <div style={{ fontSize: 13, color: C.ink2, marginBottom: 12 }}>
          {quota ? `已购 ${quota.purchasedHeadcount ?? 0} 人次，可渲染 ${quota.totalRenderable ?? 0} 人，剩余 ${quota.remaining ?? 0} 人` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{t('guest.batch.buyHeadcount', { defaultValue: '购买人次' })}</span>
          <Input type="number" min={1} value={buyHeadcount} onChange={(e) => setBuyHeadcount(e.target.value)} style={{ width: 120 }} />
        </div>
        {buyError ? <div style={{ color: C.err, fontSize: 12, marginTop: 8 }}>{buyError}</div> : null}
      </Modal>

      {/* 逐人预览弹窗：手机框 + 上一页/下一页 + 第X/总N页 + 关闭（ESC 可关） */}
      <Modal
        open={previewOpen}
        title="逐人预览"
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={400}
        destroyOnClose
      >
        {previewPages[previewPage]?.name ? (
          <div style={{ fontSize: 12, color: C.ink4, marginBottom: 8 }}>{previewPages[previewPage].name}</div>
        ) : null}
        {previewLoading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>加载中…</div>
        ) : previewPages.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>没有可预览的记录</div>
        ) : (
          <>
            {/* 手机框：宽固定 PREVIEW_FRAME_W，高按 schema 设计稿尺寸等比缩放，仅渲染当前页 */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: PREVIEW_FRAME_W + 16, borderRadius: 28, background: '#111827', padding: 8 }}>
                <div
                  style={{
                    position: 'relative',
                    width: PREVIEW_FRAME_W,
                    height: personalized
                      ? (personalized.height || 667) * (PREVIEW_FRAME_W / (personalized.width || 375))
                      : 0,
                    overflow: 'hidden',
                    borderRadius: 20,
                    background: '#fff',
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
            </div>

            {/* 底部控制条：上一页 / 第X/总N页 / 下一页 / 关闭 */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                disabled={previewPage <= 0}
                style={previewNavBtn(previewPage <= 0)}
              >
                上一页
              </button>
              <span style={{ fontSize: 14, color: C.ink3 }}>{`第 ${previewPage + 1} / ${previewPages.length} 页`}</span>
              <button
                onClick={() => setPreviewPage((p) => Math.min(previewPages.length - 1, p + 1))}
                disabled={previewPage >= previewPages.length - 1}
                style={previewNavBtn(previewPage >= previewPages.length - 1)}
              >
                下一页
              </button>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{
                  borderRadius: 4,
                  border: 'none',
                  background: C.blue,
                  color: '#fff',
                  padding: '4px 16px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                关闭
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* 批量生成前「永久绑定」确认弹窗：首次批量生成后请柬作品与名单永久绑定，无法撤回配对 */}
      <Modal
        open={confirmOpen}
        title={null}
        onCancel={() => setConfirmOpen(false)}
        footer={null}
        width={420}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <ExclamationCircleFilled style={{ color: C.warn, fontSize: 20, marginTop: 2 }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink1 }}>
            本操作永久性绑定请柬和名单，是否继续？
          </h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, color: C.ink2 }}>
          首次批量生成后，本次选定的请柬作品与名单将永久绑定，无法撤回配对。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setConfirmOpen(false)}
            style={{
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: '#fff',
              padding: '6px 16px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={() => {
              setConfirmOpen(false);
              if (projectId) void startGenerate({ projectId, targetRecordIds: [...checked] });
            }}
            style={{
              borderRadius: 4,
              border: 'none',
              background: C.brand,
              color: '#fff',
              padding: '6px 16px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            确认
          </button>
        </div>
      </Modal>
    </div>
  );
}

const th: React.CSSProperties = { background: C.head, textAlign: 'left', color: C.ink3, fontWeight: 500, padding: '8px 12px' };
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${C.lineSoft}` };

function linkBtn(color: string, enabled: boolean): React.CSSProperties {
  return {
    marginRight: 12,
    border: 'none',
    background: 'none',
    padding: 0,
    fontSize: 14,
    color: enabled ? color : '#d1d5db',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

/** 逐人预览弹窗底部「上一页 / 下一页」导航按钮样式 */
function previewNavBtn(disabled: boolean): React.CSSProperties {
  return {
    borderRadius: 4,
    border: '1px solid #d1d5db',
    background: '#fff',
    padding: '4px 12px',
    fontSize: 14,
    color: '#4b5563',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function SmallBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 4,
        border: '1px solid #d1d5db',
        background: '#fff',
        padding: '4px 12px',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
