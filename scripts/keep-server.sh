#!/usr/bin/env bash
# ============================================================
# keep-server.sh — 后端 :3000 看门狗（保活）脚本
#
# 解决的问题：此前 web / 运营端登录失败的根因几乎都是「后端 :3000 没在跑」，
# 而 startup.sh 是前台运行、会话一关 server 就死。本脚本把 server 放到后台，
# 并每 5 秒探活，进程挂掉自动拉起，从根本上消除「登录先查 :3000」的运维痛点。
#
# 用法:
#   ./scripts/keep-server.sh           启动看门狗（server 已在跑也会接管探活）
#   ./scripts/keep-server.sh stop      停止看门狗并杀掉它拉起的 server
#   SKIP_BUILD=1 ./scripts/keep-server.sh   不重新 build server（直接用现有 dist）
#
# 依赖: apps/server/dist/main.js 已构建（首次或改 server 后需 build）。
#        prisma client 已生成（改 schema 后须 regenerate，见 memory §8）。
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRV="$ROOT/apps/server"
cd "$SRV"

NODE_BIN="${NODE_BIN:-/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-2/node.exe}"
PIDFILE="$ROOT/logs/server.pid"
OUTLOG="$ROOT/logs/server.out"
PORT=3000
HEALTH_URL="http://127.0.0.1:$PORT/health"
CHECK_INTERVAL=5

# ---------- 前置检查 ----------
if [ ! -x "$NODE_BIN" ]; then
  echo "✗ NODE_BIN 不可执行: $NODE_BIN"; exit 1
fi
if [ ! -f "dist/main.js" ]; then
  echo "✗ 未找到 dist/main.js，请先 build server（SKIP_BUILD=1 时也必须已构建）"
  exit 1
fi

is_up() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$HEALTH_URL" 2>/dev/null)
  [ "$code" != "000" ] && [ -n "$code" ]
}

start_server() {
  export NODE_OPTIONS=""
  nohup "$NODE_BIN" dist/main.js > "$OUTLOG" 2>&1 &
  echo $! > "$PIDFILE"
  echo "$(date +'%F %T') started server pid $(cat "$PIDFILE")" >> "$OUTLOG"
}

stop_server() {
  if [ -f "$PIDFILE" ]; then
    local pid; pid=$(cat "$PIDFILE" 2>/dev/null)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && echo "stopped server pid $pid"
    rm -f "$PIDFILE"
  fi
  # 兜底：清掉仍占用 3000 的本脚本拉起的进程（按端口）
  for p in $(netstat -ano 2>/dev/null | grep ":$PORT" | grep LISTEN | awk '{print $5}'); do
    taskkill /F /PID "$p" >/dev/null 2>&1 || true
  done
}

# ---------- stop 模式 ----------
if [ "${1:-}" = "stop" ]; then
  stop_server
  echo "看门狗已停止"
  exit 0
fi

# ---------- 可选：重新 build server ----------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> build server (nest build)"
  export NODE_OPTIONS=""
  "$NODE_BIN" node_modules/@nestjs/cli/bin/nest.js build 2>&1 | tail -5
  if [ ! -f "dist/main.js" ]; then echo "✗ build 失败"; exit 1; fi
fi

echo "==> 启动看门狗，探活间隔 ${CHECK_INTERVAL}s，日志: $OUTLOG (Ctrl+C 停止)"
# 初始：若未运行则拉起
if ! is_up; then start_server; fi

trap 'echo "看门狗退出，停止 server"; stop_server; exit 0' INT TERM

while true; do
  if ! is_up; then
    echo "$(date +'%F %T') health check failed, restarting server..." >> "$OUTLOG"
    # 清掉可能僵死的旧 pid
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null
    rm -f "$PIDFILE"
    start_server
  fi
  sleep "$CHECK_INTERVAL"
done
