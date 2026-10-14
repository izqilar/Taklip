import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { PreviewCard } from '../components/provider/SettingPage';
import { authHeaders, API_URL, downloadWithAuth } from '../utility';
import { T } from '../config/theme';
import { useSpScope, apiGet, apiPost, apiDelete } from './user/invitationShared';

/**
 * 服务商端 · 批量请柬（§16.4 触发 B：侧栏「请柬营销」分组）
 *
 * 归属：默认 `ORG`（服务商自营样板）；切到某客户时走 `CLIENT` 并带 `clientId`（决策 D1）。
 * 主路径仍是「客户管理 → 客户详情 → 请柬名单」（触发 A，代客上下文最自然），
 * 本页为辅路径，覆盖自营样板与跨客户总览。
 *
 * 权限边界（§16.6）：仅 SERVICE_PROVIDER 及其员工可见；名单属组织域数据，
 * 与终端用户 SELF 域物理隔离，越权一律 404。
 */

type OwnerType = 'ORG' | 'CLIENT';

interface ListRow {
  id: string;
  name: string;
  ownerType: string;
  clientId: string | null;
  recordCount: number;
  updatedAt: string;
}

interface JobRow {
  id: string;
  projectId: string;
  status: string;
  mode: string;
  progress: number;
  total: number;
  createdAt: string;
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '生成中',
  SUCCESS: '已完成',
  FAILED: '失败',
};

