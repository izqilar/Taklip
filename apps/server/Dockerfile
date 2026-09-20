# H5 后端（NestJS）多阶段构建
# 构建上下文：仓库根目录（monorepo workspace）
# 用法：docker build -f apps/server/Dockerfile -t h5design-server .

# ---- 1. 依赖安装 ----
FROM node:18-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY apps/server/package.json apps/server/package.json
RUN pnpm install --frozen-lockfile

# ---- 2. 构建 ----
FROM deps AS builder
WORKDIR /app
COPY packages/core packages/core
COPY apps/server apps/server
RUN pnpm --filter @h5design/core build
RUN pnpm --filter @h5design/server build
# 生成 Prisma Client（运行时依赖，nest build 不会自动生成）
RUN pnpm --filter @h5design/server exec prisma generate

# ---- 3. 运行时 ----
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY apps/server/package.json apps/server/package.json
COPY package.json ./package.json
EXPOSE 3000
CMD ["node", "apps/server/dist/main.js"]
