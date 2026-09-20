import { useTranslation } from 'react-i18next';
import {useEditorStore} from '@h5design/editor';
import { LayerList } from '@h5design/editor';

/**
 * 图层面板（独立浮窗/侧边栏外壳）
 * 主体逻辑已抽离到 LayerList.tsx，此处仅保留可单独使用的外壳。
 */
export default function LayerPanel() {
  const { t } = useTranslation(['editor']);
  const select = useEditorStore((s) => s.select);

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-[#f7f8fa] px-3 py-2">
        <span className="text-sm font-semibold text-gray-700">
          {t('editor:panel.layerList')}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => select(null)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title={t('editor:layer.clearSelection')}
          >
            ✕
          </button>
        </div>
      </div>

      <LayerList />
    </aside>
  );
}
