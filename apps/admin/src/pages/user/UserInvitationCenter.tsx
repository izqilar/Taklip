import { useCallback, useEffect, useRef, useState } from 'react';
import { STATIC_URL, authHeaders, downloadWithAuth } from '../../utility';
import {
  apiDelete,
  apiGet,
  apiPost,
  useSubjectScope,
  type PerResult,
  type ProjectResults,
} from './invitationShared';
import { VariableMappingDialog, type InvitationHealth, type ProjectElement, type ElementBindings } from '@h5design/invitation-mapping';
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
 * 运营端（用户视角）· 请柬批量生成（§18 二次优化）
 *
 * 唯一基准 = web 端 `apps/web/src/user/InvitationJobs.tsx`，逐模块对齐（布局 / 字段 / 按钮 / 列表 / 交互）：
 *   1. 选择区：「请柬模板选择」→ 模板预览弹窗；「人员名单选择」→ 人员选择弹窗；
 *      「批量生成」→ setGuestSelection + POST /invitations/batch-generate（首渲 FREE_SAMPLE / 续渲 PAID）；
 *   2. 任务进度区：按**人员逐条**展示 任务(姓名) / 状态 / 进度 / 操作(预览 · 重新生成)；
 *   3. 工具条：全选 / 删除选择 / 打包下载 + 每行复选框（仅成功图可勾）。
 *
 * 轮询完成语义（★防回归）：**不能**仅凭逐人 status 停止——免费赠样仅渲前 3 人、其余恒 pending；
 * 必须以 **job 状态** SUCCESS/PARTIAL/FAILED 为终态信号。
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
  err: '#dc2626',
  errBg: '#fef2f2',
};

interface JobRow {
  id: string;
  status: string;
}

