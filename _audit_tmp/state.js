const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';
const out = [];

function dupScan(text) {
  const dups = []; const stack = []; const pathStack = [];
  let i = 0, line = 1, pendingKey = null; const len = text.length;
  while (i < len) {
    const c = text[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '{') { stack.push({ keys: new Map() }); pathStack.push(pendingKey); pendingKey = null; i++; continue; }
    if (c === '}') { stack.pop(); pathStack.pop(); pendingKey = null; i++; continue; }
    if (c === '[') { pathStack.push(pendingKey); pendingKey = null; i++; continue; }
    if (c === ']') { pathStack.pop(); i++; continue; }
    if (c === ':' || c === ',') { pendingKey = null; i++; continue; }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < len) { if (text[j] === '\\') { s += text[j + 1]; j += 2; continue; } if (text[j] === '"') break; s += text[j]; j++; }
      const startLine = line;
      for (let k = 0; k < j + 1 - i; k++) if (text[i + k] === '\n') line++;
      i = j + 1;
      let k = i; while (k < len && /[\s]/.test(text[k])) k++;
      if (text[k] === ':' && stack.length > 0) {
        const top = stack[stack.length - 1];
        const p = pathStack.filter(x => x != null).concat([s]);
        if (top.keys.has(s)) dups.push({ path: p.join('.'), line: startLine }); else top.keys.set(s, startLine);
        pendingKey = s;
      }
      continue;
    }
    i++;
  }
  return dups;
}

// 1) all locale files parse + dup check
const LANGS = ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN'];
let parseFail = 0, dupFiles = 0, total = 0;
const dupDetail = [];
for (const app of ['web', 'admin']) {
  for (const lang of LANGS) {
    const dir = path.join(ROOT, 'apps', app, 'src', 'i18n', 'locales', lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      total++;
      const p = path.join(dir, f); const t = fs.readFileSync(p, 'utf8');
      try { JSON.parse(t); } catch (e) { parseFail++; out.push('PARSE FAIL: ' + p + ' ' + e.message); continue; }
      const d = dupScan(t);
      if (d.length) { dupFiles++; dupDetail.push(p.replace(ROOT, '') + ' -> ' + JSON.stringify(d)); }
    }
  }
}
out.push(`locale files: ${total}  parseFail=${parseFail}  filesWithDupKeys=${dupFiles}`);
dupDetail.forEach(d => out.push('  DUP ' + d));

// 2) zoom presence in admin editor.json x6
out.push('');
out.push('=== admin editor.json zoom ===');
for (const lang of LANGS) {
  const p = path.join(ROOT, 'apps/admin/src/i18n/locales', lang, 'editor.json');
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  const z = o.zoom;
  const vals = z ? ['out', 'reset', 'in', 'fit', 'fitShort'].map(k => (z[k] == null || z[k] === '') ? 'MISSING:' + k : null).filter(Boolean) : null;
  out.push(`  ${lang}: ${z ? 'present keys=[' + Object.keys(z).join(',') + ']' : 'ABSENT'}${vals ? ' ' + vals.join(',') : ''}`);
}

// 3) target keys presence
function get(app, lang, file, keyPath) {
  try {
    const o = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', app, 'src/i18n/locales', lang, file + '.json'), 'utf8'));
    return keyPath.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  } catch (e) { return 'PARSE_ERR'; }
}
out.push('');
out.push('=== target keys ===');
const checks = [
  ['web', 'zh-CN', 'errors', 'error.loadFailed'], ['web', 'en', 'errors', 'error.loadFailed'],
  ['admin', 'zh-CN', 'errors', 'error.loadFailed'], ['admin', 'en', 'errors', 'error.loadFailed'],
  ['admin', 'zh-CN', 'common', 'pages.error.404'], ['admin', 'en', 'common', 'pages.error.404'],
  ['admin', 'zh-CN', 'common', 'pages.error.backHome'], ['admin', 'en', 'common', 'pages.error.backHome'],
  ['web', 'zh-CN', 'errors', 'error.submitReviewFailed'], ['web', 'en', 'errors', 'error.submitReviewFailed'],
  ['admin', 'zh-CN', 'errors', 'error.submitReviewFailed'], ['admin', 'en', 'errors', 'error.submitReviewFailed'],
  ['web', 'zh-CN', 'editor', 'page.noPageData'], ['web', 'en', 'editor', 'page.noPageData'],
  ['admin', 'zh-CN', 'editor', 'page.noPageData'], ['admin', 'en', 'editor', 'page.noPageData'],
];
for (const [app, lang, file, kp] of checks) {
  const v = get(app, lang, file, kp);
  out.push(`  ${app}/${lang}/${file}.json :: ${kp} => ${v === undefined ? 'MISSING' : JSON.stringify(v)}`);
}

// 4) remaining t(...) || '...' patterns
out.push('');
out.push('=== t(...) || literal  remaining ===');
const SCAN = ['apps/web/src', 'apps/admin/src', 'packages/ui/src', 'packages/render/src', 'packages/editor/src', 'packages/core/src'];
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];
function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(e.name)) walk(p, acc); }
    else if (EXTS.includes(path.extname(e.name))) acc.push(p);
  }
  return acc;
}
const files = []; for (const d of SCAN) walk(path.join(ROOT, d), files);
let n = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (/\bt\([^)]*\)\s*\|\|\s*['"`]/.test(ln) || /\bt\([^)]*\)\s*\?\?\s*['"`]/.test(ln)) {
      n++; out.push(`  ${f.replace(ROOT, '')}:${i + 1}\n      ${ln.trim()}`);
    }
  });
}
out.push('  COUNT=' + n);

// 5) regions.tsx alive guard
out.push('');
const rg = fs.readFileSync(path.join(ROOT, 'apps/admin/src/pages/regions.tsx'), 'utf8');
out.push('regions.tsx alive count=' + (rg.match(/alive/g) || []).length);

fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'state.txt'), out.join('\n'), 'utf8');
