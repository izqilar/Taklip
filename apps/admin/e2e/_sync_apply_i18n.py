# -*- coding: utf-8 -*-
"""
把 web 端「入驻申请」文案同步进运营端共享语言包 apps/admin/src/i18n/locales/<lang>/web-common.json。

设计要点（踩过坑才有的）：
· **以 HEAD 版本为基底重建**，天然幂等，不会累积上一轮的歪插入。
· 不整份 json.dump：该文件存在行内紧凑写法（"publish": "发布", "export": "导出"），
  整体 dump 会把既有 700 行全部洗一遍，diff 不可读。改为「定位块 → 在最后一个成员后追加」。
· **保持原文件行尾符**：HEAD 的 web-common.json 是 CRLF、common.json 是 LF，
  统一写 \n 会让 git diff 变成整文件变更（2026-09-24 踩过）。故按字节判定 dominant EOL。
· zh-CN 需先落地既有术语修正（服务商入住 → 服务商入驻），否则重建会把上轮改动冲掉。
"""
import io, json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
WEB = os.path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales')
ADMIN = os.path.join(ROOT, 'apps', 'admin', 'src', 'i18n', 'locales')
LANGS = ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN']

# HEAD → 工作副本之间需要保留的既有订正（上一轮会话的术语纠正）
PRE_FIXES = [('服务商入住', '服务商入驻')]


def match_block(s, start):
    """start 指向 '{'，返回其匹配 '}' 的下标（跳过字符串内的括号）。"""
    depth, i, in_str, esc = 0, start, False, False
    while i < len(s):
        c = s[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError('unbalanced braces @%d' % start)


def find_child(s, key, block_start, block_end):
    """在块内找 "<key>": {...}，返回 (key 起始, 值 '{' 位置, 值 '}' 位置)。"""
    idx = s.find('"%s":' % key, block_start, block_end)
    if idx < 0:
        return None
    brace = s.find('{', idx)
    if brace < 0 or brace > block_end:
        return None
    return (idx, brace, match_block(s, brace))


def last_member_end(s, close_brace):
    """块闭合花括号前一个成员的结束位置（其后紧接待插入内容）。"""
    j = close_brace - 1
    while s[j] in ' \t\r\n':
        j -= 1
    return j + 1


def member_block(key, value, indent):
    """生成 '<indent>"<key>": <value>' 文本，value 为 dict 时按 json 缩进展开。"""
    pad = ' ' * indent
    body = json.dumps(value, ensure_ascii=False, indent=2)
    lines = body.split('\n')
    lines[0] = '"%s": %s' % (key, lines[0])
    return '\n'.join(pad + ln for ln in lines)


def main():
    report = []
    for lang in LANGS:
        web_path = os.path.join(WEB, lang, 'common.json')
        adm_rel = os.path.join('apps', 'admin', 'src', 'i18n', 'locales', lang, 'web-common.json').replace('\\', '/')
        webd = json.load(io.open(web_path, encoding='utf-8'))
        uc_src = webd.get('userCenter', {})
        if not uc_src.get('apply') or not uc_src.get('menu', {}).get('apply'):
            report.append('%-6s SKIP (source has no apply keys)' % lang)
            continue

        raw = subprocess.run(['git', 'show', 'HEAD:' + adm_rel], cwd=ROOT, capture_output=True).stdout
        if not raw:
            report.append('%-6s ABORT (no HEAD version)' % lang)
            continue
        eol = '\r\n' if raw.count(b'\r\n') * 2 > raw.count(b'\n') else '\n'
        s = raw.decode('utf-8').replace('\r\n', '\n')
        for old, new in PRE_FIXES:
            s = s.replace(old, new)

        uc_idx = s.find('"userCenter":')
        if uc_idx < 0:
            report.append('%-6s SKIP (target has no userCenter)' % lang)
            continue
        uc_brace = s.find('{', uc_idx)
        uc_end = match_block(s, uc_brace)
        menu = find_child(s, 'menu', uc_brace, uc_end)

        # ⚠️ 从后往前插：先 uc 直属 apply.*（下标靠后），再 menu.apply（下标靠前）
        #    否则先插使后插的定位下标整体右移。
        s = (
            s[: last_member_end(s, uc_end)]
            + ','
            + '\n'
            + member_block('apply', uc_src['apply'], 4)
            + s[last_member_end(s, uc_end):]
        )
        if menu:
            me = match_block(s, s.find('{', s.find('"menu":', s.find('"userCenter":'))))
            p = last_member_end(s, me)
            s = s[:p] + ',\n' + member_block('apply', uc_src['menu']['apply'], 6) + s[p:]

        json.loads(s)  # 语法校验：写坏就抛，不落盘
        out = s.replace('\n', eol)
        open(os.path.join(ROOT, adm_rel), 'wb').write(out.encode('utf-8'))
        report.append('%-6s OK (%s, %d apply keys)' % (lang, eol.encode(), len(uc_src['apply'])))
    print('\n'.join(report))


if __name__ == '__main__':
    main()
