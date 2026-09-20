import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/store/editorStore';

const PRESETS = [
  '#ffffff',
  '#000000',
  '#f3f4f6',
  '#fee2e2',
  '#dbeafe',
  '#fef3c7',
  '#dcfce7',
  '#fae8ff',
];

/**
 * 背景面板 — 设置当前页背景色
 */
export default function BackgroundPanel() {
  const { t } = useTranslation(['editor']);
  const activePage = useEditorStore((s) => s.activePage);
  const background =
    useEditorStore((s) => s.project.pages[s.activePage]?.background) ?? '#ffffff';
  const setPageBackground = useEditorStore((s) => s.setPageBackground);

  const hex = /^#[0-9a-fA-F]{6}$/.test(background ?? '') ? (background as string) : '#ffffff';

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 text-sm text-gray-200">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {t('editor:background.title')}
      </h3>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => setPageBackground(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-gray-600"
        />
        <input
          type="text"
          value={background}
          onChange={(e) => setPageBackground(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs"
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setPageBackground(c)}
            className="h-7 rounded border border-gray-600 transition hover:scale-105"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
