/**
 * 运营端（服务商）· 批量请柬生成管线（完整工作区）
 *
 * 复用 web 端已定型落地的核心技术链路（server 端 `invitation.*` 两端共享，无需改 server），
 * 在本端补齐「模板选择 → 人员选择 → 批量生成 → 逐人进度/任务调度 → 打包/逐人下载/删除/重生成」
 * 全链路 UI，并明确与 web 端的差异与运行环境约束（详见 docs/运营端批量请柬生成管线设计.md）。
 *
 * 与 web 端（USER / :5173）的关键差异：
 *  1. 鉴权：web `request()` 含 401→refresh→重试；admin `authHeaders()` 裸 Bearer、无 refresh。
 *     本页统一以 ApiError(401) 清登录态并提示重登，避免静默失败（已知约束）。
 *  2. API 基址：web 走 vite proxy（BASE_URL=''）；admin `API_URL` 绝对（Vite 不代理 /api）。
 *     所有请求一律 `${API_URL}${path}`，下载一律 `downloadWithAuth`（fetch+Blob+auth）。
 *  3. 作用域：web SELF；admin ORG（自营）/ CLIENT（代客，带 clientId），ownerType/clientId 透传。
 *     注意 server 对 scope 的入参位置不一致：POST 走 body、GET 走 query —— 本页两处都带。
 *  4. 渲染内核一致：模板预览复用 admin 既有 `WorkPreviewModal`（同 @h5design/render SchemaRenderer），
 *     保证与 web 端所见即所得；逐人私密图经 `AuthImage`（带鉴权 fetch）呈现，避免 <img> 直链 401。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Table, Button, message, Checkbox, Select, Input, Spin, Alert, Tag, Tooltip, Empty } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { WorkPreviewModal } from '../components/user/WorkPreviewModal';
import {
  API_URL,
  STATIC_URL,
  authHeaders,
  jsonHeaders,
  clearSession,
  downloadWithAuth,
} from '../utility';
import { T } from '../config/theme';
import {
  VariableMappingDialog,
  type InvitationHealth,
  type ProjectElement,
  type ElementBindings,
} from '@h5design/invitation-mapping';
import {
  getInvitationHealth,
  getProjectElements,
  saveInvitationMapping,
  saveElementBindings,
  InvitationApiError,
  type InvitationApiOpts,
} from '../api/invitation';

type OwnerType = 'ORG' | 'CLIENT';
type PerStatus = 'pending' | 'ok' | 'failed';
interface PerResult {
  recordId: string;
  name: string | null;
  status: PerStatus;
  url: string | null;
  error: string | null;
  /**
   * 已勾选但剩余渲染额度耗尽、尚未渲染（B5）。
   * 既不是成功也不是失败 —— 状态列显示为「待解锁」，区别于红色「失败」。
   */
  paywalled?: boolean;
}
interface ProjectResults {
  projectId: string;
  total: number;
  results: PerResult[];
}
interface WorkItem {
  id: string;
  title?: string;
  cover?: string | null;
  status?: string;
  pages?: any[];
  schema?: any;
}
interface GuestRecord {
  id: string;
  data?: Record<string, any>;
}

