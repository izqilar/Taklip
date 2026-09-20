/**
 * 编辑器内核（@h5design/editor）宿主适配层注入（运营端 / admin）。
 *
 * 运营端画布编辑的是「服务商模板（Template）」，与 web 端操作 Project 语义不同：
 * - updateProject  →  PUT  /api/provider/services/:id/draft      （方案 A：仅写草稿 draftSchema，不动线上）
 * - publish        →  POST /api/provider/services/:id/publish    （原子替换线上 schema + 清草稿 + liveVersion+1）
 * - uploadAsset    →  POST /api/assets/upload
 * - getSystemMusic →  GET  /api/music/system
 * - listAssets     →  GET  /api/assets?type=
 * - createProject / listVersions / rollback：运营端编辑既有模板，无对应语义，占位（模板流不会触发）。
 *
 * ⚠️ 性能注意：本模块静态依赖 `@h5design/editor`（内含 Konva/GSAP，体积很大）。
 * **不要**在 `main.tsx` 等入口处导入它 —— 那样会把整个内核打进首屏 chunk，
 * 导致登录页等无关页面也要下载整包。只允许在已 code-split 的编辑器宿主页
 * （`pages/providerDetailPages/SPTemplateEditor.tsx`）中调用 `registerEditorServices()`。
 */
import { setEditorServices } from '@h5design/editor';
import type { FontMeta } from '@h5design/core';
import { setFontCatalog, ensureFontsByFamilies, getFontCatalog } from '@h5design/core';
import { API_URL, authHeaders } from './utility';
import { withSubject } from './providers/dataProvider';

async function authedFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
    ...authHeaders(),
  };
  // 字符串 body 默认按 JSON 发送：浏览器 fetch 对字符串 body 的默认 Content-Type 是
  // text/plain，NestJS 的 JSON parser 会跳过解析 → 服务端收到空 body（曾致
  // 「projectId 必填」400，导出图片报「导出失败，请重试」）。
  if (typeof init.body === 'string' && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    let msg = `请求失败 ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) msg = body.message;
    } catch {
      /* ignore parse error */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** 二进制响应请求（服务端导出图片/视频）：带鉴权，返回 Blob */
async function authedFetchBlob(path: string, body: unknown): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `请求失败 ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.blob();
}

let fontsBootstrapped = false;

/** 拉取字体目录并注册（幂等，失败静默降级为系统字体） */
async function bootstrapFonts(): Promise<void> {
  if (fontsBootstrapped) return;
  fontsBootstrapped = true;
  try {
    const list = await authedFetch<FontMeta[]>('/fonts');
    setFontCatalog(list);
    await ensureFontsByFamilies(list.map((f) => f.family));
  } catch {
    /* 字体目录不可用时静默降级为系统字体 */
  }
}

/** 注入运营端编辑器服务实现（须在 <EditorApp/> 挂载前调用）
 *  kind: 'template'（默认）= 编辑服务商模板，保存到 /provider/services/:id/draft
 *        'work'     = 编辑个人作品，保存到 /provider/works/:id/draft
 *
 * ⚠️ 必须「每次调用都按当前 kind 重注册」：模板/作品编辑器切换时，
 * 确保 draftPath/publishPath 与 publish 回退链接随 kind 正确切换，
 * 不会因模块级 registered 粘性缓存而调错后端路由。字体 bootstrap 仍保持幂等。 */
