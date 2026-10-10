'use strict';
// 少数民族语言包尾部多写了根级 }（CRLF/LF 混合导致不相邻），逐个删除末尾 } 直到 JSON.parse 通过。
const fs = require('fs');
const path = require('path');
const BASE = 'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/i18n/locales';
const LANGS = ['ug', 'kk-CN', 'ky-CN', 'uz-CN'];

for (const lang of LANGS) {
  const file = path.join(BASE, lang, 'common.json');
  let txt = fs.readFileSync(file, 'utf8');
  let guard = 0;
  while (guard++ < 5) {
    try {
      JSON.parse(txt);
      break; // already valid
    } catch (e) {
      const trimmed = txt.replace(/\s+$/, '');
      if (/after JSON/.test(e.message) && trimmed.endsWith('}')) {
        const i = txt.lastIndexOf('}');
        txt = txt.slice(0, i) + txt.slice(i + 1); // drop the last stray }
      } else {
        console.log(`[give-up] ${lang}: ${e.message}`);
        break;
      }
    }
  }
  try {
    JSON.parse(txt);
    fs.writeFileSync(file, txt, 'utf8');
    console.log(`[fixed] ${lang}`);
  } catch (e) {
    console.log(`[still-broken] ${lang}: ${e.message}`);
  }
}
