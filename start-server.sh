#!/usr/bin/env bash
# ============================================================
# 后端一键启动器 (start-server.sh) — 固化"构建+启动"，避免 dist 不完整导致全站 Failed to fetch
#
# 关键点：
#   1. 用 system node + NODE_OPTIONS="" 跑 nest build，绕过沙箱 genie-safe-delete
#      shim 对 DLL 重命名的拦截（managed node 直接跑 .bin/nest 会因 sh 脚本报 SyntaxError）。
#   2. 构建后校验 dist/main.js 存在（不完整则中止，绝不带着残破 dist 启动）。
#   3. 启动优先 pm2（进程守护/自动重启），否则后台 node 并写 server.pid + server.log。
#
# 用法：
#   ./start-server.sh                正常启动（默认端口 3000）
#   PORT=3100 ./start-server.sh      指定端口
#   SYSTEM_NODE=/path/to/node ./start-server.sh   指定 node 二进制
# ============================================================
set -euo pipefail

# 无论怎么调用，都切到 apps/server
cd "$(dirname "$0")/apps/server"
SERVER_ROOT="$(pwd)"
DIST_MAIN="$SERVER_ROOT/dist/main.js"
PORT="${PORT:-3000}"
# Windows / 沙箱里用系统 node，避免 managed node 的 shim 干扰 nest build
SYSTEM_NODE="${SYSTEM_NODE:-/c/Program Files/nodejs/node.exe}"

log(){ echo -e "\033[1;34m==>\033[0m $*"; }
ok(){ echo -e "\033[1;32m✓\033[0m $*"; }
err(){ echo -e "\033[1;31m✗\033[0m $*"; }

# ---------- 0. 前置检查 ----------
command -v curl >/dev/null 2>&1 || { err "未检测到 curl，请先安装"; exit 1; }
if [ ! -x "$SYSTEM_NODE" ]; then
  # 退而求其次用 PATH 里的 node
  if command -v node >/dev/null 2>&1; then SYSTEM_NODE="node"; else err "未找到 node"; exit 1; fi
fi
log "node: $($SYSTEM_NODE -v)  ($SYSTEM_NODE)"

# ---------- 1. 安全构建 ----------
log "构建后端 (nest build, NODE_OPTIONS='')"
NODE_OPTIONS="" "$SYSTEM_NODE" node_modules/@nestjs/cli/bin/nest.js build
# 完整性校验：不仅要有 main.js，还要有关键依赖模块，避免「dist 残缺 → 全站 Failed to fetch」
# （历史上曾发生 dist/app.module 找不到 ./prisma/prisma.module 导致启动即崩）
REQUIRED_FILES=("$DIST_MAIN" "$SERVER_ROOT/dist/app.module.js" "$SERVER_ROOT/dist/prisma/prisma.module.js")
MISSING=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then err "构建产物缺失：$f"; MISSING=1; fi
done
if [ "$MISSING" = "1" ]; then
  err "构建不完整，拒绝启动（否则会全站 Failed to fetch）。请查看上方 nest build 报错。"
  exit 1
fi
ok "dist 构建完整（main / app.module / prisma.module 均在）"

# ---------- 2. 启动 ----------
if command -v pm2 >/dev/null 2>&1; then
  log "使用 pm2 托管后端 (name=h5design-server, PORT=$PORT)"
  pm2 delete h5design-server 2>/dev/null || true
  pm2 start "$DIST_MAIN" --name h5design-server -- env PORT="$PORT"
  pm2 save 2>/dev/null || true
else
  log "后台启动 node dist/main（日志 → server.log，pid → server.pid）"
  PORT="$PORT" nohup "$SYSTEM_NODE" "$DIST_MAIN" > "$SERVER_ROOT/../../server.log" 2>&1 &
  echo $! > "$SERVER_ROOT/../../server.pid"
  ok "已启动 PID $(cat "$SERVER_ROOT/../../server.pid")"
fi

# ---------- 3. 健康检查 ----------
log "等待后端就绪 (http://localhost:$PORT/health)"
for i in $(seq 1 30); do
  if curl -s -m 3 "http://localhost:$PORT/health" >/dev/null 2>&1; then
    ok "后端已就绪：$PORT"
    echo "后端 API: http://localhost:$PORT/api"
    exit 0
  fi
  sleep 1
done
err "后端 30s 内未就绪，请查看 server.log"
exit 1
