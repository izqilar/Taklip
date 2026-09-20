/**
 * 历史版本弹窗 — 列出作品的历史快照，支持一键回滚。
 * 每次"手动保存"会在后端生成一份版本快照（最多保留 30 份）。
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { services } from '../../services';
import { useEditorStore } from '../../store/editorStore';

interface VersionMeta {
  id: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
}

export default function VersionHistoryModal({ open, onClose, projectId }: Props) {
  const { t } = useTranslation(['editor', 'common', 'errors']);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadProject = useEditorStore((s) => s.loadProject);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const list = await services.listVersions(projectId);
      setVersions(list);
    } catch (err) {
      console.error('listVersions failed:', err);
      if (!(err as Error).message?.includes('401')) {
        alert(t('errors:error.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (open && projectId) {
      fetchVersions();
    }
  }, [open, projectId, fetchVersions]);

  const handleRollback = async (versionId: string) => {
    if (!projectId) return;
    if (!window.confirm(t('editor:version.rollbackConfirm'))) return;
    setBusyId(versionId);
    try {
      const res = await services.rollback(projectId, versionId);
      // 用回滚后的 schema 重新装载编辑器（loadProject 会做字段补齐 + 重置历史）
      if (res && res.schema) {
        loadProject(res.schema as Parameters<typeof loadProject>[0], projectId);
      }
      alert(t('editor:version.restored'));
      onClose();
    } catch (err) {
      console.error('rollback failed:', err);
      alert(t('errors:error.saveFailed'));
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[420px] flex-col rounded-lg bg-gray-800 text-gray-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3 className="text-base font-bold">{t('editor:version.title')}</h3>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-gray-400 hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 主体 */}
        <div className="min-h-[160px] flex-1 overflow-y-auto px-4 py-3">
          {loading && <p className="py-8 text-center text-sm text-gray-400">{t('editor:version.loading')}</p>}
          {!loading && versions.length === 0 && (
            <p className="py-8 text-center text-sm leading-relaxed text-gray-400">
              {t('editor:version.empty')}
            </p>
          )}
          {!loading && versions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {versions.map((v, idx) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded border border-gray-700 bg-gray-900/40 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {idx === 0
                        ? t('editor:version.current')
                        : `#${versions.length - idx}`}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(v.createdAt)}</span>
                  </div>
                  <button
                    onClick={() => handleRollback(v.id)}
                    disabled={busyId === v.id || idx === 0}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyId === v.id ? t('common:status.saving') : t('editor:version.rollback')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底部 */}
        <div className="border-t border-gray-700 px-4 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded border border-gray-600 px-4 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700"
          >
            {t('editor:version.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 本地化时间显示（跟随浏览器区域，回退中文） */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
