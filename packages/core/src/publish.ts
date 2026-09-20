/**
 * 发布管线共享纯函数（方案 A draft/live 单点真源）
 *
 * 这些函数被以下四处复用，避免「草稿优先取稿 / 发布消毒 / publishCode 生成策略」
 * 在多个后端与前端实现里各写一遍而漂移：
 *   - apps/server/src/project/project.service.ts        （列表/详情取稿）
 *   - apps/server/src/publish/publish.service.ts        （web 端发布）
 *   - apps/server/src/console/provider-console.controller.ts （运营端模板上架 / 作品发布）
 *   - packages/editor 及 apps/web、apps/admin 的 editorServices.ts（前端取稿渲染）
 *
 * 纯函数、零运行时依赖（不引入 node crypto），浏览器与 Node 同构可用。
 */

import type { Project } from './schema';
import { sanitizeSchema } from './sanitize';

/**
 * 取「有效 schema」：草稿优先于线上。
 * 用于只读页 / 编辑器加载等「取当前应展示的稿子」场景（不做消毒，保持原样返回）。
 *
 * @param draft 草稿稿（Project.draftSchema）
 * @param live  线上稿（Project.schema）
 * @returns draft 为对象时返回 draft，否则返回 live
 */
export function effectiveSchema(draft?: unknown, live?: unknown): unknown {
  return draft && typeof draft === 'object' ? draft : live;
}

/**
 * 发布用「消毒后线上 schema」：先取有效稿（草稿优先），再跑统一消毒。
 * 发布闸口（双闸口之二）三端共用，确保落到数据库 / 只读页的 schema 一致且安全。
 */
export function buildPublishedSchema(draft?: unknown, live?: unknown): Project {
  return sanitizeSchema(effectiveSchema(draft, live) as unknown as Project);
}

/**
 * 是否应生成新 publishCode：仅首次发布（状态非 published）才生成，
 * 重复发布沿用旧码以保持 /p/ 链接稳定。返回 true 表示需要新生成。
 *
 * 注：码本身的随机生成（randomBytes）留在服务端，这里只抽取「决策」逻辑以便单测。
 */
export function shouldRegeneratePublishCode(status?: string | null): boolean {
  return status !== 'published';
}
