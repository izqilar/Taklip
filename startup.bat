@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

:: ============================================================
:: H5 Design Platform - dev environment launcher (startup.bat)
:: pnpm workspace monorepo: @h5design/core + web + server
:: Logic is equivalent to startup.sh (bash version)
::
:: Usage (cmd):
::   startup.bat                      start dev environment
::   set DRY_RUN=1 && startup.bat     only print commands
::   set SKIP_DOCKER=1 && startup.bat skip docker
::   set SKIP_INSTALL=1 && startup.bat skip pnpm install
::   set SKIP_MIGRATE=1 && startup.bat skip migrations
::
:: NOTE: pure ASCII so it parses under any codepage.
:: ============================================================

:: ---------- overridable switches ----------
if not defined DRY_RUN      set "DRY_RUN=0"
if not defined SKIP_DOCKER  set "SKIP_DOCKER=0"
if not defined SKIP_INSTALL set "SKIP_INSTALL=0"
if not defined SKIP_MIGRATE set "SKIP_MIGRATE=0"

:: ---------- header ----------
echo =============================================
echo   H5 Design Platform . Dev Launcher (cmd)
echo =============================================

:: ---------- precheck: node >= 18 ----------
where node >nul 2>&1 || (echo [ERR] node not found, install Node.js ^>= 18 & exit /b 1)
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_RAW=%%v"
set "NODE_MAJOR=%NODE_RAW:~1%"
if %NODE_MAJOR% LSS 18 (echo [ERR] node too old, need ^>= 18 & exit /b 1)
echo ==^> node: %NODE_RAW%

:: ---------- precheck: pnpm (fallback to corepack) ----------
where pnpm >nul 2>&1
if errorlevel 1 (
    where corepack >nul 2>&1 || (echo [ERR] pnpm or corepack not found & exit /b 1)
    echo ==^> enable pnpm@10.28.2 via corepack
    call :exec corepack enable
    call :exec corepack prepare pnpm@10.28.2 --activate
)
for /f "tokens=*" %%p in ('pnpm -v 2^>nul') do echo ==^> pnpm: %%p

:: ---------- precheck: docker ----------
where docker >nul 2>&1 || (echo [ERR] docker not found, dev needs PostgreSQL + Redis & exit /b 1)
echo ==^> docker:
docker -v

:: docker compose v2 plugin / v1 binary
set "DC=docker compose"
docker compose version >nul 2>&1
if errorlevel 1 set "DC=docker-compose"

:: ---------- cd to repo root (script dir) ----------
cd /d "%~dp0"
echo ==^> workdir: %CD%

:: ---------- 0. .env fallback ----------
if not exist "apps\server\.env" (
    if exist ".env.example" (
        echo ==^> apps/server/.env missing, copy from .env.example
        call :exec copy .env.example apps\server\.env
    )
)

:: ---------- 1. install deps ----------
if "%SKIP_INSTALL%"=="1" (
    echo ==^> skip install (SKIP_INSTALL=1)
) else (
    echo ==^> install deps (pnpm install)
    call :exec pnpm install
    echo [OK] deps installed
)

:: ---------- 2. infra: PostgreSQL + Redis ----------
if "%SKIP_DOCKER%"=="1" (
    echo ==^> skip docker (SKIP_DOCKER=1)
) else (
    echo ==^> start PostgreSQL + Redis (%DC% up -d)
    call :exec %DC% up -d
    if "%DRY_RUN%"=="0" call :wait_pg
)

:: ---------- 3. Prisma: generate client + apply migrations ----------
echo ==^> generate Prisma client (pnpm prisma:generate)
call :exec pnpm prisma:generate
if "%SKIP_MIGRATE%"=="1" (
    echo ==^> skip migrations (SKIP_MIGRATE=1)
) else (
    echo ==^> apply db migrations (prisma migrate deploy)
    call :exec pnpm --filter @h5design/server exec prisma migrate deploy
    echo [OK] migrations applied
)

:: ---------- 4. build core (web uses prebuilt dist) ----------
echo ==^> build @h5design/core (tsc -^> dist)
call :exec pnpm --filter @h5design/core build
echo [OK] core built

:: ---------- 5. start dev services (foreground, Ctrl+C to stop) ----------
echo ==^> start dev services: web@5173 + server@3000 (pnpm dev)
echo ---------------------------------------------
echo frontend: http://localhost:5173
echo backend:  http://localhost:3000
echo press Ctrl+C to stop
echo ---------------------------------------------
call :exec pnpm dev
goto :eof

:: ============================================================
:: wait for PostgreSQL healthy (max ~60s)
:: ============================================================
:wait_pg
for /l %%i in (1,1,30) do (
    %DC% exec -T postgres pg_isready -U h5design -d h5design_platform >nul 2>&1
    if not errorlevel 1 (
        echo [OK] PostgreSQL ready
        %DC% exec -T redis redis-cli ping >nul 2>&1
        if not errorlevel 1 echo [OK] Redis ready
        goto :eof
    )
    if %%i==30 ( echo [ERR] wait PostgreSQL timeout, check %DC% logs & exit /b 1 )
    timeout /t 2 >nul
)
goto :eof

:: ============================================================
:: run command (print only when DRY_RUN)
:: ============================================================
:exec
if "%DRY_RUN%"=="1" (
    echo     [dry-run] %*
) else (
    %*
    if errorlevel 1 (
        echo [ERR] command failed (exit %errorlevel%): %*
        exit /b 1
    )
)
goto :eof
