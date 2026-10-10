'use strict';
// 少数民族语言包误带了 "tier" 中间层（pages.tier.* 残留），展平为 tierNames.agent / tierNames.provider，
// 与 zh-CN/en 插入的扁平结构保持一致。文本替换，不 json.load/dump，保留 \u 转义。
const fs = require('fs');
const path = require('path');
const BASE = 'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/i18n/locales';
const LANGS = ['ug', 'kk-CN', 'ky-CN', 'uz-CN'];

for (const lang of LANGS) {
  const file = path.join(BASE, lang, 'common.json');
  let txt = fs.readFileSync(file, 'utf8');
  const before = txt;
  // 1) 去掉 "tier": { 这一层
  txt = txt.replace('  "tierNames": {\n    "tier": {', '  "tierNames": {');
  // 2) 去掉对应的 "tier" 闭合 }（provider 闭合后、tierNames 闭合前的 4 空格 }）
  txt = txt.replace('      }\n    }\n  }', '      }\n  }');
  if (txt === before) {
    console.log(`[no-change] ${lang}: tier wrapper not found`);
    continue;
  }
  try {
    JSON.parse(txt);
  } catch (e) {
    console.log(`[BROKEN] ${lang}: ${e.message}`);
    continue;
  }
  fs.writeFileSync(file, txt, 'utf8');
  console.log(`[flattened] ${lang}`);
}
