/**
 * 内核对外/对内复用的最小类型集合。
 *
 * 这些类型原本定义在 web 的 `api/client.ts` 中；由于 client 被站内 11 处
 * 非编辑器模块引用而不能随内核搬迁（见文档 §0-D3），这里只搬"编辑器真正用到的"
 * 那几个类型，保持内核与 web API 层零耦合。
 */

/** 发布结果（web=发布 Project 得到 publishCode；运营端=草稿替换线上后返回） */
export interface PublishResult {
  publishCode: string;
  url: string;
}
