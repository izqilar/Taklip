/**
 * 文本排版辅助 —— 阿拉伯文等「连写文字」的字间距处理。
 *
 * 问题：给阿拉伯文（及波斯文 / 维吾尔文等共用阿拉伯字母块的连写文字）直接加
 * CSS `letter-spacing` / Konva `letterSpacing`，会在每个字形之间插入等宽间隙，
 * 把本应相连的笔画「拆开」，视觉上完全错误。
 *
 * 正确做法（与浏览器 / InDesign 等一致）：在合法的连写处插入「延长符」Tatweel
 * （U+0640，kashida），像拉橡皮筋一样把字词横向拉长，而笔画始终相连。
 *
 * 因此这里提供 `kashidaForLetterSpacing`：当 `letterSpacing > 0` 且文本为阿拉伯文时，
 * 返回「已插入延长符」的文本 + 归零的 `letterSpacing`（间隙改由延长符承担）；
 * 非阿拉伯文或字间距≤0 时原样返回。编辑器（Konva）与发布页（DOM）共用本函数，
 * 保证两端对阿拉伯文的字间距表现完全一致。
 *
 * 注：本文件刻意只用 Unicode 码点数字，不写任何字面阿拉伯字符，避免源码编码导致
 * 正则字符类范围顺序报错（TS1517）。
 */

/** 延长符（Tatweel / kashida）。⚠️ 只用 Unicode 码点数字，勿写字面阿拉伯字符（防编码漂移：字面量实测曾为 U+0652，渲染成小圆圈） */
export const TATWEEL = String.fromCodePoint(0x640);

/** 判断一个码点是否属于阿拉伯字母块（含扩展区 / 变体选区 / presentation forms） */
function isArabicCp(cp: number): boolean {
  return (
    (cp >= 0x0600 && cp <= 0x06ff) || // Arabic
    (cp >= 0x0750 && cp <= 0x077f) || // Arabic Supplement
    (cp >= 0x08a0 && cp <= 0x08ff) || // Arabic Extended-A
    (cp >= 0xfb50 && cp <= 0xfdff) || // Arabic Presentation Forms-A
    (cp >= 0xfe70 && cp <= 0xfeff) // Arabic Presentation Forms-B
  );
}

/** 阿拉伯文「标点」（不属于字母、不参与连写）：其前/后不应插入延长符。
 * 注意：组合读音符号（harakat 064B–065F）虽也在字母块内，但它们是零宽组合符、
 * 不阻断字母间的连写，故【不】列入此处——字母与读音符号之间仍可正常加延长符。 */
const ARABIC_PUNCT = new Set<number>([
  0x060c, // ، Arabic comma
  0x061b, // ؛ Arabic semicolon
  0x061f, // ؟ Arabic question mark
  0x066a, // ٪ Arabic percent sign
  0x066b, // ٫ Arabic decimal separator
  0x066c, // ٬ Arabic thousands separator
  0x06d4, // ۔ Urdu full stop
]);

export function isArabicChar(ch: string): boolean {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return cp !== undefined && isArabicCp(cp);
}

export function isArabicText(text: string): boolean {
  for (const ch of text || '') {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isArabicCp(cp)) return true;
  }
  return false;
}

/**
 * 连写能力分类（按 Unicode 阿拉伯字母块的「形」规则）：
 *  - 有 initial 形（能向【下一个】字母连出）的字母：记作「向前连」。无 initial 形的字母
 *    （alef/hamza 系、waw、dal/dhal/reh/zay、teh marbuta、alef maksura 及维吾尔文基于 waw
 *    的元音 ۆ/ۇ/ۈ/ۋ/ە）记入 NO_FORWARD。
 *  - 有 final 形（能接收【上一个】字母的连接）的字母：记作「向后连」。标准阿拉伯文中仅独立
 *    hamza（ء）无 final 形 → 记入 NO_BACK；其余字母均可向后连。
 *
 * 延长符（kashida）只在「A 向前连 且 B 向后连」的相邻字母对之间插入，即二者在书写时本就
 * 经一笔相连。两侧字母均须属阿拉伯脚本（空格等非脚本字符令 isArabicCp 守卫失败）→ 词边界
 * （有空格）天然不加延长符，符合规则要求。
 */
const NO_FORWARD = new Set<number>([
  // 阿拉伯文：无首形（alef/hamza 系 + waw + dal/dhal/reh/zay + teh marbuta + alef maksura）
  0x0627, // ا alef
  0x0622, // آ alef madda
  0x0623, // أ alef hamza above
  0x0625, // إ alef hamza below
  0x0624, // ؤ waw hamza
  0x0621, // ء hamza
  0x0648, // و waw
  0x062f, // د dal
  0x0630, // ذ dhal
  0x0631, // ر reh
  0x0632, // ز zain
  0x0629, // ة teh marbuta
  0x0649, // ى alef maksura
  // 维吾尔文扩展（基于 waw 的元音，无首形，不向左连写）
  0x06c6, // ۆ Uyghur o
  0x06c7, // ۇ Uyghur o
  0x06c8, // ۈ Uyghur ü
  0x06cb, // ۋ Uyghur ve
  0x06d5, // ە Uyghur e
]);