export default function UserInvitationCenter() {
  const { q, subjBody, canWrite, scopeForImage, subject } = useSubjectScope();

  // 变量绑定对话框（S5）态
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState<InvitationHealth | null>(null);
  const [mappingElements, setMappingElements] = useState<ProjectElement[]>([]);
  const [previewSchema, setPreviewSchema] = useState<unknown>(undefined);
  // 分步向导：第③步「字段配对」是否完成
  const [fieldPaired, setFieldPaired] = useState(false);

  const [template, setTemplate] = useState<PickedTemplate | null>(null);
  const [picked, setPicked] = useState<PickedPersons | null>(null);

  const [results, setResults] = useState<PerResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);

  const pollRef = useRef<number | null>(null);
  const projectId = picked?.projectId ?? '';

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadResults = useCallback(
    async (pid: string) => {
      try {
        const r = await apiGet<ProjectResults>(q(`/invitations/projects/${pid}/results`));
        setResults(r.results ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingResults(false);
      }
    },
    [q],
  );

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
    if (projectId) void loadResults(projectId);
    else {
      setResults([]);
      setChecked(new Set());
    }
  }, [projectId, loadResults]);

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
          await apiPost(q(`/invitations/projects/${payload.projectId}/selection`), {
            listId: picked.listId,
            selectedRecordIds: picked.selectedRecordIds,
            ...subjBody,
          });
        }
        const res = await apiPost<{ jobId: string }>(q('/invitations/batch-generate'), {
          ...payload,
          ...subjBody,
        });
        setRunningJobId(res.jobId);
        await loadResults(payload.projectId);
      } catch (e) {
        setGenerating(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picked, loadResults, q],
  );

  /**
   * 第③步「字段配对」入口：先体检 + 拉取可点选元素，弹出「字段配对」对话框。
   * 对话框保存/跳过 → onPaired 标记第③步完成，不再耦合生成（生成由第④步独立负责）。
   */
  const openFieldPair = async () => {
    if (!picked) {
      setError('请先选择人员名单');
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

  const onRegenerate = (recordId: string) => {
    if (!picked) return;
    void startGenerate({ projectId: picked.projectId, mode: 'RERENDER', targetRecordIds: [recordId] });
  };

  /** 逐人预览：private-assets 不公开暴露，须带鉴权 fetch → Blob → 新窗口 */
  const previewOne = async (row: PerResult) => {
    if (!row.url) return;
    try {
      const res = await fetch(`${STATIC_URL}${row.url}${scopeForImage}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      const qs = new URLSearchParams();
      if (ids.length) qs.set('recordIds', ids.join(','));
      if (subjBody.subject) qs.set('subject', subjBody.subject);
      const suffix = qs.toString();
      await downloadWithAuth(
        `/api/invitations/projects/${projectId}/download${suffix ? `?${suffix}` : ''}`,
        `invitations-${projectId}.zip`,
      );
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
        ...subjBody,
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
  const okIds = results.filter((r) => r.status === 'ok').map((r) => r.recordId);
  const allChecked = okIds.length > 0 && okIds.every((id) => checked.has(id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(okIds));

  const statusText = (r: PerResult) => {
    if (r.status === 'ok') return { label: '成功', color: C.ok };
    if (r.status === 'failed') return { label: '失败', color: C.fail };
    return runningJobId ? { label: '生成中', color: C.running } : { label: '待生成', color: C.ink4 };
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: C.ink1 }}>请柬批量生成</h2>

      {error && (
        <div style={{ marginBottom: 12, borderRadius: 4, background: C.errBg, padding: '8px 12px', fontSize: 12, color: C.err }}>
          {error}
        </div>
      )}

      {/* 分步向导：① 选模板 → ② 选名单 → ③ 字段配对 → ④ 批量生成（严格顺序，禁止跳步） */}
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
          ② 人员名单选择
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

        <button
          onClick={() => {
            if (!template || !picked || !fieldPaired) {
              setError('请先完成前一步操作');
              return;
            }
            if (picked) void startGenerate({ projectId: picked.projectId });
          }}
          disabled={!picked || generating || !canWrite || !fieldPaired}
          style={{
            marginLeft: 'auto',
            borderRadius: 4,
            border: 'none',
            background: C.blue,
            color: '#fff',
            padding: '6px 20px',
            fontSize: 14,
            cursor: !picked || generating || !canWrite || !fieldPaired ? 'not-allowed' : 'pointer',
            opacity: !picked || generating || !canWrite || !fieldPaired ? 0.5 : 1,
          }}
        >
          {generating ? '生成中…' : '④ 批量生成'}
        </button>
        {!canWrite && <span style={{ fontSize: 12, color: C.ink4 }}>监督态只读</span>}
      </div>

      {/* 任务进度区 */}
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
          <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>任务进度</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
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
        </div>

        {!projectId ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>
            请先选择模板与人员名单，再点击「批量生成」
          </div>
        ) : loadingResults && !results.length ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }} />
                <th style={th}>任务</th>
                <th style={{ ...th, width: 112 }}>状态</th>
                <th style={{ ...th, width: 112 }}>进度</th>
                <th style={{ ...th, width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const st = statusText(r);
                const canRegenerate = r.status === 'ok' || r.status === 'failed';
                return (
                  <tr key={r.recordId}>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={checked.has(r.recordId)}
                        disabled={r.status !== 'ok'}
                        onChange={() => toggleCheck(r.recordId)}
                        title={r.status !== 'ok' ? '仅成功图可勾选打包/删除' : ''}
                        style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                      />
                    </td>
                    <td style={{ ...td, color: C.ink1 }}>{r.name ?? r.recordId}</td>
                    <td style={{ ...td, color: st.color }}>
                      {st.label}
                      {r.error ? <div style={{ fontSize: 11, color: '#ef4444' }}>{r.error}</div> : null}
                    </td>
                    <td style={{ ...td, color: C.ink3 }}>{r.url ? '已生成' : '待生成'}</td>
                    <td style={td}>
                      <button
                        onClick={() => void previewOne(r)}
                        disabled={!r.url}
                        style={linkBtn(C.blue, !!r.url)}
                      >
                        预览
                      </button>
                      <button
                        onClick={() => onRegenerate(r.recordId)}
                        disabled={!canRegenerate || generating || !canWrite}
                        style={linkBtn(C.brand, canRegenerate && !generating && canWrite)}
                      >
                        重新生成
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!results.length && (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: 'center', color: C.ink4, padding: 40 }}>
                    暂无生成任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
