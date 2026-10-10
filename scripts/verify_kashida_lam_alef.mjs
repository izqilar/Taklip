/**
 * verify_kashida_lam_alef.mjs
 * 校验 kashidaForLetterSpacing / kashidaForJustify 不再在 lam-alef 必配合字之间插延长符。
 * 测的是 esbuild 打包后的 core/src/text.ts 真实实现。
 *
 * 背景：letterSpacing>0 的阿拉伯文走「延长符替换字距」管线，旧 findKashidaGaps 把
 * lam→alef 对当合法插点 → "لا" 被拆成 "لـا"（必配合字断裂）。
 * 编辑态 textarea 走原生 CSS letter-spacing（保留必配合字）→ 两端不一致。
 *
 * 用法：
 *   node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/bin/esbuild \
 *     packages/core/src/text.ts --bundle --format=esm --outfile=/tmp/core-text.mjs
 *   node scripts/verify_kashida_lam_alef.mjs
 */
import { kashidaForLetterSpacing, kashidaForJustify, TATWEEL } from './.core-text.tmp.mjs';

const LAM_ALEF = '\u0644\u0627'; // لا
const cps = (s) => Array.from(s).map((c) => c.codePointAt(0).toString(16)).join(' ');
let pass = 0;
let fail = 0;
function assert(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log('✓', name, detail);
  } else {
    fail++;
    console.log('✗', name, detail);
  }
}

// —— 1. 纯 "لا"（无其他合法插点）+ 正字距 ——
{
  const konva = kashidaForLetterSpacing(LAM_ALEF, 4.7, 32, true);
  assert('لا(konva) 不插延长符', !konva.text.includes(TATWEEL), `cps=${cps(konva.text)}`);
  assert('لا(konva) 字距归零（防 ltr 逐字符绘制）', konva.letterSpacing === 0, `ls=${konva.letterSpacing}`);
  const dom = kashidaForLetterSpacing(LAM_ALEF, 4.7, 32, false);
  assert('لا(dom) 不插延长符', !dom.text.includes(TATWEEL), `cps=${cps(dom.text)}`);
  assert('لا(dom) 字距透传（CSS 保留必配合字）', dom.letterSpacing === 4.7, `ls=${dom.letterSpacing}`);
}

// —— 2. lam-alef 变体（لأ لإ لآ）同样跳过 ——
for (const [name, alef] of [
  ['لأ', '\u0644\u0623'],
  ['لإ', '\u0644\u0625'],
  ['لآ', '\u0644\u0622'],
]) {
  const r = kashidaForLetterSpacing(name, 3, 32, true);
  assert(`${name} 不插延长符`, !r.text.includes(TATWEEL), `cps=${cps(r.text)}`);
}

// —— 3. 含 lam-alef 的真实词：其他合法插点仍插，lam-alef 之间绝不插 ——
{
  // "مىنۇتلا" 含 …ت لا（lam-alef）以及词首若干合法对
  const word = '\u0645\u0649\u0646\u06c7\u062a\u0644\u0627'; // مىنۇتلا
  const r = kashidaForLetterSpacing(word, 4.7, 16, true);
  const chars = Array.from(r.text);
  let lamAlefIntact = false;
  for (let i = 0; i + 1 < chars.length; i++) {
    if (chars[i].codePointAt(0) === 0x644 && chars[i + 1].codePointAt(0) === 0x627) lamAlefIntact = true;
  }
  assert('مىنۇتلا 中 lam 与 alef 相邻保持', lamAlefIntact, `cps=${cps(r.text)}`);
  assert('مىنۇتلا 字距归零（有插点→延长符承担）', r.letterSpacing === 0, `ls=${r.letterSpacing}`);
}

// —— 4. 回归：普通合法插点仍会插延长符（字间距功能不失效） ——
{
  // "بالا" = ب ا ل ا：合法插点只有 ب→ا 一处（ا→ل 被 NO_FORWARD 排除、ل→ا 是必配合字）
  const word = '\u0628\u0627\u0644\u0627';
  const r = kashidaForLetterSpacing(word, 10, 32, true);
  assert('بالا 在 ب→ا 处插了延长符', r.text.includes(TATWEEL), `cps=${cps(r.text)}`);
  const chars = Array.from(r.text);
  let lamAlefIntact = false;
  for (let i = 0; i + 1 < chars.length; i++) {
    if (chars[i].codePointAt(0) === 0x644 && chars[i + 1].codePointAt(0) === 0x627) lamAlefIntact = true;
  }
  assert('بالا 中 lam-alef 相邻保持（其间无延长符）', lamAlefIntact, `cps=${cps(r.text)}`);
}

// —— 5. 两端对齐管线（kashidaForJustify）同样跳过 lam-alef ——
{
  const line = '\u0645\u0649\u0646\u06c7\u062a\u0644\u0627'; // مىنۇتلا
  const measure = (t) => {
    // 简化测宽：每字符 10px、延长符 8px
    return Array.from(t).reduce((w, c) => w + (c === TATWEEL ? 8 : 10), 0);
  };
  const out = kashidaForJustify(line, 30, 16, measure);
  const chars = Array.from(out);
  let lamAlefIntact = false;
  for (let i = 0; i + 1 < chars.length; i++) {
    if (chars[i].codePointAt(0) === 0x644 && chars[i + 1].codePointAt(0) === 0x627) lamAlefIntact = true;
  }
  assert('justify 拉伸后 lam-alef 相邻保持', lamAlefIntact, `cps=${cps(out)}`);
}

// —— 6. 非阿拉伯文不受影响 ——
{
  const r = kashidaForLetterSpacing('Hello 世界', 2, 16, true);
  assert('拉丁/中文保持原字距', r.letterSpacing === 2 && r.text === 'Hello 世界', `ls=${r.letterSpacing}`);
}

// —— 7. 零字距原样返回 ——
{
  const r = kashidaForLetterSpacing(LAM_ALEF, 0, 32, true);
  assert('ls=0 原样返回', r.text === LAM_ALEF && r.letterSpacing === 0);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
