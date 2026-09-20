#!/usr/bin/env node
/**
 * server-watchdog.js - backend :3000 self-healing watchdog (Windows/Linux)
 *
 * Mirrors scripts/keep-server.sh. Launched DETACHED by startup.ps1.
 * Every CHECK_INTERVAL seconds it probes http://127.0.0.1:3000/health:
 *   - connection refused / timeout -> start node
 *   - any HTTP response (incl 4xx/5xx) -> considered alive (server answered)
 * Only a CONNECTION FAILURE is treated as "down", so a missing /health route
 * (404) never triggers a false restart while a dead/hung process is recovered.
 *
 * Usage:
 *   node scripts/server-watchdog.js [ROOT]
 *   ROOT defaults to the parent of this script's directory.
 *
 * stop:  kill the node process whose command line contains server-watchdog.js
 *        (killing it stops auto-restart; then kill the server by port 3000)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..');
const SRV = path.join(ROOT, 'apps', 'server');
const PORT = 3000;
const HEALTH_URL = { host: '127.0.0.1', port: PORT, path: '/health', timeout: 3000 };
const LOG = path.join(ROOT, 'server.log');
const ERR = path.join(ROOT, 'server.err');
const WDLOG = path.join(ROOT, 'server-watchdog.log');
const CHECK_INTERVAL = 5000;

let currentPid = null;

function wdLog(msg) {
  const line = `${new Date().toISOString()} [watchdog] ${msg}\n`;
  try {
    fs.appendFileSync(WDLOG, line);
  } catch (e) {
    // best-effort; never let logging break the watchdog loop
  }
}

function probeAlive() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(true); // any HTTP response => server is up
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function distExists() {
  return fs.existsSync(path.join(SRV, 'dist', 'main.js'));
}

function startServer() {
  if (!distExists()) {
    wdLog('dist/main.js missing, waiting for build');
    return;
  }
  let outFd;
  let errFd;
  try {
    outFd = fs.openSync(LOG, 'a');
    errFd = fs.openSync(ERR, 'a');
  } catch (e) {
    wdLog(`cannot open logs: ${e.message}`);
    return;
  }
  try {
    const child = spawn('node', ['dist/main.js'], {
      cwd: SRV,
      detached: true,
      stdio: ['ignore', outFd, errFd],
    });
    child.unref();
    currentPid = child.pid;
    wdLog(`server not listening, started node pid ${currentPid}`);
  } catch (e) {
    wdLog(`failed to start node: ${e.message}`);
  }
}

function stopCurrent() {
  if (currentPid) {
    try {
      process.kill(currentPid, 'SIGKILL');
    } catch (e) {
      /* already gone */
    }
    wdLog(`killed unhealthy node pid ${currentPid}`);
    currentPid = null;
  }
}

async function tick() {
  if (!distExists()) {
    wdLog('dist/main.js missing, waiting for build');
    return;
  }
  const alive = await probeAlive();
  if (!alive) {
    wdLog('server unhealthy (no response), restarting');
    stopCurrent();
    startServer();
  }
}

let stopped = false;
async function loop() {
  while (!stopped) {
    try {
      await tick();
    } catch (e) {
      wdLog(`tick error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
  }
}

process.on('SIGINT', () => {
  stopped = true;
  stopCurrent();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopped = true;
  stopCurrent();
  process.exit(0);
});

wdLog(`started, monitoring :${PORT} (root=${ROOT})`);
loop();
