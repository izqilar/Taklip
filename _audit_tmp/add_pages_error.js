const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';
const log = [];
const rel = 'apps/admin/src/i18n/locales/en/common.json';
const p = path.join(ROOT, rel);
const text = fs.readFileSync(p, 'utf8');

// locate top-level "pages": { and its matching close
const m = /^  "pages": \{/m.exec(text);
if (!m) { log.push('pages not found'); }
else {
  const openIdx = m.index + m[0].length - 1;
  let depth = 0, inS = false, closeIdx = -1;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inS) { if (c === '\\') i++; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { closeIdx = i; break; } }
  }
  const obj = JSON.parse(text.slice(openIdx, closeIdx + 1));
  if (obj.error) { log.push('pages.error already exists: ' + JSON.stringify(obj.error)); }
  else {
    const body = text.slice(openIdx + 1, closeIdx);
    const before = body.replace(/\s+$/, '');
    const needsComma = !before.endsWith(',');
    const entry = before + (needsComma ? ',' : '') +
      '\n    "error": {\n      "404": "Page not found (404)",\n      "backHome": "Back to home"\n    }\n  ';
    const out = text.slice(0, openIdx + 1) + entry + text.slice(closeIdx);
    try {
      const v = JSON.parse(out);
      log.push('OK added pages.error => ' + JSON.stringify(v.pages.error));
      fs.writeFileSync(p, out, 'utf8');
    } catch (e) { log.push('INVALID JSON: ' + e.message); }
  }
}
fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'pages_result.txt'), log.join('\n'), 'utf8');
