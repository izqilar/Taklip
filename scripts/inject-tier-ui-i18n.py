# -*- coding: utf-8 -*-
"""向 web 端 6 语言 common.json 注入顶层 tierUi（牌级 UI 文案）标签。
文本插入（保留少数民族语言包 unicode 转义），自动探测换行符（CRLF/LF），插入后逐语言 json.load 校验。
"""
import json
import os

BASE = 'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/i18n/locales'

UI = {
    'zh-CN': {
        'score': '贡献分',
        'updatedAt': '定档时间',
        'level': '等级',
        'providerTier': '服务商等级',
        'agentTier': '代理商等级',
        'myContrib': '我的贡献等级',
    },
    'en': {
        'score': 'Contribution',
        'updatedAt': 'Tiered at',
        'level': 'Tier',
        'providerTier': 'Provider tier',
        'agentTier': 'Agent tier',
        'myContrib': 'My contribution tier',
    },
    'ug': {
        'score': 'تۆھپە نومۇرى',
        'updatedAt': 'دەرىجە ۋاقتى',
        'level': 'دەرىجە',
        'providerTier': 'مۇلازىمەتچى دەرىجىسى',
        'agentTier': 'ۋاكالەتچى دەرىجىسى',
        'myContrib': 'مېنىڭ تۆھپە دەرىجەم',
    },
    'kk-CN': {
        'score': 'Үлес ұпайы',
        'updatedAt': 'Деңгей уақыты',
        'level': 'Деңгей',
        'providerTier': 'Қызметкер деңгейі',
        'agentTier': 'Агент деңгейі',
        'myContrib': 'Менің үлес деңгейім',
    },
    'ky-CN': {
        'score': 'салым упайы',
        'updatedAt': 'деңгээл убакыты',
        'level': 'деңгээл',
        'providerTier': 'кызматкер деңгээли',
        'agentTier': 'өкүл деңгээли',
        'myContrib': 'Менин салым деңгээлим',
    },
    'uz-CN': {
        'score': 'Hissa ballari',
        'updatedAt': 'Darajalangan sana',
        'level': 'Daraja',
        'providerTier': 'Provayder darajasi',
        'agentTier': 'Agent darajasi',
        'myContrib': 'Mening hissa darajam',
    },
}


def build_block(names, nl):
    items = list(names.items())
    inner = []
    for i, (k, v) in enumerate(items):
        comma = ',' if i < len(items) - 1 else ''
        inner.append('    "%s": %s%s' % (k, json.dumps(v, ensure_ascii=False), comma))
    return '  "tierUi": {' + nl + nl.join(inner) + nl + '  }'


for lang in UI:
    fp = os.path.join(BASE, lang, 'common.json')
    with open(fp, 'r', encoding='utf-8') as f:
        txt = f.read()
    if '"tierUi"' in txt:
        print('[skip] %s: tierUi already present' % lang)
        continue
    nl = '\r\n' if '\r\n' in txt else '\n'
    block = build_block(UI[lang], nl)
    idx = txt.rfind('}')
    txt = txt[:idx] + ',' + nl + block + txt[idx:]
    # 校验
    try:
        json.loads(txt)
    except Exception as e:
        print('[FAIL] %s: %s' % (lang, e))
        continue
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(txt)
    print('[ok] %s: injected tierUi' % lang)
