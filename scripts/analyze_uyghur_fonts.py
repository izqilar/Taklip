# -*- coding: utf-8 -*-
"""
维吾尔文/阿拉伯文「跨浏览器字形不一致」取证脚本。

对 uploads/fonts 下的每个字体：
  1. cmap 是否覆盖 U+06D5 (ARABIC LETTER AE，维吾尔文 ە)
  2. 用真实 HarfBuzz（与 Chrome/Firefox 内核同一套整形引擎）整形样本串，
     看是否出现 .notdef（= 缺字形 → 浏览器必然走两级回退 → 跨浏览器不一致）
  3. 对比 ە 在「孤立 / 词首 / 词中 / 词尾」四种语境下的字形 id，
     判断该字体是否提供完整连写形态（init/medi/fina/isol 全部存在）
  4. 列出 GSUB 里与阿拉伯连写相关的 feature tag

用法：python scripts/analyze_uyghur_fonts.py [--only <substr>] [--json out.json]
"""
import argparse
import json
import os
import sys

import uharfbuzz as hb
from fontTools.ttLib import TTFont

# 用户报告的问题串：مىرزات & مەلىكە
WORD = "مەلىكە"          # 出问题的词
WORD_REF = "مىرزات"      # 正常的词
AE = "\u06d5"            # ە ARABIC LETTER AE
# 四语境探针（逻辑序即输入序，HarfBuzz 按 RTL 反向处理）
CTX = {
    "isolated": AE,           # ە
    "initial": AE + "ل",      # ەل   → ە 若在词首
    "medial": "م" + AE + "ل",  # مەل  → ە 在词中
    "final": "م" + AE,         # مە   → ە 在词尾
}

ARAB_RANGES = [(0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF),
               (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)]
ARAB_FEATURES = {"init", "medi", "fina", "isol", "curs", "rlig", "calt",
                 "liga", "ccmp", "mark", "mkmk", "mset", "rclt"}


def in_arabic(cp):
    return any(lo <= cp <= hi for lo, hi in ARAB_RANGES)


def shape(path, text, lang="ug"):
    """返回 (glyph_names_by_gid, n_notdef, clusters)；用真实 HarfBuzz 整形。"""
    with open(path, "rb") as f:
        blob = hb.Blob(f.read())
    face = hb.Face(blob)
    font = hb.Font(face)
    upem = face.upem
    font.scale = (upem, upem)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.direction = "rtl"
    buf.script = "Arab"
    buf.language = lang
    hb.shape(font, buf, {"kern": True, "liga": True, "rlig": True, "calt": True})
    infos = buf.glyph_infos
    return [i.codepoint for i in infos], [i.cluster for i in infos]


def gsub_features(font):
    """收集 GSUB 中出现的 feature tag（按 script/lang 去重）"""
    tags = set()
    try:
        gsub = font["GSUB"].table
        if gsub.FeatureList is None:
            return tags
        for rec in gsub.FeatureList.FeatureRecord:
            tags.add(rec.FeatureTag)
    except Exception:
        pass
    return tags


