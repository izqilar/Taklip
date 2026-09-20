import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelectedElement } from '@/store/editorStore';
import ComponentSettingsPanel from './ComponentSettingsPanel';
import PageSettingsPanel from './PageSettingsPanel';

/* ───────── 属性面板（双选项卡容器） ───────── */

export default function PropertyPanel() {
  const { t } = useTranslation(['editor']);
  const el = useSelectedElement();
  const [topTab, setTopTab] = useState<'component' | 'page'>('component');

  // 未选中元素时只能看到页面设置
  const activeTab = el ? topTab : 'page';

  return (
    <aside className="flex h-full w-80 shrink-0 border-l border-gray-200 bg-white">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶部双选项卡 */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTopTab('component')}
            disabled={!el}
            className={`flex-1 py-3 text-base font-medium transition ${
              activeTab === 'component'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : el
                  ? 'text-gray-600 hover:text-gray-800'
                  : 'cursor-not-allowed text-gray-300'
            }`}
          >
            {t('editor:panel.componentSettings')}
          </button>
          <button
            type="button"
            onClick={() => setTopTab('page')}
            className={`flex-1 py-3 text-base font-medium transition ${
              activeTab === 'page'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('editor:panel.pageSettings')}
          </button>
        </div>

        {/* 内容区 */}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activeTab === 'component' && el ? <ComponentSettingsPanel /> : <PageSettingsPanel />}
        </div>
      </div>
    </aside>
  );
}
