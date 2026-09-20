const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';
function loadResources(app) {
  const langs = ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN'];
  const res = {};
  for (const lang of langs) {
    const dir = path.join(ROOT, 'apps', app, 'src', 'i18n', 'locales', lang);
    res[lang] = {};
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const file = f.replace('.json', '');
      const ns = file === 'web-common' ? 'common' : file === 'common' ? (app === 'admin' ? 'translation' : 'common') : file;
      res[lang][ns] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  return res;
}
const L = [];
function mk(app, fb, dns, ns) {
  const I = require(path.join(ROOT, 'apps', app, 'node_modules', 'i18next')).createInstance();
  I.init({ resources: loadResources(app), lng: 'ug', fallbackLng: fb, defaultNS: dns, ns, interpolation: { escapeValue: false }, initImmediate: false });
  return I;
}
const admin = mk('admin', 'zh-CN', 'translation');
const web = mk('web', 'en', 'common', ['common', 'editor', 'templates', 'publish', 'errors']);

const cases = [
  ['admin', 'status.ACTIVE (missing in ug, in zh-CN)', () => admin.t('status.ACTIVE', { ns: 'translation' })],
  ['admin', 'status.ACTIVE WITH defaultValue:key', () => admin.t('status.ACTIVE', { ns: 'translation', defaultValue: 'status.ACTIVE' })],
  ['admin', 'group.overview (missing in ug, in zh-CN)', () => admin.t('group.overview', { ns: 'translation' })],
  ['admin', 'editor:zoom.out (missing EVERYWHERE)', () => admin.t('editor:zoom.out')],
  ['admin', 'editor:zoom.out WITH defaultValue:key', () => admin.t('editor:zoom.out', { defaultValue: 'editor:zoom.out' })],
  ['admin', 'errors:error.loadFailed (missing EVERYWHERE)', () => admin.t('errors:error.loadFailed')],
  ['admin', 'pages.error.404 (in zh-CN, missing in en & ug)', () => admin.t('pages.error.404', { ns: 'translation' })],
  ['web', 'status.draftBadge (missing in ug, in en)', () => web.t('status.draftBadge', { ns: 'common' })],
  ['web', 'common:detail.id (missing in ug, in en)', () => web.t('common:detail.id')],
  ['web', 'errors:error.submitReviewFailed (in zh-CN only, NOT en)', () => web.t('errors:error.submitReviewFailed')],
  ['web', 'editor:page.noPageData (missing EVERYWHERE)', () => web.t('editor:page.noPageData')],
];
for (const [app, label, fn] of cases) {
  let v;
  try { v = fn(); } catch (e) { v = 'ERR ' + e.message; }
  L.push(`[${app}] ${label}\n     => ${JSON.stringify(v)}`);
}
fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'confirm.txt'), L.join('\n'), 'utf8');
