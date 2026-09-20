#!/usr/bin/env bash
# ============================================================
# H5 在线设计平台 — 开发环境启动器 (startup.sh)
# 适配 pnpm workspace monorepo: @h5design/core + web + server
#
# 流程: 依赖安装 → 起基础设施(PG/Redis) → Prisma 生成与迁移 →
#       构建 core(web 依赖其预编译 dist) → 启动开发服务
#
# 用法:
#   ./startup.sh                正常启动开发环境
#   DRY_RUN=1 ./startup.sh      只打印将执行的命令，不真正执行
#   SKIP_DOCKER=1 ./startup.sh  跳过 docker(假设 PG/Redis 已在运行)
#   SKIP_INSTALL=1 ./startup.sh 跳过 pnpm install
#   SKIP_MIGRATE=1 ./startup.sh 跳过 prisma migrate deploy
# ============================================================

set -euo pipefail

# ---------- 可覆盖的环境开关 ----------
DRY_RUN=${DRY_RUN:-0}
SKIP_DOCKER=${SKIP_DOCKER:-0}
SKIP_INSTALL=${SKIP_INSTALL:-0}
SKIP_MIGRATE=${SKIP_MIGRATE:-0}

# ---------- 输出助手 ----------
log() { echo -e "\033[1;34m==>\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }
err() { echo -e "\033[1;31m✗\033[0m $*"; }
# run: DRY_RUN 时只打印，否则真正执行
run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "    [dry-run] $*"
  else
    eval "$@"
  fi
}

# ---------- 退出时给出友好提示 ----------
cleanup() {
  if [ "$DRY_RUN" != "1" ]; then
    echo
    echo "已退出。开发服务(web/server)已停止。"
    echo "如需再次启动，重新运行: ./startup.sh"
  fi
}
trap cleanup EXIT

# ---------- 前置检查 ----------
echo "============================================="
echo "  TAKLIP 设计平台 · 开发环境启动器"
echo "============================================="

command -v node >/dev/null 2>&1 || { err "未检测到 node，请先安装 Node.js >= 18"; exit 1; }
NODE_VER=$(node -v | sed 's/v//'); log "node: v$NODE_VER"

# pnpm: 优先用已安装的，否则通过 corepack 启用
if ! command -v pnpm >/dev/null 2>&1; then
  command -v corepack >/dev/null 2>&1 || { err "未检测到 pnpm 或 corepack，请安装 pnpm@10"; exit 1; }
  log "通过 corepack 启用 pnpm@10.28.2"
  run "corepack enable"
  run "corepack prepare pnpm@10.28.2 --activate"
fi
log "pnpm: $(pnpm -v 2>/dev/null || echo '?(corepack 已激活)')"

command -v docker >/dev/null 2>&1 || { err "未检测到 docker，开发需要 PostgreSQL + Redis"; exit 1; }
log "docker: $(docker -v)"

# docker compose 命令兼容(v2 插件 / v1 独立二进制)
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi

# 切换到仓库根目录(脚本所在目录)，保证相对路径正确
cd "$(dirname "$0")"
log "工作目录: $(pwd)"

# ---------- 0. .env 兜底 ----------
if [ ! -f "apps/server/.env" ] && [ -f ".env.example" ]; then
  log "apps/server/.env 缺失，从 .env.example 复制"
  run "cp .env.example apps/server/.env"
fi

# ---------- 1. 安装依赖 ----------
if [ "$SKIP_INSTALL" != "1" ]; then
  log "安装依赖 (pnpm install)"
  run "pnpm install"
  ok "依赖安装完成"
else
  log "跳过依赖安装 (SKIP_INSTALL=1)"
fi

# ---------- 2. 基础设施: PostgreSQL + Redis ----------
if [ "$SKIP_DOCKER" != "1" ]; then
  log "启动 PostgreSQL + Redis ($DC up -d)"
  run "$DC up -d"
  # 等待 PG 健康(最多 ~60s)
  if [ "$DRY_RUN" != "1" ]; then
    for i in $(seq 1 30); do
      if $DC exec -T postgres pg_isready -U h5design -d h5design_platform >/dev/null 2>&1; then
        ok "PostgreSQL 就绪"
        break
      fi
      [ "$i" = "30" ] && { err "等待 PostgreSQL 超时，请检查 $DC logs"; exit 1; }
      sleep 2
    done
    if $DC exec -T redis redis-cli ping >/dev/null 2>&1; then ok "Redis 就绪"; fi
  fi
else
  log "跳过 docker (SKIP_DOCKER=1)，假设 PG/Redis 已在运行"
fi

# ---------- 3. Prisma: 生成客户端 + 应用迁移 ----------
log "生成 Prisma 客户端 (pnpm prisma:generate)"
run "pnpm prisma:generate"

if [ "$SKIP_MIGRATE" != "1" ]; then
  log "应用数据库迁移 (prisma migrate deploy)"
  run "pnpm --filter @h5design/server exec prisma migrate deploy"
  ok "数据库迁移完成"
else
  log "跳过数据库迁移 (SKIP_MIGRATE=1)"
fi

# ---------- 4. 构建 core(web 通过预编译 dist 引用) ----------
log "构建 @h5design/core (tsc -> dist)"
run "pnpm --filter @h5design/core build"
ok "core 构建完成"

# ---------- 5. 启动开发服务(前台, Ctrl+C 停止) ----------
log "启动开发服务: web@5173 + server@3000 (pnpm dev)"
echo "---------------------------------------------"
echo "前端: http://localhost:5173"
echo "后端: http://localhost:3000"
echo "按 Ctrl+C 停止"
echo "---------------------------------------------"
run "pnpm dev"