const cell: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${T.border}` };

/**
 * 模板下载（方案①）：服务端返回文件流，需带 Bearer 鉴权头。
 * 原 `window.open` 顶层导航无法携带 Authorization 头 → 401（见诊断）。
 * 改为 fetch + blob 触发下载；鉴权头由 authHeaders 提供。
 * ownerType/clientId 透传作用域，使下载的模板反映对应 org/client 的字段设计。
 */
async function downloadTemplate(format: 'csv' | 'xlsx', ownerType?: string, clientId?: string) {
  let url = `${API_URL}/guest-lists/template?format=${format}`;
  if (ownerType) url += `&ownerType=${encodeURIComponent(ownerType)}`;
  if (clientId) url += `&clientId=${encodeURIComponent(clientId)}`;
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = format === 'xlsx' ? 'guest-template.xlsx' : 'guest-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    message.error(`模板下载失败：${e instanceof Error ? e.message : '未知错误'}`);
  }
}

/**
 * 批量导入名单控件（复用于「请柬名单」列表页与「客户详情 → 请柬名单」子页）。
 *
 * 入口：文件选择 + 目标名单（导入为新名单 / 追加到既有名单）+ 模式（追加/覆盖）。
 * 校验：服务端返回 `{ created, failed }`；`failed` 为非空数组时提示被跳过的行与原因。
 * 注意：必须用绝对 `API_URL`（admin 的 Vite 不代理 `/api`，相对路径会打到 SPA 回退页）。
 */
function ImportControl({
  rows,
  ownerType,
  clientId,
  onDone,
}: {
  rows: ListRow[];
  ownerType: string;
  clientId?: string;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<'append' | 'overwrite'>('append');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg('请先选择名单文件（CSV / XLSX / XLS / JSON）');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);
    fd.append('ownerType', ownerType);
    if (clientId) fd.append('clientId', clientId);
    if (target) {
      fd.append('listId', target);
    } else {
      // 未选目标名单 → 以文件名（去扩展名）作新名单名
      fd.append('name', file.name.replace(/\.[^.]+$/, '') || '导入名单');
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API_URL}/guest-lists/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const skipped = Array.isArray(data?.failed) ? data.failed.length : 0;
      setMsg(
        skipped
          ? `导入成功 ${data.created ?? 0} 条，跳过 ${skipped} 条（${data.failed?.[0]?.reason ?? ''}）`
          : `导入成功 ${data.created ?? 0} 条`,
      );
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" style={{ fontSize: 12 }} />
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.border}` }}
      >
        <option value="">导入为新名单</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as 'append' | 'overwrite')}
        style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.border}` }}
      >
        <option value="append">追加</option>
        <option value="overwrite">覆盖</option>
      </select>
      <button
        onClick={run}
        disabled={busy}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          background: T.accent,
          color: '#fff',
          border: 'none',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? '导入中…' : '导入名单'}
      </button>
      {msg && (
        <span style={{ fontSize: 12, color: msg.includes('成功') ? '#16a34a' : '#c81e42' }}>{msg}</span>
      )}
    </div>
  );
}

/** 服务商 · 请柬名单（模板下载 / 导入 / 在线编辑入口） */
export function SPInvitationLists() {
  const navigate = useNavigate();
  const { subject, scopeQuery, scopeBody } = useSpScope();

  /* SP 专属：自营样板（ORG）/ 代客（CLIENT）选择器（必须保留） */
  const [ownerType, setOwnerType] = useState<OwnerType>('ORG');
  const [clientId, setClientId] = useState('');

  /* 对齐 web：模板选择 / 文件格式 / 名单名称（行内） */
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [dlFormat, setDlFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [newName, setNewName] = useState('');
  const [importTarget, setImportTarget] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const clientIdForScope = ownerType === 'CLIENT' ? clientId : undefined;

  /* 模板列表：按 subject/effUser 维度，不挂 ownerType */
  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiGet<{ templates: { id: string; name: string }[] }>(
        scopeQuery('/guest-lists/templates'),
      );
      const tpls = Array.isArray(data?.templates) ? data.templates : [];
      setTemplates(tpls);
      setTemplateId((prev) => prev || (tpls[0]?.id ?? ''));
    } catch {
      /* ignore */
    }
  }, [scopeQuery]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ListRow[]>(scopeQuery('/guest-lists', ownerType, clientIdForScope));
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, ownerType, clientIdForScope]);

  useEffect(() => {
    void load();
  }, [load]);

  /* 模板下载：scopeQuery 携带 ownerType/clientId + subject；templateId 单独追加 */
  const downloadTemplate = useCallback(
    async (format: 'csv' | 'xlsx') => {
      try {
        const base = scopeQuery('/guest-lists/template', ownerType, clientIdForScope);
        const sep = base.includes('?') ? '&' : '?';
        const tail = [templateId ? `templateId=${encodeURIComponent(templateId)}` : ''].filter(Boolean).join('');
        const qs = `${sep}format=${format}${tail ? `&${tail}` : ''}`;
        const res = await fetch(`${API_URL}${base}${qs}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = format === 'xlsx' ? 'guest-template.xlsx' : 'guest-template.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (e) {
        message.error(`模板下载失败：${e instanceof Error ? e.message : '未知错误'}`);
      }
    },
    [scopeQuery, ownerType, clientIdForScope, templateId],
  );

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await apiPost<{ id: string }>(
        scopeQuery('/guest-lists', ownerType, clientIdForScope),
        { name, templateId: templateId || undefined, ...scopeBody },
      );
      setNewName('');
      navigate(`/sp/invitations/lists/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [scopeQuery, scopeBody, ownerType, clientIdForScope, templateId, newName, navigate]);

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('请先选择名单文件（CSV / XLSX / XLS / JSON）');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', importMode);
    if (importTarget) fd.append('listId', importTarget);
    else if (templateId) fd.append('templateId', templateId);
    if (subject) fd.append('subject', subject);
    try {
      const res = await fetch(`${API_URL}${scopeQuery('/guest-lists/import', ownerType, clientIdForScope)}`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const skipped = Array.isArray(data?.failed) ? data.failed.length : 0;
      setError(
        skipped
          ? `导入成功 ${data.created ?? 0} 条，跳过 ${skipped} 条（${data.failed?.[0]?.reason ?? ''}）`
          : `导入成功 ${data.created ?? 0} 条`,
      );
      if (fileRef.current) fileRef.current.value = '';
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    }
  }, [scopeQuery, ownerType, clientIdForScope, importMode, importTarget, templateId, subject, load]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm('确定删除该名单？名单及其记录将一并删除，且不可恢复。')) return;
      try {
        await apiDelete(scopeQuery(`/guest-lists/${id}`, ownerType, clientIdForScope), scopeBody);
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [scopeQuery, scopeBody, ownerType, clientIdForScope, load],
  );

  const inputStyle: React.CSSProperties = {
    borderRadius: T.rSm,
    border: `1px solid ${T.border}`,
    padding: '6px 10px',
    fontSize: 14,
    outline: 'none',
    background: T.bg,
    color: T.ink1,
  };
  const btnGhost: React.CSSProperties = {
    borderRadius: T.rSm,
    border: `1px solid ${T.border}`,
    background: T.bg,
    padding: '6px 14px',
    fontSize: 14,
    cursor: 'pointer',
    color: T.ink1,
  };
  const btnPrimary: React.CSSProperties = {
    borderRadius: T.rSm,
    border: 'none',
    background: T.accent,
    color: T.onAccent,
    padding: '6px 16px',
    fontSize: 14,
    cursor: 'pointer',
  };
  const greenBtn: React.CSSProperties = {
    borderRadius: T.rSm,
    border: 'none',
    background: T.up,
    color: '#fff',
    padding: '6px 14px',
    fontSize: 14,
    cursor: 'pointer',
  };

  return (
    <>
      <PageHead title="宾客名单制作" />
      <Panel>
        {/* 服务商专属：自营样板 / 代客 选择器（保留） */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: 12,
            flexWrap: 'wrap',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <span style={{ fontSize: 13, color: T.ink3 }}>归属</span>
          <select
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value as OwnerType)}
            style={{ ...inputStyle, flexShrink: 0 }}
          >
            <option value="ORG">自营样板（ORG）</option>
            <option value="CLIENT">代客（CLIENT）</option>
          </select>
          {ownerType === 'CLIENT' && (
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="客户 id"
              style={{ ...inputStyle, minWidth: 180, flexShrink: 0 }}
            />
          )}
        </div>

        {/*
          新建区：模板选择 → 文件格式 → 下载模板 → 名单名称 → 新建名单
          同一行横向排列、垂直居中、等距（gap 8）；窄屏 flex-wrap 自然换行。
        */}
        <div
          data-testid="new-list-form"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            data-testid="new-list-template"
            style={{ ...inputStyle, flexShrink: 0 }}
          >
            <option value="">模板列表</option>
            {templates.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.name}
              </option>
            ))}
          </select>
          <select
            value={dlFormat}
            onChange={(e) => setDlFormat(e.target.value as 'xlsx' | 'csv')}
            style={{ ...inputStyle, flexShrink: 0 }}
          >
            <option value="xlsx">xlsx</option>
            <option value="csv">csv</option>
          </select>
          <button style={{ ...btnGhost, flexShrink: 0 }} onClick={() => void downloadTemplate(dlFormat)}>
            下载模板
          </button>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="名单名称，如：婚礼主桌"
            style={{ ...inputStyle, flex: '1 1 200px', minWidth: 160 }}
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            style={{ ...btnPrimary, flexShrink: 0, opacity: creating || !newName.trim() ? 0.5 : 1 }}
          >
            新建名单
          </button>
        </div>

        {/* 导入 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" style={{ fontSize: 14 }} />
          <select value={importTarget} onChange={(e) => setImportTarget(e.target.value)} style={inputStyle}>
            <option value="">导入为新名单</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as 'append' | 'overwrite')}
            style={inputStyle}
          >
            <option value="append">追加</option>
            <option value="overwrite">覆盖</option>
          </select>
          <button style={{ ...greenBtn }} onClick={upload}>
            导入名单
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: T.downInk, background: T.downBg }}>{error}</div>
        )}

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: T.ink3 }}>…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.panel2, textAlign: 'left', color: T.ink3 }}>
                <th style={cell}>名单名称</th>
                <th style={{ ...cell, width: 96 }}>人数</th>
                <th style={{ ...cell, width: 160 }}>更新时间</th>
                <th style={{ ...cell, width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...cell, color: T.ink1 }}>{r.name}</td>
                  <td style={{ ...cell, color: T.ink3 }}>{r.recordCount}</td>
                  <td style={{ ...cell, color: T.ink3 }}>{new Date(r.updatedAt).toLocaleString()}</td>
                  <td style={cell}>
                    <button
                      onClick={() => navigate(`/sp/invitations/lists/${r.id}`)}
                      style={{ marginRight: 12, border: 'none', background: 'none', padding: 0, fontSize: 14, color: T.accent, cursor: 'pointer' }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => void remove(r.id)}
                      style={{ border: 'none', background: 'none', padding: 0, fontSize: 14, color: T.ink3, cursor: 'pointer' }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} style={{ ...cell, textAlign: 'center', color: T.ink3, padding: 40 }}>
                    暂无名单，可下载模板填写后导入，或直接新建
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

/**
 * 客户详情内嵌「请柬名单」子页（§16.4 触发 A，主路径）
 *
 * 归属恒为 `CLIENT`（`orgId` 由 DataScopeInterceptor 补齐，前端只带 `clientId`），
 * 名单随客户走，符合 D1「代客上下文最自然」。
 */
export function ClientGuestLists({ clientId }: { clientId?: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const scope = `ownerType=CLIENT${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}`;

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/guest-lists?${scope}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch {
      message.error('请柬名单加载失败');
    } finally {
      setLoading(false);
    }
  }, [clientId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    const name = window.prompt('名单名称（将挂在当前客户名下）');
    if (!name?.trim() || !clientId) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/guest-lists?${scope}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: name.trim(), ownerType: 'CLIENT', clientId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `HTTP ${res.status}`);
      }
      message.success('名单已创建');
      void load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }, [clientId, load, scope]);

  return (
    <PreviewCard
      title="请柬名单"
      hint={clientId ? '归属：CLIENT · 代客上下文' : '客户未加载'}
      soft
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Button size="small" type="primary" loading={creating} disabled={!clientId} onClick={create}>
          新建名单
        </Button>
        <Button size="small" disabled={!clientId} onClick={() => void downloadTemplate('xlsx', 'CLIENT', clientId)}>
          下载 Excel 模板
        </Button>
        <Button size="small" disabled={!clientId} onClick={() => void downloadTemplate('csv', 'CLIENT', clientId)}>
          下载 CSV 模板
        </Button>
        <ImportControl rows={rows} ownerType="CLIENT" clientId={clientId} onDone={load} />
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: T.ink3, fontSize: 12 }}>加载中…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.bg, textAlign: 'left', color: T.ink3 }}>
              <th style={cell}>名单名称</th>
              <th style={cell}>人数</th>
              <th style={cell}>更新时间</th>
              <th style={cell}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.name}</td>
                <td style={cell}>{r.recordCount}</td>
                <td style={cell}>{new Date(r.updatedAt).toLocaleString()}</td>
                <td style={cell}>
                  {/* 名单就绪后进作品编辑器，用编辑器内「批量生成」面板勾选人员（决策 D4） */}
                  <button
                    onClick={() => navigate('/sp/works')}
                    style={{ color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    去生成
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} style={{ ...cell, textAlign: 'center', color: T.ink3, padding: 24 }}>
                  该客户暂无请柬名单
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </PreviewCard>
  );
}

/** 服务商 · 批量生成任务（进度 / 打包下载） */
export function SPInvitationJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/invitations/jobs`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setJobs(Array.isArray(d) ? d : []);
    } catch {
      /* 静默：任务页无数据不影响其它流程 */
    } finally {
      setLoading(false);
    }
  }, []);

  /** 轮询开关用 ref 持有，避免 jobs 变化导致 interval 反复重建（定时器抖动） */
  const activeRef = useRef(false);
  activeRef.current = jobs.some((j) => j.status === 'PENDING' || j.status === 'RUNNING');

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (activeRef.current) void load();
    }, 3000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <PageHead title="生成任务" chip="批量请柬" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 12px 0' }}>
        <Button type="primary" size="small" onClick={() => navigate('/sp/invitations/generate')}>
          新建批量生成
        </Button>
      </div>
      <Panel>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.ink3 }}>…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.panel2, textAlign: 'left', color: T.ink2 }}>
                <th style={cell}>任务</th>
                <th style={cell}>状态</th>
                <th style={cell}>进度</th>
                <th style={cell}>操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td style={cell}>
                    {j.mode} · {new Date(j.createdAt).toLocaleString()}
                  </td>
                  <td style={cell}>{STATUS_TEXT[j.status] ?? j.status}</td>
                  <td style={cell}>
                    {j.progress}/{j.total}
                  </td>
                  <td style={cell}>
                    {j.status === 'SUCCESS' ? (
                      <Button
                        type="link"
                        style={{ padding: 0, color: T.accent }}
                        onClick={() => {
                          void downloadWithAuth(
                            `/api/invitations/jobs/${j.id}/download`,
                            `invitations-${j.id}.zip`,
                          ).catch((e) => message.error(`下载失败：${e instanceof Error ? e.message : '未知错误'}`));
                        }}
                      >
                        下载全部(Zip)
                      </Button>
                    ) : (
                      <span style={{ color: T.ink3 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={4} style={{ ...cell, textAlign: 'center', color: T.ink3, padding: 32 }}>
                    暂无生成任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
