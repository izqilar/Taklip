/**
 * Sentry 接入点（示例占位，未实际接入，避免引入外部依赖）。
 *
 * 生产环境接入步骤：
 * 1. 安装依赖：npm i @sentry/node
 * 2. 在 main.ts 顶部、创建 app 之前初始化：
 *      import * as Sentry from '@sentry/node';
 *      if (process.env.SENTRY_DSN) {
 *        Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
 *      }
 * 3. 在路由中间件之前挂载请求处理器、在之后挂载错误处理器：
 *      app.use(Sentry.Handlers.requestHandler());
 *      app.use(Sentry.Handlers.errorHandler());
 * 4. 在 .env 配置 SENTRY_DSN（见 .env.example）。
 *
 * 注意：本沙箱不实际接入 Sentry；此文件仅作为接入点与配置约定占位。
 */
export const SENTRY_DSN = process.env.SENTRY_DSN ?? '';
export const SENTRY_ENVIRONMENT = process.env.NODE_ENV ?? 'development';

// 实际接入时取消注释：
// import * as Sentry from '@sentry/node';
// if (SENTRY_DSN) {
//   Sentry.init({ dsn: SENTRY_DSN, environment: SENTRY_ENVIRONMENT });
// }