/** 无 final 形（不能接收上一字母连接）的字母：仅独立 hamza。其余字母均可向后连。 */
const NO_BACK = new Set<number>([
  0x0621, // ء hamza（孤立形，无词尾形）
]);

/**
 * 找出所有合法延长符插入点。
 * @param chars 字符数组（Array.from，含代理对）
 * @returns 满足「A(前)=chars[i] 向前连、B(后)=chars[i+1] 向后连、二者皆阿拉伯字母（非标点）、且均非延长符」的 i 列表
 */
function findKashidaGaps(chars: string[]): number[] {
  const gaps: number[] = [];
  for (let i = 0; i + 1 < chars.length; i++) {
    const a = chars[i];
    const b = chars[i + 1];
    const acp = a.codePointAt(0);
    const bcp = b.codePointAt(0);
    if (
      acp !== undefined &&
      bcp !== undefined &&
      isArabicCp(acp) &&
      isArabicCp(bcp) &&
      !ARABIC_PUNCT.has(acp) && // 标点非字母、不连写：其前不加延长符
      !ARABIC_PUNCT.has(bcp) && // 标点非字母、不连写：其后不加延长符
      !NO_FORWARD.has(acp) && // A（前/逻辑右）须能向前连（有 initial 形）
      !NO_BACK.has(bcp) && // B（后/逻辑左）须能向后连（有 final 形）
      a !== TATWEEL &&
      b !== TATWEEL
    ) {
      gaps.push(i);
    }
  }
  return gaps;
}

/** 每个合法插入点最多插入的延长符数量（避免单点拉得过长、像一条异常长横线） */
export const KASHIDA_MAX_PER_GAP = 4;

/** 按「每个插入点各自的延长符数量」拼出最终文本 */
function buildFromCounts(chars: string[], gaps: number[], counts: number[]): string {
  const out: string[] = [];
  let gi = 0;
  for (let i = 0; i < chars.length; i++) {
    out.push(chars[i]);
    if (gi < gaps.length && gaps[gi] === i) {
      const add = counts[gi] || 0;
      if (add > 0) out.push(TATWEEL.repeat(add));
      gi++;
    }
  }
  return out.join('');
}

/**
 * 把 totalCount 个延长符「尽量均匀」分配到 gapCount 个插入点（前若干点各多 1）。
 * @returns 长度 = gapCount 的每点数量数组（每点上限 cap）
 */
function distributeEvenly(totalCount: number, gapCount: number, cap: number): number[] {
  const total = Math.max(0, Math.min(Math.round(totalCount), gapCount * cap));
  const base = Math.floor(total / gapCount);
  let rem = total - base * gapCount;
  const counts = new Array<number>(gapCount).fill(base);
  for (let i = 0; i < gapCount && rem > 0; i++) {
    counts[i] += 1;
    rem -= 1;
  }
  return counts;
}

/**
 * 在合法插入点均分插入延长符，使总伸长量≈ totalTargetWidth(px)。每处上限 KASHIDA_MAX_PER_GAP。
 * @param gaps findKashidaGaps 返回的插入点列表
 */
function applyKashida(chars: string[], gaps: number[], totalTargetWidth: number, fontSize: number): string {
  if (gaps.length === 0) return chars.join('');
  const kashidaWidth = 0.22 * fontSize;
  const total = Math.max(1, Math.round(totalTargetWidth / (kashidaWidth || 1)));
  return buildFromCounts(chars, gaps, distributeEvenly(total, gaps.length, KASHIDA_MAX_PER_GAP));
}

export interface KashidaResult {
  /** 处理后的文本（阿拉伯文+字间距>0 时含延长符 U+0640） */
  text: string;
  /** 处理后的字间距（阿拉伯文场景归零，延长由 kashida 承担） */
  letterSpacing: number;
}

/**
 * 把「字间距」转译为阿拉伯文的「延长符」展开。
 *
 * @param text          原始文本
 * @param letterSpacing 设计稿里的字间距（px），≤0 时原样返回
 * @param fontSize      字号（px），用于估算每个延长符的视觉宽度，使总伸长量接近原字间距
 */
