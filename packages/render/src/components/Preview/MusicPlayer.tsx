/**
 * 背景音乐浮动播放器 — 可复用于「预览」与「发布页」。
 * 默认自动播放（除非 closeBackgroundMusic）；点击图标切换 播放/暂停（静音）。
 * 位于作品右上角，点击可在播放 ↔ 暂停间切换。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackgroundMusic } from '@h5design/core';

const DEFAULT_NOTE = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

interface MusicPlayerProps {
  music?: BackgroundMusic;
  autoPlay?: boolean;
  hidden?: boolean;
  className?: string;
}

export default function MusicPlayer({
  music,
  autoPlay = true,
  hidden = false,
  className = '',
}: MusicPlayerProps) {
  const { t } = useTranslation('editor');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music) return;
    setPlaying(false);
    if (autoPlay) {
      // 浏览器常拦截无用户手势的自动播放；失败则保持暂停态，由用户点击触发
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music?.url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  if (!music || hidden) return null;

  return (
    <div className={`absolute right-3 top-3 z-30 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        title={playing ? t('editor:musicPlayer.pause') : t('editor:musicPlayer.play')}
        aria-label={playing ? t('editor:musicPlayer.pause') : t('editor:musicPlayer.play')}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow-lg backdrop-blur transition hover:bg-white"
      >
        <span className={playing ? 'animate-spin' : ''} style={playing ? { animationDuration: '3s' } : undefined}>
          {music.icon?.startsWith('data:') ? (
            <img src={music.icon} alt="" className="h-5 w-5" />
          ) : (
            DEFAULT_NOTE
          )}
        </span>
        {!playing && (
          <span className="pointer-events-none absolute h-6 w-0.5 rotate-45 rounded bg-gray-500" />
        )}
      </button>
      <audio
        ref={audioRef}
        key={music.url}
        src={music.url}
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
