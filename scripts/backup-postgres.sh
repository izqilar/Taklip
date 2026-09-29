#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 庆柬云 / TAKLIP — PostgreSQL 逻辑备份脚本
# 用法: bash scripts/backup-postgres.sh
#   · 通过 docker exec 在容器内跑 pg_dump，导出到宿主备份目录
#   · 同时产出 自定义格式(.dump, 压缩/可恢复) 与 纯文本 SQL(.sql, 可读)
#   · 自动清理 N 天前的旧备份
# 恢复示例(自定义格式):
#   docker exec -i h5design-postgres pg_restore -U h5design -d h5design_platform --clean --if-exists < 备份文件.dump
# 恢复纯文本:
#   docker exec -i h5design-postgres psql -U h5design -d h5design_platform < 备份文件.sql
# ─────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="h5design-postgres"
DB="h5design_platform"
USER="h5design"
# 备份落盘目录（与数据卷同父目录，且不在 git 仓库内）
BACKUP_DIR="/d/docker-volumes/h5design/backups"
RETENTION_DAYS=14
PLAIN_SQL=1   # 1=同时导出可读文本 SQL

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
DUMP="$BACKUP_DIR/${DB}_${TS}.dump"

echo "[$(date)] 开始逻辑备份 -> 容器 $CONTAINER / 库 $DB"

# 自定义格式（压缩、支持选择性恢复）
docker exec "$CONTAINER" pg_dump -U "$USER" -d "$DB" -Fc > "$DUMP"
echo "[$(date)] 已生成: $DUMP ($(du -h "$DUMP" | cut -f1))"

if [ "$PLAIN_SQL" = "1" ]; then
  PLAIN="$BACKUP_DIR/${DB}_${TS}.sql"
  docker exec "$CONTAINER" pg_dump -U "$USER" -d "$DB" > "$PLAIN"
  echo "[$(date)] 已生成: $PLAIN ($(du -h "$PLAIN" | cut -f1))"
fi

# 校验 dump 完整性（宿主侧，不引入容器路径转换）：
#   · 自定义格式(-Fc)归档以魔数 "PGDMP" 开头
#   · 纯文本 SQL 头部含 "-- PostgreSQL database dump"
DUMP_HDR=$(head -c 5 "$DUMP")
if [ "$DUMP_HDR" = "PGDMP" ]; then
  echo "[$(date)] .dump 魔数校验通过 (PGDMP)"
else
  echo "[$(date)] ❌ .dump 魔数错误: [$DUMP_HDR]"; exit 1
fi
if [ "$PLAIN_SQL" = "1" ]; then
  if grep -q "PostgreSQL database dump" "$PLAIN"; then
    echo "[$(date)] .sql 头部校验通过"
  else
    echo "[$(date)] ❌ .sql 头部校验失败"; exit 1
  fi
fi

# 清理过期备份
echo "[$(date)] 清理 ${RETENTION_DAYS} 天前的备份"
find "$BACKUP_DIR" -name "${DB}_*.dump" -mtime +"$RETENTION_DAYS" -delete
[ "$PLAIN_SQL" = "1" ] && find "$BACKUP_DIR" -name "${DB}_*.sql" -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] 完成。当前备份清单:"
ls -lh "$BACKUP_DIR" | tail -n +2
