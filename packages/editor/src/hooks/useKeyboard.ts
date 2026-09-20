/**
 * 键盘快捷键 hook
 *
 * 快捷键列表：
 * Ctrl+Z         → 撤销
 * Ctrl+Shift+Z   → 重做（Ctrl+Y 同样）
 * Ctrl+C         → 复制选中元素（支持多选）
 * Ctrl+X         → 剪切选中元素（支持多选）
 * Ctrl+V         → 粘贴
 * Ctrl+D         → 复制选中元素（原地副本）
 * Delete / Backspace → 删除选中元素（支持多选）
 * 方向键          → 微调位置 1px
 * Shift+方向键    → 大步移动 10px
 * Ctrl+]         → 置顶
 * Ctrl+[         → 置底
 */

import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 在 input/textarea 中编辑时不拦截
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const state = useEditorStore.getState();
      const { selectedId } = state;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      /* ── Undo / Redo ── */
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (shift) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      /* ── 添加形状快捷键（不需要选中元素） ── */
      if (!ctrl) {
        const state = useEditorStore.getState();
        switch (e.key.toLowerCase()) {
          case 'r':
            e.preventDefault();
            state.addElement('rect');
            return;
          case 'l':
            if (!shift) {
              e.preventDefault();
              state.addElement('line');
              return;
            }
            e.preventDefault();
            state.addElement('arrow');
            return;
          case 'o':
            e.preventDefault();
            state.addElement('ellipse');
            return;
        }
      }

      /* ── Copy / Cut / Paste（粘贴不需要选中；复制/剪切需要选中） ── */
      if (ctrl && e.key.toLowerCase() === 'c') {
        if (state.selectedIds.length) {
          e.preventDefault();
          state.copyElement(state.selectedIds);
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'x') {
        if (state.selectedIds.length) {
          e.preventDefault();
          state.cutElement(state.selectedIds);
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        state.pasteElement();
        return;
      }

      /* ── 以下操作需要选中元素 ── */
      if (!selectedId) return;

      /* ── Duplicate ── */
      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        state.duplicateElement(selectedId);
        return;
      }

      /* ── Delete（多选时一次性删除全部选中） ── */
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.removeElements(state.selectedIds);
        return;
      }

      /* ── 层级 ── */
      if (ctrl && e.key === ']') {
        e.preventDefault();
        state.bringToFront(selectedId);
        return;
      }
      if (ctrl && e.key === '[') {
        e.preventDefault();
        state.sendToBack(selectedId);
        return;
      }

      /* ── 方向键移动 ── */
      const step = shift ? 10 : 1;
      const el = state.project.pages[state.activePage].elements.find(
        (e) => e.id === selectedId,
      );
      if (!el) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          state.updateElement(selectedId, { x: el.x - step });
          break;
        case 'ArrowRight':
          e.preventDefault();
          state.updateElement(selectedId, { x: el.x + step });
          break;
        case 'ArrowUp':
          e.preventDefault();
          state.updateElement(selectedId, { y: el.y - step });
          break;
        case 'ArrowDown':
          e.preventDefault();
          state.updateElement(selectedId, { y: el.y + step });
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