/** 统一异常：携带 HTTP 状态与业务 code，供上层做 401/402 分流 */
class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function scopeQuery(ot: OwnerType, cid: string): string {
  return ot === 'CLIENT' && cid ? `ownerType=CLIENT&clientId=${encodeURIComponent(cid)}` : `ownerType=${ot}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (res.status === 401) {
    clearSession();
    throw new ApiError('登录态已失效，请重新登录', 401, 'UNAUTH');
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d?.message || `HTTP ${res.status}`, res.status, d?.code);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    clearSession();
    throw new ApiError('登录态已失效，请重新登录', 401, 'UNAUTH');
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d?.message || `HTTP ${res.status}`, res.status, d?.code);
  }
  return res.json() as Promise<T>;
}

async function apiDelete<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearSession();
    throw new ApiError('登录态已失效，请重新登录', 401, 'UNAUTH');
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d?.message || `HTTP ${res.status}`, res.status, d?.code);
  }
  return res.json() as Promise<T>;
}

/** 带鉴权的私密图预览（private-assets 不公开暴露，<img src> 直链会 401） */
function AuthImage({ path, scope, alt }: { path: string; scope: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    setSrc(null);
    setErr(false);
    const u = `${STATIC_URL}${path}${path.includes('?') ? '&' : '?'}${scope}`;
    fetch(u, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => {
        obj = URL.createObjectURL(b);
        if (alive) setSrc(obj);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [path, scope]);
  if (err) return <span style={{ fontSize: 11, color: '#c81e42' }}>预览失败</span>;
  if (!src)
    return <div style={{ width: 46, height: 62, background: '#f3f4f6', borderRadius: 4 }} />;
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: 46, height: 62, objectFit: 'cover', borderRadius: 4, border: `1px solid ${T.border}` }}
    />
  );
}

const JOB_STATUS_TEXT: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '生成中',
  SUCCESS: '全部完成',
  PARTIAL: '部分完成（有失败）',
  FAILED: '全部失败',
};

export function SPInvitationBatch() {
  const navigate = useNavigate();

  // ── 作用域（ORG 自营 / CLIENT 代客）──
  const [ownerType, setOwnerType] = useState<OwnerType>('ORG');
  const [clientId, setClientId] = useState('');
  const scope = scopeQuery(ownerType, clientId);

  // ── 模板 / 名单 / 项目状态 ──
  const [template, setTemplate] = useState<WorkItem | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]); // 勾选的 recordId
  const [projectId, setProjectId] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false); // 已发起过生成 → 名单锁定

  // ── 生成 / 进度 ──
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [results, setResults] = useState<PerResult[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // 结果表多选

  // ── 弹窗 ──
  const [tplOpen, setTplOpen] = useState(false);
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplPick, setTplPick] = useState<WorkItem | null>(null);
  const [previewWork, setPreviewWork] = useState<WorkItem | null>(null);

  const [personOpen, setPersonOpen] = useState(false);
  const [listOptions, setListOptions] = useState<{ id: string; name: string }[]>([]);
  const [personListId, setPersonListId] = useState('');
  const [records, setRecords] = useState<GuestRecord[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [personBusy, setPersonBusy] = useState(false);
  const [search, setSearch] = useState('');

  // ── 生成前变量匹配体检对话框（S5：C 变量映射 + D 画布点选）──
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState<InvitationHealth | null>(null);
  const [mappingElements, setMappingElements] = useState<ProjectElement[]>([]);
  const [previewSchema, setPreviewSchema] = useState<unknown>(undefined);
  const [pairBusy, setPairBusy] = useState(false);
  // 分步向导：第③步「字段配对」是否完成
  const [fieldPaired, setFieldPaired] = useState(false);

  /** 服务端作用域透传（ORG 自营 / CLIENT 代客） */
  const scopeOpts = (): InvitationApiOpts => ({
    ownerType,
    clientId: ownerType === 'CLIENT' ? clientId : undefined,
  });

  const handleErr = (e: unknown, prefix = '操作失败') => {
    if (e instanceof ApiError) {
      if (e.status === 401) {
        message.error('登录态已失效，请重新登录');
        return;
      }
      if (e.status === 402) {
        message.error(`需购买人次：${e.message}`);
        return;
      }
      message.error(`${prefix}：${e.message}`);
    } else {
      message.error(`${prefix}：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  /* ───────── 模板选择 ───────── */
  const openTemplate = async () => {
    setTplLoading(true);
    try {
      const list = await apiGet<WorkItem[]>('/projects');
      setWorks(list.filter((w) => (Array.isArray((w as any).pages) ? (w as any).pages.length > 0 : true)));
      setTplPick(template);
      setTplOpen(true);
    } catch (e) {
      handleErr(e, '模板加载失败');
    } finally {
      setTplLoading(false);
    }
  };

