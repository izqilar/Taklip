/**
 * 音乐管理对话框 — 由编辑器顶部「多媒体 → 音乐」子菜单触发。
 * 提供「系统音乐」与「我的上传」两个来源，支持试听、上传本地音乐，
 * 选中后保存为作品背景音乐（写入 project.settings.backgroundMusic）。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { services } from '../../services';
import type { BackgroundMusic } from '@h5design/core';

const DEFAULT_MUSIC_ICON =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%236366f1'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M9%2018V5l12-2v13'/%3E%3Ccircle%20cx='6'%20cy='18'%20r='3'/%3E%3Ccircle%20cx='18'%20cy='16'%20r='3'/%3E%3C/svg%3E";

type TabKey = 'system' | 'mine';
interface MusicItem extends BackgroundMusic {
  id?: string;
}

interface MusicManagerModalProps {
  open: boolean;
  current?: BackgroundMusic;
  onClose: () => void;
  onSave: (music: BackgroundMusic) => void;
}

function filenameToName(url: string): string {
  const parts = url.split('/');
  const f = parts[parts.length - 1] || 'music';
  return decodeURIComponent(f.replace(/\.[^/.]+$/, ''));
}

export default function MusicManagerModal({
  open,
  current,
  onClose,
  onSave,
}: MusicManagerModalProps) {
  const { t } = useTranslation('editor');
  const [tab, setTab] = useState<TabKey>('system');
  const [systemList, setSystemList] = useState<MusicItem[]>([]);
  const [mineList, setMineList] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MusicItem | null>(current ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 打开时重置选择 / 停止上一段试听
  useEffect(() => {
    if (!open) return;
    setSelected(current ?? null);
    setPreviewUrl(null);
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 切换 tab 时按需拉取列表
  useEffect(() => {
    if (!open) return;
    if (tab === 'system' && systemList.length === 0) {
      setLoading(true);
      services
        .getSystemMusic()
        .then((items) => setSystemList(items.map((i) => ({ ...i }))))
        .catch(() => setSystemList([]))
        .finally(() => setLoading(false));
    }
    if (tab === 'mine' && mineList.length === 0) {
      setLoading(true);
      services
        .listAssets('audio')
        .then((items) =>
          setMineList(
            items.map((it) => ({
              id: it.id,
              name: filenameToName(it.url),
              url: it.url,
              icon: DEFAULT_MUSIC_ICON,
            })),
          ),
        )
        .catch(() => setMineList([]))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const play = (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    setPreviewUrl(url);
  };

  const handleSelect = (item: MusicItem) => {
    if (selected?.url === item.url && playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    setSelected(item);
    play(item.url);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await services.uploadAsset(file);
      const item: MusicItem = {
        id: asset.id,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: asset.url,
        icon: DEFAULT_MUSIC_ICON,
      };
      setMineList((prev) => [item, ...prev]);
      setTab('mine');
      setSelected(item);
      play(item.url);
    } catch {
      // 上传失败静默处理，保留现有列表
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (selected) {
      onSave({ name: selected.name, url: selected.url, icon: selected.icon });
    }
    onClose();
  };

  if (!open) return null;

  const list = tab === 'system' ? systemList : mineList;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[520px] max-w-[92vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-800">{t('editor:musicManager.title')}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 px-5 pt-3">
          {(['system', 'mine'] as TabKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                tab === k ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t(`editor:musicManager.tab${k === 'system' ? 'System' : 'Mine'}`)}
            </button>
          ))}
          {tab === 'mine' && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {uploading ? t('editor:musicManager.uploading') : `+ ${t('editor:musicManager.upload')}`}
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            handleUpload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {/* 列表 */}
        <div className="min-h-[200px] flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              {t('common:status.loading')}
            </div>
          ) : list.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <span>{tab === 'system' ? t('editor:musicManager.systemEmpty') : t('editor:musicManager.mineEmpty')}</span>
              {tab === 'mine' && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  {t('editor:musicManager.upload')}
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {list.map((item) => {
                const isSel = selected?.url === item.url;
                const isPlaying = isSel && playing;
                return (
                  <li key={item.id ?? item.url}>
                    <button
                      onClick={() => handleSelect(item)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isSel ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        {item.icon?.startsWith('data:') ? (
                          <img src={item.icon} alt="" className="h-6 w-6" />
                        ) : (
                          <span className="text-lg">{item.icon || '🎵'}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
                        {item.name}
                      </span>
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                          isPlaying ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isPlaying ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <span className="truncate text-xs text-gray-400">
            {selected
              ? t('editor:musicManager.selected', { name: selected.name })
              : t('editor:musicManager.noSelection')}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              {t('editor:musicManager.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!selected}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {t('editor:musicManager.save')}
            </button>
          </div>
        </div>

        {/* 试听音频（隐藏） */}
        <audio
          ref={audioRef}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          loop
        />
      </div>
    </div>
  );
}
