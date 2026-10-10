import { useCallback, useEffect, useState } from 'react';
import { TemplateFieldDesign, type GuestFieldDef } from '@h5design/ui';
import { API_URL, authHeaders } from '../../utility';
import { useLayer } from '../../providers/layerContext';

/**
 * 运营端（用户视角）· 模板字段设计（§17.2 多模板管理）
 *
 * 唯一基准 = web 端 `apps/web/src/user/TemplateFieldDesignPage.tsx`，逐模块对齐：
 *   1. 列表页：序号 / 模板ID / 模板名称 / 操作（查看 · 编辑 · 删除），右上「＋ 新建模板」；
 *      系统默认模板带「系统」标签且**不可编辑 / 不可删除**（对齐 web 端对普通用户的呈现）；
 *   2. 查看页：只读字段表（字段 key / 中文表头 / 类型 / 必填）；
 *   3. 编辑 / 新建页：复用 @h5design/ui 的 TemplateFieldDesign（lockFirstField=false，
 *      各模板字段独立），支持字段增删改、排序、必填与校验配置。
 *
 * 作用域：用户视角 = ADMIN 监督窗口，用 `objectScope.id` 作 `subject` 透传
 * （服务端 subjectId 口径，等价于该用户自己登录）；真实 USER 登录运营端时不带 subject。
 *
 * 运行环境约束：admin 的 Vite 不代理 `/api`，一律走绝对 `API_URL` + `authHeaders()`。
 */

interface TemplateView {
  id: string;
  name: string;
  ownerType: string;
  isSystem: boolean;
  seq: number;
  version: string;
  fieldCount: number;
}

type Mode = 'list' | 'view' | 'edit' | 'new';

