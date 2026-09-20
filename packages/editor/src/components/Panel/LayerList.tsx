import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';
import { getElementRegistration } from '../../elements/registry';
import type { Element } from '@h5design/core';

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="2" y1="22" x2="22" y2="2" />}
    </svg>
  );
}

function LockIcon({ open }: { open?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      {open ? (
        <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      ) : (
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      )}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/**
 * 图层列表主体（无 header/外壳）
 * 支持：点击选中、显隐切换、锁定切换、删除、双击重命名、拖拽排序
 */
export default function LayerList() {
  const { t } = useTranslation(['editor', 'common']);
  const activePage = useEditorStore((s) => s.activePage);
  const pages = useEditorStore((s) => s.project.pages);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const updateElement = useEditorStore((s) => s.updateElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const reorderElements = useEditorStore((s) => s.reorderElements);

  const elements = pages[activePage]?.elements ?? [];
  // 上层（zIndex 大）显示在列表顶部
  const layers = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const handleDrop = (targetId: string) => {
    const dragged = dragId;
    setDragId(null);
    setOverId(null);
    if (!dragged || dragged === targetId) return;
    const ids = layers.map((l) => l.id);
    const from = ids.indexOf(dragged);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragged);
    reorderElements(ids);
  };

  if (layers.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-gray-400">
        {t('editor:layer.empty')}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {layers.map((el: Element) => {
        const reg = getElementRegistration(el.type);
        const name = el.name || t(`editor:element.${el.type}`) || el.type;
        const isSelected = el.id === selectedId;
        return (
          <div
            key={el.id}
            draggable={!editingId && !el.locked}
            onDragStart={() => setDragId(el.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(el.id);
            }}
            onDrop={() => handleDrop(el.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onClick={() => select(el.id)}
            className={`group mb-1.5 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition ${
              isSelected
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'
            } ${overId === el.id && dragId !== el.id ? 'border-dashed border-blue-400' : ''}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
              {reg?.icon || '•'}
            </span>

            {editingId === el.id ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                  updateElement(el.id, { name: draftName.trim() || undefined });
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1 py-0.5 text-xs text-gray-700 outline-none"
              />
            ) : (
              <span
                className={`min-w-0 flex-1 truncate ${el.visible ? '' : 'opacity-50 line-through'}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(el.id);
                  setDraftName(name);
                }}
              >
                {name}
              </span>
            )}

            <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
              <button
                title={el.visible ? t('editor:layer.hide') : t('editor:layer.show')}
                onClick={(e) => {
                  e.stopPropagation();
                  updateElement(el.id, { visible: !el.visible });
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-500"
              >
                <EyeIcon off={!el.visible} />
              </button>
              <button
                title={el.locked ? t('editor:layer.unlock') : t('editor:layer.lock')}
                onClick={(e) => {
                  e.stopPropagation();
                  updateElement(el.id, { locked: !el.locked });
                }}
                className={`rounded p-1 hover:bg-gray-100 ${el.locked ? 'text-amber-500' : 'text-gray-400 hover:text-blue-500'}`}
              >
                <LockIcon open={!el.locked} />
              </button>
              <button
                title={t('common:button.delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  removeElement(el.id);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
