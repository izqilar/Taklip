/**
 * 导出对话框（web 终端用户统一出口）
 *
 * 复用编辑器内核的 <PublishModal exportOnly />：作品卡片 hover「导出」与编辑器顶栏「导出」
 * 打开的是同一个对话框，能力完全一致 —— 图片（JPEG / PNG / WebP，指定页或长图）、
 * 视频（MP4 / WebM）以及 GIF 动图。
 *
 * ⚠️ 终端用户没有发布权限（不能发布为模板、不能生成线上访问链接），因此这里强制
 *    exportOnly：对话框内不出现「立即发布」页签。
 *
 * ⚠️ 性能：本模块静态依赖 @h5design/editor（Konva / GSAP，体积大），
 *    只能被 React.lazy 动态引入，禁止在首屏组件里静态 import。
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublishModal, services } from '@h5design/editor';
import type { ImageExportOptions } from '@h5design/editor';
import type { Project } from '@h5design/core';
import { registerEditorServices } from '@/editorServices';

// 模块求值即注入宿主服务（幂等）：PublishModal 内的图片导出走 services.exportImage
registerEditorServices();

export interface ExportWorkTarget {
  id: string;
  title: string;
  /** 完整作品 Schema（ProjectListItem.schema 已带回来，无需二次请求） */
  schema: unknown;
}

interface ExportWorkDialogProps {
  target: ExportWorkTarget | null;
  onClose: () => void;
}

function extOf(format: string): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportWorkDialog({ target, onClose }: ExportWorkDialogProps) {
  const { t } = useTranslation(['common', 'publish']);
  const [busy, setBusy] = useState(false);

  // PublishModal 需要一个完整 Project 用于右侧预览与本地视频/GIF 导出
  const project = useMemo<Project | null>(() => {
    if (!target || !target.schema) return null;
    return target.schema as Project;
  }, [target]);

  const handleExport = useCallback(
    async (opts: ImageExportOptions) => {
      if (!target) return;
      if (busy) return;
      setBusy(true);
      try {
        if (!services.exportImage) {
          alert(t('publish:exportImageFail'));
          return;
        }
        const r = await services.exportImage({
          projectId: target.id,
          page: opts.page,
          mode: opts.mode,
          format: opts.format,
        });
        const suffix = opts.mode === 'all' ? '-长图' : `-${opts.page + 1}`;
        saveBlob(r.blob, `${target.title || 'h5'}${suffix}.${extOf(opts.format)}`);
        if (!r.licensed && r.missing?.length) {
          alert(
            `本次导出为「试用版」（含水印、分辨率已降级）。\n\n原因：使用到未授权付费字体 ${r.missing.join(
              '、',
            )}。\n购买包含该字体的付费模板后，即可导出高清无水印版本。`,
          );
        }
      } catch (err) {
        console.warn('[export-work] 服务端导出失败：', err);
        alert(t('publish:exportImageFail'));
      } finally {
        setBusy(false);
      }
    },
    [busy, target, t],
  );

  if (!target || !project) return null;

  return (
    <PublishModal
      open
      onClose={busy ? () => undefined : onClose}
      projectId={target.id}
      project={project}
      currentPage={0}
      onExport={handleExport}
      exportOnly
    />
  );
}
