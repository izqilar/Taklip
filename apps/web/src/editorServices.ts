/**
 * 编辑器内核（@h5design/editor）宿主适配层注入（web 端）。
 *
 * 内核是持久化无关的：它只声明 EditorServices 契约，具体实现由宿主在挂载前注入。
 * 这里把 web 的 `api/client` 方法映射进去，使内核在 web 端操作 Project。
 * 运营端会注入另一套实现（Template 草稿/发布），见 docs/editor-shared-kernel-refactor.md §5。
 *
 * ⚠️ 性能注意：本模块静态依赖 `@h5design/editor`（内含 Konva/GSAP，体积很大）。
 * **不要**在 `main.tsx` 等入口处导入它 —— 那样会把整个内核打进首屏 chunk。
 * 只在编辑器路由（`pages/Editor.tsx`，已 code-split）中调用 `registerEditorServices()`。
 */
import { setEditorServices } from '@h5design/editor';
import type { FontMeta } from '@h5design/core';
import { setFontCatalog, ensureFontsByFamilies, getFontCatalog } from '@h5design/core';
import { api } from '@/api/client';

let registered = false;

/**
 * 字体目录拉取（并发去重，每次调用都重新拉取 → 保证「目录即真相」）。
 * 旧实现用模块级 `fontsBootstrapped` 只拉一次，导致增删字体文件后下拉列表不刷新；
 * 这里改为每次都重新请求后端（后端 list 已改为实时扫描目录），in-flight 去重避免并发重复拉。
 * 字体文件由服务端托管在 /uploads/fonts/，前端只认 URL。
 */
let fontsInflight: Promise<void> | null = null;
async function bootstrapFonts(): Promise<void> {
  if (fontsInflight) return fontsInflight;
  fontsInflight = (async () => {
    try {
      const list = (await api.fonts()) as FontMeta[];
      setFontCatalog(list);
      await ensureFontsByFamilies(list.map((f) => f.family));
    } catch {
      /* 字体目录不可用时静默降级为系统字体 */
    }
  })().finally(() => {
    fontsInflight = null;
  });
  return fontsInflight;
}

/** 注入 web 端编辑器服务实现（幂等；须在 <EditorApp/> 挂载前调用） */
export function registerEditorServices(): void {
  if (registered) return;
  registered = true;
  setEditorServices({
    uploadAsset: async (file, dims) => {
      const r = await api.uploadAsset(
        file,
        dims ? { width: dims.width, height: dims.height } : undefined,
      );
      return { url: r.url, id: r.id };
    },
    // 编辑器「保存」= 写草稿（draftSchema），不触碰线上 schema（方案 A draft/live）
    updateProject: (id, data) =>
      api.saveProjectDraft(id, data as Parameters<typeof api.saveProjectDraft>[1]),
    createProject: (title, templateId) => api.createProject(title, templateId),
    listVersions: (projectId) => api.listVersions(projectId),
    rollback: (projectId, versionId) => api.rollback(projectId, versionId),
    publish: (projectId) => api.publish(projectId),
    getSystemMusic: () => api.getSystemMusic(),
    listAssets: (kind) => api.listAssets(kind),

    // 字体目录（自定义 / 艺术字体）：拉取后写入 core 的运行时目录，供字体选择器动态渲染
    listFonts: async () => {
      await bootstrapFonts();
      return getFontCatalog();
    },

    // 服务端导出（硬门槛）：先 prepare 做字体授权判定，再取二进制。
    // 分辨率与水印完全由服务端决定，客户端无法通过改代码绕过。
    getFontLicense: async (_schema, projectId) => {
      if (!projectId) return { watermark: false, missing: [] };
      const prep = await api.exportPrepare(projectId, 'draft');
      return { watermark: !prep.licensed, missing: prep.missing ?? [] };
    },
    exportImage: async ({ page, mode, format, projectId }) => {
      const prep = await api.exportPrepare(projectId, 'draft');
      const blob = await api.exportImage({ token: prep.token, page, mode, format });
      return { blob, licensed: prep.licensed, missing: prep.missing ?? [] };
    },
    exportVideo: async ({ projectId, secondsPerPage }) => {
      const prep = await api.exportPrepare(projectId, 'draft');
      const blob = await api.exportVideo({ token: prep.token, secondsPerPage });
      return { blob, licensed: prep.licensed, missing: prep.missing ?? [] };
    },
  });

  // 拉取并注册字体（幂等、失败静默降级）
  void bootstrapFonts();
}
