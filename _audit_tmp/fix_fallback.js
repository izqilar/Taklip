const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';
const FILES = [
  'apps/web/src/components/WorkPreviewModal.tsx',
  'apps/web/src/pages/ProjectList.tsx',
  'apps/admin/src/pages/audit-logs.tsx',
  'apps/web/src/components/WorkDetailModal.tsx',
];
const log = [];
for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  let text = fs.readFileSync(p, 'utf8');
  const before = text;
  // t('X') || 'Y'   ->   t('X', { defaultValue: 'Y' })
  text = text.replace(/\bt\(\s*'([^']+)'\s*\)\s*\|\|\s*'([^']*)'/g,
    (_m, key, fb) => `t('${key}', { defaultValue: '${fb}' })`);
  // t("X") || "Y"
  text = text.replace(/\bt\(\s*"([^"]+)"\s*\)\s*\|\|\s*"([^"]*)"/g,
    (_m, key, fb) => `t('${key}', { defaultValue: '${fb}' })`);
  // t('X') || t('Y')  -> t('X')      (second is dead code too; keep first which exists)
  text = text.replace(/\bt\(\s*'([^']+)'\s*\)\s*\|\|\s*t\(\s*'[^']+'\s*\)/g,
    (_m, key) => `t('${key}')`);
  if (text !== before) {
    fs.writeFileSync(p, text, 'utf8');
    log.push('MODIFIED ' + rel);
  } else log.push('unchanged ' + rel);
}
// remaining scan
const SCAN = ['apps/web/src', 'apps/admin/src', 'packages/ui/src', 'packages/render/src', 'packages/editor/src', 'packages/core/src'];
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];
function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const pp = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(e.name)) walk(pp, acc); }
    else if (EXTS.includes(path.extname(e.name))) acc.push(pp);
  }
  return acc;
}
const files = []; for (const d of SCAN) walk(path.join(ROOT, d), files);
let n = 0;
for (const f of files) {
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((ln, i) => {
    if (/\bt\([^)]*\)\s*\|\|\s*['"`]/.test(ln) || /\bt\([^)]*\)\s*\?\?\s*['"`]/.test(ln)) {
      n++; log.push('REMAINING ' + f.replace(ROOT, '') + ':' + (i + 1) + '  ' + ln.trim());
    }
  });
}
log.push('TOTAL REMAINING = ' + n);
fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'fallback_fix.txt'), log.join('\n'), 'utf8');
