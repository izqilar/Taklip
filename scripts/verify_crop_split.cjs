/* eslint-disable */
/**
 * 验证「裁剪」对话框按钮拆分（web 用户端 + admin 服务商端）：
 *  - 「裁剪」：原位替换原图，不新建行、不占配额；尺寸/sha256 更新。
 *  - 「保存为新图」：生成裁剪后的新图，占配额；配额满时提示且不裁剪（web 端验证）。
 * 修复点：浏览器内所有 API 走绝对 http://localhost:3000（admin 的 Vite 不代理 /api）；
 *         上传后 reload 让 React 列表渲染卡片（fetch 上传不会触发 React 刷新）。
 */
const { chromium } = require('playwright');

const WEB = 'http://localhost:5173';
const ADMIN = 'http://localhost:5174';
const API = 'http://localhost:3000';
const report = { web: {}, admin: {}, errors: [] };

async function login(page, base, phone, password, tokenKey) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const ok = await page.evaluate(
    async ({ api, phone, password, tokenKey }) => {
      const res = await fetch(api + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) return false;
      const j = await res.json();
      const data = j?.data ?? j;
      const tk = data?.accessToken || data?.token;
      if (!tk) return false;
      localStorage.setItem(tokenKey, tk);
      // web 路由守卫要求 user_info / h5_admin_user 同时存在，否则重定向登录页
      const uiKey = tokenKey === 'access_token' ? 'user_info' : tokenKey === 'h5_admin_token' ? 'h5_admin_user' : null;
      if (uiKey && (data?.user || data?.home)) {
        localStorage.setItem(uiKey, JSON.stringify({ ...(data?.user ?? {}), home: data?.home }));
      }
      return true;
    },
    { api: API, phone, password, tokenKey },
  );
  return ok;
}

// 在页面会话内上传一张图库图（canvas 生成 webp），返回 {id, width, height}
async function uploadGallery(page, tk0, w, h, color) {
  return page.evaluate(
    async ({ api, tk0, w, h, color }) => {
      const tk = localStorage.getItem(tk0);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = color;
      x.fillRect(0, 0, w, h);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.92));
      const form = new FormData();
      form.append('file', blob, 'image.webp');
      const r = await fetch(api + `/api/assets/upload?purpose=gallery&width=${w}&height=${h}`, {
        method: 'POST',
        headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
        body: form,
      });
      const j = await r.json();
      return { id: j?.id || j?.data?.id, width: j?.width, height: j?.height, status: r.status };
    },
    { api: API, tk0, w, h, color },
  );
}

async function listGallery(page, tk0) {
  return page.evaluate(
    async ({ api, tk0 }) => {
      const tk = localStorage.getItem(tk0);
      const r = await fetch(api + '/api/assets?type=image&galleryOnly=1', {
        headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
      });
      return await r.json();
    },
    { api: API, tk0 },
  );
}

async function deleteAll(page, tk0) {
  const list = await listGallery(page, tk0);
  for (const a of list || []) {
    await page.evaluate(
      async ({ api, tk0, id }) => {
        const tk = localStorage.getItem(tk0);
        await fetch(api + '/api/assets/' + id + '?force=1', {
          method: 'DELETE',
          headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
        });
      },
      { api: API, tk0, id: a.id },
    );
  }
  return (list || []).length;
}

async function getQuota(page, tk0) {
  return page.evaluate(
    async ({ api, tk0 }) => {
      const tk = localStorage.getItem(tk0);
      const r = await fetch(api + '/api/assets/quota', {
        headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
      });
      return await r.json();
    },
    { api: API, tk0 },
  );
}

async function drawSelection(page, dialogSel, ox, oy, sw, sh) {
  const box = await page.locator(dialogSel + ' div[style*="cursor: crosshair"]').first().boundingBox();
  if (!box) return false;
  const x1 = box.x + ox;
  const y1 = box.y + oy;
  const x2 = box.x + ox + sw;
  const y2 = box.y + oy + sh;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 5 });
  await page.mouse.move(x2, y2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  return true;
}

