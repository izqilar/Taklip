const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';
const LANGS = ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN'];
const log = [];

// duplicate-key detector (reused)
function dupScan(text) {
  const dups = [];
  const stack = []; const pathStack = [];
  let i = 0, line = 1, pendingKey = null;
  const len = text.length;
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
      while (j < len) {
        if (text[j] === '\\') { s += text[j + 1]; j += 2; continue; }
        if (text[j] === '"') break;
        s += text[j]; j++;
      }
      const startLine = line;
      for (let k = 0; k < j + 1 - i; k++) { if (text[i + k] === '\n') { line++; } }
      i = j + 1;
      let k = i;
      while (k < len && /[\s]/.test(text[k])) k++;
      const isKey = text[k] === ':' && stack.length > 0;
      if (isKey) {
        const top = stack[stack.length - 1];
        const fullPath = pathStack.filter(p => p != null).concat([s]);
        if (top.keys.has(s)) dups.push({ key: s, path: fullPath.join('.'), line: startLine });
        else top.keys.set(s, startLine);
        pendingKey = s;
      }
      continue;
    }
    i++;
  }
  return dups;
}

for (const lang of LANGS) {
  const webPath = path.join(ROOT, 'apps/web/src/i18n/locales', lang, 'editor.json');
  const admPath = path.join(ROOT, 'apps/admin/src/i18n/locales', lang, 'editor.json');
  const webText = fs.readFileSync(webPath, 'utf8');
  const admText = fs.readFileSync(admPath, 'utf8');

  const admObj = JSON.parse(admText);
  if (admObj.zoom) { log.push(`${lang}: already has zoom, SKIP`); continue; }

  // extract raw "zoom" block from web file (verbatim, preserves RTL text + formatting)
  const m = webText.match(/^[ \t]*"zoom":[ \t]*\{\r?\n(?:.*\r?\n)*?[ \t]*\},?\r?\n/m);
  if (!m) { log.push(`${lang}: FAILED to extract zoom block from web`); continue; }
  const zoomBlock = m[0];

  const anchor = admText.match(/^[ \t]*"tool":[ \t]*\{\r?\n/m);
  if (!anchor) { log.push(`${lang}: anchor "tool" not found`); continue; }
  const idx = admText.indexOf(anchor[0]);
  const out = admText.slice(0, idx) + zoomBlock + admText.slice(idx);
  fs.writeFileSync(admPath, out, 'utf8');

  // verify
  const re = JSON.parse(fs.readFileSync(admPath, 'utf8'));
  const d = dupScan(fs.readFileSync(admPath, 'utf8'));
  const ok = re.zoom && re.zoom.out && re.zoom.reset && re.zoom.in && re.zoom.fit && re.zoom.fitShort;
  log.push(`${lang}: inserted=${ok} keys=${re.zoom ? Object.keys(re.zoom).join(',') : 'NONE'} dups=${d.length}`);
}
fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'zoom_result.txt'), log.join('\n'), 'utf8');
