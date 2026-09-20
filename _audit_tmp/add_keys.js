/**
 * Targeted key insertion into locale JSON, preserving original formatting.
 * Inserts `<key>: <value>` just before the closing brace of the target object.
 */
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';
const log = [];

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

/** find index of the key token's value start, and matching close brace for object at that value */
function findKeyObjectRange(text, from, key) {
  // searche for "key": { starting search at index `from`
  const re = new RegExp('"' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:\\s*\\{');
  const m = re.exec(text.slice(from));
  if (!m) return null;
  const openIdx = from + m.index + m[0].length - 1; // index of '{'
  let depth = 0, inS = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inS) { if (c === '\\') i++; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { openIdx, closeIdx: i }; }
  }
  return null;
}

function addKey(text, parentPath, key, value) {
  let from = 0;
  if (parentPath.length) {
    for (const pk of parentPath) {
      const r = findKeyObjectRange(text, from, pk);
      if (!r) return failMissing(parentPath, pk);
      from = r.openIdx;
    }
  }
  const obj = JSON.parse('{}');
  void obj;
  const rootObj = JSON.parse(text);
  void rootObj;
  // locate target object range by walking from `from`
  let openIdx = -1, closeIdx = text.lastIndexOf('}');
  if (parentPath.length) {
    let cursor = 0;
    for (const pk of parentPath) {
      const r = findKeyObjectRange(text, cursor, pk);
      if (!r) return { text, error: 'parent not found: ' + pk };
      openIdx = r.openIdx; closeIdx = r.closeIdx;
      cursor = r.openIdx + 1;
    }
  } else {
    // root: first '{'
    openIdx = text.indexOf('{');
    let depth = 0, inS = false;
    for (let i = openIdx; i < text.length; i++) {
      const c = text[i];
      if (inS) { if (c === '\\') i++; else if (c === '"') inS = false; continue; }
      if (c === '"') { inS = true; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { closeIdx = i; break; } }
    }
  }
  const body = text.slice(openIdx + 1, closeIdx);
  const trimmed = body.trim();
  const indentMatch = text.slice(0, closeIdx).split('\n').slice(-1)[0].match(/^(\s*)/);
  const indent = (indentMatch ? indentMatch[1] : '  ');
  const childIndent = indent + '  ';
  const entry = childIndent + JSON.stringify(key) + ': ' + JSON.stringify(value);
  let insertion;
  if (trimmed === '') insertion = '\n' + entry + '\n' + indent;
  else {
    // append after last non-empty char of body, add comma
    const bodyEnd = closeIdx; // insert before close brace
    const before = body.replace(/\s+$/, '');
    const needsComma = !before.endsWith(',') && before !== '';
    insertion = before + (needsComma ? ',' : '') + '\n' + entry + '\n' + indent;
    return { text: text.slice(0, openIdx + 1) + insertion + text.slice(bodyEnd), ok: true };
  }
  return { text: text.slice(0, openIdx + 1) + insertion + text.slice(closeIdx), ok: true };
}
function failMissing(parentPath, pk) { return { text: null, error: 'parent not found ' + parentPath.join('.') + ' at ' + pk }; }

const TASKS = [
  // errors:error.loadFailed  (web + admin, zh-CN + en only)
  { file: 'apps/web/src/i18n/locales/zh-CN/errors.json', parent: ['error'], key: 'loadFailed', value: '加载失败，请重试' },
  { file: 'apps/web/src/i18n/locales/en/errors.json', parent: ['error'], key: 'loadFailed', value: 'Failed to load, please try again' },
  { file: 'apps/admin/src/i18n/locales/zh-CN/errors.json', parent: ['error'], key: 'loadFailed', value: '加载失败，请重试' },
  { file: 'apps/admin/src/i18n/locales/en/errors.json', parent: ['error'], key: 'loadFailed', value: 'Failed to load, please try again' },
  // error.submitReviewFailed missing in en (both apps)
  { file: 'apps/web/src/i18n/locales/en/errors.json', parent: ['error'], key: 'submitReviewFailed', value: 'Failed to submit qualification review, please retry' },
  { file: 'apps/admin/src/i18n/locales/en/errors.json', parent: ['error'], key: 'submitReviewFailed', value: 'Failed to submit qualification review, please retry' },
  // admin en pages.error.404 / backHome
  { file: 'apps/admin/src/i18n/locales/en/common.json', parent: ['pages', 'error'], key: '404', value: 'Page not found (404)' },
  { file: 'apps/admin/src/i18n/locales/en/common.json', parent: ['pages', 'error'], key: 'backHome', value: 'Back to home' },
  // editor:page.noPageData
  { file: 'apps/web/src/i18n/locales/zh-CN/editor.json', parent: ['page'], key: 'noPageData', value: '当前页面无数据' },
  { file: 'apps/web/src/i18n/locales/en/editor.json', parent: ['page'], key: 'noPageData', value: 'No data for this page' },
  { file: 'apps/admin/src/i18n/locales/zh-CN/editor.json', parent: ['page'], key: 'noPageData', value: '当前页面无数据' },
  { file: 'apps/admin/src/i18n/locales/en/editor.json', parent: ['page'], key: 'noPageData', value: 'No data for this page' },
];

// group tasks by file so we can apply sequentially to accumulating text
const byFile = {};
for (const t of TASKS) { (byFile[t.file] = byFile[t.file] || []).push(t); }

for (const rel of Object.keys(byFile)) {
  const p = path.join(ROOT, rel);
  let text = fs.readFileSync(p, 'utf8');
  for (const t of byFile[rel]) {
    const before = JSON.parse(text);
    const exists = t.parent.reduce((a, k) => (a == null ? a : a[k]), before);
    if (exists && t.key in exists) { log.push(`${rel}: ${t.parent.join('.')}.${t.key} already exists, skip`); continue; }
    const r = addKey(text, t.parent, t.key, t.value);
    if (r.error) { log.push(`${rel}: ERROR ${r.error}`); continue; }
    let ok = true;
    try { JSON.parse(r.text); } catch (e) { ok = false; log.push(`${rel}: JSON INVALID after adding ${t.key}: ${e.message}`); }
    if (!ok) continue;
    text = r.text;
    log.push(`${rel}: added ${t.parent.join('.')}.${t.key}`);
  }
  const dups = dupScan(text);
  fs.writeFileSync(p, text, 'utf8');
  const after = JSON.parse(text);
  const chk = byFile[rel].map(t => t.parent.concat([t.key]).join('.') + '=' + (t.parent.concat([t.key]).reduce((a, k) => (a == null ? a : a[k]), after) !== undefined)).join(' ');
  log.push(`   -> written dups=${dups.length} ${dups.length ? JSON.stringify(dups) : ''} verify: ${chk}`);
}

fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'keys_result.txt'), log.join('\n'), 'utf8');