/* web 端同款视觉令牌（tailwind 灰阶 / 品牌色） */
const C = {
  brand: '#c81e42',
  blue: '#2563eb',
  ink1: '#1f2937',
  ink2: '#4b5563',
  ink3: '#6b7280',
  ink4: '#9ca3af',
  line: '#e5e7eb',
  lineSoft: '#f3f4f6',
  head: '#f9fafb',
  tagBg: '#f3f4f6',
  tagInk: '#6b7280',
  err: '#dc2626',
  errBg: '#fef2f2',
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: React.CSSProperties = {
  background: C.head,
  textAlign: 'left',
  color: C.ink3,
  fontWeight: 500,
  padding: '8px 12px',
};
const tdStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${C.lineSoft}` };

const SystemTag = () => (
  <span
    style={{
      marginLeft: 8,
      borderRadius: 4,
      background: C.tagBg,
      color: C.tagInk,
      fontSize: 12,
      padding: '1px 8px',
    }}
  >
    系统
  </span>
);

export default function UserTemplateFieldDesign() {
  const { objectScope, isOwnView, readonly } = useLayer();
  const subject = isOwnView ? undefined : objectScope?.id;
  const canWrite = isOwnView || !readonly;
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  const url = useCallback((path: string) => `${API_URL}${path}${q}`, [q]);

  const [mode, setMode] = useState<Mode>('list');
  const [rows, setRows] = useState<TemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<TemplateView | null>(null);
  const [viewFields, setViewFields] = useState<GuestFieldDef[]>([]);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(url('/guest-lists/templates'), { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setRows(Array.isArray(d.templates) ? d.templates : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (mode === 'list') void load();
  }, [mode, load]);

  const openView = useCallback(
    async (tpl: TemplateView) => {
      setCurrent(tpl);
      setError('');
      try {
        const res = await fetch(url(`/guest-lists/templates/${tpl.id}`), { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        setViewFields((d.template?.fields ?? []) as GuestFieldDef[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setMode('view');
    },
    [url],
  );

  const remove = useCallback(
    async (tpl: TemplateView) => {
      if (!window.confirm('确定删除该模板？')) return;
      try {
        const res = await fetch(url(`/guest-lists/templates/${tpl.id}`), {
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
    [load, url],
  );

  /* 系统默认模板在「用户视角」不可编辑 / 不可删除（对齐 web 端普通用户所见） */
  const canEdit = (tpl: TemplateView) => !tpl.isSystem;

  /* ───── 编辑：复用 TemplateFieldDesign ───── */
  if (mode === 'edit' && current) {
    const loadFields = async (): Promise<GuestFieldDef[]> => {
      const res = await fetch(url(`/guest-lists/templates/${current.id}`), { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return (d.template?.fields ?? []) as GuestFieldDef[];
    };
    const saveFields = async (defs: GuestFieldDef[]): Promise<GuestFieldDef[]> => {
      if (!canWrite) throw new Error('监督态只读，无法保存模板字段');
      const res = await fetch(url(`/guest-lists/templates/${current.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ fields: defs }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `HTTP ${res.status}`);
      }
      const d = await res.json();
      return (d.template?.fields ?? []) as GuestFieldDef[];
    };
    return (
      <div style={{ padding: 24 }}>
        <BackLink onClick={() => setMode('list')} />
        <TemplateFieldDesign
          loadFields={loadFields}
          saveFields={saveFields}
          lockFirstField={false}
          lockedKeys={[]}
          onSaved={() => setMode('list')}
          labels={{ desc: '设计该模板的字段。各模板字段独立，不强制姓名(guest_name) 为首字段。' }}
        />
      </div>
    );
  }

  /* ───── 新建 ───── */
  if (mode === 'new') {
    const saveFields = async (defs: GuestFieldDef[]): Promise<GuestFieldDef[]> => {
      if (!canWrite) throw new Error('监督态只读，无法创建模板');
      const res = await fetch(url('/guest-lists/templates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: newName, fields: defs }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `HTTP ${res.status}`);
      }
      const d = await res.json();
      return (d.template?.fields ?? []) as GuestFieldDef[];
    };
    return (
      <div style={{ padding: 24 }}>
        <BackLink onClick={() => setMode('list')} />
        <TemplateFieldDesign
          loadFields={async () => []}
          saveFields={saveFields}
          showName
          nameValue={newName}
          onNameChange={setNewName}
          lockFirstField={false}
          lockedKeys={[]}
          onSaved={() => setMode('list')}
          labels={{ desc: '新建一套模板字段，保存后可在「诚邀名单制作」下载对应线下填写模板。' }}
        />
      </div>
    );
  }

  /* ───── 查看（只读） ───── */
  if (mode === 'view' && current) {
    return (
      <div style={{ padding: 16 }}>
        <BackLink onClick={() => setMode('list')} />
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: C.ink1 }}>
          {current.name}
          {current.isSystem && <SystemTag />}
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: C.ink3 }}>模板字段（只读）</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>字段 key</th>
              <th style={thStyle}>中文表头</th>
              <th style={thStyle}>类型</th>
              <th style={thStyle}>必填</th>
            </tr>
          </thead>
          <tbody>
            {viewFields.map((f, i) => (
              <tr key={f.key + i}>
                <td style={{ ...tdStyle, color: C.ink2 }}>{f.key}</td>
                <td style={{ ...tdStyle, color: C.ink2 }}>{f.label}</td>
                <td style={{ ...tdStyle, color: C.ink3 }}>{f.type === 'enum' ? '枚举' : '文本'}</td>
                <td style={{ ...tdStyle, color: C.ink3 }}>{f.required ? '是' : '否'}</td>
              </tr>
            ))}
            {!viewFields.length && (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: C.ink4, padding: 40 }}>
                  该模板暂无字段
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  /* ───── 列表页 ───── */
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <h2 style={{ margin: 0, marginRight: 'auto', fontSize: 18, fontWeight: 600, color: C.ink1 }}>
          模板字段设计
        </h2>
        <button
          onClick={() => {
            setNewName('');
            setMode('new');
          }}
          disabled={!canWrite}
          style={{
            borderRadius: 4,
            background: canWrite ? C.brand : '#e5e7eb',
            color: canWrite ? '#fff' : C.ink4,
            border: 'none',
            padding: '6px 16px',
            fontSize: 14,
            cursor: canWrite ? 'pointer' : 'not-allowed',
          }}
        >
          ＋ 新建模板
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 12, borderRadius: 4, background: C.errBg, padding: '8px 12px', fontSize: 12, color: C.err }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>…</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 64 }}>序号</th>
              <th style={{ ...thStyle, width: 192 }}>模板ID</th>
              <th style={thStyle}>模板名称</th>
              <th style={{ ...thStyle, width: 192 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id}>
                <td style={{ ...tdStyle, color: C.ink3 }}>{idx + 1}</td>
                <td style={{ ...tdStyle, color: C.ink3 }}>{r.id}</td>
                <td style={{ ...tdStyle, color: C.ink1 }}>
                  {r.name}
                  {r.isSystem && <SystemTag />}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => void openView(r)} style={linkStyle(C.brand)}>
                    查看
                  </button>
                  {canEdit(r) ? (
                    <button
                      onClick={() => {
                        setCurrent(r);
                        setMode('edit');
                      }}
                      disabled={!canWrite}
                      style={linkStyle(C.blue, canWrite)}
                    >
                      编辑
                    </button>
                  ) : (
                    <span
                      title="系统默认模板不可编辑"
                      style={{ marginRight: 12, color: C.ink4, cursor: 'not-allowed', background: 'none', border: 'none', padding: 0, fontSize: 14 }}
                    >
                      编辑
                    </span>
                  )}
                  {!r.isSystem && (
                    <button onClick={() => void remove(r)} disabled={!canWrite} style={linkStyle(C.ink3, canWrite)}>
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: C.ink4, padding: 40 }}>
                  暂无模板
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ───────── 局部小件 ───────── */

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ marginBottom: 12, border: 'none', background: 'none', padding: 0, fontSize: 14, color: '#c81e42', cursor: 'pointer' }}
    >
      ← 返回列表
    </button>
  );
}

function linkStyle(color: string, enabled = true): React.CSSProperties {
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
