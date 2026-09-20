# -*- coding: utf-8 -*-
import io
p=r"D:\MyWorkBuddy\2026-08-10-22-39-56\UI_Design\p9.html"
s=io.open(p,encoding='utf-8-sig').read()

start_marker='/* ── 首页动态数据 ── */'
end_marker='/* ══════════ 关键屏声明（截图器枚举） ══════════ */'
i=s.index(start_marker)
j=s.index(end_marker)

new_block = open(r"D:\MyWorkBuddy\2026-08-10-22-39-56\UI_Design\new_block.txt", encoding='utf-8').read()
s = s[:i] + new_block + s[j:]
io.open(p,'w',encoding='utf-8').write(s)
print('replaced ok; markers:', 'renderScope' in s, 'AGENTS' in s, 'syncObjUI' in s)
