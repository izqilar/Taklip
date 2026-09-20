@echo off
REM ============================================================
REM 后端一键启动器 (start-server.bat) — Windows 双击运行
REM 构建 + 校验 dist + 启动（优先 pm2，否则后台 node）
REM ============================================================
setlocal EnableDelayedExpansion

cd /d "%~dp0apps\server"
set "SERVER_ROOT=%CD%"
set "DIST_MAIN=%SERVER_ROOT%\dist\main.js"
if "%PORT%"=="" set "PORT=3000"

echo ==^> 后端一键启动器

REM 优先用系统 node，避免 managed node 的 shim 干扰 nest build
set "SYSTEM_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%SYSTEM_NODE%" (
  where node >nul 2>&1 && set "SYSTEM_NODE=node" || (echo [x] 未找到 node & exit /b 1)
)
for /f "tokens=*" %%v in ('"%SYSTEM_NODE%" -v') do echo node: %%v

REM 1) 安全构建
echo ==^> 构建后端 (nest build, NODE_OPTIONS=)
set "NODE_OPTIONS="
"%SYSTEM_NODE%" node_modules\@nestjs\cli\bin\nest.js build
if not exist "%DIST_MAIN%" (
  echo [x] 构建失败：dist\main.js 未生成
  exit /b 1
)
if not exist "%SERVER_ROOT%\dist\app.module.js" (
  echo [x] 构建不完整：dist\app.module.js 缺失
  exit /b 1
)
if not exist "%SERVER_ROOT%\dist\prisma\prisma.module.js" (
  echo [x] 构建不完整：dist\prisma\prisma.module.js 缺失
  exit /b 1
)
echo [v] dist 构建完整（main / app.module / prisma.module 均在）

REM 2) 启动
where pm2 >nul 2>&1 (
  echo ==^> 使用 pm2 托管后端
  pm2 delete h5design-server >nul 2>&1
  pm2 start "%DIST_MAIN%" --name h5design-server -- env PORT=%PORT%
) else (
  echo ==^> 后台启动 node dist\main
  start "" /b "%SYSTEM_NODE%" "%DIST_MAIN%" > "%SERVER_ROOT%\..\..\server.log" 2>&1
  echo [v] 后端已在后台启动，日志见 server.log
)

REM 3) 健康检查
echo ==^> 等待后端就绪 (http://localhost:%PORT%/health)
set "i=0"
:waitloop
curl -s -m 3 "http://localhost:%PORT%/health" >nul 2>&1
if %errorlevel%==0 (
  echo [v] 后端已就绪：%PORT%
  echo 后端 API: http://localhost:%PORT%/api
  exit /b 0
)
set /a i+=1
if %i% geq 30 (
  echo [x] 后端 30s 内未就绪，请查看 server.log
  exit /b 1
)
timeout /t 1 >nul
goto waitloop
