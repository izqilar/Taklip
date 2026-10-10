import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TemplateFieldDesign, type GuestFieldDef } from '@h5design/ui';
import { authFetch } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

/**
 * 用户端「模板字段设计」（§17.2 多模板管理页）。
 *
 * 改造为多模板管理：列出系统默认模板（不可删除）+ 用户自建模板，支持
 * 查看 / 编辑 / 删除 / 新建。仅平台超级管理员（isAdmin）可编辑系统模板字段。
 * 编辑 / 新建复用 @h5design/ui 的 TemplateFieldDesign（lockFirstField=false，各模板字段独立）。
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

/** 统一错误体解析：优先取服务端 message，其次回落到 HTTP 状态码 */
const failOf = async (res: Response): Promise<Error> => {
  const d = await res.json().catch(() => ({}));
  return new Error((d as { message?: string })?.message || `HTTP ${res.status}`);
};

export default function WebTemplateFieldDesign() {
  const { t } = useTranslation(['common']);
  const isAdmin = useAuthStore((s) => s.isAdmin);
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
      const res = await authFetch('/api/guest-lists/templates');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setRows(Array.isArray(d.templates) ? d.templates : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'list') void load();
  }, [mode, load]);

  const openView = useCallback(async (tpl: TemplateView) => {
    setCurrent(tpl);
    setError('');
    try {
      const res = await authFetch(`/api/guest-lists/templates/${tpl.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setViewFields((d.template?.fields ?? []) as GuestFieldDef[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setMode('view');
  }, []);

  const remove = useCallback(
    async (tpl: TemplateView) => {
      if (!window.confirm(t('common:guest.confirmDelete', { defaultValue: '确定删除该模板？' }))) return;
      try {
        const res = await authFetch(`/api/guest-lists/templates/${tpl.id}`, { method: 'DELETE' });
        if (!res.ok) throw await failOf(res);
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load, t],
  );

  const canEdit = (tpl: TemplateView) => !tpl.isSystem || isAdmin;

  /* ───── 编辑 / 新建：复用 TemplateFieldDesign ───── */
  if (mode === 'edit' && current) {
    const loadFields = async (): Promise<GuestFieldDef[]> => {
      const res = await authFetch(`/api/guest-lists/templates/${current.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return (d.template?.fields ?? []) as GuestFieldDef[];
    };
    const saveFields = async (defs: GuestFieldDef[]): Promise<GuestFieldDef[]> => {
      const res = await authFetch(`/api/guest-lists/templates/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: defs }),
      });
      if (!res.ok) throw await failOf(res);
      const d = await res.json();
      return (d.template?.fields ?? []) as GuestFieldDef[];
    };
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => setMode('list')} className="mb-3 text-sm text-[#c81e42] hover:underline">
          ← {t('common:guest.backToList', { defaultValue: '返回列表' })}
        </button>
        <TemplateFieldDesign
          loadFields={loadFields}
          saveFields={saveFields}
          lockFirstField={false}
          lockedKeys={[]}
          onSaved={() => setMode('list')}
          labels={{ desc: t('common:guest.templateDesc', { defaultValue: '设计该模板的字段。各模板字段独立，不强制姓名(guest_name) 为首字段。' }) }}
        />
      </div>
    );
  }

  if (mode === 'new') {
    const saveFields = async (defs: GuestFieldDef[]): Promise<GuestFieldDef[]> => {
      const res = await authFetch('/api/guest-lists/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, fields: defs }),
      });
      if (!res.ok) throw await failOf(res);
      const d = await res.json();
      return (d.template?.fields ?? []) as GuestFieldDef[];
    };
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => setMode('list')} className="mb-3 text-sm text-[#c81e42] hover:underline">
          ← {t('common:guest.backToList', { defaultValue: '返回列表' })}
        </button>
        <TemplateFieldDesign
          loadFields={async () => []}
          saveFields={saveFields}
          showName
          nameValue={newName}
          onNameChange={setNewName}
          lockFirstField={false}
          lockedKeys={[]}
          onSaved={() => setMode('list')}
          labels={{ desc: t('common:guest.templateDescNew', { defaultValue: '新建一套模板字段，保存后可在「诚邀名单制作」下载对应线下填写模板。' }) }}
        />
      </div>
    );
  }

  if (mode === 'view' && current) {
    return (
      <div className="p-4">
        <button onClick={() => setMode('list')} className="mb-3 text-sm text-[#c81e42] hover:underline">
          ← {t('common:guest.backToList', { defaultValue: '返回列表' })}
        </button>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          {current.name}
          {current.isSystem && (
            <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {t('common:guest.systemTag', { defaultValue: '系统' })}
            </span>
          )}
        </h2>
        <p className="mb-3 text-sm text-gray-500">{t('common:guest.viewFields', { defaultValue: '模板字段（只读）' })}</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-3 py-2 font-medium">{t('common:guest.colKey', { defaultValue: '字段 key' })}</th>
              <th className="px-3 py-2 font-medium">{t('common:guest.colLabel', { defaultValue: '中文表头' })}</th>
              <th className="px-3 py-2 font-medium">{t('common:guest.colType', { defaultValue: '类型' })}</th>
              <th className="px-3 py-2 font-medium">{t('common:guest.colReq', { defaultValue: '必填' })}</th>
            </tr>
          </thead>
          <tbody>
            {viewFields.map((f, i) => (
              <tr key={f.key + i} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-700">{f.key}</td>
                <td className="px-3 py-2 text-gray-700">{f.label}</td>
                <td className="px-3 py-2 text-gray-600">{f.type === 'enum' ? '枚举' : '文本'}</td>
                <td className="px-3 py-2 text-gray-600">{f.required ? t('common:status.yes', { defaultValue: '是' }) : t('common:status.no', { defaultValue: '否' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ───── 列表页 ───── */
  return (
    <div className="p-4">
      <div className="mb-4 flex items-end gap-2">
        <h2 className="mr-auto text-lg font-semibold text-gray-800">
          {t('common:userCenter.menu.fieldDesign', { defaultValue: '模板字段设计' })}
        </h2>
        <button
          onClick={() => { setNewName(''); setMode('new'); }}
          className="rounded bg-[#c81e42] px-4 py-1.5 text-sm text-white hover:opacity-90"
        >
          ＋ {t('common:guest.newTemplate', { defaultValue: '新建模板' })}
        </button>
      </div>

      {error && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">…</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="w-16 px-3 py-2 font-medium">{t('common:guest.seq', { defaultValue: '序号' })}</th>
              <th className="w-48 px-3 py-2 font-medium">{t('common:guest.templateId', { defaultValue: '模板ID' })}</th>
              <th className="px-3 py-2 font-medium">{t('common:guest.templateName', { defaultValue: '模板名称' })}</th>
              <th className="w-48 px-3 py-2 font-medium">{t('common:action.operations', { defaultValue: '操作' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-3 py-2 text-gray-500">{r.id}</td>
                <td className="px-3 py-2 text-gray-800">
                  {r.name}
                  {r.isSystem && (
                    <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {t('common:guest.systemTag', { defaultValue: '系统' })}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => void openView(r)} className="mr-3 text-[#c81e42] hover:underline">
                    {t('common:action.view', { defaultValue: '查看' })}
                  </button>
                  {canEdit(r) ? (
                    <button onClick={() => { setCurrent(r); setMode('edit'); }} className="mr-3 text-blue-600 hover:underline">
                      {t('common:guest.editFields', { defaultValue: '编辑' })}
                    </button>
                  ) : (
                    <span className="mr-3 text-gray-300" title={t('common:guest.cannotEditSystem', { defaultValue: '仅平台超级管理员可编辑系统模板字段' })}>
                      {t('common:guest.editFields', { defaultValue: '编辑' })}
                    </span>
                  )}
                  {!r.isSystem && (
                    <button onClick={() => void remove(r)} className="text-gray-500 hover:text-red-600">
                      {t('common:action.delete', { defaultValue: '删除' })}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-gray-400">
                  {t('common:guest.noTemplates', { defaultValue: '暂无模板' })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
