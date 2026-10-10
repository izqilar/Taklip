/**
 * 批量请柬 · 模板变量面板（方案 §1.3 面板层 / §5.2）
 *
 * 集中管理模板内所有变量占位：
 *  - 按 key 聚合（同一模板中重复占位合并为一条，显示「命中 N 处」）
 *  - 逐条改 key / 样例 / 兜底值 / 溢出策略
 *  - 定位到命中元素（自动切页 + 选中）
 *  - 解除绑定（对该变量下所有命中元素生效）
 *  - 画布标记开关（variableMode）
 *
 * ★ 不新增表：变量本质是「元素上的标注」，真值源 = schema + `collectBindings`。
 *   单独建表会与 schema 产生双写不一致（既有教训：MEMORY §11「两套模板别混」）。
 */

import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';
import CollapsibleSection from '../UI/CollapsibleSection';
import {
  collectBindings,
  type TemplateVariableView,
} from '@h5design/core';
import { GUEST_FIELD_DEFS, getGuestFieldDef } from '@h5design/core';
import type { Element, VariableFitMode } from '@h5design/core';
import { VARIABLE_BRAND } from '../Canvas/VariableOverlay';
import { fetchPlaceholderRegistry, placeholderLabel } from '../../placeholderRegistry';
import type { PlaceholderRegistryEntry } from '../../services';

/** 标准字段候选 key（D4 反转：key 不强制等于名单字段 key，恒等仍是零配置主路径，优先从这里选） */
const STANDARD_KEYS = GUEST_FIELD_DEFS.map((d) => ({ key: d.key, label: d.label }));

const FIT_OPTIONS: { value: VariableFitMode; label: string }[] = [
  { value: 'shrink', label: '缩字号' },
  { value: 'clip', label: '裁剪' },
  { value: 'wrap', label: '换行' },
];

function VariableIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1" />
      <path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" />
    </svg>
  );
}