async function webFlow(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push('web pageerror: ' + e.message));
  page.on('dialog', (d) => {
    report.web.alertMsg = d.message();
    d.dismiss().catch(() => {});
  });
  const tokenKey = 'access_token';
  const ok = await login(page, WEB, '13900001002', 'Test123456', tokenKey);
  if (!ok) {
    report.web.pass = false;
    report.web.reason = 'login failed';
    return;
  }
  await deleteAll(page, tokenKey);
  await page.goto(WEB + '/user/gallery', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1) 上传原图 A（300x200，display 与 nat 1:1，便于断言裁剪尺寸）
  const A = await uploadGallery(page, tokenKey, 300, 200, '#1144cc');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  let list = await listGallery(page, tokenKey);
  const a0 = list.find((x) => x.id === A.id);
  const used0 = list.length;

  // 2) 打开 A 的裁剪弹窗（第一张卡片「裁剪」按钮）
  await page.locator('button[aria-label="裁剪"]').first().click();
  await page.waitForSelector('[role="dialog"] div[style*="cursor: crosshair"]', { timeout: 5000 });
  await page.waitForTimeout(700);
  // 框选 200x120 区域（1:1）
  await drawSelection(page, '[role="dialog"]', 50, 40, 200, 120);

  // 3) 点「裁剪」→ 替换原图（不占配额）
  await page.locator('[role="dialog"] button', { hasText: /裁\s*剪/ }).first().click();
  await page.waitForTimeout(900);
  let list2 = await listGallery(page, tokenKey);
  const a1 = list2.find((x) => x.id === A.id);
  report.web.replace = {
    usedBefore: used0,
    usedAfter: list2.length,
    wBefore: a0?.width,
    wAfter: a1?.width,
    hBefore: a0?.height,
    hAfter: a1?.height,
    shaChanged: a0?.sha256 !== a1?.sha256,
  };

  // 3b) 非满额时「保存为新图」应新建一张（count 1 → 2）
  await page.locator('button[aria-label="裁剪"]').first().click();
  await page.waitForSelector('[role="dialog"] div[style*="cursor: crosshair"]', { timeout: 5000 });
  await page.waitForTimeout(700);
  await drawSelection(page, '[role="dialog"]', 30, 30, 100, 80);
  await page.locator('[role="dialog"] button', { hasText: '保存为新图' }).first().click();
  await page.waitForTimeout(900);
  const list3 = await listGallery(page, tokenKey);
  report.web.saveAsNewCreate = {
    before: list2.length,
    after: list3.length,
    incremented: list3.length === list2.length + 1,
  };

  // 4) 填满到真实配额上限（该用户 PAID tier，limit 可能 >4），reload 让 UI 配额刷新
  const q = await getQuota(page, tokenKey);
  const limit = q?.limit ?? 4;
  let cur = (await listGallery(page, tokenKey)).length; // A 已占 1
  const fillerColors = ['#22aa33', '#33aa22', '#44aa11', '#55aa00', '#66aa11'];
  let fi = 0;
  while (cur < limit && fi < 40) {
    await uploadGallery(page, tokenKey, 120, 90, fillerColors[fi % fillerColors.length]);
    cur = (await listGallery(page, tokenKey)).length;
    fi++;
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const usedFull = (await listGallery(page, tokenKey)).length;

  // 5) 打开 A 的裁剪（A 最旧 → 列表末位卡片），点「保存为新图」→ 应弹配额提示且不新增
  report.web.alertMsg = undefined;
  const cropBtns = page.locator('button[aria-label="裁剪"]');
  const n = await cropBtns.count();
  await cropBtns.nth(n - 1).click();
  await page.waitForSelector('[role="dialog"] div[style*="cursor: crosshair"]', { timeout: 5000 });
  await drawSelection(page, '[role="dialog"]', 30, 30, 100, 80);
  await page.locator('[role="dialog"] button', { hasText: '保存为新图' }).first().click();
  await page.waitForTimeout(900);
  const usedAfterSave = (await listGallery(page, tokenKey)).length;
  report.web.saveWhenFull = {
    usedFull,
    usedAfterSave,
    alertShown: report.web.alertMsg,
    noNewCreated: usedAfterSave === usedFull,
  };

  await deleteAll(page, tokenKey);
  report.web.pass =
    report.web.replace.usedBefore === 1 &&
    report.web.replace.usedAfter === 1 &&
    report.web.replace.wAfter === 200 &&
    report.web.replace.hAfter === 120 &&
    report.web.replace.shaChanged === true &&
    report.web.saveAsNewCreate.incremented === true &&
    report.web.saveWhenFull.noNewCreated === true &&
    !!report.web.saveWhenFull.alertShown;
  await ctx.close();
}