export function kashidaForLetterSpacing(
  text: string,
  letterSpacing: number,
  fontSize = 16,
  forKonva = false,
): KashidaResult {
  if (!text || letterSpacing === 0) return { text, letterSpacing };
  if (letterSpacing < 0) {
    // 连写文字（阿拉伯文等）+ 负字间距：
    //  - Konva 画布：非零 letterSpacing 触发逐字符绘制、拆散字母连接 → 归零（保持自然连写间距）；
    //  - DOM 发布/导出：CSS letter-spacing 原生支持连写文字（只收紧间距、不拆连写）→ 负值原样透传。
    if (forKonva && isArabicText(text)) return { text, letterSpacing: 0 };
    return { text, letterSpacing };
  }
  if (!isArabicText(text)) return { text, letterSpacing };

  const chars = Array.from(text);
  // 合法插入点：相邻两字母 A(前)向前连、B(后)向后连、同属阿拉伯脚本（词内）、且均非延长符
  const gaps = findKashidaGaps(chars);
  if (gaps.length === 0) {
    // 没有合法的连写插入点（如整段都是不连写字母）→ 退化为原字间距，至少不破坏连写
    return { text, letterSpacing };
  }

  // 估算应插入的延长符总数：字间距本会在每个间隙累加 letterSpacing 宽，总和≈ letterSpacing×gaps；
  // 除以单个延长符视觉宽度（约 0.22em）按间隙均分，每处上限 4 个避免过长。
  const expanded = applyKashida(chars, gaps, letterSpacing * gaps.length, fontSize);
  return { text: expanded, letterSpacing: 0 };
}

/**
 * 两端对齐 / 分散对齐时，为阿拉伯文行插入延长符（kashida）铺满 `stretchWidth`(px) 的额外宽度。
 *
 * 与 `kashidaForLetterSpacing` 共用同一套合法插入点规则（A 向前连 & B 向后连 & 词内），
 * 故「字间距」与「对齐拉伸」对阿拉伯文的延长符表现完全一致。非阿拉伯文、无需拉伸
 * （stretchWidth≤0）或无可插点时原样返回。
 *
 * ⚠️ 绝不越过边界：延长符的推进宽随字体而变（实测默认字体 32px 下单个 ≈8.19px，
 * 而非早先按 0.22em≈7.04px 的估算）。按估算值插满会实际多插 ~16% → 行宽超过内容框，
 * RTL 行以右缘为锚绘制 → 多出的宽度从**左端溢出**边界框。
 * 因此这里接受可选 `measure(text)` 回调：实测「插入 1 个延长符的真实增量」得到单位宽，
 * 用 `floor` 决定数量（保证不超），拼好后**复核实际宽度**，超出目标则逐个回退。
 *
 * @param measure 宽度测量函数（Konva 传 `(t) => this.measureSize(t).width`）。
 *                不传时回退 0.22em 估算（仅兜底，可能略超）。
 */
export function kashidaForJustify(
  text: string,
  stretchWidth: number,
  fontSize = 16,
  measure?: (t: string) => number,
): string {
  if (!text || stretchWidth <= 0 || !isArabicText(text)) return text;
  const chars = Array.from(text);
  const gaps = findKashidaGaps(chars);
  if (gaps.length === 0) return text;

  const natural = measure ? measure(text) : 0;
  // 单个延长符的真实推进宽：优先实测（在第一个合法插入点插 1 个的增量），否则回退 0.22em
  let unit = 0.22 * fontSize;
  if (measure) {
    const oneCounts = gaps.map((_, i) => (i === 0 ? 1 : 0));
    const delta = measure(buildFromCounts(chars, gaps, oneCounts)) - natural;
    if (delta > 0.01) unit = delta;
  }
  if (!(unit > 0)) return text;

  // floor → 插入后总宽 ≤ 目标宽（绝不越过边界；宁可略欠不满）
  let total = Math.floor(stretchWidth / unit);
  if (total <= 0) return text;
  total = Math.min(total, gaps.length * KASHIDA_MAX_PER_GAP);

  const counts = distributeEvenly(total, gaps.length, KASHIDA_MAX_PER_GAP);
  let out = buildFromCounts(chars, gaps, counts);

  // 复核（字形 reshape 存在非线性偏差）：实测超出目标就回退，直到不越界
  if (measure) {
    const target = natural + stretchWidth + 0.5; // 0.5px 容差
    for (let guard = 0; guard < 8; guard++) {
      const w = measure(out);
      if (w <= target) break;
      let k = Math.max(1, Math.ceil((w - target) / unit));
      while (k > 0) {
        let maxIdx = 0;
        for (let i = 1; i < counts.length; i++) {
          if (counts[i] > counts[maxIdx]) maxIdx = i;
        }
        if (counts[maxIdx] <= 0) break;
        counts[maxIdx] -= 1;
        k -= 1;
      }
      if (counts.every((c) => c <= 0)) {
        out = text;
        break;
      }
      out = buildFromCounts(chars, gaps, counts);
    }
  }
  return out;
}
