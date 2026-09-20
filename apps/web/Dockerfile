# H5 前端（Vite 静态产物 + Nginx 托管）多阶段构建
# 构建上下文：仓库根目录
# 用法：docker build -f apps/web/Dockerfile -t h5design-web .

# ---- 1. 依赖安装 ----
FROM node:18-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# ---- 2. 构建静态产物 ----
FROM deps AS builder
WORKDIR /app
COPY packages/core packages/core
COPY apps/web apps/web
RUN pnpm --filter @h5design/core build
RUN pnpm --filter @h5design/web build

# ---- 3. Nginx 托管 ----
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