  const onPreview = async (w: WorkItem) => {
    try {
      const full = await apiGet<WorkItem>(`/projects/${w.id}`);
      setPreviewWork(full);
    } catch {
      setPreviewWork(w); // 回退到封面
    }
  };

  const onConfirmTemplate = () => {
    if (!tplPick) {
      message.warning('请选择一个模板');
      return;
    }
    setTemplate(tplPick);
    // 改模板则作废已有项目（下次保存选择会用新模板重建），避免锁定快照指向旧模板
    setProjectId(null);
    setListId(null);
    setSelected([]);
    setGenerated(false);
    setFieldPaired(false);
    setTplOpen(false);
  };

  /* ───────── 人员选择 ───────── */
  const openPerson = async () => {
    if (!template) {
      message.warning('请先选择模板');
      return;
    }
    try {
      const lists = await apiGet<{ id: string; name: string }[]>(`/guest-lists?${scope}`);
      setListOptions(lists);
      setPersonListId(listId ?? '');
      setRecords([]);
      setSearch('');
      setPersonOpen(true);
    } catch (e) {
      handleErr(e, '名单加载失败');
    }
  };

  const onPickList = async (id: string) => {
    setPersonListId(id);
    setRecLoading(true);
    setSelected([]);
    try {
      const page = await apiGet<{ items?: GuestRecord[]; records?: GuestRecord[]; data?: GuestRecord[] }>(
        `/guest-lists/${id}/records?page=1&size=500`,
      );
      const arr = page.items ?? page.records ?? page.data ?? [];
      setRecords(arr);
    } catch (e) {
      handleErr(e, '人员加载失败');
    } finally {
      setRecLoading(false);
    }
  };

  const filtered = records.filter((r) => {
    if (!search) return true;
    return (r.data?.guest_name ?? '').includes(search);
  });

  const onConfirmPerson = async () => {
    if (!template) {
      message.warning('请先选择模板');
      return;
    }
    if (!personListId) {
      message.warning('请选择名单');
      return;
    }
    if (!selected.length) {
      message.warning('请至少勾选 1 人');
      return;
    }
    try {
      setPersonBusy(true);
      let pid = projectId;
      if (!pid) {
        const p = await apiPost<{ id: string }>('/invitations/projects', {
          templateId: template.id,
          listId: personListId,
          ownerType,
          clientId: ownerType === 'CLIENT' ? clientId : undefined,
        });
        pid = p.id;
        setProjectId(pid);
      }
      const saved = await apiPost<{ selectedRecordIds?: string[] }>(
        `/invitations/projects/${pid}/selection`,
        {
          listId: personListId,
          selectedRecordIds: selected,
          ownerType,
          clientId: ownerType === 'CLIENT' ? clientId : undefined,
        },
      );
      // 后端按「已锁定 ids ∪ 本次提交 ids」返回并集，可能与提交值不同，以响应体为准回写
      if (saved?.selectedRecordIds?.length) setSelected(saved.selectedRecordIds);
      setListId(personListId);
      // 名单变更 → 字段配对需重做
      setFieldPaired(false);
      message.success('人员已选定');
      setPersonOpen(false);
    } catch (e) {
      handleErr(e, '保存选择失败');
    } finally {
      setPersonBusy(false);
    }
  };

  /* ───────── 批量生成 ───────── */
  const refreshResults = async () => {
    if (!projectId) return;
    try {
      const r = await apiGet<ProjectResults>(`/invitations/projects/${projectId}/results?${scope}`);
      setResults(r.results ?? []);
    } catch {
      /* 轮询容错 */
    }
  };

