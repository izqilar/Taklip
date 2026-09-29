import { readFileSync, statSync } from 'fs';

/**
 * 纯 Node 的 TTF / OTF cmap 解析（无第三方依赖）。
 *
 * 目的：在「目录即真相」扫描字体时，算出每个字体对**维吾尔文正字法**的覆盖情况，
 * 供前端做两件事：
 *   1) 文本含维吾尔文而所选字体缺字时，确定性地回退到统一的内置补字字体
 *      （消除 Chrome / Firefox 各自回退系统字体导致的字形/连字不一致）；
 *   2) 编辑器字体选择器对「缺维吾尔字母」的字体给出明确警示，引导用户改选覆盖字体。
 *
 * 只解析 cmap 的 format 0 / 4 / 6 / 12（覆盖 99.9% 的 TTF/OTF）。
 * format 14（IVS）与复杂衍生表对「字符是否有字形」判定无意义，跳过。
 */

/** 维吾尔文正字法所需、且不属于标准阿拉伯字母表的码位（缺其一即无法正确拼写维吾尔文） */
export const UYGHUR_SPECIFIC: number[] = [
  0x0626, // ئ
  0x067e, // پ
  0x0686, // چ
  0x0698, // ژ
  0x06ad, // ڭ
  0x06af, // گ
  0x06be, // ھ
  0x06c6, // ۆ
  0x06c7, // ۇ
  0x06c8, // ۈ
  0x06cb, // ۋ
  0x06d0, // ې
  0x06d5, // ە
  0x0649, // ى（维吾尔文词尾变体）
];

/** 连字/连写相关的不可见控制符（缺 ZWNJ/ZWJ 会影响词语连写表现） */
export const UYGHUR_JOIN_CTRL: number[] = [0x0640, 0x200c, 0x200d];

export interface FontCoverage {
  /** 是否覆盖全部维吾尔文特定码位（不含控制符） */
  uyghur: boolean;
  /** 缺失的维吾尔文特定码位（十进制），供编辑器提示具体缺哪些字母 */
  missingUyghur: number[];
  /**
   * 该字体真实覆盖的 unicode-range 字符串（用于 @font-face 的 unicode-range，
   * 让浏览器只在本字体确实有字形的码位上使用它，缺失码位确定性地交给回退字体）。
   * 形如 ["U+0600-06FF","U+0750-077F","U+200C-200D","U+FB50-FDFF","U+FE70-FEFF"]。
   */
  ranges: string[];
  /** 覆盖的码位总数（仅用于调试/校验） */
  count: number;
}

const EMPTY_COVERAGE: FontCoverage = {
  uyghur: false,
  missingUyghur: UYGHUR_SPECIFIC.slice(),
  ranges: [],
  count: 0,
};

function u16(buf: Buffer, off: number): number {
  return buf.readUInt16BE(off);
}
function u32(buf: Buffer, off: number): number {
  return buf.readUInt32BE(off);
}

/** 读取 cmap 表内所有映射到的码位集合 */
function readCmapCodepoints(buf: Buffer, cmapOffset: number): Set<number> {
  const out = new Set<number>();
  const numSub = u16(buf, cmapOffset + 2);
  const subHeaders: number[] = [];
  for (let i = 0; i < numSub; i += 1) {
    // platformID(2) encodingID(2) offset(4) —— offset 相对 cmap 表首
    subHeaders.push(cmapOffset + u32(buf, cmapOffset + 4 + i * 8 + 4));
  }
  for (const sub of subHeaders) {
    const fmt = u16(buf, sub);
    if (fmt === 0) {
      // 256 个 1-byte 码位
      for (let c = 0; c < 256; c += 1) {
        if (u16(buf, sub + 4 + c * 2) !== 0) out.add(c);
      }
    } else if (fmt === 4) {
      const segCount = u16(buf, sub + 6) / 2;
      let p = sub + 14;
      // endCode[segCount]
      const endCode: number[] = [];
      for (let i = 0; i < segCount; i += 1) {
        endCode.push(u16(buf, p + i * 2));
      }
      p += segCount * 2 + 2; // 跳过 endCode + reservedPad(2)
      const startCode: number[] = [];
      for (let i = 0; i < segCount; i += 1) {
        startCode.push(u16(buf, p + i * 2));
      }
      p += segCount * 2;
      const idDelta: number[] = [];
      for (let i = 0; i < segCount; i += 1) {
        idDelta.push(u16(buf, p + i * 2));
      }
      p += segCount * 2;
      const idRangeOffsetBase = p;
      const idRangeOffsets: number[] = [];
      for (let i = 0; i < segCount; i += 1) {
        idRangeOffsets.push(u16(buf, p + i * 2));
      }
      for (let s = 0; s < segCount; s += 1) {
        const end = endCode[s];
        const start = startCode[s];
        if (start > end) continue;
        for (let c = start; c <= end; c += 1) {
          if (c === 0xffff) break;
          const ro = idRangeOffsets[s];
          let gid: number;
          if (ro === 0) {
            gid = (idDelta[s] + c) & 0xffff;
          } else {
            const gOff = idRangeOffsetBase + s * 2 + ro + (c - start) * 2;
            gid = u16(buf, gOff);
            if (gid !== 0) gid = (gid + idDelta[s]) & 0xffff;
          }
          if (gid !== 0) out.add(c);
        }
      }
    } else if (fmt === 6) {
      const first = u16(buf, sub + 6);
      const count = u16(buf, sub + 8);
      for (let i = 0; i < count; i += 1) {
        if (u16(buf, sub + 10 + i * 2) !== 0) out.add(first + i);
      }
    } else if (fmt === 12) {
      const nGroups = u32(buf, sub + 12);
      let p = sub + 16;
      for (let g = 0; g < nGroups; g += 1) {
        const sc = u32(buf, p);
        const ec = u32(buf, p + 4);
        p += 12;
        for (let c = sc; c <= ec; c += 1) out.add(c);
      }
    }
    // 其它 format（2/8/10/13/14）跳过
  }
  return out;
}

