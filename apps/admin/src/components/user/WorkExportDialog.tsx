/**
 * 运营端作品导出对话框（用户视角 · 超级管理员）。
 *
 * 复用编辑器内核的 <PublishModal exportOnly />：与 web 端「我的作品」卡片 hover「导出」
 * 打开的是同一个对话框，能力完全一致 —— 图片（JPEG / PNG / WebP，指定页或长图）、
 * 视频（MP4 / WebM）以及 GIF 动图。
 *
 * ⚠️ 终端用户/运营端没有「发布为模板 / 生成线上链接」语义，因此强制 exportOnly。
 * ⚠️ 必须按 kind='work' 注册宿主服务，使 exportImage/exportVideo 指向 /provider/works 导出端点。
 * ⚠️ 本模块静态依赖 @h5design/editor（Konva / GSAP，体积大），只能被 React.lazy 动态引入。
 */
import { useCallback, useMemo, useState } from 'react';
import { PublishModal, services } from '@h5design/editor';
import type { ImageExportOptions } from '@h5design/editor';
import type { Project } from '@h5design/core';
import { registerEditorServices } from '../../editorServices';

registerEditorServices('work');

export interface WorkExportTarget {
  id: string;
  title: string;
  /** 完整作品 Schema（列表行已带回来，无需二次请求） */
  schema: unknown;
}

interface WorkExportDialogProps {
  target: WorkExportTarget | null;
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

export default function WorkExportDialog({ target, onClose }: WorkExportDialogProps) {
  const [busy, setBusy] = useState(false);

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
          window.alert('导出失败：导出服务不可用');
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
          window.alert(
            `本次导出为「试用版」（含水印、分辨率已降级）。\n\n原因：使用到未授权付费字体 ${r.missing.join(
              '、',
            )}。`,
          );
        }
      } catch (err) {
        console.warn('[admin-export-work] 服务端导出失败：', err);
        window.alert('导出失败，请重试');
      } finally {
        setBusy(false);
      }
    },
    [busy, target],
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
