/**
 * verify_lam_alef.mjs
 * 校验 normalizeArabicPresentationForms 的逻辑：把非法「呈现形式」码位归一化回基本字母，
 * 同时保留 ZWNJ / Tatweel / 基本字母 / 拉丁文等。
 *
 * 与 core/src/text.ts 内实现保持同步（纯逻辑断言，不依赖浏览器）。
 * 用法：node scripts/verify_lam_alef.mjs
 */
const PF = (s) => {
  // 复刻 core 实现（保持与源一致）
  if (!s) return s;
  const chars = Array.from(s);
  let out = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cp = ch.codePointAt(0);
    const isPF =
      cp !== undefined && ((cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff));
    if (!isPF) {
      if (out !== null) out += ch;
      continue;
    }
    if (out === null) out = chars.slice(0, i).join('');
    out += ch.normalize('NFKC');
  }
  return out ?? s;
};

const C = (s) => Array.from(s).map((c) => c.codePointAt(0).toString(16)).join(' ');
let pass = 0;
let fail = 0;
function eq(label, got, wantCps) {
  const ok = C(got) === wantCps;
  console.log(`${ok ? '✓' : '✗'} ${label}  ->  [${C(got)}]`);
  if (ok) pass++;
  else {
    fail++;
    console.log(`    期望 [${wantCps}]`);
  }
}

// 1) 单字母呈现形式 → 基本字母
eq('lam 首形 U+FEDF -> U+0644', PF('\uFEDF'), '644');
eq('alef 孤形 U+FE8D -> U+0627', PF('\uFE8D'), '627');
// 2) 合字呈现形式 U+FEFB -> 两个基本字母
eq('لا 合字 U+FEFB -> 0644 0627', PF('\uFEFB'), '644 627');
// 3) 混合文本：基本字母 + 呈现形式混排（真实污染场景）
//    "غۇ" + FEDF + FE8D 应归一成 "غۇلا"(063a 06c7 0644 0627)
eq('mix FEDF/FE8D -> 基本', PF('\u063a\u06c7\uFEDF\uFE8D'), '63a 6c7 644 627');
// 4) 整词 U+FEFB 合字 -> لا
eq('word FEFB -> لا', PF('\u063a\u06c7\uFEFB'), '63a 6c7 644 627');
// 5) 基本字母串不被改动
eq('base letters untouched', PF('\u063a\u06c7\u0644\u0627'), '63a 6c7 644 627');
// 6) ZWNJ 必须保留（维吾尔正字法合法断连控制符）
eq('ZWNJ preserved', PF('\u0644\u200c\u0627'), '644 200c 627');
// 7) Tatweel U+0640 保留
eq('tatweel preserved', PF('\u0644\u0640\u0627'), '644 640 627');
// 8) 拉丁 / 空格 / 标点不受影响
eq('latin untouched', PF('Hello لا World'), '48 65 6c 6c 6f 20 644 627 20 57 6f 72 6c 64');
// 9) 无呈现形式的串原样返回（连对象引用都不应改变）
const s9 = 'ئالتۇن';
console.log(`${PF(s9) === s9 ? '✓' : '✗'} identity preserved (no alloc)  ->  ${PF(s9) === s9}`);
if (PF(s9) === s9) pass++; else fail++;

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
