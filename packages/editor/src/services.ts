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

import type { FontMeta, GuestFieldDef } from '@h5design/core';

export interface UploadedAsset {
  url: string;
  id?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

/**
 * 占位符注册表条目（运营端「系统设置 → 占位符管理」配置唯一真相源）。
 * 编辑器只绑定、不创建：下拉只读这些已注册项，按元素类型过滤。
 * 底层仍映射 `binding.key`，渲染内核零改动。
 */
export interface PlaceholderRegistryEntry {
  id: string;
  key: string;
  type: 'text' | 'image' | 'datetime' | 'address';
  /** 单语言标签（运营端按当前语言录入） */
  label?: string;
  /** 单语言编辑提示 */
  hint?: string;
  /** 单语言默认值 */
  defaultValue?: string;
  scope: 'record' | 'batch';
  requiredDef?: boolean;
  legacy?: boolean;
  status?: string;
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
  /**
   * 打开「图库选择器」弹窗（宿主实现，web 端为私有图库）。
   * 返回选中的素材（url + 尺寸）；取消 / 关闭返回 null。
   * 未注入时内核回退到原生文件上传（保持旧行为，运营端即此路径）。
   */
  openAssetPicker?(opts?: { kind?: 'image' | 'video' | 'audio' }): Promise<UploadedAsset | null>;
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

  /* ── 批量请柬（规范 §9.3 / §16 决策 D4：面板在编辑器内，两宿主共用） ── */

  /** 列出可选用的人员名单 */
  listGuestLists?(params?: {
    ownerType?: string;
    clientId?: string;
  }): Promise<{ id: string; name: string; recordCount: number }[]>;
  /** 分页读取名单人员 */
  listGuestRecords?(
    listId: string,
    page?: number,
    size?: number,
  ): Promise<{
    listId: string;
    page: number;
    size: number;
    total: number;
    /** 名单字段定义（名单创建时快照的模板字段，如婚礼模板为 ext_husband/ext_wife）；人员名单弹窗据此渲染表头与取数 */
    columnDefs?: GuestFieldDef[];
    records: { id: string; seq: number; data: Record<string, string | null> }[];
  }>;
  /** 创建/复用批量渲染项目（模板 + 名单） */
  createBatchProject?(payload: {
    templateId: string;
    listId: string;
    ownerType?: string;
    clientId?: string;
  }): Promise<{ id: string; state: string; remaining: number; locked: boolean }>;
  /** 读取项目状态与配额 */
  getBatchProject?(projectId: string): Promise<{
    id: string;
    state: string;
    freeRendered: number;
    paidRendered: number;
    purchasedHeadcount: number;
    totalRenderable: number;
    alreadyRendered: number;
    remaining: number;
    locked: boolean;
  }>;
  /** 读取当前勾选子集 */
  getGuestSelection?(projectId: string): Promise<{
    projectId: string;
    listId: string;
    selectedRecordIds: string[];
  }>;
  /** 保存勾选子集 */
  setGuestSelection?(payload: {
    projectId: string;
    listId: string;
    selectedRecordIds: string[];
  }): Promise<{ count: number }>;
  /** 发起批量渲染 */
  batchGenerate?(payload: {
    projectId: string;
    mode?: 'FREE_SAMPLE' | 'PAID' | 'RERENDER';
    targetRecordIds?: string[];
  }): Promise<{ jobId: string; total: number }>;

  /**
   * 拉取占位符注册表（只读，供编辑器绑定）。
   * 宿主实现（web/运营端各自注入 API 客户端，调用 /api/console/placeholders）。
   * 未注入时内核回落旧逻辑（GUEST_FIELD_DEFS + ext_ 自定义输入），不阻断创作。
   */
  listPlaceholders?(): Promise<PlaceholderRegistryEntry[]>;
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
