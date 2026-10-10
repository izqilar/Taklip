import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  InvitationHealth,
  ProjectElement,
  ElementBindings,
  VariableMappingDialogProps,
  BlockVerdict,
  HealthCandidate,
} from './types';
import { VariableRow } from './VariableRow';
import { CanvasPicker } from './CanvasPicker';
import { usePickState } from './usePickState';

/** 三级阻断裁决（纯函数，三端共用同一份语义） */
function computeBlocking(
  health: InvitationHealth,
  mapping: Record<string, string>,
  elementBindings: ElementBindings,
  tk: (k: string, opts?: Record<string, unknown>) => string,
): BlockVerdict {
  const candidates = health.candidates ?? [];
  const varCount = health.vars.length;
  const mappedVarKeys = health.vars.filter((v) => mapping[v.key]).length;
  const elementMapped = Object.keys(elementBindings).length;
  const totalMapped = mappedVarKeys + elementMapped;

  if (candidates.length === 0) {
    return { blocked: true, blockCode: 'NO_USABLE_COLUMN', blockReason: tk('noUsableColumn'), amber: false, amberCount: 0 };
  }
  if (varCount > 0 && totalMapped === 0) {
    return { blocked: true, blockCode: 'NO_MAPPING_AT_ALL', blockReason: tk('noMappingAtAll'), amber: false, amberCount: 0 };
  }
  const guestNameCovered =
    !!mapping['guest_name'] || Object.values(elementBindings).some((e) => e.key === 'guest_name');
  if (varCount > 0 && health.vars.some((v) => v.key === 'guest_name') && !guestNameCovered) {
    return { blocked: true, blockCode: 'REQUIRED_UNMAPPED', blockReason: tk('requiredUnmapped'), amber: false, amberCount: 0 };
  }
  const amber = varCount > 0 && mappedVarKeys > 0 && mappedVarKeys < varCount;
  return { blocked: false, amber, amberCount: varCount - mappedVarKeys };
}

/** health 为 null（对话框已挂载但体检数据尚未返回）时的安全兜底裁决，避免首屏/未加载即崩溃 */
const NO_BLOCK: BlockVerdict = { blocked: false, blockCode: undefined, blockReason: '', amber: false, amberCount: 0 };

/**
 * 三端复用的「请柬变量绑定」对话框（S5）。
 * - C 模式（变量视图）：模板预置变量 → 名单列映射；显示人类可读名（binding.name）。
 * - D 模式（画布点选）：零绑定模板直接在对话框里指认元素 → 名单字段，落 project.elementBindings。
 * - 三级阻断 UI：硬阻断禁用主按钮；琥珀放行列「将留空/隐藏，共 N 张」。
 */
