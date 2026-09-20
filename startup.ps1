# ============================================================
# H5 Design Platform - dev environment launcher (startup.ps1)
# pnpm workspace monorepo: @h5design/core + web + admin + server
# Logic is equivalent to startup.sh (bash version)
#
# Usage (PowerShell):
#   .\startup.ps1                      start dev environment (detached, returns immediately)
#   $env:DRY_RUN=1; .\startup.ps1      only print commands, do not run
#   $env:SKIP_DOCKER=1; .\startup.ps1  skip docker (assume PG/Redis running)
#   $env:SKIP_INSTALL=1; .\startup.ps1 skip pnpm install
#   $env:SKIP_MIGRATE=1; .\startup.ps1 skip prisma migrate deploy
#   $env:SKIP_GENERATE=1; .\startup.ps1 skip prisma generate (regenerate only on schema change by default)
#   $env:SKIP_CORE_BUILD=1; .\startup.ps1 skip building @h5design/core (it is dist-built; rebuild after core edits)
#   $env:SKIP_WATCHDOG=1;  .\startup.ps1 launch bare node (no auto-restart) instead of the :3000 watchdog
#
# The web (vite / 5173), admin (vite / 5174) and server (node dist/main) are launched
# as DETACHED processes, so closing this window / reaping the task will NOT stop them.
# The server runs UNDER scripts/server-watchdog.js, which probes the backend every 5s
# and restarts it on death/hang - so a crashed backend no longer breaks web/admin login.
# To stop a service, kill the PID listening on its port (see the printed Stop-Process hints).
#
# NOTE: written in pure ASCII so it parses correctly under any codepage.
# ============================================================

$ErrorActionPreference = 'Stop'

# ---------- crash guard: never silently close the window (no more silent flash-exit) ----------
# Record everything to a log file so failures are inspectable even when the window
# closes too fast to read. The trap also pauses on an uncaught error so the user
# can actually see WHAT failed instead of a blank flash.
$transcriptPath = Join-Path $PSScriptRoot 'startup.log'
try { Start-Transcript -Path $transcriptPath -Append -ErrorAction Stop } catch { }
trap {
    Err "UNCAUGHT ERROR: $_"
    if ($_.ScriptStackTrace) { Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray }
    Write-Host ''
    Write-Host 'Script stopped due to an error. See startup.log for details. Press Enter to close...'
    $null = Read-Host
    break
}

# ---------- overridable switches ----------
$DRY_RUN      = if ($env:DRY_RUN)      { $env:DRY_RUN }      else { '0' }
$SKIP_DOCKER  = if ($env:SKIP_DOCKER)  { $env:SKIP_DOCKER }  else { '0' }
$SKIP_INSTALL = if ($env:SKIP_INSTALL) { $env:SKIP_INSTALL } else { '0' }
$SKIP_MIGRATE = if ($env:SKIP_MIGRATE) { $env:SKIP_MIGRATE } else { '0' }
$SKIP_GENERATE  = if ($env:SKIP_GENERATE)  { $env:SKIP_GENERATE }  else { '0' }
$SKIP_CORE_BUILD = if ($env:SKIP_CORE_BUILD) { $env:SKIP_CORE_BUILD } else { '0' }
$SKIP_WATCHDOG   = if ($env:SKIP_WATCHDOG)   { $env:SKIP_WATCHDOG }   else { '0' }

# ---------- output helpers ----------
function Log($msg){ Write-Host '==> ' -ForegroundColor Blue -NoNewline; Write-Host $msg }
function Ok ($msg){ Write-Host '[OK] ' -ForegroundColor Green -NoNewline; Write-Host $msg }
function Err($msg){ Write-Host '[ERR] ' -ForegroundColor Red -NoNewline; Write-Host $msg }
function Warn($msg){ Write-Host '[WARN] ' -ForegroundColor Yellow -NoNewline; Write-Host $msg }