async function adminFlow(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push('admin pageerror: ' + e.message));
  const tokenKey = 'h5_admin_token';
  const ok = await login(page, ADMIN, '13800000001', 'dev123456', tokenKey);
  if (!ok) {
    report.admin.pass = false;
    report.admin.reason = 'login failed';
    return;
  }
  await deleteAll(page, tokenKey);
  await page.goto(ADMIN + '/sp/gallery', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 上传原图 A（300x200）
  const A = await uploadGallery(page, tokenKey, 300, 200, '#cc4411');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const list0 = await listGallery(page, tokenKey);
  const a0 = list0.find((x) => x.id === A.id);
  const used0 = list0.length;

  // 打开裁剪（卡片「裁剪」 IconBtn aria-label="裁剪"）
  await page.locator('button[aria-label="裁剪"]').first().click();
  await page.waitForSelector('.ant-modal div[style*="cursor: crosshair"]', { timeout: 5000 });
  await page.waitForTimeout(700);
  await drawSelection(page, '.ant-modal', 50, 40, 200, 120);

  // 两个按钮是否都在
  const hasCrop = await page.locator('.ant-modal button', { hasText: /裁\s*剪/ }).count();
  const hasSave = await page.locator('.ant-modal button', { hasText: '保存为新图' }).count();
  report.admin.buttons = { hasCrop: hasCrop > 0, hasSave: hasSave > 0 };

  // 点「裁剪」→ 替换原图
  await page.locator('.ant-modal button', { hasText: /裁\s*剪/ }).first().click();
  await page.waitForTimeout(900);
  const list1 = await listGallery(page, tokenKey);
  const a1 = list1.find((x) => x.id === A.id);
  report.admin.replace = {
    usedBefore: used0,
    usedAfter: list1.length,
    wAfter: a1?.width,
    hAfter: a1?.height,
    shaChanged: a0?.sha256 !== a1?.sha256,
  };

  // 点「保存为新图」→ 新图（used+1）
  await page.locator('button[aria-label="裁剪"]').first().click();
  await page.waitForSelector('.ant-modal div[style*="cursor: crosshair"]', { timeout: 5000 });
  await page.waitForTimeout(700);
  await drawSelection(page, '.ant-modal', 30, 30, 100, 80);
  await page.locator('.ant-modal button', { hasText: '保存为新图' }).first().click();
  await page.waitForTimeout(900);
  const list2 = await listGallery(page, tokenKey);
  report.admin.saveAsNew = { usedBefore: list1.length, usedAfter: list2.length, incremented: list2.length === list1.length + 1 };

  await deleteAll(page, tokenKey);
  report.admin.pass =
    report.admin.buttons.hasCrop &&
    report.admin.buttons.hasSave &&
    report.admin.replace.usedBefore === 1 &&
    report.admin.replace.usedAfter === 1 &&
    report.admin.replace.wAfter === 200 &&
    report.admin.replace.hAfter === 120 &&
    report.admin.replace.shaChanged === true &&
    report.admin.saveAsNew.incremented === true;
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await webFlow(browser);
  } catch (e) {
    report.web.pass = false;
    report.web.error = String(e && e.stack ? e.stack : e);
  }
  try {
    await adminFlow(browser);
  } catch (e) {
    report.admin.pass = false;
    report.admin.error = String(e && e.stack ? e.stack : e);
  }
  await browser.close();
  report.pass = report.web.pass === true && report.admin.pass === true;
  console.log(JSON.stringify(report, null, 2));
})();
