"""
生成「系统背景音乐」资源（离线可用、可无缝循环）。

输出：
  apps/server/public/music/*.wav        若干首合成的背景音乐（16bit/22050Hz/单声道）
  apps/server/public/music/system-music.json  前端 /api/music/system 返回的内容

仅依赖 Python 标准库（wave / math / struct / json / os），不引入第三方依赖。
合成采用柔和的正弦泛音 + 包络，并在首尾做淡入淡出以保证循环无缝。
"""

import json
import math
import os
import struct
import wave

SR = 22050  # 采样率
AMP = 0.8  # 峰值振幅（留余量防削波）
FADE = 0.08  # 首尾整体淡入淡出（秒），保证 loop 无缝

# 音名 -> 频率（十二平均律，A4=440）
NOTE = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
}


def render_note(samples_start, dur, freqs, gain=1.0, vibrato=0.0):
    """把一组频率（和弦）渲染进全局采样缓冲（就地修改 samples）。"""
    n = int(dur * SR)
    attack = int(0.02 * SR)
    release = int(0.12 * SR)
    for i in range(n):
        t = i / SR
        # 音符级包络：快起音 + 慢释放，避免咔嗒声
        env = 1.0
        if i < attack:
            env = i / attack
        elif i > n - release:
            env = max(0.0, (n - i) / release)
        s = 0.0
        for f in freqs:
            vib = 1.0 + (vibrato * math.sin(2 * math.pi * 5.0 * t)) if vibrato else 1.0
            # 基频 + 少量谐波，营造温暖音色
            s += math.sin(2 * math.pi * f * vib * t)
            s += 0.4 * math.sin(2 * math.pi * (f * 2) * t)
            s += 0.18 * math.sin(2 * math.pi * (f * 3) * t)
        s *= env * gain
        samples_start[i] += s


def build_track(events, total_dur):
    """events: [(start_t, dur_t, [freqs], gain, vibrato), ...]"""
    n_total = int(total_dur * SR)
    buf = [0.0] * n_total
    for (st, dur, freqs, gain, vib) in events:
        base = int(st * SR)
        seg = [0.0] * int(dur * SR)
        render_note(seg, dur, freqs, gain, vib)
        for i, v in enumerate(seg):
            if base + i < n_total:
                buf[base + i] += v
    # 整体归一化
    peak = max(1e-6, max(abs(x) for x in buf))
    scale = AMP / peak
    # 首尾淡入淡出，确保循环无缝
    fade_n = int(FADE * SR)
    for i in range(n_total):
        f = 1.0
        if i < fade_n:
            f = i / fade_n
        elif i > n_total - fade_n:
            f = (n_total - i) / fade_n
        buf[i] = buf[i] * scale * f
    return buf


def write_wav(path, buf):
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for s in buf:
            v = int(max(-1.0, min(1.0, s)) * 32767)
            frames += struct.pack('<h', v)
        w.writeframes(bytes(frames))


def chord(names):
    return [NOTE[n] for n in names]


# 五首曲目定义：name / 颜色 / 和弦进行（每 2 秒一段）/ 是否带颤音
TRACKS = [
    {
        'file': 'warm.wav', 'name': '温馨时光', 'color': '#f59e0b',
        'chords': ['C4,E4,G4', 'G3,B3,D4', 'A3,C4,E4', 'F3,A3,C4', 'C4,E4,G4', 'G3,B3,D4'],
    },
    {
        'file': 'bright.wav', 'name': '轻快律动', 'color': '#10b981',
        'chords': ['C4,E4,G4', 'F3,A3,C4', 'G3,B3,D4', 'C4,E4,G4', 'A3,C4,E4', 'F3,A3,C4'],
    },
    {
        'file': 'romantic.wav', 'name': '浪漫之夜', 'color': '#ec4899',
        'chords': ['A3,C4,E4', 'F3,A3,C4', 'C4,E4,G4', 'G3,B3,D4', 'A3,C4,E4', 'E3,G3,B3'],
    },
    {
        'file': 'calm.wav', 'name': '静谧星空', 'color': '#3b82f6',
        # 长持续和弦 + 缓慢起伏
        'sustained': ['C3', 'E3', 'G3', 'C4'],
    },
    {
        'file': 'festival.wav', 'name': '欢乐庆典', 'color': '#8b5cf6',
        # 快速琶音
        'arpeggio': ['C4,E4,G4,C5', 'D4,F4,A4,D5', 'E4,G4,B4,E5', 'F4,A4,C5,F5',
                     'G4,B4,D5,G5', 'A4,C5,E5,A5'],
    },
]


def icon_data_url(color):
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' "
        f"stroke='{color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>"
        "<path d='M9 18V5l12-2v13'/><circle cx='6' cy='18' r='3'/><circle cx='18' cy='16' r='3'/></svg>"
    )
    return 'data:image/svg+xml,' + _urlencode(svg)


def _urlencode(s):
    # 不做完整编码，仅转义数据 URL 必需的字符
    return (
        s.replace("'", "%27")
        .replace('"', "%22")
        .replace('<', "%3C")
        .replace('>', "%3E")
        .replace('#', "%23")
        .replace(' ', "%20")
    )


def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'music')
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    items = []
    for tr in TRACKS:
        if 'sustained' in tr:
            # 12 秒持续和弦，缓慢起伏
            buf = build_track(
                [(0.0, 12.0, chord(tr['sustained']), 0.5, 0.0)], 12.0
            )
            # 给持续音加整体缓动（用包络近似：这里复用 render_note 的增益）
        elif 'arpeggio' in tr:
            events = []
            step = 0.5
            t = 0.0
            # 两遍循环，覆盖 12 秒
            seq = tr['arpeggio'] * 2
            for ch in seq:
                events.append((t, step * 0.9, chord(ch.split(',')), 0.6, 0.0))
                t += step
            buf = build_track(events, 12.0)
        else:
            events = []
            step = 2.0
            t = 0.0
            for ch in tr['chords']:
                events.append((t, step, chord(ch.split(',')), 0.55, 0.004))
                t += step
            buf = build_track(events, 12.0)

        path = os.path.join(out_dir, tr['file'])
        write_wav(path, buf)
        items.append({
            'name': tr['name'],
            'url': f"/public/music/{tr['file']}",
            'icon': icon_data_url(tr['color']),
        })
        print(f"generated {tr['file']} ({len(buf)} samples)")

    json_path = os.path.join(out_dir, 'system-music.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"wrote {json_path} with {len(items)} tracks")


if __name__ == '__main__':
    main()
