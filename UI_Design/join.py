# -*- coding: utf-8 -*-
import io, re, os

src = r"D:\MyWorkBuddy\2026-08-10-22-39-56\UI_Design"
parts = ["p1.html", "p2.html", "p3.html", "p4.html", "p5.html",
         "p6.html", "p7.html", "p8.html", "p9.html"]
chunks = []
for p in parts:
    with io.open(os.path.join(src, p), "r", encoding="utf-8-sig") as f:
        chunks.append(f.read())

# p1 里提前闭合了 </style></head>，去掉，把闭合移到 p3 之后
p1 = chunks[0]
p1 = re.sub(r"</style>\s*</head>\s*$", "", p1, flags=re.S)
html = p1 + chunks[1] + chunks[2] + "\n</style>\n</head>\n" + "".join(chunks[3:])

dest = r"D:\MyWorkBuddy\2026-08-10-22-39-56\UI_Design\ui-run\console\index.html"
with io.open(dest, "w", encoding="utf-8") as f:
    f.write(html)

# 校验：统计中文字符数量、关键中文是否正常
body = html
for probe in ["庆柬云", "经营总览", "总台视角", "服务商入驻审核", "评价与反馈中心"]:
    print(probe, "->", probe in html)
print("size:", len(html))
