import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { PreviewCard } from '../components/provider/SettingPage';
import { authHeaders, API_URL, downloadWithAuth } from '../utility';
import { T } from '../config/theme';

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
  const [ownerType, setOwnerType] = useState<OwnerType>('ORG');
  const [clientId, setClientId] = useState('');
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const scope = useCallback(
    () => (ownerType === 'CLIENT' && clientId ? `ownerType=CLIENT&clientId=${encodeURIComponent(clientId)}` : `ownerType=${ownerType}`),
    [ownerType, clientId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/guest-lists?${scope()}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    const name = window.prompt('名单名称');
    if (!name?.trim()) return;
    try {
      const res = await fetch(`${API_URL}/guest-lists?${scope()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: name.trim(), ownerType }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `HTTP ${res.status}`);
      }
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [load, ownerType, scope]);

  return (
    <>
      <PageHead title="请柬名单" chip="批量请柬" />
      <Panel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, flexWrap: 'wrap' }}>
          <select
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value as OwnerType)}
            style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.border}` }}
          >
            <option value="ORG">自营样板（ORG）</option>
            <option value="CLIENT">代客（CLIENT）</option>
          </select>
          {ownerType === 'CLIENT' && (
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="客户 id"
              style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.border}`, minWidth: 180 }}
            />
          )}
          <button onClick={create} style={{ padding: '6px 12px', borderRadius: 6, background: T.accent, color: '#fff', border: 'none' }}>
            新建名单
          </button>
          <button
            onClick={() => void downloadTemplate('xlsx', clientId ? 'CLIENT' : 'ORG', clientId)}
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: '#fff' }}
          >
            下载 Excel 模板
          </button>
          <button
            onClick={() => void downloadTemplate('csv', clientId ? 'CLIENT' : 'ORG', clientId)}
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: '#fff' }}
          >
            下载 CSV 模板
          </button>
          <ImportControl
            rows={rows}
            ownerType={ownerType}
            clientId={ownerType === 'CLIENT' ? clientId : undefined}
            onDone={load}
          />
        </div>

        {error && <div style={{ padding: '0 12px 12px', color: '#c81e42', fontSize: 12 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.ink3 }}>…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.panel2, textAlign: 'left', color: T.ink2 }}>
                <th style={cell}>名单名称</th>
                <th style={cell}>归属</th>
                <th style={cell}>人数</th>
                <th style={cell}>更新时间</th>
                <th style={cell}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={cell}>{r.name}</td>
                  <td style={cell}>{r.ownerType}{r.clientId ? ` · ${r.clientId.slice(0, 8)}…` : ''}</td>
                  <td style={cell}>{r.recordCount}</td>
                  <td style={cell}>{new Date(r.updatedAt).toLocaleString()}</td>
                  <td style={cell}>
                    {/* 名单编辑后进入作品编辑器，用编辑器内「批量生成」面板勾选人员（决策 D4） */}
                    <button
                      onClick={() => navigate('/sp/works')}
                      style={{ color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      去生成
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} style={{ ...cell, textAlign: 'center', color: T.ink3, padding: 32 }}>
                    暂无名单，可下载模板填写后导入或新建
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
