import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, authHeaders } from '../../utility';
import { useLayer } from '../../providers/layerContext';

/**
 * 运营端（用户视角）· 诚邀名单制作（§16.4 入口 A）
 *
 * 唯一基准 = web 端 `apps/web/src/user/GuestLists.tsx`，逐模块对齐（布局 / 字段 / 按钮 / 列表 / 交互）：
 *   1. 标题独立成行；
 *   2. 新建区（同一行，垂直居中、等距）：模板选择 → 文件格式 → 「下载模板」 → 名单名称输入 → 「新建名单」
 *      —— 模板选择为唯一真值（同时决定下载/导入校验的模板与新建名单的字段快照），
 *      名称输入框右侧原有的重复「选择模板（可选）」下拉已删除，未留占位容器；
 *   3. 导入区：文件选择 + 目标名单（导入为新名单 / 某名单）+ 追加|覆盖 + 「导入」；
 *   4. 表格：名单名称 / 人数 / 更新时间 / 操作（编辑 → 详情页 · 删除）。
 *
 * 作用域：用户视角 = ADMIN 监督窗口，`objectScope.id` 作 `subject` 透传；真实 USER 登录不带 subject。
 * 运行环境约束：admin Vite 不代理 /api → 一律绝对 `API_URL` + `authHeaders()`；
 * 下载为文件流，`<a>`/window.open 无法带 Authorization → fetch + Blob。
 */

interface GuestListRow {
  id: string;
  name: string;
  recordCount: number;
  updatedAt: string;
}

const C = {
  brand: '#c81e42',
  ink1: '#1f2937',
  ink2: '#4b5563',
  ink3: '#6b7280',
  ink4: '#9ca3af',
  line: '#e5e7eb',
  lineSoft: '#f3f4f6',
  head: '#f9fafb',
  box: '#f9fafb',
  err: '#dc2626',
  errBg: '#fef2f2',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 4,
  border: `1px solid #d1d5db`,
  padding: '6px 10px',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
};
const btnGhost: React.CSSProperties = {
  borderRadius: 4,
  border: `1px solid #d1d5db`,
  background: '#fff',
  padding: '6px 14px',
  fontSize: 14,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  borderRadius: 4,
  border: 'none',
  background: C.brand,
  color: '#fff',
  padding: '6px 16px',
  fontSize: 14,
  cursor: 'pointer',
};

