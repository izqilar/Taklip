/**
 * 预览模态框 — 使用 DOM 渲染器展示发布态效果
 * 支持设备切换（手机/平板/PC）
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@h5design/core';
import DOMRenderer from './DOMRenderer';
import MusicPlayer from './MusicPlayer';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export default function PreviewModal({ open, onClose, project }: PreviewModalProps) {
  const { t } = useTranslation(['publish']);
  const [device, setDevice] = useState('mobile');
  const [page, setPage] = useState(0);

  if (!open) return null;

  const DEVICES = [
    { key: 'mobile', name: t('publish:deviceMobile'), width: 375, height: 667 },
    { key: 'tablet', name: t('publish:deviceTablet'), width: 768, height: 1024 },
    { key: 'pc', name: t('publish:deviceDesktop'), width: 1024, height: 768 },
  ];

  const dev = DEVICES.find((d) => d.key === device)!;
  const maxW = 500;
  const maxH = 600;
  const scaleX = maxW / dev.width;
  const scaleY = maxH / dev.height;
  const scale = Math.min(scaleX, scaleY, 1);

  const settings = project.settings ?? ({} as Project['settings']);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80"
      onClick={onClose}
    >
      {/* 顶部工具栏 */}
      <div
        className="flex items-center justify-between px-6 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-lg font-medium text-white">{t('publish:previewTitle')}</span>
        <div className="flex items-center gap-4">
          {/* 设备切换 */}
          <div className="flex gap-2">
            {DEVICES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDevice(d.key)}
                className={`rounded-lg px-3 py-1 text-sm transition ${
                  device === d.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
          {/* 关闭 */}
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-700 px-3 py-1 text-sm text-gray-300 transition hover:bg-gray-600"
          >
            {t('publish:close')}
          </button>
        </div>
      </div>

      {/* 预览区 */}
      <div
        className="flex flex-1 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: dev.width * scale,
            height: dev.height * scale,
          }}
          className="relative overflow-hidden rounded-lg border-2 border-gray-600 bg-white"
        >
          <DOMRenderer project={project} currentPage={page} scale={scale} />
          <MusicPlayer
            music={settings.backgroundMusic}
            autoPlay={!settings.closeBackgroundMusic}
            hidden={settings.hideMusicIcon}
          />
        </div>
      </div>

      {/* 底部翻页 */}
      {project.pages.length > 1 && (
        <div
          className="flex items-center justify-center gap-2 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg bg-gray-700 px-3 py-1 text-sm text-white disabled:opacity-30"
          >
            {t('publish:prevPage')}
          </button>
          <span className="text-sm text-gray-300">
            {page + 1} / {project.pages.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(project.pages.length - 1, p + 1))}
            disabled={page === project.pages.length - 1}
            className="rounded-lg bg-gray-700 px-3 py-1 text-sm text-white disabled:opacity-30"
          >
            {t('publish:nextPage')}
          </button>
        </div>
      )}
    </div>
  );
}