export default function VariablePanel() {
  const { t, i18n } = useTranslation(['editor']);
  const project = useEditorStore((s) => s.project);
  const pages = useEditorStore((s) => s.project.pages);
  const updateElement = useEditorStore((s) => s.updateElement);
  const select = useEditorStore((s) => s.select);
  const switchPage = useEditorStore((s) => s.switchPage);
  const variableMode = useEditorStore((s) => s.variableMode);
  const setVariableMode = useEditorStore((s) => s.setVariableMode);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState('');

  // 注册表（key → 条目）：用于 label 优先取注册表（回落 key）；接口失败/未注入时为 null
  const [registryMap, setRegistryMap] = useState<Record<string, PlaceholderRegistryEntry> | null>(null);
  useEffect(() => {
    let alive = true;
    fetchPlaceholderRegistry().then((res) => {
      if (!alive || !res) return;
      const m: Record<string, PlaceholderRegistryEntry> = {};
      for (const e of res) m[e.key] = e;
      setRegistryMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  const locale = i18n.language;
  const labelOf = (v: TemplateVariableView): string => {
    const reg = registryMap?.[v.key];
    if (reg) return placeholderLabel(reg, locale);
    return v.label || v.key;
  };

  const vars = useMemo(() => collectBindings(project), [project]);

  /** 找到某变量命中元素所在的页序号（用于「定位」时切页） */
  const pageOfElement = (elId: string): number =>
    pages.findIndex((p) => (p.elements ?? []).some((e) => e.id === elId));

  /** 定位：切到元素所在页并选中它 */
  const locate = (v: TemplateVariableView) => {
    const first = v.elementIds[0];
    if (!first) return;
    const pi = pageOfElement(first);
    if (pi >= 0) switchPage(pi);
    select(first);
  };

  /** 对某变量的全部命中元素应用 binding 补丁 */
  const patchBinding = (v: TemplateVariableView, patch: Partial<Element['binding']>) => {
    for (const id of v.elementIds) {
      const el = pages.flatMap((p) => p.elements ?? []).find((e) => e.id === id);
      if (!el?.binding?.key) continue;
      updateElement(id, { binding: { ...el.binding, ...patch } } as Partial<Element>);
    }
  };

  /** 重命名变量 key（对该变量全部命中元素生效） */
  const commitRename = (v: TemplateVariableView) => {
    const next = draftKey.trim();
    setEditingKey(null);
    setDraftKey('');
    if (!next || next === v.key) return;
    if (!/^[a-z][a-z0-9_]*$/.test(next)) return; // 命名规范守卫
    for (const id of v.elementIds) {
      const el = pages.flatMap((p) => p.elements ?? []).find((e) => e.id === id);
      if (!el?.binding?.key) continue;
      updateElement(id, { binding: { ...el.binding, key: next } } as Partial<Element>);
    }
  };

  /** 解除绑定：对全部命中元素清除 binding（显式置 undefined，JSON 序列化即删除该字段） */
  const unbind = (v: TemplateVariableView) => {
    for (const id of v.elementIds) {
      updateElement(id, { binding: undefined } as Partial<Element>);
    }
  };

  return (
    <div className="flex flex-col">
      {/* 画布标记开关 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm text-gray-700">
          {t('editor:variable.showOnCanvas', { defaultValue: '画布显示变量标记' })}
        </span>
        <button
          type="button"
          data-testid="variable-mode-toggle"
          onClick={() => setVariableMode(!variableMode)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${
            variableMode ? 'bg-blue-500' : 'bg-gray-300'
          }`}
          aria-pressed={variableMode}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
              variableMode ? 'left-4' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {vars.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs leading-relaxed text-gray-400">
          <div className="mb-2 flex justify-center text-gray-300">
            <VariableIcon className="h-6 w-6" />
          </div>
          {t('editor:variable.empty', {
            defaultValue: '暂无占位符。选中文本/图片元素后，在「组件设置 → 占位符绑定」中把它设为占位符。',
          })}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {vars.map((v) => (
            <div key={v.key} className="px-4 py-3" data-testid={`variable-row-${v.key}`}>
              {/* 头部：key + 命中数 + 操作 */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-white"
                  style={{ background: VARIABLE_BRAND }}
                  title={v.isStandard ? '标准名单字段' : '自定义字段'}
                >
                  <VariableIcon />
                  {v.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
                  {labelOf(v)} ·{' '}
                  {t('editor:variable.hitCount', {
                    defaultValue: '命中 {{n}} 处',
                    n: v.elementIds.length,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => locate(v)}
                  className="shrink-0 text-xs text-blue-500 hover:underline"
                  data-testid={`variable-locate-${v.key}`}
                >
                  {t('editor:variable.locate', { defaultValue: '定位' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(v.key);
                    setDraftKey(v.key);
                  }}
                  className="shrink-0 text-xs text-gray-500 hover:underline"
                >
                  {t('editor:variable.rename', { defaultValue: '重命名' })}
                </button>
                <button
                  type="button"
                  onClick={() => unbind(v)}
                  className="shrink-0 text-xs text-red-500 hover:underline"
                  data-testid={`variable-unbind-${v.key}`}
                >
                  {t('editor:variable.unbind', { defaultValue: '解除' })}
                </button>
              </div>

              {/* 重命名输入 */}
              {editingKey === v.key && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={draftKey}
                    onChange={(e) => setDraftKey(e.target.value)}
                    onBlur={() => commitRename(v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(v);
                      if (e.key === 'Escape') {
                        setEditingKey(null);
                        setDraftKey('');
                      }
                    }}
                    placeholder={t('editor:variable.keyPlaceholder', {
                      defaultValue: '小写字母/数字/下划线，如 ext_session',
                    })}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                </div>
              )}

              {/* 样例 / 兜底 / 溢出策略 */}
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-14 shrink-0 text-gray-500">
                    {t('editor:variable.sample', { defaultValue: '样例' })}
                  </span>
                  <input
                    value={v.sample}
                    onChange={(e) => patchBinding(v, { sample: e.target.value })}
                    placeholder={getGuestFieldDef(v.key)?.example ?? ''}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-14 shrink-0 text-gray-500">
                    {t('editor:variable.fallback', { defaultValue: '兜底值' })}
                  </span>
                  <input
                    value={v.fallback ?? ''}
                    onChange={(e) => patchBinding(v, { fallback: e.target.value || undefined })}
                    placeholder={t('editor:variable.fallbackHint', {
                      defaultValue: '名单该字段为空时使用（留空则隐藏元素）',
                    })}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-14 shrink-0 text-gray-500">
                    {t('editor:variable.fit', { defaultValue: '超长时' })}
                  </span>
                  <select
                    value={v.fit}
                    onChange={(e) => patchBinding(v, { fit: e.target.value as VariableFitMode })}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {FIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 帮助说明 */}
      <CollapsibleSection
        title={
          <span className="text-xs">
            {t('editor:variable.howto', { defaultValue: '变量命名与取值规则' })}
          </span>
        }
      >
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-gray-500">
          <li>
            {t('editor:variable.rule1', {
              defaultValue: '占位符来自「系统设置 → 占位符管理」，编辑器仅可绑定、不可新建；同名恒等命中。',
            })}
          </li>
          <li>
            {t('editor:variable.rule2', {
              defaultValue: '标准字段：',
            })}
            {STANDARD_KEYS.map((k) => k.key).join(' / ')}
          </li>
          <li>
            {t('editor:variable.rule3', {
              defaultValue: '自定义字段须由管理员在系统设置创建；旧模板遗留的 ext_ 字段仍可正常渲染。',
            })}
          </li>
          <li>
            {t('editor:variable.rule4', {
              defaultValue: '取值顺序：映射字段值 → 兜底值 → 称谓推断 → 空（整段变量元素则隐藏）。',
            })}
          </li>
        </ul>
      </CollapsibleSection>
    </div>
  );
}
