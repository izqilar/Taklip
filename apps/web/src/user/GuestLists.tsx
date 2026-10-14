import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '@/api/client';
import { Link, useNavigate } from 'react-router-dom';

/**
 * 用户端「我的请柬名单」（§16.4 入口 A：个人中心新增分组「批量请柬」）
 *
 * 布局：标题独立成行；新建区为**同一行**的
 *   模板选择 → 文件格式 → 「下载模板」 → 名单名称输入 → 「新建名单」
 * 其中模板选择是唯一真值，同时决定「下载模板 / 导入校验」所用模板与「新建名单」的字段快照；
 * 名称输入框右侧原有的重复「选择模板（可选）」下拉已删除（与顶部下拉同源、纯重复）。
 *
 * 三大能力收口于此：
 *   1. 下载标准化模板（CSV / XLSX）
 *   2. 文件导入（append / overwrite）
 *   3. 进入在线编辑（浏览器内增删改）
 * 渲染动作统一收口到编辑器内「批量生成」面板（决策 D4），本页不提供生成按钮。
 */

interface GuestListRow {
  id: string;
  name: string;
  recordCount: number;
  updatedAt: string;
}

export default function UserGuestLists() {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
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
      const res = await authFetch('/api/guest-lists/templates');
      if (!res.ok) return;
      const d = await res.json();
      const tpls = Array.isArray(d.templates) ? d.templates : [];
      setTemplates(tpls);
      setTemplateId((prev) => prev || tpls.find((t: { id: string }) => t.id === 'sys_simple_guest')?.id || (tpls[0]?.id ?? ''));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/guest-lists');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [importTarget]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 模板下载（方案①）：服务端返回文件流，需带 Bearer 鉴权头。
   * 原 `window.open` 顶层导航无法携带 Authorization 头 → 401（见诊断）。
   * 改为 fetch + blob 触发下载，鉴权头与 401 静默续期统一由 `authFetch` 提供。
   */
  const downloadTemplate = useCallback(async (format: 'csv' | 'xlsx') => {
    try {
      const qs = new URLSearchParams({ format });
      if (templateId) qs.set('templateId', templateId);
      const res = await authFetch(`/api/guest-lists/template?${qs.toString()}`);
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
  }, [templateId]);

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await authFetch('/api/guest-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, templateId: templateId || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      setNewName('');
      navigate(`/user/invitations/lists/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [newName, templateId, navigate]);

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', importMode);
    if (importTarget) fd.append('listId', importTarget);
    // 透传下载模板所选 templateId：直接「导入为新名单」时，服务端据此按该模板字段
    // 校验（与下载模板同一真值），避免婚礼等「首列非 guest_name」模板被误判缺列。
    if (!importTarget && templateId) fd.append('templateId', templateId);
    try {
      const res = await authFetch('/api/guest-lists/import', {
        method: 'POST',
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
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [importMode, importTarget, load, templateId]);

  const remove = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/guest-lists/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.message || `HTTP ${res.status}`);
        }
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load],
  );

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        {t('common:userCenter.menu.guestLists', { defaultValue: '诚邀名单制作' })}
      </h2>

      {/*
        新建区：模板选择 → 文件格式 → 下载模板 → 名单名称 → 新建名单
        同一行横向排列、垂直居中、等距（gap-2）；窄屏由 flex-wrap 自然换行，
        各控件加 shrink-0 防止被压缩到不可点，输入框 flex-1 + min-w 保证可用宽度。
      */}
      <div
        data-testid="new-list-form"
        className="mb-4 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 p-3"
      >
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          data-testid="new-list-template"
          className="shrink-0 rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">{t('common:guest.templateList', { defaultValue: '模板列表' })}</option>
          {templates.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.name}
            </option>
          ))}
        </select>
        <select
          value={dlFormat}
          onChange={(e) => setDlFormat(e.target.value as 'xlsx' | 'csv')}
          className="shrink-0 rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="xlsx">xlsx</option>
          <option value="csv">csv</option>
        </select>
        <button
          onClick={() => void downloadTemplate(dlFormat)}
          className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          {t('common:guest.downloadBtn', { defaultValue: '下载模板' })}
        </button>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('common:guest.listNamePlaceholder', { defaultValue: '名单名称，如：婚礼主桌' })}
          className="min-w-[160px] flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
        <button
          onClick={create}
          disabled={creating || !newName.trim()}
          className="shrink-0 rounded bg-[#c81e42] px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {t('common:guest.createList', { defaultValue: '新建名单' })}
        </button>
      </div>

      {/* 导入 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 p-3">
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" className="text-sm" />
        <select
          value={importTarget}
          onChange={(e) => setImportTarget(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">{t('common:guest.importNew', { defaultValue: '导入为新名单' })}</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={importMode}
          onChange={(e) => setImportMode(e.target.value as 'append' | 'overwrite')}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="append">{t('common:guest.modeAppend', { defaultValue: '追加' })}</option>
          <option value="overwrite">{t('common:guest.modeOverwrite', { defaultValue: '覆盖' })}</option>
        </select>
        <button
          onClick={upload}
          className="rounded border border-gray-300 bg-white px-4 py-1.5 text-sm hover:bg-gray-50"
        >
          {t('common:guest.import', { defaultValue: '导入' })}
        </button>
      </div>

      {error && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">…</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-3 py-2 font-medium">{t('common:guest.name', { defaultValue: '名单名称' })}</th>
              <th className="w-24 px-3 py-2 font-medium">{t('common:guest.count', { defaultValue: '人数' })}</th>
              <th className="w-40 px-3 py-2 font-medium">{t('common:guest.updatedAt', { defaultValue: '更新时间' })}</th>
              <th className="w-40 px-3 py-2 font-medium">{t('common:action.operations', { defaultValue: '操作' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-800">{r.name}</td>
                <td className="px-3 py-2 text-gray-600">{r.recordCount}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(r.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Link to={`/user/invitations/lists/${r.id}`} className="mr-3 text-[#c81e42] hover:underline">
                    {t('common:action.edit', { defaultValue: '编辑' })}
                  </Link>
                  <button onClick={() => remove(r.id)} className="text-gray-500 hover:text-red-600">
                    {t('common:action.delete', { defaultValue: '删除' })}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-gray-400">
                  {t('common:guest.empty', { defaultValue: '暂无名单，可下载模板填写后导入，或直接新建' })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