export function VariableMappingDialog(props: VariableMappingDialogProps) {
  const {
    open,
    health,
    elements,
    previewSchema,
    i18nPrefix = 'invitationMapping',
    onClose,
    onSaveMapping,
    onSaveElementBindings,
    onPaired,
  } = props;
  const { t } = useTranslation(['common']);
  const tk = (k: string, opts?: Record<string, unknown>) => t(`common:${i18nPrefix}.${k}`, opts);

  const [mapping, setMapping] = useState<Record<string, string>>(health?.mapping ?? {});
  const pick = usePickState();
  const [mode, setMode] = useState<'variable' | 'element'>('variable');
  const [saving, setSaving] = useState(false);

  // 打开/切换项目时重置本地态（health 可能尚未加载，需先判空）
  useEffect(() => {
    if (open && health) {
      setMapping(health.mapping ?? {});
      pick.setBindings({});
      pick.setSelectedId(null);
      setMode(health.vars.length > 0 ? 'variable' : 'element');
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, health?.projectId]);

  const verdict = useMemo(
    () => (health ? computeBlocking(health, mapping, pick.bindings, tk) : NO_BLOCK),
    [health, mapping, pick.bindings, tk],
  );

  const dModeAvailable = !!elements && elements.length > 0;

  // health 为 null（对话框已挂载但体检数据尚未返回）时不渲染，避免读取 null.mapping 崩溃
  if (!open || !health) return null;

  const handleField = (v: { key: string }, fieldKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (fieldKey) next[v.key] = fieldKey;
      else delete next[v.key];
      return next;
    });
  };

  // 字段配对（保存映射，不耦合生成）。保存成功 → 标记配对完成并关闭对话框。
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveMapping(mapping);
      await onSaveElementBindings(pick.bindings);
      onPaired?.();
      onClose();
    } catch {
      /* 保存失败：保持对话框打开，由调用方 onSave* 处理错误提示（含 409 容错） */
    } finally {
      setSaving(false);
    }
  };

  // 跳过字段配对（如 NO_MAPPING_AT_ALL：无变量可映射）。直接标记配对完成并关闭。
  const handleSkip = async () => {
    setSaving(true);
    try {
      onPaired?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canGenerate = !verdict.blocked || verdict.blockCode === 'NO_MAPPING_AT_ALL';

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold text-gray-800">{tk('title')}</h3>

        {/* 模式切换 */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setMode('variable')}
            className={`rounded px-3 py-1 text-sm ${mode === 'variable' ? 'bg-[#c81e42] text-white' : 'border border-gray-300 text-gray-600'}`}
          >
            {tk('modeVariable')}
          </button>
          <button
            onClick={() => dModeAvailable && setMode('element')}
            disabled={!dModeAvailable}
            className={`rounded px-3 py-1 text-sm ${mode === 'element' ? 'bg-[#c81e42] text-white' : 'border border-gray-300 text-gray-600 disabled:opacity-40'}`}
          >
            {tk('modeElement')}
          </button>
        </div>

        {/* 阻断/警告条 */}
        {verdict.blocked ? (
          <div className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{verdict.blockReason}</div>
        ) : null}
        {verdict.amber ? (
          <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {tk('willBeEmpty', { count: verdict.amberCount })}
          </div>
        ) : null}

        {/* 主体 */}
        {mode === 'variable' ? (
          <div className="space-y-2">
            {health.vars.length === 0 ? (
              <div className="rounded bg-gray-50 px-3 py-3 text-xs text-gray-500">{tk('noVarsHint')}</div>
            ) : (
              health.vars.map((v) => (
                <VariableRow
                  key={v.key}
                  v={v}
                  candidates={health.candidates}
                  value={mapping[v.key]}
                  onChange={(fk) => handleField(v, fk)}
                  i18nPrefix={i18nPrefix}
                />
              ))
            )}
          </div>
        ) : (
          <CanvasPicker
            elements={elements ?? []}
            candidates={health.candidates}
            bindings={pick.bindings}
            previewSchema={previewSchema}
            selectedId={pick.selectedId}
            onSelect={pick.selectEl}
            onSetField={pick.setField}
            i18nPrefix={i18nPrefix}
          />
        )}

        {/* 非阻断提示 */}
        {health.orphaned.length ? (
          <div className="mt-3 rounded bg-gray-50 px-3 py-1 text-xs text-gray-500">
            {tk('orphanedHint', { count: health.orphaned.length })}
          </div>
        ) : null}
        {health.superseded.length ? (
          <div className="mt-1 rounded bg-gray-50 px-3 py-1 text-xs text-gray-500">
            {tk('supersededHint', { count: health.superseded.length })}
          </div>
        ) : null}

        {/* D 模式清空 */}
        {mode === 'element' && Object.keys(pick.bindings).length ? (
          <button onClick={pick.clearAll} className="mt-3 text-xs text-gray-500 underline">
            {tk('clearAll')}
          </button>
        ) : null}

        {/* 底部操作 */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
          >
            {tk('cancel')}
          </button>
          {verdict.blockCode === 'NO_MAPPING_AT_ALL' ? (
            <button
              onClick={handleSkip}
              disabled={saving}
              className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {tk('skipUnified')}
            </button>
          ) : null}
          <button
            onClick={handleSave}
            disabled={!canGenerate || saving}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? tk('saving') : tk('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { InvitationHealth, ProjectElement, ElementBindings, HealthCandidate };