  const startGenerate = async () => {
    if (!projectId) {
      message.warning('请先选择模板与人员');
      return;
    }
    if (!selected.length) {
      message.warning('请至少勾选 1 人');
      return;
    }
    try {
      setGenBusy(true);
      // 落盘勾选：先取服务端并集基线，与本地勾选合并后**全量**提交。
      // 只提交本地勾选会让已锁定的旧记录被判为「被移除」→ 409 RENDERED_RECORD_IMMUTABLE，
      // 直接阻断生成（后端「增删分离」口径：新增不限量，移除已生成记录一律拒绝）。
      let toSubmit = selected;
      try {
        const base = await apiGet<{ selectedRecordIds?: string[] }>(
          `/invitations/projects/${projectId}/selection?${scope}`,
        );
        if (base?.selectedRecordIds?.length) {
          toSubmit = [...new Set([...base.selectedRecordIds, ...selected])];
        }
      } catch {
        /* 取基线失败时退化为本地勾选，由服务端并集兜底 */
      }
      const saved = await apiPost<{ selectedRecordIds?: string[] }>(
        `/invitations/projects/${projectId}/selection`,
        {
          listId,
          selectedRecordIds: toSubmit,
          ownerType,
          clientId: ownerType === 'CLIENT' ? clientId : undefined,
        },
      );
      if (saved?.selectedRecordIds?.length) setSelected(saved.selectedRecordIds);
      // 不传 mode → 服务端自动 FREE_SAMPLE（首渲）/ PAID（续渲）
      const r = await apiPost<{ jobId: string; projectId: string; total: number }>('/invitations/batch-generate', {
        projectId,
        ownerType,
        clientId: ownerType === 'CLIENT' ? clientId : undefined,
      });
      setJobId(r.jobId);
      setJobStatus('PENDING');
      setResults([]);
      setPicked([]);
      setRunning(true);
      setGenerated(true);
      message.success('已发起批量生成');
    } catch (e) {
      handleErr(e, '生成发起失败');
    } finally {
      setGenBusy(false);
    }
  };

  /**
   * 「③ 字段配对」按钮入口（对齐 web 端 InvitationJobs）：先生成前体检 + 拉取可点选元素，
   * 弹「字段配对」对话框；对话框保存/跳过 → onPaired 标记第③步完成，不再耦合生成。
   * RERENDER（重生成）沿用既有直接调用路径（映射已持久化，无需再弹窗）。
   */
  const openFieldPair = async () => {
    if (!projectId) {
      message.warning('请先选择模板与人员');
      return;
    }
    if (!selected.length) {
      message.warning('请至少勾选 1 人');
      return;
    }
    setPairBusy(true);
    try {
      const opts = scopeOpts();
      const h = await getInvitationHealth(projectId, opts);
      setHealth(h);
      const els = await getProjectElements(projectId, opts);
      setMappingElements(els.elements);
      setPreviewSchema(els.previewSchema);
      setHealthOpen(true);
    } catch (e) {
      handleErr(e, '字段配对体检失败');
    } finally {
      setPairBusy(false);
    }
  };

  const onRegenerate = async (ids: string[]) => {
    if (!projectId) return;
    try {
      const r = await apiPost<{ jobId: string }>('/invitations/batch-generate', {
        projectId,
        mode: 'RERENDER',
        targetRecordIds: ids,
        ownerType,
        clientId: ownerType === 'CLIENT' ? clientId : undefined,
      });
      setJobId(r.jobId);
      setJobStatus('PENDING');
      setRunning(true);
      message.success('已发起重生成（不耗配额）');
    } catch (e) {
      handleErr(e, '重生成失败');
    }
  };

  const onDelete = async (ids: string[]) => {
    if (!projectId) return;
    try {
      await apiDelete(`/invitations/projects/${projectId}/results`, {
        recordIds: ids,
        ownerType,
        clientId: ownerType === 'CLIENT' ? clientId : undefined,
      });
      message.success(`已删除 ${ids.length} 条记录（不退配额）`);
      setPicked((p) => p.filter((x) => !ids.includes(x)));
      void refreshResults();
    } catch (e) {
      handleErr(e, '删除失败');
    }
  };

  const onDownloadZip = async (ids?: string[]) => {
    if (!projectId) return;
    const q = `${scope}${ids?.length ? `&recordIds=${ids.join(',')}` : ''}`;
    try {
      await downloadWithAuth(
        `/api/invitations/projects/${projectId}/download?${q}`,
        `invitations-${projectId}.zip`,
      );
    } catch (e) {
      handleErr(e, '打包下载失败');
    }
  };

