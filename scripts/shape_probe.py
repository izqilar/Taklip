# -*- coding: utf-8 -*-
"""
对单个字体做「字形级」整形取证：打印 HarfBuzz 输出的 glyph 名 + cluster，
以确定 ە(U+06D5) 的连接类型行为、以及浏览器是否会因缺字形而回退。

用法：python scripts/shape_probe.py "<font path>" [更多字体...]
"""
import sys

import uharfbuzz as hb
from fontTools.ttLib import TTFont

WORD = "مەلىكە"
WORD_REF = "مىرزات"
PROBES = [
    ("isolated   ە      ", "\u06d5"),
    ("init?      ەل     ", "\u06d5\u0644"),
    ("medi?      مەل    ", "\u0645\u06d5\u0644"),
    ("final?     مە     ", "\u0645\u06d5"),
    ("word       مەلىكە ", WORD),
    ("ref        مىرزات ", WORD_REF),
]
ARAB_JOIN_PROBE = [
    ("A+beh  اب          ", "\u0627\u0628"),   # alef(R)+beh(D)
    ("beh+beh بب        ", "\u0628\u0628"),   # D+D  -> 都应连
    ("AE+AE  ەە         ", "\u06d5\u06d5"),   # R?+R? -> 看是否连
]


def load(path):
    tt = TTFont(path, fontNumber=0, lazy=True)
    order = tt.getGlyphOrder()
    cmap = {}
    for t in tt["cmap"].tables:
        cmap.update(t.cmap)
    return tt, order, cmap


def shape(path, text, lang="ug"):
    with open(path, "rb") as f:
        blob = hb.Blob(f.read())
    face = hb.Face(blob)
    font = hb.Font(face)
    font.scale = (face.upem, face.upem)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.direction = "rtl"
    buf.script = "Arab"
    buf.language = lang
    hb.shape(font, buf, {"kern": True, "liga": True, "rlig": True, "calt": True})
    return buf.glyph_infos, buf.glyph_positions


def report(path):
    print("=" * 100)
    print("FONT:", path)
    try:
        tt, order, cmap = load(path)
    except Exception as e:
        print("  !! open failed:", e)
        return
    nm = tt["name"]
    print("  family:", (nm.getDebugName(16) or nm.getDebugName(1)))
    print("  glyphs:", len(order), " cmap U+06D5:", cmap.get(0x06D5, "MISSING"))

    def gname(gid):
        # HarfBuzz 给 gid(int)；fontTools cmap 给 glyph name(str)
        if isinstance(gid, str):
            return gid
        try:
            return order[gid] if 0 <= gid < len(order) else "gid%d(?)" % gid
        except Exception:
            return "gid%d" % gid

    # 每个字符的 cmap 直查（不含上下文）
    print("  -- cmap 直查（无上下文）--")
    for ch in WORD:
        cp = ord(ch)
        gid = cmap.get(cp)
        print("     U+%04X %s -> %s" % (cp, ch, gname(gid) if gid is not None else "MISSING"))

    print("  -- HarfBuzz 整形（visual order，左→右）--")
    for label, text in PROBES + ARAB_JOIN_PROBE:
        infos, poss = shape(path, text)
        seq = " ".join("%s(cl%d)" % (gname(i.codepoint), i.cluster) for i in infos)
        notdef = sum(1 for i in infos if i.codepoint == 0)
        print("     %s -> %s   notdef=%d" % (label, seq, notdef))
    tt.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        report(p)
