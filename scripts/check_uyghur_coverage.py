# -*- coding: utf-8 -*-
"""
维吾尔文（ئۇيغۇر ئەرەب يېزىقى）32 字母覆盖体检。

逐个字体检查维吾尔文正字法所需码位是否在 cmap 中；缺失即意味着浏览器必然回退。

用法：python scripts/check_uyghur_coverage.py [字体路径...]
"""
import os
import sys

from fontTools.ttLib import TTFont

# 维吾尔文阿拉伯字母表（32 字母 + 正字法常用附加码位）
UYGHUR = {
    0x0626: "ئ", 0x0627: "ا", 0x06D5: "ە", 0x0628: "ب", 0x067E: "پ",
    0x062A: "ت", 0x062C: "ج", 0x0686: "چ", 0x062E: "خ", 0x062F: "د",
    0x0631: "ر", 0x0632: "ز", 0x0698: "ژ", 0x0633: "س", 0x0634: "ش",
    0x063A: "غ", 0x0641: "ف", 0x0642: "ق", 0x0643: "ك", 0x06AF: "گ",
    0x06AD: "ڭ", 0x0644: "ل", 0x0645: "م", 0x0646: "ن", 0x06BE: "ھ",
    0x0648: "و", 0x06C7: "ۇ", 0x06C6: "ۆ", 0x06C8: "ۈ", 0x06CB: "ۋ",
    0x06D0: "ې", 0x0649: "ى", 0x064A: "ي",
}
# 维吾尔文标点/符号（连字符 ھەمزە 等）
EXTRA = {0x0640: "ـ", 0x200C: "ZWNJ", 0x200D: "ZWJ"}


def coverage(path):
    tt = TTFont(path, fontNumber=0, lazy=True)
    cmap = set()
    for t in tt["cmap"].tables:
        cmap.update(t.cmap.keys())
    fam = tt["name"].getDebugName(1) or "?"
    tt.close()
    missing = {cp: ch for cp, ch in {**UYGHUR, **EXTRA}.items() if cp not in cmap}
    return fam, missing, cmap


def main():
    paths = sys.argv[1:]
    if not paths:
        base = "uploads/fonts"
        paths = []
        for d in ("FreeFonts", "LicensedFonts"):
            p = os.path.join(base, d)
            if os.path.isdir(p):
                paths += [os.path.join(p, f) for f in sorted(os.listdir(p))
                          if f.lower().endswith((".ttf", ".otf"))]
    print("%-40s %-20s %s" % ("file", "family", "缺失维吾尔字母"))
    print("-" * 100)
    full, partial = [], []
    for p in paths:
        try:
            fam, missing, _ = coverage(p)
        except Exception as e:
            print("%-40s OPEN-FAIL %s" % (os.path.basename(p)[:40], e))
            continue
        tag = os.path.basename(p)[:40]
        if not missing:
            full.append(tag)
            print("%-40s %-20s ✓ 全覆盖" % (tag, fam[:20]))
        else:
            partial.append((tag, fam, missing))
            print("%-40s %-20s ✗ 缺 %2d 个: %s" % (
                tag, fam[:20], len(missing),
                " ".join("%s(U+%04X)" % (ch, cp) for cp, ch in list(missing.items())[:12])
                + (" …" if len(missing) > 12 else "")))
    print("\n=== 汇总 ===")
    print("全覆盖: %d 个" % len(full))
    print("有缺失: %d 个" % len(partial))


if __name__ == "__main__":
    main()
