# backup-datastores.ps1
# Logical (consistent) backups for all local dev datastores.
# Strategy: bind mounts already survive a Docker-metadata reset (proven 2026-09-26);
# this script adds point-in-time logical dumps to survive disk corruption / accidental
# deletion / file-level damage, which bind mounts alone do NOT protect against.
# Run daily via Windows Task Scheduler (see registration command at bottom).
#
# NOTE: dumps land on the same physical disk (D:). For true disaster recovery,
# mirror D:\datastore-backups to another disk / cloud. This script only protects
# against software-level data loss, not a full disk failure.

$ErrorActionPreference = 'Continue'
$BackupRoot = 'D:\datastore-backups'
$RetentionDays = 14
$Stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$Log = Join-Path $BackupRoot 'backup.log'

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $Log -Value $line
  Write-Host $line
}
function EnsureDir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }

EnsureDir $BackupRoot
Log '===== backup start ====='

# 1) PostgreSQL (h5design_platform)
try {
  $pgDir = Join-Path $BackupRoot 'pg'; EnsureDir $pgDir
  $pgFile = Join-Path $pgDir "h5design_platform_$Stamp.sql"
  docker exec h5design-postgres bash -c "PGPASSWORD=h5design_dev_2026 pg_dump -U h5design -d h5design_platform -f /tmp/h5design_$Stamp.sql" 2>&1 | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -eq 0) {
    docker cp "h5design-postgres:/tmp/h5design_$Stamp.sql" $pgFile 2>&1
    docker exec h5design-postgres rm -f "/tmp/h5design_$Stamp.sql" 2>&1 | Out-Null
    if (Test-Path $pgFile) { Log "PG    OK  -> $pgFile ($( (Get-Item $pgFile).Length ) bytes)" }
    else { Log "PG    FAIL (cp failed, exit $rc)" }
  } else { Log "PG    FAIL (pg_dump exit $rc)" }
} catch { Log "PG    EXCEPTION: $_" }

# 2) MySQL (crmeb java_dev)
try {
  $myDir = Join-Path $BackupRoot 'mysql'; EnsureDir $myDir
  $myFile = Join-Path $myDir "java_dev_$Stamp.sql"
  docker exec crmeb-mysql bash -c "mysqldump -uroot -proot_dev_2026 java_dev -r /tmp/java_dev_$Stamp.sql" 2>&1 | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -eq 0) {
    docker cp "crmeb-mysql:/tmp/java_dev_$Stamp.sql" $myFile 2>&1
    docker exec crmeb-mysql rm -f "/tmp/java_dev_$Stamp.sql" 2>&1 | Out-Null
    if (Test-Path $myFile) { Log "MySQL OK  -> $myFile ($( (Get-Item $myFile).Length ) bytes)" }
    else { Log "MySQL FAIL (cp failed, exit $rc)" }
  } else { Log "MySQL FAIL (mysqldump exit $rc)" }
} catch { Log "MySQL EXCEPTION: $_" }

# 3) Redis (h5design 6380 + crmeb 6381) -- AOF already durable via bind mount;
#    rdb snapshot copied out for version-independent portability.
foreach ($r in @(@{c='h5design-redis';p=6380;n='h5design'}, @{c='crmeb-redis';p=6381;n='crmeb'})) {
  try {
    $rdDir = Join-Path $BackupRoot 'redis'; EnsureDir $rdDir
    $rdFile = Join-Path $rdDir "$($r.n)_redis_$Stamp.rdb"
    docker exec $r.c redis-cli -p $r.p SAVE 2>&1 | Out-Null
    docker cp "$($r.c):/data/dump.rdb" $rdFile 2>&1
    if (Test-Path $rdFile) { Log "Redis OK  ($($r.n):$($r.p)) -> $rdFile ($( (Get-Item $rdFile).Length ) bytes)" }
    else { Log "Redis FAIL ($($r.n):$($r.p)): copy failed" }
  } catch { Log "Redis EXCEPTION ($($r.n)): $_" }
}

# 4) Rotation: delete dumps older than RetentionDays.
# IMPORTANT: key off the date embedded in the filename (_yyyyMMdd_HHmm), NOT the
# file's LastWriteTime -- docker cp preserves the container-internal mtime, which can
# be far older than "now" and would otherwise cause freshly-made backups to be purged.
try {
  $cut = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -Path $BackupRoot -Recurse -Include *.sql, *.rdb | ForEach-Object {
    if ($_.BaseName -match '_(\d{8}_\d{4})$') {
      try {
        $fdate = [datetime]::ParseExact($Matches[1], 'yyyyMMdd_HHmm', $null)
        if ($fdate -lt $cut) {
          Remove-Item $_.FullName -Force
          Log "purge old: $($_.FullName)"
        }
      } catch { Log "Rotation parse-skip: $($_.FullName)" }
    }
  }
} catch { Log "Rotation EXCEPTION: $_" }

Log '===== backup done ====='

# Registration (run once, as admin, in PowerShell):
# schtasks /Create /TN "DatastoreDailyBackup" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\MyWorkBuddy\2026-08-10-22-39-56\scripts\backup-datastores.ps1" /SC DAILY /ST 03:00 /RL HIGHEST
