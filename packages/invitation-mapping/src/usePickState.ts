import { useCallback, useState } from 'react';
import type { ElementBindings, ElementBindingEntry, ProjectElement, HealthCandidate } from './types';

/**
 * D 模式画布点选的本地状态：元素选中 + 元素→名单字段绑定。
 * 纯展示态，落库由 onSaveElementBindings 负责（不在此处写后端）。
 */
export function usePickState(initial?: ElementBindings) {
  const [bindings, setBindings] = useState<ElementBindings>(initial ?? {});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectEl = useCallback((id: string) => setSelectedId((cur) => (cur === id ? null : id)), []);

  const setField = useCallback((el: ProjectElement, field: HealthCandidate | null) => {
    setBindings((prev) => {
      const next = { ...prev };
      if (!field) {
        delete next[el.id];
      } else {
        const entry: ElementBindingEntry = { key: field.key, name: field.label, listField: field.key };
        next[el.id] = entry;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setBindings({});
    setSelectedId(null);
  }, []);

  return { bindings, selectedId, selectEl, setField, clearAll, setBindings, setSelectedId };
}