export function registerEditorServices(kind: 'template' | 'work' = 'template'): void {
  const isWork = kind === 'work';
  // withSubject：ADMIN 视察视角（用户/服务商视角编辑被视察对象的作品/模板）时
  // 自动追加 ?subject=，与服务端 subjectId 的归属解析口径一致，否则保存/发布 404。
  const draftPath = (id: string) =>
    withSubject(isWork ? `/provider/works/${id}/draft` : `/provider/services/${id}/draft`);
  const publishPath = (id: string) =>
    withSubject(isWork ? `/provider/works/${id}/publish` : `/provider/services/${id}/publish`);

  setEditorServices({
    uploadAsset: async (file, dims) => {
      const form = new FormData();
      form.append('file', file);
      const qs = dims ? `?width=${dims.width}&height=${dims.height}` : '';
      const res = await fetch(`${API_URL}/assets/upload${qs}`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) throw new Error(`素材上传失败 ${res.status}`);
      const data = await res.json();
      return { url: data.url, id: data.id, width: data.width, height: data.height };
    },

    // 保存草稿（draft/live 分离）：内核传 { schema }，仅写入 draftSchema，不影响线上版本
    updateProject: async (id, data) => {
      return authedFetch(draftPath(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: (data as { schema?: unknown })?.schema }),
      });
    },

    // 运营端编辑既有模板，无「通过编辑器新建模板」语义
    createProject: async () => {
      throw new Error('运营端暂不支持通过编辑器新建模板');
    },

    // 历史版本/回滚：运营端模板以 liveVersion 表达版本，内核版本列表暂无对应后端
    listVersions: async () => [],
    rollback: async () => {
      throw new Error('运营端暂不支持版本回滚');
    },

    // 发布：草稿原子替换线上 schema，并清除草稿（APPROVED 再发布免审直接替换）
    // 运营端发布的是 Template（母版），没有 /p/ 公开 H5 路由，因此补一个稳定的
    // publishCode（用模板 id）并给出运营端内可用的跳转链接，避免 PublishModal 渲染成 /p/undefined。
    publish: async (projectId) => {
      const resp = (await authedFetch(publishPath(projectId), {
        method: 'POST',
      })) as Record<string, unknown>;
      return {
        ...resp,
        // 模板侧无公开 /p/ 路由，回退到运营端内编辑链接；作品侧使用服务端返回的 url。
        url: isWork ? (resp.url as string) : `/sp/templates/${projectId}/editor`,
      };
    },

    getSystemMusic: async () => {
      return authedFetch<unknown[]>('/music/system');
    },

    listAssets: async (kind) => {
      return authedFetch<unknown[]>(`/assets?type=${encodeURIComponent(kind)}`);
    },

    // 字体目录（自定义 / 艺术字体）：拉取后写入 core 的运行时目录，供字体选择器动态渲染
    listFonts: async () => {
      await bootstrapFonts();
      return getFontCatalog();
    },

    // 服务端导出（硬门槛）：目前仅「作品(work)」有 Project 实体可导出；
    // 模板(template)尚未提供服务端导出，明确提示而非静默失败。
    getFontLicense: async (_schema, projectId) => {
      if (!isWork || !projectId) return { watermark: false, missing: [] };
      const prep = await authedFetch<{ licensed: boolean; missing: string[] }>(
        withSubject('/export/prepare', 'POST'),
        { method: 'POST', body: JSON.stringify({ projectId, source: 'draft' }) },
      );
      return { watermark: !prep.licensed, missing: prep.missing ?? [] };
    },
    exportImage: async ({ page, mode, format, projectId }) => {
      if (!isWork) throw new Error('模板暂不支持服务端导出，请先由使用该模板生成作品');
      const prep = await authedFetch<{
        token: string;
        licensed: boolean;
        missing: string[];
      }>(withSubject('/export/prepare', 'POST'), {
        method: 'POST',
        body: JSON.stringify({ projectId, source: 'draft' }),
      });
      const blob = await authedFetchBlob('/export/image', {
        token: prep.token,
        page,
        mode,
        format,
      });
      return { blob, licensed: prep.licensed, missing: prep.missing ?? [] };
    },
    exportVideo: async ({ projectId, secondsPerPage }) => {
      if (!isWork) throw new Error('模板暂不支持服务端导出，请先由使用该模板生成作品');
      const prep = await authedFetch<{ token: string; licensed: boolean; missing: string[] }>(
        withSubject('/export/prepare', 'POST'),
        { method: 'POST', body: JSON.stringify({ projectId, source: 'draft' }) },
      );
      const blob = await authedFetchBlob('/export/video', {
        token: prep.token,
        secondsPerPage,
      });
      return { blob, licensed: prep.licensed, missing: prep.missing ?? [] };
    },
  });

  // 拉取并注册字体（失败静默降级）
  void bootstrapFonts();
}