  const onDownloadOne = async (row: PerResult) => {
    if (!row.url) return;
    try {
      await downloadWithAuth(`${row.url}?${scope}`, `${row.name || row.recordId}.png`);
    } catch (e) {
      handleErr(e, '下载失败');
    }
  };

  const reset = () => {
    setTemplate(null);
    setListId(null);
    setSelected([]);
    setProjectId(null);
    setGenerated(false);
    setFieldPaired(false);
    setJobId(null);
    setJobStatus(null);
    setRunning(false);
    setResults([]);
    setPicked([]);
  };

  /* ───────── 轮询：job 状态（终态信号）+ 逐人结果 ───────── */
  useEffect(() => {
    if (!running || !jobId || !projectId) return;
    let alive = true;
    const tick = async () => {
      try {
        const [job, res] = await Promise.all([
          apiGet<any>(`/invitations/jobs/${jobId}?${scope}`),
          apiGet<ProjectResults>(`/invitations/projects/${projectId}/results?${scope}`),
        ]);
        if (!alive) return;
        setJobStatus(job.status);
        setResults(res.results ?? []);
        if (['SUCCESS', 'PARTIAL', 'FAILED'].includes(job.status)) {
          setRunning(false);
        }
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) setRunning(false);
      }
    };
    void tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [running, jobId, projectId, scope]);

