'use strict';
/**
 * 修复 web 端 6 语言 common.json 的牌级 i18n：
 *  - ug/kk-CN/ky-CN/uz-CN：上一轮 inject-web-tier-i18n.py 误把牌级塞进 "pages" 对象，
 *    且多写一个根级 }，导致 JSON 非法。此处把 "pages" 改名为 "tierNames" 并删掉多余 }。
 *  - zh-CN/en：已有顶层 "pages": "页数"（字符串），与 "pages" 对象冲突，
 *    故改用 "tierNames" 顶层对象，文本插入（保留既定 \u 转义，仅追加）。
 * 全程文本操作，不 json.load/dump，避免少数民族语言包大 diff。
 */
const fs = require('fs');
const path = require('path');

const BASE = 'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/i18n/locales';

const NAMES = {
  'zh-CN': {
    agent: ['见习代理', '铜牌代理', '银牌代理', '金牌代理', '钻石代理'],
    provider: ['新锐服务商', '铜牌服务商', '银牌服务商', '金牌服务商', '钻石服务商'],
  },
  en: {
    agent: ['Trainee Agent', 'Bronze Agent', 'Silver Agent', 'Gold Agent', 'Diamond Agent'],
    provider: ['Rookie Provider', 'Bronze Provider', 'Silver Provider', 'Gold Provider', 'Diamond Provider'],
  },
  ug: {
    agent: ['شاگىرت ۋاكالەتچى', 'مىس ۋاكالەتچى', 'كۈمۈش ۋاكالەتچى', 'ئالتۇن ۋاكالەتچى', 'ئالماس ۋاكالەتچى'],
    provider: ['يېڭى مۇلازىمەتچى', 'مىس مۇلازىمەتچى', 'كۈمۈش مۇلازىمەتچى', 'ئالتۇن مۇلازىمەتچى', 'ئالماس مۇلازىمەتچى'],
  },
  'kk-CN': {
    agent: ['Шәкірт агент', 'Қола агент', 'Күміс агент', 'Алтын агент', 'Алмас агент'],
    provider: ['Жаңа қызметкер', 'Қола қызметкер', 'Күміс қызметкер', 'Алтын қызметкер', 'Алмас қызметкер'],
  },
  'ky-CN': {
    agent: ['شاگىرت وكىل', 'مىس وكىل', 'كۈمۈش وكىل', 'التۇن وكىل', 'الماس وكىل'],
    provider: ['جاڭى قىزماتكەر', 'مىس قىزماتكەر', 'كۈمۈش قىزماتكەر', 'التۇن قىزماتكەر', 'الماس قىزماتكەر'],
  },
  'uz-CN': {
    agent: ['Shogird agent', 'Bronza agent', 'Kumush agent', 'Oltin agent', 'Olmos agent'],
    provider: ['Yangi provayder', 'Bronza provayder', 'Kumush provayder', 'Oltin provayder', 'Olmos provayder'],
  },
};

function tierBlock(names) {
  const agent = names.agent.map((n, i) => `        "L${i}": ${JSON.stringify(n)}`).join(',\r\n');
  const provider = names.provider.map((n, i) => `        "L${i}": ${JSON.stringify(n)}`).join(',\r\n');
  return `,\r\n  "tierNames": {\r\n    "agent": {\r\n${agent}\r\n    },\r\n    "provider": {\r\n${provider}\r\n    }\r\n  }`;
}

for (const lang of Object.keys(NAMES)) {
  const file = path.join(BASE, lang, 'common.json');
  let txt = fs.readFileSync(file, 'utf8');

  if (txt.includes('"tierNames"')) {
    console.log(`[skip] ${lang}: tierNames already present`);
    continue;
  }

  if (txt.includes('  "pages": {')) {
    // 少数民族语言包：误用 pages 对象 + 多一个根级 }。改名 + 删多余 }。
    txt = txt.replace('  "pages": {', '  "tierNames": {');
    // 删掉文末多余的 }（} 紧跟在 pages/tierNames 对象闭合 } 之后）
    txt = txt.replace(/\}\}\s*\Z/, '}');
    console.log(`[repaired] ${lang}: pages->tierNames, dropped extra brace`);
  } else {
    // zh-CN / en：插入 tierNames 顶层对象（保留既有 "pages":"页数" 字符串）
    const idx = txt.lastIndexOf('}');
    if (idx < 0) {
      console.error(`[err] ${lang}: no root } found`);
      continue;
    }
    txt = txt.slice(0, idx) + tierBlock(NAMES[lang]) + txt.slice(idx);
    console.log(`[inserted] ${lang}: tierNames block added`);
  }

  fs.writeFileSync(file, txt, 'utf8');
}

console.log('done');
