import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/store/editorStore';
import LayerList from './LayerList';

type Tab = 'layer' | 'page' | 'template';

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function PageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

const TABS: { key: Tab; icon: typeof LayersIcon; labelKey: string }[] = [
  { key: 'layer', icon: LayersIcon, labelKey: 'editor:panel.layers' },
  { key: 'page', icon: PageIcon, labelKey: 'editor:panel.pages' },
  { key: 'template', icon: TemplateIcon, labelKey: 'editor:panel.templates' },
];

export default function PageList() {
  const { t } = useTranslation(['editor']);
  const [tab, setTab] = useState<Tab>('layer');

  const pages = useEditorStore((s) => s.project.pages);
  const activePage = useEditorStore((s) => s.activePage);
  const switchPage = useEditorStore((s) => s.switchPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const renamePage = useEditorStore((s) => s.renamePage);

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-[#f7f8fa]">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(({ key, icon: Icon, labelKey }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1 px-1 py-2.5 text-xs font-medium transition ${
                active
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={t(labelKey)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      {tab === 'layer' && <LayerList />}

      {tab === 'page' && (
        <>
          <div className="flex-1 overflow-y-auto p-2">
            {pages.map((page, i) => {
              const displayName =
                page.name || t('editor:page.defaultName', { index: i + 1 });
              const active = i === activePage;
              return (
                <div
                  key={page.id}
                  onClick={() => switchPage(i)}
                  className={`group mb-2 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 transition ${
                    active
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                      active
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                    {displayName}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const name = window.prompt(
                          t('editor:page.pageName'),
                          displayName,
                        );
                        if (name !== null) renamePage(i, name);
                      }}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-blue-500"
                      title={t('editor:page.renamePage')}
                    >
                      ✎
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(i);
                        }}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        title={t('editor:page.deletePage')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 p-2">
            <button
              onClick={addPage}
              className="flex w-full items-center justify-center gap-1 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
            >
              <span>+</span>
              {t('editor:page.addBlankPage')}
            </button>
          </div>
        </>
      )}

      {tab === 'template' && (
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-sm text-gray-400">
          <div className="mb-2 text-3xl">📁</div>
          {t('editor:page.myTemplatesEmpty')}
        </div>
      )}
    </aside>
  );
}
