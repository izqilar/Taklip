/**
 * 编辑器路由页 — 根据 URL 中的 projectId 从 API 加载作品，然后渲染 EditorApp
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useEditorStore } from '@/store/editorStore';
import EditorApp from '@/components/Editor/EditorApp';
import type { Project } from '@h5design/core';

export default function Editor() {
  const { t } = useTranslation(['common', 'errors']);
  const { projectId } = useParams<{ projectId: string }>();
  const loadProject = useEditorStore((s) => s.loadProject);
  const newProject = useEditorStore((s) => s.newProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!projectId) {
        newProject();
        setLoading(false);
        return;
      }

      try {
        const detail = await api.getProject(projectId);
        if (cancelled) return;

        if (detail.schema) {
          loadProject(detail.schema as Project, String(detail.id));
        } else {
          newProject();
        }
        setLoading(false);
      } catch (err) {
        console.error('Load project failed:', err);
        setError(t('errors:dashboard.loadProjectError'));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject, newProject, t]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 text-gray-400">
        {t('common:status.loadingProject')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="mb-2 text-red-400">{error}</p>
          <Link to="/dashboard" className="text-blue-400 hover:underline">
            {t('common:button.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  return <EditorApp />;
}
