#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 应用一次手写 migration，并自动触发全量备份
# 这是「表结构(schema)变更即自动备份」的落地：把你们唯一的改表入口
#   (手写 migration.sql -> db execute -> migrate resolve -> generate)
# 与 backup-postgres.sh 串成一步，改表后无需再单独记着备份。
#
# 用法:
#   bash scripts/migrate-apply.sh <migration_name>
#     <migration_name> 对应 apps/server/prisma/migrations/<ts>_<name>/
#   bash scripts/migrate-apply.sh --backup-only   # 仅跑备份（测试/随时手动）
#
# 说明:
#   · 凭据来自 docker-compose.yml (h5design / h5design_dev_2026 / h5design_platform)
#     若环境未设置 DATABASE_URL，则自动注入默认值。
#   · prisma generate 可能与运行中的服务争用 query_engine dll(EPERM)，
#     如报错请先停 server 看门狗再跑；生成成功后会自动备份。
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."            # 回到仓库根

# 仅备份模式
if [ "${1:-}" = "--backup-only" ]; then
  bash scripts/backup-postgres.sh
  exit 0
fi

: "${DATABASE_URL:=postgresql://h5design:h5design_dev_2026@localhost:5432/h5design_platform}"
export DATABASE_URL

SERVER="apps/server"
MIG_NAME="${1:?用法: bash scripts/migrate-apply.sh <migration_name>}"
MIG_DIR="$SERVER/prisma/migrations/$MIG_NAME"
[ -f "$MIG_DIR/migration.sql" ] || { echo "❌ 找不到 $MIG_DIR/migration.sql"; exit 1; }

PRISMA="$SERVER/node_modules/.bin/prisma"
[ -x "$PRISMA" ] || PRISMA="./node_modules/.bin/prisma"

echo "[$(date)] 1/4 执行 SQL: $MIG_DIR/migration.sql"
"$PRISMA" db execute --file "$MIG_DIR/migration.sql" --schema "$SERVER/prisma/schema.prisma"

echo "[$(date)] 2/4 标记迁移已应用: $MIG_NAME"
"$PRISMA" migrate resolve --applied "$MIG_NAME" --schema "$SERVER/prisma/schema.prisma"

echo "[$(date)] 3/4 重新生成客户端"
"$PRISMA" generate --schema "$SERVER/prisma/schema.prisma"

echo "[$(date)] 4/4 schema 已变更 -> 自动全量备份"
bash scripts/backup-postgres.sh

echo "[$(date)] ✅ 完成: $MIG_NAME 已应用并备份"
