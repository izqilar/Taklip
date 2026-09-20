import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MaterialPanel from './MaterialPanel';
import LayerPanel from './LayerPanel';
import BackgroundPanel from './BackgroundPanel';

type Tab = 'element' | 'layer' | 'background';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'element', labelKey: 'editor:panel.elements' },
  { key: 'layer', labelKey: 'editor:panel.layers' },
  { key: 'background', labelKey: 'editor:panel.background' },
];

/**
 * 左侧面板 — Tab 切换：元素库 / 图层 / 背景
 */
export default function LeftPanel() {
  const { t } = useTranslation(['editor']);
  const [tab, setTab] = useState<Tab>('element');

  return (
    <aside className="flex w-44 flex-col border-r border-gray-700 bg-gray-800">
      <div className="flex border-b border-gray-700">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 px-1 py-2 text-xs font-medium transition ${
              tab === tb.key
                ? 'border-b-2 border-blue-500 text-blue-300'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'element' && <MaterialPanel />}
      {tab === 'layer' && <LayerPanel />}
      {tab === 'background' && <BackgroundPanel />}
    </aside>
  );
}
