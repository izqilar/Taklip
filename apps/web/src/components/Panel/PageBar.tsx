import { useTranslation } from 'react-i18next';
import {useEditorStore} from '@h5design/editor';

/**
 * 底部多页面管理栏
 * 支持：添加页面、删除页面、切换页面、重命名页面
 */
export default function PageBar() {
  const { t } = useTranslation(['editor']);
  const pages = useEditorStore((s) => s.project.pages);
  const activePage = useEditorStore((s) => s.activePage);
  const switchPage = useEditorStore((s) => s.switchPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const renamePage = useEditorStore((s) => s.renamePage);

  return (
    <footer className="flex items-center gap-1 border-t border-gray-700 bg-gray-800 px-2 py-1.5">
      {pages.map((page, i) => {
        const displayName =
          page.name || t('editor:page.defaultName', { index: i + 1 });
        return (
          <div
            key={page.id}
            className={`group flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
              i === activePage
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <button onClick={() => switchPage(i)} className="cursor-pointer">
              {displayName}
            </button>
            <button
              onClick={() => {
                const name = window.prompt(
                  t('editor:page.pageName'),
                  displayName,
                );
                if (name !== null) renamePage(i, name);
              }}
              className="opacity-0 transition group-hover:opacity-60 hover:!opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              title={t('editor:page.renamePage')}
            >
              ✎
            </button>
            {pages.length > 1 && (
              <button
                onClick={() => deletePage(i)}
                className="opacity-0 transition group-hover:opacity-60 hover:!opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                title={t('editor:page.deletePage')}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={addPage}
        className="ms-1 flex h-7 w-7 items-center justify-center rounded bg-gray-700 text-gray-300 transition hover:bg-gray-600 hover:text-white"
        title={t('editor:page.addPage')}
      >
        +
      </button>
    </footer>
  );
}
