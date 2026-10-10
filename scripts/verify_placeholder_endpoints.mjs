// Phase C-7 endpoint verification: ensure single-language fields returned, no i18n JSONB.
const BASE = 'http://localhost:3000';

async function login(phone, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!r.ok) throw new Error(`login ${phone} failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.accessToken || j.access_token || j.token || (j.data && (j.data.accessToken || j.data.access_token || j.data.token));
}

function assertSingleLang(item, tag) {
  const bad = ['labelI18n', 'hintI18n', 'defaultI18n'].filter((k) => k in item);
  if (bad.length) throw new Error(`[${tag}] still exposes i18n JSONB keys: ${bad.join(', ')}`);
  const need = ['label'];
  const missing = need.filter((k) => !(k in item));
  if (missing.length) throw new Error(`[${tag}] missing single-lang key: ${missing.join(', ')}`);
  // label must be a plain string, not an object
  if (typeof item.label !== 'string') throw new Error(`[${tag}] label is not string: ${JSON.stringify(item.label)}`);
}

async function getList(path, token, tag) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const items = Array.isArray(j) ? j : (j.items || j.data || j);
  if (!Array.isArray(items)) throw new Error(`[${tag}] unexpected payload: ${JSON.stringify(j).slice(0, 300)}`);
  items.forEach((it) => assertSingleLang(it, tag));
  return items;
}

(async () => {
  let fail = 0;
  try {
    const adminTok = await login('13800000002', 'dev123456');
    const adminItems = await getList('/api/admin/placeholders', adminTok, 'admin');
    console.log(`[PASS] /api/admin/placeholders -> ${adminItems.length} items, all single-lang`);
    console.log('       sample:', JSON.stringify(adminItems[0]).slice(0, 200));
  } catch (e) { fail++; console.error('[FAIL] admin:', e.message); }

  try {
    const userTok = await login('13900001001', 'Test123456');
    const userItems = await getList('/api/console/placeholders', userTok, 'console');
    console.log(`[PASS] /api/console/placeholders -> ${userItems.length} items, all single-lang`);
    console.log('       sample:', JSON.stringify(userItems[0]).slice(0, 200));
  } catch (e) { fail++; console.error('[FAIL] console:', e.message); }

  if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
  console.log('\nALL ENDPOINT CHECKS PASSED');
})();
