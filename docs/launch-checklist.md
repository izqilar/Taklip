# H5 在线设计平台 — 上线 Checklist（P4）

> 阶段：P4 优化上线（对应 standard-dev-doc.md §6.2 M5）
> 用途：发布到生产环境前的逐项核对清单。✔ 表示已在 P4 实现，⏳ 表示需运维/外部资源配合。

## 1. 安全审计

| 项 | 状态 | 说明 |
|----|------|------|
| XSS — 外链/媒体 URL 协议白名单 | ✔ | `apps/web/src/utils/sanitize.ts`：`safeLink`/`safeMedia` 仅放行 http/https/mailto/tel/data:image，拦截 `javascript:` 等；已接入 `DOMRenderer` 的 button/image/video |
| XSS — React 默认转义 | ✔ | 文本/属性经 React 渲染自动转义，未使用 `dangerouslySetInnerHTML` |
| 上传安全 — MIME 收紧 | ✔ | `asset.controller.ts` 仅允许位图（jpg/png/gif/webp），**已移除 svg**（SVG 可执行脚本，构成存储型 XSS） |
| 上传安全 — 文件名/路径 | ✔ | multer `diskStorage` 用服务端生成文件名（时间戳+随机），无路径穿越 |
| 响应头 — 防点击劫持/嗅探 | ✔ | `main.ts` 全局设置 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Content-Security-Policy` |
| CSRF | ✔（不适用） | 鉴权使用 JWT Bearer（无 Cookie），CSRF 风险低；前端调用同源 `/api` |
| 限流 — 防爆破 | ✔ | `common/guards/rate-limit.guard.ts`：register 5/min、login 10/min、refresh 20/min、publish 10/min，超限返回 429 |
| 输入校验 | ✔ | `auth.dto.ts` 手机号正则 + 密码 6–64 位；全局 `ValidationPipe` 保留 `whitelist:false/transform:false`（作品 schema 为任意 JSON，见 P3 记录） |
| SQL 注入 | ✔ | 全部经 Prisma 参数化；唯一原生 SQL（`publish.service.ts` 访问量自增）使用 `$1` 占位绑定 |

## 2. 性能优化

| 项 | 状态 | 说明 |
|----|------|------|
| 自动保存防抖 + 节流 | ✔ | `EditorApp.tsx`：停止编辑 3s 防抖保存；距上次保存 <8s 则延后；30s 兜底定时 + 失焦立即保存 |
| 画布渲染优化 | ✔ | `EditorCanvas.tsx`：Konva 节点加 `perfectDrawEnabled=false`/`shadowForStrokeEnabled=false`，降低重绘开销 |
| 仅渲染当前页 | ✔（既有） | 多页作品只渲染 active page |
| 大作品分块加载 | ⏳ | 超多元素场景建议后续分页/虚拟列表（本次未做） |

## 3. 环境变量与配置

- [ ] 复制 `.env.example` 为 `.env`，填写真实 `JWT_SECRET`/`JWT_REFRESH_SECRET`（强随机）
- [ ] `DATABASE_URL` 指向生产 PostgreSQL（compose 自动拼接）
- [ ] 生产 `NODE_ENV=production`
- [ ] COS 配置（发布静态包，可选）
- [ ] `SENTRY_DSN`（监控，可选，见 `observability/sentry.config.example.ts`）

## 4. 数据库与备份

- [ ] 生产库开启定期备份（pg_dump / 托管快照）
- [ ] 迁移脚本（`prisma migrate`）在预发环境验证通过
- [ ] 回滚方案：保留上一镜像 tag，异常时 `docker compose up -d` 回退

## 5. 部署（生产）

- [ ] `docker compose -f docker-compose.prod.yml up -d --build` 成功
- [ ] `GET /api/health` 返回 `{"status":"ok","db":"up",...}`
- [ ] 前端 Nginx：`/api` 反代到 backend、`/uploads` 反代、SPA fallback、gzip 生效
- [ ] HTTPS / 域名：在边缘 Nginx/Traefik 终止 TLS，配置 HSTS
- [ ] CDN：静态产物与发布包走 COS + CDN 加速

## 6. 监控与告警

- [ ] 健康检查探针接入负载均衡 / K8s liveness
- [ ] 结构化访问日志（`main.ts` 请求日志中间件）接入日志收集
- [ ] Sentry（错误上报）按 §3 接入（当前为占位）
- [ ] Redis（会话/缓存）当前代码未接入，预留容器；如需启用需补充代码与 `REDIS_*` 配置

## 7. 验收标准（M5）

- [ ] 安全审计通过（XSS/CSRF/SQLi/限流/上传）
- [ ] 核心路径压测达标（k6 脚本见 `deploy/load-test.js`，目标 1000 并发需按资源调整）
- [ ] 生产环境稳定运行，健康检查正常
