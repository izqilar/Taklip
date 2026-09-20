/**
 * Measure how much of the RTL (ug) gap is closed by i18next fallbackLng
 * once the `defaultValue: key` short-circuit is removed.
 */
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/MyWorkBuddy/2026-08-10-22-39-56';

function flat(o, p = '', out = {}) {
  for (const k of Object.keys(o)) {
    const v = o[k]; const key = p ? p + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = v;
  }
  return out;
}

function loadResources(app) {
  // returns { lang: { ns: obj } } matching each app's i18n init
  const langs = ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN'];
  const res = {};
  for (const lang of langs) {
    const dir = path.join(ROOT, 'apps', app, 'src', 'i18n', 'locales', lang);
    res[lang] = {};
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const file = f.replace('.json', '');
      const ns = file === 'web-common' ? 'common'
        : file === 'common' ? (app === 'admin' ? 'translation' : 'common')
        : file;
      res[lang][ns] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  return res;
}

function run(app, fallbackLng, defaultNS, nsList) {
  const i18n = require(path.join(ROOT, 'apps', app, 'node_modules', 'i18next'));
  const inst = i18n.createInstance();
  inst.init({
    resources: loadResources(app),
    lng: 'ug',
    fallbackLng: fallbackLng,
    ns: nsList,
    defaultNS: defaultNS,
    interpolation: { escapeValue: false },
    initImmediate: false,
  });

  // full key inventory per ns from zh-CN, and which are missing in ug
  const zhFlatByNs = {}, ugFlatByNs = {};
  const res = loadResources(app);
  for (const ns of Object.keys(res['zh-CN'])) {
    zhFlatByNs[ns] = flat(res['zh-CN'][ns]);
    ugFlatByNs[ns] = flat(res['ug'][ns] || {});
  }

  let totalGap = 0, resolvedByFallback = 0, stillRaw = 0;
  const rawSamples = [];
  for (const ns of Object.keys(zhFlatByNs)) {
    for (const key of Object.keys(zhFlatByNs[ns])) {
      if (ugFlatByNs[ns] && (key in ugFlatByNs[ns])) continue; // present in ug
      totalGap++;
      const out = inst.t(key, { ns, lng: 'ug' });
      const isRaw = out === key || out === ns + ':' + key;
      if (isRaw) { stillRaw++; if (rawSamples.length < 12) rawSamples.push(ns + ':' + key); }
      else resolvedByFallback++;
    }
  }
  return { app, totalGap, resolvedByFallback, stillRaw, rawSamples, i18n: inst };
}

const lines = [];
const admin = run('admin', 'zh-CN', 'translation', undefined);
lines.push('=== ADMIN (lng=ug, fallbackLng=zh-CN, WITHOUT defaultValue:key) ===');
lines.push('total keys in zh-CN absent from ug: ' + admin.totalGap);
lines.push('  resolved via fallbackLng (shows Chinese): ' + admin.resolvedByFallback);
lines.push('  STILL raw key path: ' + admin.stillRaw);
lines.push('  samples still raw: ' + JSON.stringify(admin.rawSamples));

const web = run('web', 'en', 'common', ['common', 'editor', 'templates', 'publish', 'errors']);
lines.push('');
lines.push('=== WEB (lng=ug, fallbackLng=en, no defaultValue wrapper) ===');
lines.push('total keys in zh-CN absent from ug: ' + web.totalGap);
lines.push('  resolved via fallbackLng (shows English): ' + web.resolvedByFallback);
lines.push('  STILL raw key path: ' + web.stillRaw);
lines.push('  samples still raw: ' + JSON.stringify(web.rawSamples));

// also confirm: admin WITH the current defaultValue:key behaviour
const i18n2 = require('D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/node_modules/i18next');
const inst2 = i18n2.createInstance();
inst2.init({
  resources: loadResources('admin'), lng: 'ug', fallbackLng: 'zh-CN',
  defaultNS: 'translation', interpolation: { escapeValue: false }, initImmediate: false,
});
const resA = loadResources('admin');
let withDv_raw = 0, withDv_total = 0;
for (const ns of Object.keys(resA['zh-CN'])) {
  const z = flat(resA['zh-CN'][ns]); const u = flat(resA['ug'][ns] || {});
  for (const key of Object.keys(z)) {
    if (key in u) continue;
    withDv_total++;
    const out = inst2.t(key, { ns, lng: 'ug', defaultValue: key });
    if (out === key) withDv_raw++;
  }
}
lines.push('');
lines.push('=== ADMIN CURRENT behaviour (WITH defaultValue:key) ===');
lines.push('gaps: ' + withDv_total + '  -> rendered as raw key path: ' + withDv_raw);

fs.writeFileSync(path.join(ROOT, '_audit_tmp', 'fallback_result.txt'), lines.join('\n'), 'utf8');
