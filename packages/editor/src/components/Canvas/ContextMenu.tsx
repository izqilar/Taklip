/**
 * 画布右键上下文菜单：复制 / 剪切 / 粘贴 / 创建副本 / 删除。
 *
 * - 直接读取编辑器 store 的当前选择与剪贴板状态；
 * - 点击菜单项后执行对应 store 动作并自动关闭；
 * - 点击菜单外部、按 Esc、滚动或改变窗口尺寸都会关闭菜单。
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../../store/editorStore';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const { t } = useTranslation(['editor', 'common']);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clipboard = useEditorStore((s) => s.clipboard);
  const copyElement = useEditorStore((s) => s.copyElement);
  const cutElement = useEditorStore((s) => s.cutElement);
  const pasteElement = useEditorStore((s) => s.pasteElement);
  const removeElements = useEditorStore((s) => s.removeElements);
  const duplicateElement = useEditorStore((s) => s.duplicateElement);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // 菜单打开时按下本菜单支持的快捷键 → 关闭菜单；
      // 实际动作由全局 useKeyboard 统一执行（两者互不重复）。
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const isShortcut =
        (mod && (k === 'c' || k === 'x' || k === 'v' || k === 'd')) ||
        e.key === 'Delete' ||
        e.key === 'Backspace';
      if (isShortcut) onClose();
    };
    const onScrollOrResize = () => onClose();
    // 注意：不监听 window 的 contextmenu 来关闭，否则在菜单已打开时再次右键
    // 会被本监听器先置空，导致 onCanvasContextMenu 无法把菜单移动到新位置。
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [onClose]);

  const hasSelection = selectedIds.length > 0;
  const hasClipboard = clipboard.length > 0;

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  // 修饰键文案：macOS 上为 ⌘（useKeyboard 同时识别 ctrlKey / metaKey），其余平台为 Ctrl
  const isMac =
    typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || '');
  const mod = isMac ? '⌘' : 'Ctrl+';

  const items: {
    key: string;
    label: string;
    /** 右侧快捷键提示（仅展示，实际按键由 useKeyboard 统一处理） */
    shortcut: string;
    disabled: boolean;
    danger?: boolean;
    onClick: () => void;
  }[] = [
    {
      key: 'copy',
      label: t('editor:contextMenu.copy', '复制'),
      shortcut: `${mod}C`,
      disabled: !hasSelection,
      onClick: () => run(() => copyElement(selectedIds)),
    },
    {
      key: 'cut',
      label: t('editor:contextMenu.cut', '剪切'),
      shortcut: `${mod}X`,
      disabled: !hasSelection,
      onClick: () => run(() => cutElement(selectedIds)),
    },
    {
      key: 'paste',
      label: t('editor:contextMenu.paste', '粘贴'),
      shortcut: `${mod}V`,
      disabled: !hasClipboard,
      onClick: () => run(() => pasteElement()),
    },
    {
      key: 'duplicate',
      label: t('editor:contextMenu.duplicate', '创建副本'),
      shortcut: `${mod}D`,
      disabled: !hasSelection,
      onClick: () => run(() => duplicateElement(selectedIds[0])),
    },
    {
      key: 'delete',
      label: t('editor:contextMenu.delete', '删除'),
      shortcut: 'Del',
      disabled: !hasSelection,
      danger: true,
      onClick: () => run(() => removeElements(selectedIds)),
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[1000] min-w-[184px] rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          disabled={it.disabled}
          onClick={it.onClick}
          className={[
            'flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left transition-colors',
            it.disabled
              ? 'cursor-not-allowed text-gray-300'
              : it.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100',
          ].join(' ')}
        >
          <span>{it.label}</span>
          <span
            className={[
              'shrink-0 text-xs tabular-nums',
              it.disabled ? 'text-gray-300' : it.danger ? 'text-red-400' : 'text-gray-400',
            ].join(' ')}
          >
            {it.shortcut}
          </span>
        </button>
      ))}
    </div>
  );
}
