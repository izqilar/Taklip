// Phase D acceptance: verify the single-language (system i18n) refactor of PlaceholderRegistry.
// Covers: schema columns, admin dialog degridding, i18n key completeness across 6 locales,
// editor read-path, and live endpoint payloads.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const fails = [];
const ok = [];
function check(name, cond, detail = '') {
  if (cond) ok.push(`[PASS] ${name}`);
  else fails.push(`[FAIL] ${name} ${detail}`);
}

function readRel(p) {
  const fp = resolve(ROOT, p);
  if (!existsSync(fp)) throw new Error(`missing file: ${p}`);
  return readFileSync(fp, 'utf8');
}

// ---- 1. Prisma schema: single-lang columns, no i18n JSONB ----
{
  const s = readRel('apps/server/prisma/schema.prisma');
  const m = s.match(/model\s+PlaceholderRegistry\s*\{([\s\S]*?)\n\}/);
  const body = m ? m[1] : '';
  check('schema: has label String', /\blabel\s+String\b/.test(body), body);
  check('schema: has hint String', /\bhint\s+String\b/.test(body));
  check('schema: has defaultValue String', /\bdefaultValue\s+String\b/.test(body));
  check('schema: no labelI18n JSONB', !/labelI18n/.test(body));
  check('schema: no hintI18n JSONB', !/hintI18n/.test(body));
  check('schema: no defaultI18n JSONB', !/defaultI18n/.test(body));
}

// ---- 2. Admin dialog: degridded, single-language Form.Items ----
{
  const t = readRel('apps/admin/src/pages/placeholders.tsx');
  check('admin.tsx: uses label Form.Item', /name=\s*['"]label['"]/.test(t));
  check('admin.tsx: uses hint Form.Item', /name=\s*['"]hint['"]/.test(t));
  check('admin.tsx: uses defaultValue Form.Item', /name=\s*['"]defaultValue['"]/.test(t));
  check('admin.tsx: no labelI18n', !/labelI18n/.test(t));
  check('admin.tsx: no hintI18n', !/hintI18n/.test(t));
  check('admin.tsx: no defaultI18n', !/defaultI18n/.test(t));
  check('admin.tsx: no LOCALES grid', !/\bLOCALES\b/.test(t));
  check('admin.tsx: no emptyI18n', !/emptyI18n/.test(t));
  check('admin.tsx: labelOf reads single-lang rec.label (not labelI18n)', /rec\?\.label(?!\w)/.test(t) && !/labelI18n/.test(t));
}

// ---- 3. i18n completeness across 6 locales (prevents fallback mixing) ----
{
  const locales = ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN'];
  const requiredKeys = ['colLabel','labelSection','label','labelTip','labelPh','labelRequired',
    'hintSection','hint','hintPh','defaultSection','defaultValue','defaultPhDatetime',
    'defaultPhAddress','defaultPhImage','defaultPhText','sub'];
  for (const l of locales) {
    const fp = `apps/admin/src/i18n/locales/${l}/common.json`;
    let j;
    try { j = JSON.parse(readRel(fp)); } catch (e) { check(`i18n ${l}: valid JSON`, false, e.message); continue; }
    const ph = j.placeholders || {};
    const missing = requiredKeys.filter((k) => !(k in ph));
    check(`i18n ${l}: placeholders block complete`, missing.length === 0, `missing=${missing.join(',')}`);
    const menuOk = !!(j.menu && j.menu.admin && j.menu.admin.placeholders);
    check(`i18n ${l}: menu.admin.placeholders present`, menuOk);
  }
}

// ---- 4. Editor read-path: single-lang, no i18n JSONB ----
{
  const svc = readRel('packages/editor/src/services.ts');
  check('editor services: PlaceholderRegistryEntry has label', /label\??:\s*string/.test(svc));
  check('editor services: no labelI18n in entry', !/labelI18n/.test(svc));
  const reg = readRel('packages/editor/src/placeholderRegistry.ts');
  check('editor registry: placeholderLabel returns entry.label', /entry\.label/.test(reg));
  check('editor registry: placeholderDefault returns entry.defaultValue', /entry\.defaultValue/.test(reg));
  check('editor registry: no labelI18n', !/labelI18n/.test(reg));
}

// ---- 5. Live endpoints: single-lang payload, no i18n JSONB ----
const BASE = 'http://localhost:3000';
async function login(phone, password) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  if (!r.ok) throw new Error(`login ${phone} -> ${r.status}`);
  const j = await r.json();
  return j.accessToken || j.access_token || j.token;
}
function assertSingle(items, tag) {
  for (const it of items) {
    if (['labelI18n','hintI18n','defaultI18n'].some((k) => k in it))
      throw new Error(`[${tag}] still exposes i18n JSONB`);
    if (typeof it.label !== 'string') throw new Error(`[${tag}] label not string`);
  }
}
async function getList(path, token, tag) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  const j = await r.json();
  const items = Array.isArray(j) ? j : (j.items || j.data || []);
  assertSingle(items, tag);
  return items.length;
}
try {
  const adminTok = await login('13800000002', 'dev123456');
  const n1 = await getList('/api/admin/placeholders', adminTok, 'admin');
  check(`endpoint /api/admin/placeholders single-lang (${n1} items)`, true);
  const userTok = await login('13900001001', 'Test123456');
  const n2 = await getList('/api/console/placeholders', userTok, 'console');
  check(`endpoint /api/console/placeholders single-lang (${n2} items)`, true);
} catch (e) { check('live endpoints', false, e.message); }

// ---- report ----
console.log(ok.join('\n'));
if (fails.length) { console.error('\n' + fails.join('\n')); console.error(`\n${fails.length} check(s) FAILED`); process.exit(1); }
console.log(`\nALL ${ok.length} PHASE D CHECKS PASSED`);