def analyze(path):
    res = {"file": os.path.relpath(path).replace("\\", "/")}
    try:
        tt = TTFont(path, fontNumber=0, lazy=True)
    except Exception as e:
        res["error"] = "TTFont open failed: %s" % e
        return res

    # family / 名称
    try:
        nm = tt["name"]
        res["family"] = (nm.getDebugName(16) or nm.getDebugName(1) or "?").strip()
        res["subfamily"] = (nm.getDebugName(17) or nm.getDebugName(2) or "").strip()
    except Exception:
        res["family"] = "?"

    # cmap 覆盖
    cmap = set()
    try:
        for t in tt["cmap"].tables:
            cmap.update(t.cmap.keys())
    except Exception:
        pass
    res["has_U06D5"] = 0x06D5 in cmap
    res["arabic_cp_count"] = sum(1 for cp in cmap if in_arabic(cp))
    res["arabic_pres_forms"] = sum(1 for cp in cmap if 0xFE70 <= cp <= 0xFEFF)

    feats = gsub_features(tt)
    res["gsub_arab_features"] = sorted(feats & ARAB_FEATURES)
    res["has_init"] = "init" in feats
    res["has_medi"] = "medi" in feats
    res["has_fina"] = "fina" in feats
    res["has_isol"] = "isol" in feats
    res["has_curs"] = "curs" in feats
    res["has_rlig"] = "rlig" in feats
    tt.close()

    # 真实整形
    try:
        gids, clusters = shape(path, WORD)
        res["word_gids"] = gids
        res["word_notdef"] = gids.count(0)
        res["word_nglyphs"] = len(gids)
        ref_gids, _ = shape(path, WORD_REF)
        res["ref_notdef"] = ref_gids.count(0)
        # 四语境 ە
        ctx_gids = {}
        for k, t in CTX.items():
            g, _ = shape(path, t)
            # 取「非第一个」的那个字形作为 ە 的落点（ە 恒为最后输入字符）
            ctx_gids[k] = g
        res["ctx"] = ctx_gids
        # ە 的四种形态是否互不相同（= 字体提供了上下文变体）
        ae_glyph = {}
        for k, g in ctx_gids.items():
            ae_glyph[k] = g[-1] if g else None
        res["ae_glyph_by_ctx"] = ae_glyph
        uniq = {v for v in ae_glyph.values() if v is not None}
        res["ae_form_variants"] = len(uniq)
    except Exception as e:
        res["shape_error"] = str(e)

    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="只分析文件名含该子串的字体")
    ap.add_argument("--json", default=None, help="输出 JSON 路径")
    ap.add_argument("--dirs", nargs="*", default=["uploads/fonts/FreeFonts",
                                                  "uploads/fonts/LicensedFonts"])
    args = ap.parse_args()

    files = []
    for d in args.dirs:
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.lower().endswith((".ttf", ".otf")):
                if args.only and args.only.lower() not in f.lower():
                    continue
                files.append(os.path.join(d, f))

    rows = [analyze(p) for p in files]

    hdr = ("%-42s %-26s %5s %5s %5s %4s %4s %4s %4s %4s %4s %6s %7s" %
           ("file", "family", "06D5", "arCp", "preF",
            "init", "medi", "fina", "isol", "curs", "rlig", "ndF", "aeVar"))
    print(hdr)
    print("-" * len(hdr))
    for r in rows:
        if "error" in r:
            print("%-42s ERROR %s" % (r["file"][-42:], r["error"]))
            continue
        print("%-42s %-26s %5s %5s %5s %4s %4s %4s %4s %4s %4s %6s %7s" % (
            r["file"].replace("FreeFonts/", "").replace("LicensedFonts/", "L:")[-42:],
            (r.get("family") or "?")[:26],
            "Y" if r.get("has_U06D5") else "N",
            r.get("arabic_cp_count"),
            r.get("arabic_pres_forms"),
            "Y" if r.get("has_init") else "-",
            "Y" if r.get("has_medi") else "-",
            "Y" if r.get("has_fina") else "-",
            "Y" if r.get("has_isol") else "-",
            "Y" if r.get("has_curs") else "-",
            "Y" if r.get("has_rlig") else "-",
            r.get("word_notdef", "?"),
            r.get("ae_form_variants", "?"),
        ))

    # 汇总
    bad = [r for r in rows if r.get("has_U06D5") and r.get("word_notdef", 0) == 0
           and r.get("ae_form_variants", 0) < 3]
    miss = [r for r in rows if r.get("has_U06D5") is False]
    print("\n=== 缺 U+06D5（必然触发浏览器回退）: %d 个 ===" % len(miss))
    for r in miss:
        print("   ", r["file"])
    print("\n=== 有 U+06D5 但 ە 上下文形态不足(<3 种) ===")
    for r in bad:
        print("   ", r["file"], "ae_glyphs=", r.get("ae_glyph_by_ctx"))

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=1)
        print("\nJSON ->", args.json)


if __name__ == "__main__":
    main()
