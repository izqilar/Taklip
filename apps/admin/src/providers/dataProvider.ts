import type { DataProvider } from '@refinedev/core';
import { API_URL, getStoredUser, authHeaders } from '../utility';
import { getSubject } from './scopeStore';

/**
 * 视察窗口 subject 注入：ADMIN 在服务商/代理商/用户视角下选定被视察对象后，
 * 对 provider/* 与 wallet/* 的 GET 请求追加 ?subject=<id>，使总台视察窗口看到的数据
 * 与被视察账号登录后看到的数据严格一致（后端 InspectSubjectGuard 据此改写作用域）。
 * 仅 ADMIN + 只读 GET 生效；SP/Agent/User 自身登录不带 subject，走各自的 req.user.id。
 * 注意：
 *  - api/messages/audit（权威公告审核队列）属总台职能，不注入 subject。
 *  - 用户视角(user/*)的各页面本身通过 useScopeUserId() 把 subject 作为 userId 查询参数下发，
 *    故此处【不要】再注入 ?userId=，否则会与页面参数重复成数组导致后端解析失败。
 */
/**
 * 视察窗口 subject 注入（导出复用）：
 * 除 dataProvider 自身外，编辑器宿主页（SPWorkEditor / SPTemplateEditor 的裸 fetch）
 * 与内核服务层（editorServices 的 draft/publish 路径）也必须走同一口径，
 * 否则 ADMIN 视察视角下「列表能看到、编辑加载 404」。
 *
 * @param method 请求方法（默认 GET）。GET 注入 provider|wallet|export 与 messages；
 *        写操作（POST/PUT/PATCH/DELETE）仅注入 provider|export —— 服务端这些端点
 *        通过 subjectId(req, subject) 以显式 subject 解析归属（发布/取消发布/删作品/
 *        升级为服务/保存草稿/导出），使 ADMIN 视察视角可代被视察对象执行操作。
 */
export function withSubject(path: string, method?: string): string {
  const role = getStoredUser<{ role?: string }>()?.role;
  const subject = getSubject();
  if (role === 'ADMIN' && subject) {
    const p = path.replace(/^\//, '');
    const isGet = (method ?? 'GET').toUpperCase() === 'GET';
    const matched = isGet
      ? /^(provider|wallet|export)\//.test(p) || p === 'messages'
      : /^(provider|export)\//.test(p);
    if (matched) {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}subject=${encodeURIComponent(subject)}`;
    }
  }
  return path;
}

/**
 * 响应解析 + 错误规范化。
 *
 * 抛出的错误**必须带上 statusCode 与 url**：
 *  - statusCode：authProvider.onError 据此识别 401（会话过期）并跳登录；页面也据此
 *    判断 404 特殊态（如「钱包未创建」空态，见 consolePages SPWallet）。
 *    若只抛裸 Error，页面拿不到状态码，只能按字符串猜。
 *  - url：用于把「权限探测」请求从 401 登出逻辑里豁免掉（见 authProvider.onError）。
 */
async function parse(res: Response, url?: string): Promise<any> {
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join('; ')
      : body?.message || `请求失败 (${res.status})`;
    const err = new Error(message) as Error & { statusCode?: number; url?: string };
    err.statusCode = res.status;
    if (url) err.url = url;
    throw err;
  }
  return body;
}

/**
 * 通用 dataProvider：resource 名即后端路由路径（如 "admin/users"）。
 * 后端列表返回 { total, items }，详情/写操作返回裸对象（或 { data }）。
 */
export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async ({ resource, pagination, filters }) => {
    const query = new URLSearchParams();
    if (pagination) {
      const p = pagination as { current?: number; pageSize?: number; mode?: string };
      query.set('page', String(p.current ?? 1));
      query.set('pageSize', String(p.pageSize ?? 10));
    }
    (filters ?? []).forEach((f: any) => {
      if (f.value == null || f.value === '') return;
      if (f.operator === 'contains' || f.operator === 'eq') {
        query.set(f.field, String(f.value));
      }
    });
    const listUrl = withSubject(`${resource}?${query.toString()}`);
    const res = await fetch(`${API_URL}/${listUrl}`, { headers: authHeaders() });
    const body = await parse(res, `${API_URL}/${listUrl}`);
    const data: any[] = Array.isArray(body) ? body : body.items ?? body.data ?? [];
    const total: number = typeof body.total === 'number' ? body.total : data.length;
    return { data, total };
  },

  getOne: async ({ resource, id }) => {
    const oneUrl = withSubject(`${resource}/${id}`);
    const res = await fetch(`${API_URL}/${oneUrl}`, { headers: authHeaders() });
    const body = await parse(res, `${API_URL}/${oneUrl}`);
    return { data: body.data ?? body };
  },

  getMany: async () => ({ data: [] }),

  create: async ({ resource, variables }) => {
    // 写操作同样要注入 subject：ADMIN 视察视角下「新建」归属必须落到被视察对象，
    // 否则会静默创建在 ADMIN 名下（列表看不到、被视察对象也看不到）。
    const url = withSubject(resource, 'POST');
    const res = await fetch(`${API_URL}/${url}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(variables),
    });
    const body = await parse(res, `${API_URL}/${url}`);
    return { data: body.data ?? body };
  },

  update: async ({ resource, id, variables }) => {
    // 同上：更新也要按被视察对象归属执行。
    const url = withSubject(`${resource}/${id}`, 'PATCH');
    const res = await fetch(`${API_URL}/${url}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(variables),
    });
    const body = await parse(res, `${API_URL}/${url}`);
    return { data: body.data ?? body };
  },

  deleteOne: async () => {
    throw new Error('该后台不支持删除用户');
  },

  custom: async ({ url, method, payload, headers }) => {
    // 写操作同样注入 subject（provider/export 域）：ADMIN 视察视角下发布/删除/升级/
    // 导出按被视察对象归属执行；非视察登录（SP/USER 自身）getSubject() 为空，不受影响。
    const finalUrl = withSubject(url, method);
    const res = await fetch(`${API_URL}/${finalUrl}`, {
      // 统一大写：fetch 仅对 GET/HEAD/POST/PUT/DELETE/OPTIONS 自动规范，
      // 小写的 'patch' 原样发送会导致浏览器 CORS 方法比对（大小写敏感）失败，抛 "Failed to fetch"。
      method: (method ?? 'GET').toUpperCase(),
      headers: { ...authHeaders(), 'Content-Type': 'application/json', ...(headers ?? {}) },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await parse(res, `${API_URL}/${finalUrl}`);
    return { data: body };
  },
};
