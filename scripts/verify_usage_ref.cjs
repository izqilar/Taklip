/* eslint-disable */
/**
 * 验证「图库图 → 作品引用」链路与 usedInWorks 状态口径（后端真值）：
 *  1) 上传一张图库图 G → 列表 usedInWorks === 0（未使用）
 *  2) 按编辑器选择器的方式转存 media 副本（purpose=media & derivedFrom=G）
 *  3) 列表 G.usedInWorks === 1（已使用）—— 证明 derivedFrom 已落库、状态可实时反映
 *  4) DELETE G（不带 force）→ 409 IN_USE（删除级联保护与标签同源联动）
 *  5) 清理：force 删 G 与副本
 */
const API = 'http://localhost:3000/api';
const PHONE = '13900001001';
const PASSWORD = 'Test123456';
const report = { steps: {}, errors: [] };

async function api(path, { method = 'GET', token, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(API + path, { method, headers, body: form });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

/** 造一张小 webp（Node 侧硬编码 1x1 webp，避免依赖 canvas） */
const WEBP_1x1 = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);

(async () => {
  // 1) 登录
  const login = await api('/auth/login', {
    method: 'POST',
    form: (() => {
      const f = new FormData();
      f.append('phone', PHONE);
      f.append('password', PASSWORD);
      return f;
    })(),
  });
  if (login.status !== 200 && login.status !== 201) {
    // 有些实现要求 JSON body
    const r2 = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
    });
    login.status = r2.status;
    login.body = await r2.json().catch(() => null);
  }
  const token = login.body?.accessToken || login.body?.access_token || login.body?.token;
  report.steps.login = { status: login.status, hasToken: !!token };
  if (!token) throw new Error('login failed: ' + JSON.stringify(login.body));

  let galleryId = null;
  let copyId = null;
  try {
    // 2) 上传图库图 G
    const upForm = new FormData();
    upForm.append('file', new Blob([WEBP_1x1], { type: 'image/webp' }), 'image.webp');
    const up = await api('/assets/upload?purpose=gallery&width=1&height=1', {
      method: 'POST',
      token,
      form: upForm,
    });
    galleryId = up.body?.id;
    report.steps.uploadGallery = { status: up.status, id: galleryId };
    if (!galleryId) throw new Error('gallery upload failed: ' + JSON.stringify(up.body));

    const listBefore = await api('/assets?type=image&galleryOnly=1', { token });
    const before = (listBefore.body || []).find((a) => a.id === galleryId);
    report.steps.beforeUsage = { usedInWorks: before?.usedInWorks };

    // 3) 转存 media 副本（等价编辑器 openAssetPicker 的 uploadAsset({derivedFrom})）
    const cForm = new FormData();
    cForm.append('file', new Blob([WEBP_1x1], { type: 'image/webp' }), 'image.webp');
    const cp = await api(`/assets/upload?derivedFrom=${encodeURIComponent(galleryId)}&width=1&height=1`, {
      method: 'POST',
      token,
      form: cForm,
    });
    copyId = cp.body?.id;
    report.steps.uploadCopy = { status: cp.status, id: copyId };
    if (!copyId) throw new Error('copy upload failed: ' + JSON.stringify(cp.body));

    // 4) 再查列表：G 应变为「已使用」
    const listAfter = await api('/assets?type=image&galleryOnly=1', { token });
    const after = (listAfter.body || []).find((a) => a.id === galleryId);
    report.steps.afterUsage = { usedInWorks: after?.usedInWorks };
    report.steps.copyNotInGalleryList = !(listAfter.body || []).some((a) => a.id === copyId);

    // 5) 删除保护（与标签同源）：不带 force 应 409
    const del = await api(`/assets/${galleryId}`, { method: 'DELETE', token });
    report.steps.deleteWithoutForce = del.status;

    report.steps.pass =
      before?.usedInWorks === 0 &&
      after?.usedInWorks === 1 &&
      report.steps.copyNotInGalleryList === true &&
      del.status === 409;
  } catch (e) {
    report.steps.fatal = String(e && e.stack ? e.stack : e);
  } finally {
    // 清理
    for (const id of [copyId, galleryId]) {
      if (!id) continue;
      const r = await api(`/assets/${id}?force=1`, { method: 'DELETE', token });
      report.steps['cleanup_' + (id === copyId ? 'copy' : 'gallery')] = r.status;
    }
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.steps.pass ? 0 : 1);
})();