  const counts = {
    ok: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'failed').length,
    pending: results.filter((r) => r.status === 'pending').length,
  };

  const resultColumns = [
    {
      title: '预览',
      dataIndex: 'url',
      width: 70,
      render: (_: any, row: PerResult) =>
        row.url ? (
          <AuthImage path={row.url} scope={scope} alt={row.name ?? ''} />
        ) : (
          <div
            style={{
              width: 46,
              height: 62,
              borderRadius: 4,
              background: row.status === 'failed' ? '#fde8ec' : '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: row.status === 'failed' ? '#c81e42' : T.ink3,
            }}
          >
            {row.status === 'failed' ? '失败' : '待渲染'}
          </div>
        ),
    },
    {
      title: '姓名',
      dataIndex: 'name',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: PerStatus, row: PerResult) => {
        if (s === 'ok') return <Tag color="success">成功</Tag>;
        if (s === 'failed')
          return (
            <Tooltip title={row.error ?? '渲染失败'}>
              <Tag color="error">失败</Tag>
            </Tooltip>
          );
        // B5：已勾选但剩余额度耗尽、尚未渲染 —— 既非成功也非失败，用琥珀色区分
        if (row.paywalled)
          return (
            <Tooltip title="已勾选但剩余渲染额度不足，需购买渲染人次后重新生成">
              <Tag color="warning">待解锁</Tag>
            </Tooltip>
          );
        return <Tag>待渲染</Tag>;
      },
    },
    {
      title: '操作',
      dataIndex: 'op',
      render: (_: any, row: PerResult) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {row.status === 'ok' && (
            <Button size="small" type="link" style={{ padding: 0 }} onClick={() => void onDownloadOne(row)}>
              下载
            </Button>
          )}
          {row.status !== 'pending' && (
            <Button size="small" type="link" style={{ padding: 0 }} onClick={() => void onRegenerate([row.recordId])}>
              重生成
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead title="批量生成" chip="请柬营销" />
      <Alert
        type="info"
        showIcon
        style={{ margin: 12 }}
        message="四步向导：① 选模板 → ② 选人员 → ③ 字段配对 → ④ 批量生成（历史渲染记录可随时 全选 / 自定义选择 / 删除 / 打包下载，不受步骤限制）"
        description="运营端复用 web 端已落地的服务端渲染内核（puppeteer 截图 + 配额闸门 + 逐人隔离），结果两端一致。代客场景请先切换为「代客(CLIENT)」并填写客户 id。"
      />

      <Panel>
        {/* 作用域 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, flexWrap: 'wrap' }}>
          <Select
            value={ownerType}
            onChange={(v) => setOwnerType(v)}
            style={{ width: 180 }}
            options={[
              { value: 'ORG', label: '自营样板（ORG）' },
              { value: 'CLIENT', label: '代客（CLIENT）' },
            ]}
          />
          {ownerType === 'CLIENT' && (
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="客户 id"
              style={{ width: 240 }}
            />
          )}
          <span style={{ flex: 1 }} />
          <Button onClick={reset} disabled={running}>
            重置
          </Button>
        </div>

        {/* 步骤条：① 选模板 → ② 选人员 → ③ 字段配对 → ④ 批量生成（严格顺序，禁止跳步） */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 12px 12px', flexWrap: 'wrap' }}>
          <Button onClick={openTemplate} disabled={generated}>
            ① 选择模板{template ? `：${template.title || template.id.slice(0, 8)}` : ''}
          </Button>
          <Button onClick={openPerson} disabled={generated || !template}>
            ② 选择人员{selected.length ? `（已选 ${selected.length} 人）` : ''}
          </Button>
          <Button onClick={openFieldPair} loading={pairBusy} disabled={generated || running || !projectId || !selected.length}>
            ③ 字段配对{fieldPaired ? '（已配对）' : ''}
          </Button>
          <Button
            type="primary"
            loading={genBusy}
            disabled={generated || running || !projectId || !selected.length || !fieldPaired}
            onClick={() => {
              if (!fieldPaired) {
                message.warning('请先完成前一步操作');
                return;
              }
              void startGenerate();
            }}
          >
            ④ 批量生成
          </Button>
          {generated && (
            <Tag color="default" style={{ marginLeft: 4 }}>
              名单已锁定
            </Tag>
          )}
          {!generated && (template || listId) && (
            <span style={{ fontSize: 12, color: T.ink3 }}>首次生成为免费赠样（带水印），购买人次后可去水印重渲</span>
          )}
        </div>

        {/* 进度 / 结果 */}
        {running && (
          <div style={{ padding: '0 12px 12px' }}>
            <Alert
              type="warning"
              showIcon
              message={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" /> 生成中：{JOB_STATUS_TEXT[jobStatus ?? 'RUNNING'] ?? '生成中'}（已完成 {counts.ok + counts.failed} / {results.length || '—'}）
                </span>
              }
            />
          </div>
        )}

        {!running && jobStatus && results.length > 0 && (
          <div style={{ padding: '0 12px 12px' }}>
            <Alert
              type={jobStatus === 'FAILED' ? 'error' : jobStatus === 'PARTIAL' ? 'warning' : 'success'}
              showIcon
              message={`${JOB_STATUS_TEXT[jobStatus] ?? jobStatus}：成功 ${counts.ok} · 失败 ${counts.failed} · 待渲染 ${counts.pending}`}
              description={
                counts.pending > 0
                  ? '剩余「待渲染」为未消耗配额人员（赠样仅含前 3 人）。购买人次后勾选相应人员「重生成」即可去水印输出。'
                  : undefined
              }
            />
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 12px 8px', flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => setPicked(results.map((r) => r.recordId))}>
                全选
              </Button>
              <Button size="small" onClick={() => setPicked([])}>
                清空
              </Button>
              <Button size="small" type="primary" disabled={!picked.length} onClick={() => void onDownloadZip(picked)}>
                打包下载选中
              </Button>
              <Button size="small" onClick={() => void onDownloadZip()}>
                打包下载全部
              </Button>
              <Button size="small" danger disabled={!picked.length} onClick={() => void onDelete(picked)}>
                删除选中
              </Button>
              <Button size="small" disabled={!picked.length} onClick={() => void onRegenerate(picked)}>
                重生成选中
              </Button>
            </div>
            <Table
              rowKey="recordId"
              size="small"
              dataSource={results}
              columns={resultColumns as any}
              pagination={false}
              rowSelection={{ selectedRowKeys: picked, onChange: (keys) => setPicked(keys as string[]) }}
              locale={{ emptyText: <Empty description="暂无生成结果" /> }}
              scroll={{ y: 420 }}
            />
          </>
        )}
      </Panel>

      {/* 模板选择弹窗 */}
      <Modal
        open={tplOpen}
        title="选择模板"
        width={720}
        onCancel={() => setTplOpen(false)}
        onOk={onConfirmTemplate}
        okText="确认选择"
        okButtonProps={{ disabled: !tplPick }}
      >
        {tplLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.ink3 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, maxHeight: 460, overflowY: 'auto' }}>
            {works.map((w) => (
              <div
                key={w.id}
                onClick={() => setTplPick(w)}
                style={{
                  border: `2px solid ${tplPick?.id === w.id ? T.accent : T.border}`,
                  borderRadius: 8,
                  padding: 6,
                  cursor: 'pointer',
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    height: 150,
                    borderRadius: 6,
                    background: w.cover ? `center/cover url(${w.cover})` : '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: T.ink3,
                    fontSize: 12,
                  }}
                >
                  {!w.cover && '无封面'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.3, height: 32, overflow: 'hidden' }}>
                  {w.title || w.id.slice(0, 8)}
                </div>
                <Button size="small" type="link" style={{ padding: '2px 0' }} onClick={(e) => { e.stopPropagation(); void onPreview(w); }}>
                  预览
                </Button>
              </div>
            ))}
            {!works.length && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: T.ink3, padding: 32 }}>暂无可渲染作品</div>}
          </div>
        )}
      </Modal>

      {/* 人员选择弹窗 */}
      <Modal
        open={personOpen}
        title="选择人员"
        width={680}
        onCancel={() => setPersonOpen(false)}
        onOk={onConfirmPerson}
        okText="保存选择"
        okButtonProps={{ disabled: personBusy || !selected.length }}
        confirmLoading={personBusy}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Select
            placeholder="选择名单"
            value={personListId || undefined}
            onChange={(v) => void onPickList(v)}
            style={{ width: 260 }}
            options={listOptions.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Input
            placeholder="搜索姓名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180 }}
          />
          <Button size="small" onClick={() => setSelected(filtered.map((r) => r.id))}>
            全选筛选结果
          </Button>
          <Button size="small" onClick={() => setSelected([])}>
            清空
          </Button>
        </div>
        {recLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.ink3 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <Checkbox.Group
              value={selected}
              onChange={(vals) => setSelected(vals as string[])}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {filtered.map((r) => (
                <Checkbox key={r.id} value={r.id}>
                  {r.data?.guest_name ?? r.id.slice(0, 8)}
                  {r.data?.unit ? ` · ${r.data.unit}` : ''}
                  {r.data?.table_no ? ` · 桌${r.data.table_no}` : ''}
                </Checkbox>
              ))}
              {!filtered.length && <span style={{ color: T.ink3, fontSize: 13 }}>该名单暂无人员，请先导入</span>}
            </Checkbox.Group>
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: T.ink3 }}>已选 {selected.length} 人</div>
      </Modal>

      <WorkPreviewModal work={previewWork as any} onClose={() => setPreviewWork(null)} />

      {/* 生成前变量匹配体检对话框（S5：C 变量映射 + D 画布点选，对齐 web 端 InvitationJobs） */}
      <VariableMappingDialog
        open={healthOpen}
        health={health as InvitationHealth}
        elements={mappingElements}
        previewSchema={previewSchema}
        onClose={() => setHealthOpen(false)}
        onSaveMapping={async (m) => {
          if (!projectId) return;
          try {
            await saveInvitationMapping(projectId, m, scopeOpts());
          } catch (se) {
            if (!(se instanceof InvitationApiError && se.status === 429)) throw se;
          }
        }}
        onSaveElementBindings={async (eb: ElementBindings) => {
          if (!projectId) return;
          try {
            await saveElementBindings(projectId, eb, scopeOpts());
          } catch (se) {
            if (!(se instanceof InvitationApiError && se.status === 429)) throw se;
          }
        }}
        onPaired={() => setFieldPaired(true)}
      />
    </>
  );
}

export default SPInvitationBatch;
