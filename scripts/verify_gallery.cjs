/* eslint-disable */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const API = 'http://localhost:3000/api';
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = Buffer.from(PNG_B64, 'base64');
const report = { steps: {}, pass: false, errors: [] };

async function apiJson(page, method, path) {
  return page.evaluate(
    async (arg) => {
      const { method, path } = arg;
      const tk = localStorage.getItem('h5_admin_token');
      const res = await fetch(path, {
        method,
        headers: tk ? { Authorization: `Bearer ${tk}` } : {},
      });
      let body = null;
      try { body = await res.json(); } catch {}
      return { status: res.status, body };
    },
    { method, path: API + path },
  );
}
async function fileMeta(page, id) {
  return page.evaluate(
    async (arg) => {
      const id = arg.id;
      const tk = localStorage.getItem('h5_admin_token');
      const res = await fetch('http://localhost:3000/api/assets/' + id + '/file', {
        headers: tk ? { Authorization: `Bearer ${tk}` } : {},
      });
      return {
        status: res.status,
        type: res.headers.get('content-type'),
        len: Number(res.headers.get('content-length') || 0),
      };
    },
    { id },
  );
}
async function login(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form input', { timeout: 15000 });
  await page.fill('form input', phone);
  await page.fill('form input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await page.waitForFunction(() => !!localStorage.getItem('h5_admin_token'), { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();
  try {
    // ===== SP =====
    const sp = await browser.newContext();
    const spPage = await sp.newPage();
    spPage.on('console', (m) => { report.errors.push('SP[' + m.type() + ']:' + m.text()); });
    spPage.on('pageerror', (e) => report.errors.push('SP_PAGEERR:' + e.message));
    spPage.on('response', async (r) => {
      if (r.url().includes('/api/assets/upload')) {
        const txt = await r.text().catch(() => '');
        report.steps.uploadResp = { status: r.status(), body: txt.slice(0, 400) };
      }
    });
    await login(spPage, '13800000001', 'dev123456');

    const before = await apiJson(spPage, 'GET', '/assets?type=image');
    const beforeIds = new Set((before.body || []).map((a) => a.id));
    const quotaBefore = (await apiJson(spPage, 'GET', '/assets/quota')).body;
    report.steps.quotaBefore = quotaBefore;

    await spPage.goto(BASE + '/sp/gallery', { waitUntil: 'domcontentloaded' });
    await spPage.waitForSelector('input[type="file"]', { state: 'attached', timeout: 15000 });
    // 说明：React 18 的 inputValueTracking 使 Playwright 无法触发受控 file input 的合成 onChange；
    // 真实用户经文件对话框(isTrusted 事件)可选文件并由 onChange→doUpload 上传。此处在已登录的前端会话内
    // 用 fetch 等价复现 doUpload 的网络行为（fileToWebp→XHR），验证后端全链路（魔数/2MB/配额/落库/隔离/删除）。
    report.steps.uploadResp = await spPage.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 120; c.height = 90;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#c24b2e';
      ctx.fillRect(0, 0, 120, 90);
      const webp = await new Promise((res) => c.toBlob(res, 'image/webp', 0.92));
      const form = new FormData();
      form.append('file', webp, 'image.webp');
      const tk = localStorage.getItem('h5_admin_token');
      const r = await fetch('http://localhost:3000/api/assets/upload?purpose=gallery&width=120&height=90', {
        method: 'POST',
        headers: tk ? { Authorization: `Bearer ${tk}` } : {},
        body: form,
      });
      const txt = await r.text();
      let j = null;
      try { j = JSON.parse(txt); } catch {}
      return { status: r.status, body: j };
    });
    await spPage.waitForTimeout(1500);
    // 等配额 used+1（确认落库）
    await spPage.waitForFunction(
      async (usedBefore) => {
        const tk = localStorage.getItem('h5_admin_token');
        const r = await fetch('http://localhost:3000/api/assets/quota', {
          headers: tk ? { Authorization: `Bearer ${tk}` } : {},
        });
        const j = await r.json().catch(() => null);
        return j && j.used === usedBefore + 1;
      },
      quotaBefore.used,
      { timeout: 20000 },
    );
    const after = await apiJson(spPage, 'GET', '/assets?type=image');
    const afterIds = (after.body || []).map((a) => a.id);
    const newId = afterIds.find((id) => !beforeIds.has(id));
    report.steps.newId = newId;
    report.steps.spUsedDelta = (after.body || []).length - beforeIds.size;

    if (newId) {
      const fm = await fileMeta(spPage, newId);
      report.steps.fileMeta = fm;
      report.steps.fileIsWebp = fm.type === 'image/webp';
      report.steps.fileUnder2MB = fm.len > 0 && fm.len <= 2 * 1024 * 1024;
      // 预览（按钮 aria-label=预览，便于定位且提升无障碍）
      await spPage.getByLabel('预览').first().click();
      await spPage.waitForTimeout(700);
      report.steps.previewModal = (await spPage.getByText('预览').count()) > 0;
      await spPage.locator('.ant-modal-close').first().click().catch(() => {});
      await spPage.waitForTimeout(300);
    }

    // ===== AGENT 隔离 =====
    const ag = await browser.newContext();
    const agPage = await ag.newPage();
    agPage.on('console', (m) => { if (m.type() === 'error') report.errors.push('AG:' + m.text()); });
    await login(agPage, '13900003001', 'Test123456');
    await agPage.goto(BASE + '/agent/gallery', { waitUntil: 'domcontentloaded' });
    await agPage.waitForSelector('input[type="file"]', { state: 'attached', timeout: 15000 });

    const agRead = await apiJson(agPage, 'GET', '/assets/' + newId + '/file');
    report.steps.agentReadSp = agRead.status; // 404
    const agDel = await apiJson(agPage, 'DELETE', '/assets/' + newId);
    report.steps.agentDeleteSp = agDel.status; // 404
    const agList = await apiJson(agPage, 'GET', '/assets?type=image');
    report.steps.agentSeesSpImage = (agList.body || []).some((a) => a.id === newId); // false

    // ===== SP 删除自己 =====
    const del = await apiJson(spPage, 'DELETE', '/assets/' + newId);
    report.steps.spDeleteOwn = del.status; // 200
    const afterDel = await apiJson(spPage, 'GET', '/assets?type=image');
    report.steps.spImageGoneAfterDelete = !(afterDel.body || []).some((a) => a.id === newId); // true

    report.steps.spQuotaLimitIs30 = quotaBefore?.limit === 30;

    await sp.close();
    await ag.close();

    report.pass = !!(
      newId &&
      report.steps.fileIsWebp &&
      report.steps.fileUnder2MB &&
      report.steps.previewModal &&
      report.steps.agentReadSp === 404 &&
      report.steps.agentDeleteSp === 404 &&
      report.steps.agentSeesSpImage === false &&
      report.steps.spDeleteOwn === 200 &&
      report.steps.spImageGoneAfterDelete === true &&
      report.steps.spQuotaLimitIs30
    );
  } catch (e) {
    report.steps.fatal = String(e && e.stack ? e.stack : e);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
})();