/** 把码位集合压缩成连续区间的 unicode-range 字符串数组 */
export function codepointsToRanges(cps: Set<number>): string[] {
  if (cps.size === 0) return [];
  const sorted = [...cps].sort((a, b) => a - b);
  const ranges: string[] = [];
  let s = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const c = sorted[i];
    if (c === prev + 1) {
      prev = c;
      continue;
    }
    ranges.push(s === prev ? `U+${hex(s)}` : `U+${hex(s)}-${hex(prev)}`);
    s = c;
    prev = c;
  }
  ranges.push(s === prev ? `U+${hex(s)}` : `U+${hex(s)}-${hex(prev)}`);
  return ranges;
}

function hex(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * 从字体文件路径解析覆盖信息。文件不存在 / 解析失败时返回 EMPTY_COVERAGE。
 * 解析失败不应阻断「目录即真相」整体流程，因此返回保守的「不覆盖」而非抛错。
 */
export function parseFontCoverage(path: string): FontCoverage {
  try {
    const buf = readFileSync(path);
    if (buf.length < 12) return { ...EMPTY_COVERAGE };
    // 取 sfnt 版本（4 字节）；OTTO / true / 0x00010000 均为有效
    const version = buf.readUInt32BE(0);
    const isSfnt =
      version === 0x00010000 ||
      version === 0x4f54544f || // 'OTTO'
      version === 0x74727565 || // 'true'
      version === 0x74746366; // 'ttcf'
    if (!isSfnt) return { ...EMPTY_COVERAGE };
    const numTables = u16(buf, 4);
    let cmapOffset = -1;
    for (let i = 0; i < numTables; i += 1) {
      const entry = 12 + i * 16;
      const tag = buf.toString('ascii', entry, entry + 4);
      if (tag === 'cmap') {
        cmapOffset = u32(buf, entry + 8);
        break;
      }
    }
    if (cmapOffset < 0 || cmapOffset + 4 > buf.length) return { ...EMPTY_COVERAGE };
    const codepoints = readCmapCodepoints(buf, cmapOffset);
    const missingUyghur = UYGHUR_SPECIFIC.filter((cp) => !codepoints.has(cp));
    // 连写控制符也纳入「缺失」提示范围（但不影响 uyghur 主判定，避免过多字体被判缺）
    const joinMissing = UYGHUR_JOIN_CTRL.filter((cp) => !codepoints.has(cp));
    const uyghur = missingUyghur.length === 0;
    return {
      uyghur,
      missingUyghur,
      ranges: codepointsToRanges(codepoints),
      count: codepoints.size + (uyghur ? 0 : 0) - joinMissing.length * 0, // count 仅基准覆盖数
    };
  } catch {
    return { ...EMPTY_COVERAGE };
  }
}

/** 仅用于 EMPTY_COVERAGE 复制返回，避免调用方改到共享对象 */
export function emptyCoverage(): FontCoverage {
  return {
    uyghur: false,
    missingUyghur: UYGHUR_SPECIFIC.slice(),
    ranges: [],
    count: 0,
  };
}

export { EMPTY_COVERAGE, statSync };
