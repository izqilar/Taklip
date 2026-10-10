/**
 * InvitationJobs — 用户端「请柬批量生成」详情页（§18 二次优化）。
 *
 * 全程在用户端闭环，不跳转编辑器：
 *  1. 「请柬模板选择」按钮 → InvitationTemplatePicker 实时预览弹窗，返回 {id,title,schema}；
 *  2. 「人员名单选择」按钮 → PersonPickerDialog（复刻编辑器批量生成 UI），返回 {projectId,listId,selectedRecordIds}；
 *  3. 「批量生成」→ setGuestSelection + POST /api/invitations/batch-generate（首渲 FREE_SAMPLE / 续渲 PAID）；
 *  4. 下方任务进度区按**人员逐条**展示：任务(姓名)/状态/进度/操作(预览·重新生成)；
 *  5. 工具条：全选 / 删除选择 / 打包下载 + 每行复选框（§18.4）。
 *
 * 数据源：聚合端点 GET /api/invitations/projects/:id/results（跨 job、按锁定快照顺序）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getToken, ApiError, type ProjectResultRow, type BindingHealth } from '@/api/client';
import {
  VariableMappingDialog,
  type ProjectElement,
  type ElementBindings,
  type InvitationHealth,
} from '@h5design/invitation-mapping';
import { InvitationTemplatePicker, type PickedTemplate } from './InvitationTemplatePicker';
import { PersonPickerDialog, type PickedPersons } from './PersonPickerDialog';

export default function InvitationJobs() {
  const { t } = useTranslation(['common']);

  const [template, setTemplate] = useState<PickedTemplate | null>(null);
  const [picked, setPicked] = useState<PickedPersons | null>(null); // {projectId, listId, selectedRecordIds}

  const [results, setResults] = useState<ProjectResultRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 生成前体检（D4 反转：含映射改指向）
  const [health, setHealth] = useState<BindingHealth | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [elements, setElements] = useState<ProjectElement[] | undefined>(undefined);
  const [resuming, setResuming] = useState(false);
  // 分步向导：第③步「字段配对」是否已完成（保存映射或点击「跳过」）
  const [fieldPaired, setFieldPaired] = useState(false);

  const pollRef = useRef<number | null>(null);
  const projectId = picked?.projectId ?? '';

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadResults = useCallback(async (pid: string) => {
    try {
      const r = await api.projectResults(pid);
      setResults(r.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingResults(false);
    }
  }, []);

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
    if (projectId) void loadResults(projectId);
    else {
      setResults([]);
      setChecked(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const onPickTemplate = (p: PickedTemplate) => {
    setTemplate(p);
    // 模板变更 → 旧项目/勾选/配对失效，需重新走向导
    setPicked(null);
    setResults([]);
    setChecked(new Set());
    setFieldPaired(false);
    setPickerOpen(false);
  };

  const onPickPersons = (p: PickedPersons) => {
    setPicked(p);
    // 名单变更 → 字段配对需重做
    setFieldPaired(false);
    setPersonOpen(false);
  };

  const startGenerate = useCallback(
    async (payload: { projectId: string; mode?: 'FREE_SAMPLE' | 'PAID' | 'RERENDER'; targetRecordIds?: string[] }) => {
      setError('');
      setGenerating(true);
      try {
        // 首渲/续渲前确保勾选已落库（重渲无需重设）
        if (!payload.targetRecordIds && picked && !payload.mode) {
          await api.setGuestSelection({
            projectId: payload.projectId,
            listId: picked.listId,
            selectedRecordIds: picked.selectedRecordIds,
          });
        }
        const res = await api.batchGenerate(payload);
        setRunningJobId(res.jobId);
        await loadResults(payload.projectId);
      } catch (e) {
        setGenerating(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [picked, loadResults],
  );

  /**
   * 第③步「字段配对」入口：先生成前体检 + 拉取可点选元素，弹出「字段配对」对话框。
   * 对话框保存/跳过 → onPaired 标记第③步完成，不再耦合生成（生成由第④步独立负责）。
   */
  const openFieldPair = async () => {
    if (!picked) {
      setError(t('common:guest.batch.needPersons', { defaultValue: '请先选择人员名单' }));
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

  /** 第④步「批量生成」：仅执行生成，前置步骤由按钮 disabled 与下方守卫双重保障 */
  const handleGenerate = () => {
    if (!template || !picked || !fieldPaired) {
      setError(t('common:guest.batch.completePrevStep', { defaultValue: '请先完成前一步操作' }));
      return;
    }
    void startGenerate({ projectId: picked.projectId });
  };

  const onRegenerate = (recordId: string) => {
    if (!picked) return;
    void startGenerate({ projectId: picked.projectId, mode: 'RERENDER', targetRecordIds: [recordId] });
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResuming(false);
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
    if (!window.confirm(t('common:guest.batch.confirmDelete', { defaultValue: '确定删除选中的生成记录？此操作不退配额' }))) return;
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
  const allChecked = results.length > 0 && checked.size === results.length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(results.filter((r) => r.status === 'ok').map((r) => r.recordId)));

  const statusText = (r: ProjectResultRow) => {
    if (r.status === 'ok') return { label: t('common:guest.batch.ok', { defaultValue: '成功' }), color: '#1a7f37' };
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

      {/* 分步向导：① 选模板 → ② 选名单 → ③ 字段配对 → ④ 批量生成（严格顺序，禁止跳步） */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded bg-[#c81e42] px-4 py-1.5 text-sm text-white hover:opacity-90"
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
          className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          ② {t('common:guest.batch.pickPersons', { defaultValue: '人员名单选择' })}
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
          className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          ③ {t('common:guest.batch.fieldPair', { defaultValue: '字段配对' })}
          {fieldPaired ? `（${t('common:guest.batch.paired', { defaultValue: '已配对' })}）` : ''}
        </button>

        <button
          onClick={handleGenerate}
          disabled={!template || !picked || !fieldPaired || generating}
          className="ml-auto rounded bg-blue-600 px-5 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? t('common:guest.batch.generating', { defaultValue: '生成中…' }) : `④ ${t('common:guest.batch.generate', { defaultValue: '批量生成' })}`}
        </button>
      </div>

      {/* 任务进度区 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-medium text-gray-700">
            {t('common:guest.batch.taskProgress', { defaultValue: '任务进度' })}
          </span>
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
              {t('common:guest.batch.deleteSelected', { defaultValue: '删除选择' })}
            </button>
            <button onClick={doPack} disabled={!results.length} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50">
              {t('common:guest.batch.packDownload', { defaultValue: '打包下载' })}
            </button>
          </div>
        </div>

        {!projectId ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {t('common:guest.batch.emptyHint', { defaultValue: '请先选择模板与人员名单，再点击「批量生成」' })}
          </div>
        ) : loadingResults && !results.length ? (
          <div className="py-12 text-center text-sm text-gray-400">…</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 font-medium">{t('common:guest.batch.colTask', { defaultValue: '任务' })}</th>
                <th className="w-28 px-3 py-2 font-medium">{t('common:guest.batch.colStatus', { defaultValue: '状态' })}</th>
                <th className="w-28 px-3 py-2 font-medium">{t('common:guest.batch.colProgress', { defaultValue: '进度' })}</th>
                <th className="w-40 px-3 py-2 font-medium">{t('common:guest.batch.colOp', { defaultValue: '操作' })}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const st = statusText(r);
                const canRegenerate = r.status === 'ok' || r.status === 'failed';
                return (
                  <tr key={r.recordId} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked.has(r.recordId)}
                        disabled={r.status !== 'ok'}
                        onChange={() => toggleCheck(r.recordId)}
                        className="h-4 w-4 accent-blue-500"
                        title={r.status !== 'ok' ? t('common:guest.batch.onlyOkCheck', { defaultValue: '仅成功图可勾选打包/删除' }) : ''}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-800">{r.name ?? r.recordId}</td>
                    <td className="px-3 py-2" style={{ color: st.color }}>
                      {st.label}
                      {r.error ? <div className="text-[11px] text-red-500">{r.error}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.url ? t('common:guest.batch.generated', { defaultValue: '已生成' }) : t('common:guest.batch.notGenerated', { defaultValue: '待生成' })}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => r.url && openPreview(r.url)}
                        disabled={!r.url}
                        className="mr-3 text-blue-600 hover:underline disabled:text-gray-300"
                      >
                        {t('common:guest.batch.preview', { defaultValue: '预览' })}
                      </button>
                      <button
                        onClick={() => onRegenerate(r.recordId)}
                        disabled={!canRegenerate || generating}
                        className="text-[#c81e42] hover:underline disabled:text-gray-300"
                      >
                        {t('common:guest.batch.regenerate', { defaultValue: '重新生成' })}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!results.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    {t('common:guest.batch.noTasks', { defaultValue: '暂无生成任务' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <InvitationTemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onConfirm={onPickTemplate} />
      {template && (
        <PersonPickerDialog
          open={personOpen}
          templateId={template.id}
          onClose={() => setPersonOpen(false)}
          onConfirm={onPickPersons}
        />
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="preview" className="max-h-[90vh] max-w-[90vw] rounded shadow-lg" />
        </div>
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
    </div>
  );
}
