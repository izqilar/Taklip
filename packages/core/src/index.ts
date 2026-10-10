export * from './schema';
export * from './constants';
export * from './transform';
export * from './sanitize';
export * from './publish';
export * from './fonts';
export * from './color';
export * from './fill';
export * from './text';
export * from './code';
export * from './money';
export * from './staff-roles';
// 批量请柬：名单字段定义（前后端单一真值）+ 个性化引擎（纯函数，服务端/浏览器共用）
export * from './guest-fields';
export * from './personalize';
export * from './textFit';

// 渲染管线归一化工具（与 @h5design/render 共享单点入口）
export { normalizeSchema, CURRENT_SCHEMA_VERSION } from './schema';
