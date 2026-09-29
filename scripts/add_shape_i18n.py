import json
import os

BASE = r'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/i18n/locales'

# 各语言文案：fillOpacity / strokeOpacity / colorPicker.eyedropper / colorPicker.pickingHint
TR = {
    'zh-CN': {
        'fillOpacity': '填充透明度',
        'strokeOpacity': '轮廓透明度',
        'eyedropper': '取色器',
        'pickingHint': '点击画布取色 · Esc 取消',
    },
    'en': {
        'fillOpacity': 'Fill opacity',
        'strokeOpacity': 'Stroke opacity',
        'eyedropper': 'Eyedropper',
        'pickingHint': 'Click canvas to pick · Esc to cancel',
    },
    'ky-CN': {
        'fillOpacity': 'Толтуруу тунуктуулугу',
        'strokeOpacity': 'Жээк тунуктуулугу',
        'eyedropper': 'Түс алуучу',
        'pickingHint': 'Кенептен түс алуу үчүн басыңыз · Esc менен жабуу',
    },
    'ug': {
        'fillOpacity': 'تولدۇرۇش سۈزۈكلۈكى',
        'strokeOpacity': 'گىرۋەك سۈزۈكلۈكى',
        'eyedropper': 'رەڭ ئالغۇچ',
        'pickingHint': 'رەڭ ئېلىش ئۈچۈن كانداققا چېكىڭ · Esc بىلەن ۋاز كەچىڭ',
    },
    'uz-CN': {
        'fillOpacity': "To'ldirish shaffofligi",
        'strokeOpacity': 'Chegara shaffofligi',
        'eyedropper': 'Rang oluvchi',
        'pickingHint': 'Rang olish uchun maydonga bosing · Esc bilan bekor qilish',
    },
    'kk-CN': {
        'fillOpacity': 'Толтыру мөлдірлігі',
        'strokeOpacity': 'Жиек мөлдірлігі',
        'eyedropper': 'Түс алғыш',
        'pickingHint': 'Түс алу үшін кенепке басыңыз · Esc арқылы болдырмау',
    },
}

for locale, t in TR.items():
    path = os.path.join(BASE, locale, 'editor.json')
    with open(path, 'r', encoding='utf-8-sig') as f:
        data = json.load(f)

    changed = False
    prop = data.setdefault('property', {})
    if 'fillOpacity' not in prop:
        prop['fillOpacity'] = t['fillOpacity']
        changed = True
    if 'strokeOpacity' not in prop:
        prop['strokeOpacity'] = t['strokeOpacity']
        changed = True

    cp = data.setdefault('colorPicker', {})
    if 'eyedropper' not in cp:
        cp['eyedropper'] = t['eyedropper']
        changed = True
    if 'pickingHint' not in cp:
        cp['pickingHint'] = t['pickingHint']
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'updated {locale}')
    else:
        print(f'unchanged {locale}')