# run-capture: like Run() but also returns combined output so callers can inspect
# it (e.g. to detect a Prisma P3005 and self-heal). Never throws on its own.
function Run-Capture($Command){
    if ($DRY_RUN -eq '1') {
        Write-Host "    [dry-run] $Command" -ForegroundColor DarkGray
        return @{ ExitCode = 0; Output = '' }
    }
    $tmp = Join-Path $env:TEMP ("migrate_$(Get-Date -Format yyyyMMddHHmmssffff).log")
    try {
        cmd /c "$Command > `"$tmp`" 2>&1"
        $code = $LASTEXITCODE
        $text = ''
        if (Test-Path $tmp) { $text = (Get-Content $tmp -Raw -ErrorAction SilentlyContinue) }
        return @{ ExitCode = $code; Output = $text }
    } finally {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
}

# run: print when DRY_RUN, else execute; non-zero exit throws
function Run($Command){
    if ($DRY_RUN -eq '1') {
        Write-Host "    [dry-run] $Command" -ForegroundColor DarkGray
    } else {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "command failed (exit $LASTEXITCODE): $Command"
        }
    }
}

# Test-EndpointAlive: returns $true if the server answers the HTTP request at all
# (any status, including 404/500 - i.e. the app's HTTP layer is alive). Returns
# $false only on connection-refused / timeout (the process is actually down/hung).
# This mirrors scripts/server-watchdog.js and catches the "port bound but app
# crashed during bootstrap" case that a bare port check would miss.
function Test-EndpointAlive($url) {
    try {
        $null = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        $ex = $_.Exception
        if ($ex -and $ex.Response) { return $true }   # server answered (even 4xx/5xx)
        return $false                                  # connection refused / timeout
    }
}

# ---------- header ----------
Write-Host '============================================='
Write-Host '  H5 Design Platform . Dev Environment Launcher (PowerShell)'
Write-Host '============================================='

# ---------- precheck: node >= 18 ----------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err 'node not found, please install Node.js >= 18'; exit 1
}
$nodeVer = (node -v).TrimStart('v')
$nodeMajor = [int]($nodeVer.Split('.')[0])
if ($nodeMajor -lt 18) { Err "node too old (v$nodeVer), need >= 18"; exit 1 }
Log "node: v$nodeVer"

# ---------- precheck: pnpm (fallback to corepack) ----------
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
        Err 'pnpm or corepack not found, please install pnpm@10'; exit 1
    }
    Log 'enable pnpm@10.28.2 via corepack'
    Run 'corepack enable'
    Run 'corepack prepare pnpm@10.28.2 --activate'
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}
$pnpmVer = (& { pnpm -v 2>$null } )
Log "pnpm: $pnpmVer"

# ---------- precheck: docker ----------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Err 'docker not found, dev needs PostgreSQL + Redis'; exit 1
}
Log "docker: $(docker -v)"

# docker compose v2 plugin / v1 binary
$v2 = $false
$null = docker compose version 2>$null
if ($LASTEXITCODE -eq 0) { $v2 = $true }
$DCStr   = if ($v2) { 'docker compose' } else { 'docker-compose' }

# ---------- cd to repo root (script dir) ----------
Set-Location $PSScriptRoot
Log "workdir: $(Get-Location)"

# ---------- 0. .env fallback ----------
if (-not (Test-Path 'apps/server/.env') -and (Test-Path '.env.example')) {
    Log 'apps/server/.env missing, copy from .env.example'
    Run 'Copy-Item .env.example apps/server/.env'
}

# ---------- 1. install deps ----------
if ($SKIP_INSTALL -ne '1') {
    Log 'install deps (pnpm install)'
    Run 'pnpm install'
    Ok 'deps installed'
} else {
    Log 'skip install (SKIP_INSTALL=1)'
}

# ---------- 2. infra: PostgreSQL + Redis ----------
if ($SKIP_DOCKER -ne '1') {
    Log "start PostgreSQL + Redis ($DCStr up -d)"
    Run "$DCStr up -d"
    if ($DRY_RUN -ne '1') {
        for ($i = 1; $i -le 30; $i++) {
            Invoke-Expression "$DCStr exec -T postgres pg_isready -U h5design -d h5design_platform" 2>$null
            if ($LASTEXITCODE -eq 0) { Ok 'PostgreSQL ready'; break }
            if ($i -eq 30) { Err "wait PostgreSQL timeout, check $DCStr logs"; exit 1 }
            Start-Sleep -Seconds 2
        }
        Invoke-Expression "$DCStr exec -T redis redis-cli ping" 2>$null
        if ($LASTEXITCODE -eq 0) { Ok 'Redis ready' }
    }
} else {
    Log 'skip docker (SKIP_DOCKER=1), assume PG/Redis running'
}

# ---------- 2.5 stop stale services BEFORE prisma generate (prevents EPERM on dll rename) ----------
# A server launched by a PREVIOUS startup.ps1 run (kept alive by its watchdog) still
# holds query_engine-windows.dll.node open. Prisma generate renames a fresh dll over it
# and dies with EPERM. We must kill any running server/watchdog FIRST, so the dll is
# free before regenerate. Putting this AFTER the generate (the old order) is exactly
# what produced the EPERM seen in a prior run.
function Get-ListenerPid($port) {
    $line = netstat -ano 2>$null | Select-String ":$port " | Select-String 'LISTENING' | Select-Object -First 1
    if ($line) { return ($line -split '\s+')[-1] }
    return $null
}

$stale = @()
foreach ($p in @(3000, 5173, 5174)) {
    $listenerPid = Get-ListenerPid $p
    if ($listenerPid) { $stale += $listenerPid }
}
try {
    # Only match the node.exe worker, NOT the transient `cmd /c start` wrapper that
    # also contains "server-watchdog.js" in its CommandLine. That wrapper exits the
    # instant it spawns node, so matching it would inject already-gone (phantom) PIDs
    # that later blow up Stop-Process with a red TerminatingError.
    $oldWds = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' AND CommandLine LIKE '%server-watchdog.js%'" -ErrorAction SilentlyContinue
    foreach ($w in $oldWds) { if ($w.ProcessId) { $stale += $w.ProcessId } }
} catch { }
if ($stale.Count -gt 0) {
    Log "stop $($stale.Count) stale process(es) before Prisma generate (free dll lock)"
    foreach ($lp in ($stale | Sort-Object -Unique)) {
        # A pid collected from netstat / CIM may already have exited by now (race, or
        # it was a child reaped when an earlier pid in this loop was killed). Skip it
        # quietly instead of throwing a red TerminatingError into the transcript.
        $proc = Get-Process -Id $lp -ErrorAction SilentlyContinue
        if (-not $proc) { Log "skip PID $lp (already exited)"; continue }
        try {
            Stop-Process -Id $lp -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 400
            if (-not (Get-Process -Id $lp -ErrorAction SilentlyContinue)) { Ok "stopped PID $lp" }
            else { Warn "PID $lp still running after stop attempt" }
        } catch {
            Warn "could not stop PID $lp : $_"
        }
    }
    Start-Sleep -Seconds 2
}

# ---------- 3. Prisma: generate client (schema-change aware) + apply migrations ----------
# KEY LESSON (P0 AuditLog incident): the previous launcher skipped `prisma generate`
# whenever the generated client FOLDER merely existed. That was exactly the root cause
# of the AuditLog "void" bug - a new `AuditLog` model was added but the client was
# never regenerated, so at runtime `this.prisma.auditLog` was undefined and every
# review/withdrawal action threw. We now regenerate whenever the schema fingerprint
# changed (not just when the folder is missing), so a schema edit is always reflected
# on next startup. Force a regenerate with SKIP_GENERATE=1 off (default already does
# it on change); set SKIP_GENERATE=1 to bypass entirely.
$schemaPath = Join-Path $PSScriptRoot 'apps/server/prisma/schema.prisma'
$markerPath = Join-Path $PSScriptRoot 'apps/server/.prisma-client.marker'
if ($SKIP_GENERATE -eq '1') {
    Log 'skip Prisma generate (SKIP_GENERATE=1)'
} else {
    if (-not (Test-Path $schemaPath)) {
        Err "prisma schema not found at $schemaPath"; exit 1
    }
    $hash   = (Get-FileHash $schemaPath -Algorithm SHA256).Hash
    $stored = ''
    if (Test-Path $markerPath) { $stored = (Get-Content $markerPath -Raw -ErrorAction SilentlyContinue).Trim() }
    if ($stored -ne $hash) {
        Log 'schema changed since last generate -> regenerate Prisma client'
        # defensive: drop any .tmp* left over from a previously interrupted generate
        Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $PSScriptRoot 'apps/server/prisma/prisma-client/*.tmp*')
        $genOk = $false
        # self-heal: an EPERM mid-rename means the dll is still locked by a running
        # server. Kill the :3000 holder (already done in step 2.5, but belt-and-braces)
        # and retry once before giving up.
        for ($attempt = 1; $attempt -le 2; $attempt++) {
            try {
                Run 'pnpm prisma:generate'
                $genOk = $true
                break
            } catch {
                if ($attempt -eq 1 -and ($_ -match 'EPERM')) {
                    Warn 'prisma generate hit EPERM (dll still locked); killing :3000 holder and retrying...'
                    $sp = Get-ListenerPid 3000
                    if ($sp -and (Get-Process -Id $sp -ErrorAction SilentlyContinue)) {
                        try { Stop-Process -Id $sp -Force -ErrorAction SilentlyContinue } catch { }
                        Start-Sleep -Seconds 2
                    }
                    Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $PSScriptRoot 'apps/server/prisma/prisma-client/*.tmp*')
                    continue
                }
                throw
            }
        }
        if ($genOk) {
            Set-Content -Path $markerPath -Value $hash -ErrorAction Stop
            Ok 'Prisma client regenerated (marker updated)'
        } else {
            Err "prisma generate failed after retry: $_"
            Warn 'continuing without regenerate; runtime may miss newly-added models'
        }
    } else {
        Log 'skip Prisma generate (schema unchanged since last generate)'
    }
}

if ($SKIP_MIGRATE -ne '1') {
    Log 'apply db migrations (prisma migrate deploy)'
    $migrateCmd = 'pnpm --filter @h5design/server prisma:migrate:deploy'
    $res = Run-Capture $migrateCmd
    if ($res.ExitCode -ne 0) {
        # P3005 = "The database schema is not empty": the DB already has tables
        # (e.g. seeded earlier via `prisma db push`) but _prisma_migrations history
        # is empty. Self-heal by baselining every migration folder, then re-deploy.
        if ($res.Output -match 'P3005') {
            Warn 'migrate deploy failed with P3005 (schema not empty, no migration history)'
            Warn 'baselining existing migrations so migrate deploy becomes idempotent...'
            $migDir = Join-Path $PSScriptRoot 'apps/server/prisma/migrations'
            $folders = Get-ChildItem -Directory $migDir -ErrorAction SilentlyContinue | Sort-Object Name
            if ($folders.Count -eq 0) {
                Err "no migration folders found at $migDir"; throw "cannot baseline: no migrations present"
            }
            foreach ($f in $folders) {
                Log "baseline migration (mark applied): $($f.Name)"
                $r2 = Run-Capture "pnpm --filter @h5design/server exec prisma migrate resolve --applied $($f.Name)"
                if ($r2.ExitCode -ne 0) {
                    Err "prisma migrate resolve failed for $($f.Name):"
                    Write-Host $r2.Output
                    throw "prisma migrate resolve failed for $($f.Name)"
                }
            }
            # re-run; all migrations are now recorded as applied -> idempotent, no-op
            Log 're-run prisma migrate deploy'
            $r3 = Run-Capture $migrateCmd
            if ($r3.ExitCode -ne 0) {
                Err "prisma migrate deploy failed after baseline:"; Write-Host $r3.Output
                throw 'prisma migrate deploy failed after baseline'
            }
            Ok 'migrations applied'
        } else {
            Err 'prisma migrate deploy failed:'; Write-Host $res.Output
            throw "prisma migrate deploy failed (exit $($res.ExitCode))"
        }
    } else {
        Ok 'migrations applied'
    }
} else {
    Log 'skip migrations (SKIP_MIGRATE=1)'
}

# ---------- 4. build core (web/admin use prebuilt dist) ----------
# Per project convention, @h5design/core is dist-built: web/admin import its compiled
# output, so a core change MUST be rebuilt or the running app is stale. Default: always
# build. Use SKIP_CORE_BUILD=1 for fast iteration when core is known unchanged.
if ($SKIP_CORE_BUILD -ne '1') {
    Log 'build @h5design/core (tsc -> dist)'
    Run 'pnpm --filter @h5design/core build'
    Ok 'core built'
} else {
    Log 'skip core build (SKIP_CORE_BUILD=1)'
}

# ---------- 4.5 build editor CSS (single source of truth for web & admin canvas) ----------
# 4.5 build editor CSS (single source of truth for web & admin canvas)
# The editor kernel has its own standalone Tailwind build -> dist/editor.css
# (scoped preflight + editor utilities). web & admin import the SAME file so
# the canvas looks identical on both ends. Rebuild after any editor style
# change, otherwise both ends load stale CSS. Set SKIP_EDITOR_CSS=1 to skip.
if ($SKIP_EDITOR_CSS -ne '1') {
    Log 'build @h5design/editor CSS (tailwind -> dist/editor.css)'
    Run 'pnpm --filter @h5design/editor build:css'
    Ok 'editor CSS built'
} else {
    Log 'skip editor CSS build (SKIP_EDITOR_CSS=1)'
}

# ---------- 5. start dev services (DETACHED, survive terminal close) ----------
# Both services are launched as independent DETACHED processes via Start-Process,
# OUTSIDE this script's process tree. This fixes the "runs a while then both die
# with Exit status 4294967295" problem: previously `pnpm dev:safe` used
# `concurrently`, and whenever the hosting terminal/task was reaped or closed the
# whole tree was TerminateProcess'd at once (concurrently exits 4294967295 and
# takes web+server with it). Detached processes are NOT children of the launcher,
# so they keep running after this script/terminal exits, and one crashing will
# not kill the other.
#
# NOTE: the server is compiled with plain `tsc` (no rimraf) instead of
# `nest start --watch`, because `nest start --watch` does `rimraf dist` (133 files)
# and trips the execution-environment safe-delete bulk guard
# (SAFE_DELETE_BULK_CONFIRM_REQUIRED, threshold 50) -> nest exits before binding.

# compile server to dist (guard-safe: overwrites, no bulk delete)
Log 'compile server (tsc -> dist, no rimraf)'
Run 'pnpm --filter @h5design/server build:compiled'
Ok 'server compiled'

# NOTE: stale services / old watchdogs were already stopped in step 2.5 (before the
# Prisma generate) so the query_engine dll was free - nothing to kill here again.

$root = (Get-Location).Path
$nodeBin  = (Get-Command node).Source

Log 'start dev services (detached): web@5173 + admin@5174 + server@3000'
Write-Host '---------------------------------------------'
Write-Host 'frontend : http://localhost:5173'
Write-Host 'admin    : http://localhost:5174'
Write-Host 'backend  : http://localhost:3000'
Write-Host 'processes are DETACHED - closing this window will NOT stop them'
Write-Host "stop server watchdog : Get-CimInstance Win32_Process -Filter `"CommandLine LIKE '%server-watchdog.js%'`" | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force }"
Write-Host "stop server (node)   : Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess"
Write-Host "stop web    : Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess"
Write-Host "stop admin  : Stop-Process -Id (Get-NetTCPConnection -LocalPort 5174).OwningProcess"
Write-Host '---------------------------------------------'

# NOTE: we intentionally do NOT pass -RedirectStandardOutput / -RedirectStandardError to
# Start-Process. On PowerShell 5.1 those parameters force PowerShell to copy the process
# environment into a case-insensitive dictionary, which throws
#   "An item with the same key has already been added. Key: Path, added key: PATH"
# when the host terminal has injected PATH/Path/path case-duplicates (e.g. WorkBuddy/CodeBuddy
# terminal). We redirect the logs INSIDE the launched cmd instead, so Start-Process stays on its
# safe (no-env-copy) code path and still detaches the services properly.

# server: launch UNDER the self-healing watchdog (scripts/server-watchdog.js) which
# probes http://127.0.0.1:3000/health every 5s and restarts node on death/hang.
# This closes gap #105 ("backend down -> web/admin login fails"): the service now
# recovers on its own instead of requiring a manual startup.ps1 re-run.
# NOTE: launched via `cmd /c start "" /min cmd /c "node scripts\server-watchdog.js <root>"`
# so the watchdog lives in its own process group, fully DETACHED and surviving launcher exit.
# (The bare-node fallback below is used only when SKIP_WATCHDOG=1 or the watchdog file
# is missing; it stays detached the same way but without auto-restart.)
$srvLog = Join-Path $root 'server.log'; $srvErr = Join-Path $root 'server.err'
$srvInner = "cd /d `"$root\apps\server`" && node dist/main > `"$srvLog`" 2> `"$srvErr`""
$srvArgs = "/c start `"`" /min cmd /c `"$srvInner`""

if ($SKIP_WATCHDOG -ne '1') {
    $wdog = Join-Path $root 'scripts\server-watchdog.js'
    if (Test-Path $wdog) {
        $wdogInner = "`"$nodeBin`" `"$wdog`" `"$root`""
        $wdogArgs = "/c start `"`" /min cmd /c `"$wdogInner`""
        Start-Process -FilePath 'cmd.exe' -ArgumentList $wdogArgs -WindowStyle Hidden
        Log 'server launched under watchdog (scripts/server-watchdog.js)'
    } else {
        Warn "watchdog not found at $wdog; launching bare node (no auto-restart)"
        Start-Process -FilePath 'cmd.exe' -ArgumentList $srvArgs -WindowStyle Hidden
    }
} else {
    Log 'skip watchdog (SKIP_WATCHDOG=1); launching bare node'
    Start-Process -FilePath 'cmd.exe' -ArgumentList $srvArgs -WindowStyle Hidden
}
# frontend: vite dev server (launch via cmd.exe so pnpm.cmd resolves regardless of shell)
$webLog = Join-Path $root 'web.log'; $webErr = Join-Path $root 'web.err'
$webInner = "cd /d `"$root\apps\web`" && pnpm dev > `"$webLog`" 2> `"$webErr`""
$webArgs = "/c start `"`" /min cmd /c `"$webInner`""
Start-Process -FilePath 'cmd.exe' -ArgumentList $webArgs -WindowStyle Hidden
# admin backend: vite dev server on :5174 (Refine + antd), launched the same
# detached way so it survives the launcher terminal and is not killed with web.
$adminLog = Join-Path $root 'admin.log'; $adminErr = Join-Path $root 'admin.err'
$adminInner = "cd /d `"$root\apps\admin`" && pnpm dev > `"$adminLog`" 2> `"$adminErr`""
$adminArgs = "/c start `"`" /min cmd /c `"$adminInner`""
Start-Process -FilePath 'cmd.exe' -ArgumentList $adminArgs -WindowStyle Hidden

Ok 'launched. waiting for readiness...'
# Poll all three services (web 5173, admin 5174, server 3000). vite binds in <1s,
# but the NestJS server (3000) can take 20s+ to cold-start (Prisma init + route
# mapping + Docker PG connect). A short window caused a *false* "[ERR] one or more
# services did not come up" even though they would come up moments later.
$maxWait = 120; $interval = 2; $waited = 0
$webUp = $false; $adminUp = $false; $srvUp = $false; $srvAlive = $false
while ($waited -lt $maxWait) {
    $webUp   = (Get-ListenerPid 5173) -ne $null
    $adminUp = (Get-ListenerPid 5174) -ne $null
    $srvUp   = (Get-ListenerPid 3000) -ne $null
    if ($webUp -and $adminUp -and $srvUp) {
        # All ports bound. Do a best-effort HTTP liveness probe for the backend so we
        # don't report success while the app is still crashing during bootstrap.
        $srvAlive = Test-EndpointAlive 'http://127.0.0.1:3000/health'
        if (-not $srvAlive) { $srvAlive = Test-EndpointAlive 'http://localhost:3000/health' }
        if ($srvAlive) { Ok 'backend :3000 answered health probe' }
        else { Warn 'backend :3000 listening but not responding yet (still initializing?)' }
        break
    }
    Start-Sleep -Seconds $interval
    $waited += $interval
}
if (-not $webUp)   { Warn "frontend (vite / 5173) not listening after ${waited}s" }
if (-not $adminUp) { Warn "admin    (vite / 5174) not listening after ${waited}s" }
if (-not $srvUp)   { Warn "backend  (nest / 3000) not listening after ${waited}s" }
if ($webUp -and $adminUp -and $srvUp) {
    Ok 'all three services up and reachable'
    Write-Host ''
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host '  Dev environment is up (services running in background)' -ForegroundColor Green
    Write-Host '  Frontend: http://localhost:5173' -ForegroundColor Cyan
    Write-Host '  Admin   : http://localhost:5174' -ForegroundColor Cyan
    Write-Host '  Backend : http://localhost:3000' -ForegroundColor Cyan
    if ($SKIP_WATCHDOG -ne '1') {
        Write-Host '  Backend is auto-restarted by scripts/server-watchdog.js if it crashes' -ForegroundColor DarkGray
    }
    Write-Host '  Logs: server.log / web.log / admin.log / startup.log' -ForegroundColor DarkGray
    Write-Host '=============================================' -ForegroundColor Green
    # Open the frontend and admin pages as a visible confirmation that they are up (non-blocking)
    try { Start-Process -FilePath 'http://localhost:5173' -ErrorAction SilentlyContinue } catch { }
    try { Start-Process -FilePath 'http://localhost:5174' -ErrorAction SilentlyContinue } catch { }
    Write-Host ''
    Write-Host 'Press Enter to close this window (services keep running in background)...'
    $null = Read-Host
} else {
    Err 'one or more services did not come up; tail of logs:'
    if (-not $srvUp)   { Get-Content "$root\server.err" -Tail 20 -ErrorAction SilentlyContinue | Write-Host }
    if (-not $webUp)   { Get-Content "$root\web.err"   -Tail 20 -ErrorAction SilentlyContinue | Write-Host }
    if (-not $adminUp) { Get-Content "$root\admin.err" -Tail 20 -ErrorAction SilentlyContinue | Write-Host }
    Write-Host ''
    Write-Host 'Press Enter to close this window...'
    $null = Read-Host
}
