/**
 * 宿主适配层（EditorServices）
 *
 * 编辑器内核是"持久化无关"的：它不知道自己跑在 web 端（客户定制，操作 Project）
 * 还是运营端（服务商画布，操作 Template 草稿）。所有与后端交互的能力都由宿主应用在
 * 挂载编辑器前通过 `setEditorServices(...)` 注入。
 *
 * 这样做的原因（见 docs/editor-shared-kernel-refactor.md §0-D3）：
 * web 的 `api/client.ts` 被站内 11 处非编辑器模块引用，无法随内核搬迁；
 * 运营端的保存/发布语义又完全不同（草稿 vs 线上），必须可替换。
 *
 * 未注入时调用会抛出明确错误，而不是静默失败。
 */

import type { FontMeta } from '@h5design/core';

export interface UploadedAsset {
  url: string;
  id?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface EditorServices {
  /** 上传图片/音频等素材 */
  uploadAsset(file: File, dims?: { width: number; height: number }): Promise<UploadedAsset>;
  /** 更新制品（web=Project；运营端=Template 草稿） */
  updateProject(id: string, data: Record<string, unknown>): Promise<unknown>;
  /** 新建制品（返回新建后的制品 id） */
  createProject(title: string, templateId?: string): Promise<{ id: string }>;
  /** 历史版本列表 */
  listVersions(projectId: string): Promise<{ id: string; createdAt: string }[]>;
  /** 回滚到指定历史版本（返回回滚后的制品，含 schema） */
  rollback(projectId: string, versionId: string): Promise<any>;
  /** 发布（web=发布 Project；运营端=草稿替换线上 schema），返回发布结果 */
  publish(projectId: string): Promise<any>;
  /** 系统背景音乐库（web 端来自服务端；运营端可定制） */
  getSystemMusic(): Promise<any[]>;
  /** 列出用户已上传素材（kind: 'audio' | 'image' | 'video' …） */
  listAssets(kind: string): Promise<any[]>;
  /** 拉取字体目录（自定义 / 艺术字体），用于字体选择器动态渲染；未注入返回 [] */
  listFonts?(): Promise<FontMeta[]>;
  /** 查询当前作品的字体授权状态（预览 / 本地兜底导出的水印判据）；未注入返回 { watermark:false } */
  getFontLicense?(
    schema: unknown,
    projectId?: string,
  ): Promise<{ watermark: boolean; missing?: string[] }>;
  /**
   * 服务端导出图片（导出硬门槛的唯一正确入口）。
   * 返回 Blob + 服务端给出的授权结果；未注入时内核会回退到本地客户端导出。
   */
  exportImage?(opts: {
    projectId: string;
    page: number;
    mode: 'current' | 'all';
    format: 'png' | 'jpeg' | 'webp';
  }): Promise<{ blob: Blob; licensed: boolean; missing: string[] }>;
  /** 服务端导出视频（逐页截图 + ffmpeg 合成） */
  exportVideo?(opts: {
    projectId: string;
    secondsPerPage?: number;
  }): Promise<{ blob: Blob; licensed: boolean; missing: string[] }>;
}

const notInjected =
  (name: string) =>
  (..._args: unknown[]): never => {
    throw new Error(
      `[@h5design/editor] EditorServices.${name} 未注入：宿主应用需在挂载编辑器前调用 setEditorServices({...})`,
    );
  };

let current: EditorServices = {
  uploadAsset: notInjected('uploadAsset') as EditorServices['uploadAsset'],
  updateProject: notInjected('updateProject') as EditorServices['updateProject'],
  createProject: notInjected('createProject') as EditorServices['createProject'],
  listVersions: notInjected('listVersions') as EditorServices['listVersions'],
  rollback: notInjected('rollback') as EditorServices['rollback'],
  publish: notInjected('publish') as EditorServices['publish'],
  getSystemMusic: notInjected('getSystemMusic') as EditorServices['getSystemMusic'],
  listAssets: notInjected('listAssets') as EditorServices['listAssets'],
};

/** 宿主注入（可多次调用，按字段覆盖） */
export function setEditorServices(next: Partial<EditorServices>): void {
  current = { ...current, ...next };
}

/** 读取当前实现（供内核内部使用，支持"导入后注入"） */
export function getEditorServices(): EditorServices {
  return current;
}

/**
 * 惰性代理：内核模块在 `import` 时就拿到 services 对象，
 * 但真正的方法在调用时才从 current 解析 —— 因此注入可以晚于导入。
 */
export const services: EditorServices = new Proxy({} as EditorServices, {
  get(_target, prop: keyof EditorServices) {
    return current[prop];
  },
});