export default function UserGuestLists() {
  const navigate = useNavigate();
  const { objectScope, isOwnView, readonly } = useLayer();
  const subject = isOwnView ? undefined : objectScope?.id;
  const canWrite = isOwnView || !readonly;
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';

  const [rows, setRows] = useState<GuestListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [importTarget, setImportTarget] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  /**
   * 模板选择为**唯一真值**：同时驱动「下载模板 / 导入校验」与「新建名单的模板快照」。
   * 旧实现里名称输入框右侧还有一个「选择模板（可选）」下拉，与顶部下拉完全重复
   * （两者默认值同为模板列表首项），已合并为本状态，避免两处选择互相矛盾。
   */
  const [templateId, setTemplateId] = useState('');
  const [dlFormat, setDlFormat] = useState<'xlsx' | 'csv'>('xlsx');

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/guest-lists/templates${q}`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      const tpls = Array.isArray(d.templates) ? d.templates : [];
      setTemplates(tpls);
      setTemplateId((prev) => prev || (tpls[0]?.id ?? ''));
    } catch {
      /* ignore */
    }
  }, [q]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/guest-lists${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 模板下载：服务端返回文件流，需带 Bearer 鉴权头 → fetch + Blob 触发下载 */
  const downloadTemplate = useCallback(
    async (format: 'csv' | 'xlsx') => {
      try {
        const qs = new URLSearchParams({ format });
        if (templateId) qs.set('templateId', templateId);
        if (subject) qs.set('subject', subject);
        const res = await fetch(`${API_URL}/guest-lists/template?${qs.toString()}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'xlsx' ? 'guest-template.xlsx' : 'guest-template.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? `模板下载失败：${e.message}` : '模板下载失败');
      }
    },
    [subject, templateId],
  );

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/guest-lists${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name,
          templateId: templateId || undefined,
          ...(subject ? { subject } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setNewName('');
      navigate(`/user/invitations/lists/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [navigate, templateId, newName, q, subject]);

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', importMode);
    if (importTarget) fd.append('listId', importTarget);
    // 透传下载模板所选 templateId：直接「导入为新名单」时按该模板字段校验（与下载模板同一真值）
    if (!importTarget && templateId) fd.append('templateId', templateId);
    if (subject) fd.append('subject', subject);
    try {
      const res = await fetch(`${API_URL}/guest-lists/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const skipped = data?.failed?.length ?? 0;
      setError(
        skipped
          ? `导入成功 ${data.created} 条，跳过 ${skipped} 条（${data.failed[0]?.reason ?? ''}）`
          : `导入成功 ${data.created} 条`,
      );
      if (fileRef.current) fileRef.current.value = '';
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [importMode, importTarget, load, subject, templateId]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm('确定删除该名单？名单及其记录将一并删除，且不可恢复。')) return;
      try {
        const res = await fetch(`${API_URL}/guest-lists/${id}${q}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.message || `HTTP ${res.status}`);
        }
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load, q],
  );

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: C.ink1 }}>诚邀名单制作</h2>

      {/*
        新建区：模板选择 → 文件格式 → 下载模板 → 名单名称 → 新建名单
        同一行横向排列、垂直居中、等距（gap 8）；窄屏由 flexWrap 自然换行，
        选择类控件 flexShrink:0 防止被压缩到不可点，输入框 flex:1 + minWidth 保证可用宽度。
      */}
      <div
        data-testid="new-list-form"
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          borderRadius: 4,
          border: `1px solid ${C.line}`,
          background: C.box,
          padding: 12,
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
          disabled={creating || !newName.trim() || !canWrite}
          style={{ ...btnPrimary, flexShrink: 0, opacity: creating || !newName.trim() || !canWrite ? 0.5 : 1 }}
        >
          新建名单
        </button>
      </div>

      {/* 导入 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          borderRadius: 4,
          border: `1px solid ${C.line}`,
          background: C.box,
          padding: 12,
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
        <button style={{ ...btnGhost, background: '#fff' }} disabled={!canWrite} onClick={upload}>
          导入
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 4,
            background: /导入成功|成功/.test(error) ? '#f0fdf4' : C.errBg,
            padding: '8px 12px',
            fontSize: 12,
            color: /导入成功|成功/.test(error) ? '#15803d' : C.err,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={th}>名单名称</th>
              <th style={{ ...th, width: 96 }}>人数</th>
              <th style={{ ...th, width: 160 }}>更新时间</th>
              <th style={{ ...th, width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, color: C.ink1 }}>{r.name}</td>
                <td style={{ ...td, color: C.ink3 }}>{r.recordCount}</td>
                <td style={{ ...td, color: C.ink3 }}>{new Date(r.updatedAt).toLocaleString()}</td>
                <td style={td}>
                  <button
                    onClick={() => navigate(`/user/invitations/lists/${r.id}`)}
                    style={{ marginRight: 12, border: 'none', background: 'none', padding: 0, fontSize: 14, color: C.brand, cursor: 'pointer' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => void remove(r.id)}
                    disabled={!canWrite}
                    style={{ border: 'none', background: 'none', padding: 0, fontSize: 14, color: canWrite ? C.ink3 : '#d1d5db', cursor: canWrite ? 'pointer' : 'not-allowed' }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: 'center', color: C.ink4, padding: 40 }}>
                  暂无名单，可下载模板填写后导入，或直接新建
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { background: C.head, textAlign: 'left', color: C.ink3, fontWeight: 500, padding: '8px 12px' };
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${C.lineSoft}` };
