import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project, ProjectSettings } from '@h5design/core';
import { createDefaultSettings } from '@h5design/core';
import { api } from '@/api/client';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  onSave: (payload: { title: string; settings: ProjectSettings }) => void;
}

type TabKey = 'general' | 'music' | 'share';

function svgDataUrl(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const DISC_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>';

const MUSIC_PRESETS = [
  {
    key: 'boombox',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M8 8v1"/><path d="M12 8v1"/><path d="M16 8v1"/><rect width="20" height="12" x="2" y="9" rx="2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>',
    ),
  },
  {
    key: 'music',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    ),
  },
  {
    key: 'music2',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>',
    ),
  },
  {
    key: 'circlePlay',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
    ),
  },
  {
    key: 'music3',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="4"/><path d="M16 18V2"/></svg>',
    ),
  },
  {
    key: 'guitar',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.2 9.9C8.7 8.8 9.8 8 11 8c2.8 0 5 2.2 5 5 0 1.2-.8 2.3-1.9 2.8l-.9.4A2 2 0 0 0 12 18a4 4 0 0 1-4 4c-3.3 0-6-2.7-6-6a4 4 0 0 1 4-4 2 2 0 0 0 1.8-1.2z"/><circle cx="11.5" cy="12.5" r=".5" fill="currentColor"/></svg>',
    ),
  },
  {
    key: 'headphones',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>',
    ),
  },
  {
    key: 'piano',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8"/><path d="M2 14h20"/><path d="M6 14v4"/><path d="M10 14v4"/><path d="M14 14v4"/><path d="M18 14v4"/></svg>',
    ),
  },
  {
    key: 'mic',
    src: svgDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    ),
  },
  {
    key: 'disc',
    src: svgDataUrl(DISC_ICON_SVG),
  },
];

function IconSvg({
  className = 'h-5 w-5',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-bold text-gray-800">{children}</h3>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-sm font-medium text-gray-700">{children}</div>;
}

function HelpIcon() {
  return (
    <svg
      className="ml-1 inline h-4 w-4 text-gray-400"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
    </svg>
  );
}

export default function SettingsPanel({
  open,
  onClose,
  project,
  onSave,
}: SettingsPanelProps) {
  const { t } = useTranslation('editor');
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [title, setTitle] = useState(project.title);
  const [settings, setSettings] = useState<ProjectSettings>(() => ({
    ...createDefaultSettings(),
    ...(project.settings ?? {}),
  }));
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(project.title);
      setSettings({ ...createDefaultSettings(), ...(project.settings ?? {}) });
    }
  }, [open, project.title, project.settings]);

  const updateSetting = useCallback(
    <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleUploadCover = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await api.uploadAsset(file);
      updateSetting('cover', asset.url);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadMusic = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await api.uploadAsset(file);
      updateSetting('backgroundMusic', {
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: asset.url,
        icon: settings.backgroundMusic?.icon || MUSIC_PRESETS[MUSIC_PRESETS.length - 1].src,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({ title, settings });
    onClose();
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'general', label: t('editor:settings.tabs.general') },
    { key: 'music', label: t('editor:settings.tabs.music') },
    { key: 'share', label: t('editor:settings.tabs.share') },
  ];

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      {/* 右侧面板 */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 选项卡 */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'text-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5">
          {uploading && (
            <div className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-600">
              {t('editor:settings.uploading')}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* 封面 */}
              <div className="flex items-center gap-5">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
                  {settings.cover ? (
                    <img
                      src={settings.cover}
                      alt="cover"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">
                      {t('editor:settings.general.noCover')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1 rounded border border-blue-200 px-4 py-1.5 text-sm text-blue-500 hover:bg-blue-50"
                  >
                    <IconSvg className="h-4 w-4">
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </IconSvg>
                    {t('editor:settings.general.changeCover')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('cover', '')}
                    className="inline-flex items-center justify-center gap-1 rounded border border-blue-200 px-4 py-1.5 text-sm text-blue-500 hover:bg-blue-50"
                  >
                    <IconSvg className="h-4 w-4">
                      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                    </IconSvg>
                    {t('editor:settings.general.cropCover')}
                  </button>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCover(file);
                    e.currentTarget.value = '';
                  }}
                />
              </div>

              {/* 标题 */}
              <div>
                <FieldLabel>{t('editor:settings.general.title')}</FieldLabel>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    placeholder={t('editor:settings.general.titlePlaceholder')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {title.length}/50
                  </span>
                </div>
              </div>

              {/* 描述 */}
              <div>
                <FieldLabel>{t('editor:settings.general.description')}</FieldLabel>
                <div className="relative">
                  <textarea
                    value={settings.description ?? ''}
                    onChange={(e) =>
                      updateSetting('description', e.target.value.slice(0, 50))
                    }
                    rows={3}
                    className="w-full resize-y rounded border border-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-400"
                    placeholder={t('editor:settings.general.descriptionPlaceholder')}
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-400">
                    {(settings.description ?? '').length}/50
                  </span>
                </div>
              </div>

              {/* 翻页方式 */}
              <section>
                <SectionTitle>{t('editor:settings.general.pageTurn')}</SectionTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={settings.pageTurnMode}
                    onChange={(e) =>
                      updateSetting(
                        'pageTurnMode',
                        e.target.value as ProjectSettings['pageTurnMode'],
                      )
                    }
                    className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400"
                  >
                    <option value="horizontal">
                      {t('editor:settings.general.pageTurnHorizontal')}
                    </option>
                    <option value="vertical">
                      {t('editor:settings.general.pageTurnVertical')}
                    </option>
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={settings.autoFlip}
                      onChange={(e) => updateSetting('autoFlip', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                    />
                    {t('editor:settings.general.autoFlip')}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.autoFlipInterval}
                      onChange={(e) =>
                        updateSetting('autoFlipInterval', Math.max(1, Number(e.target.value)))
                      }
                      className="w-14 rounded border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-400"
                    />
                    <span className="text-sm text-gray-600">
                      {t('editor:settings.general.seconds')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-700">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={settings.showPageNumber}
                      onChange={(e) => updateSetting('showPageNumber', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                    />
                    {t('editor:settings.general.showPageNumber')}
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!settings.disableManualFlip}
                      onChange={(e) =>
                        updateSetting('disableManualFlip', !e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                    />
                    {t('editor:settings.general.disableManualFlip')}
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={settings.loopFlip}
                      onChange={(e) => updateSetting('loopFlip', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                    />
                    {t('editor:settings.general.loopFlip')}
                  </label>
                </div>
              </section>

              {/* 微信设置 */}
              <section>
                <div className="mb-3 text-sm font-bold text-gray-800">
                  {t('editor:settings.general.wechat')}
                  <span className="ml-2 text-xs font-normal text-red-500">
                    {t('editor:settings.general.wechatHint')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('wechatAuth', !settings.wechatAuth)}
                  className="inline-flex items-center gap-2 rounded border border-blue-500 bg-white px-4 py-2 text-sm text-blue-500 transition hover:bg-blue-50"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-sm ${
                      settings.wechatAuth
                        ? 'bg-blue-500 text-white'
                        : 'border border-blue-300'
                    }`}
                  >
                    {settings.wechatAuth && (
                      <IconSvg className="h-3 w-3">
                        <path d="M20 6 9 17l-5-5" />
                      </IconSvg>
                    )}
                  </span>
                  {t('editor:settings.general.enableWechatAuth')}
                </button>
              </section>
            </div>
          )}

          {activeTab === 'music' && (
            <div className="space-y-6">
              {/* 音乐条 */}
              <div className="flex items-center justify-between rounded border border-gray-200 px-4 py-3">
                <span className="text-sm text-gray-700">
                  {settings.backgroundMusic?.name || t('editor:settings.music.defaultMusic')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => musicInputRef.current?.click()}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    title={t('editor:settings.music.changeMusic')}
                  >
                    <IconSvg className="h-5 w-5">
                      <path d="M21 15V6" />
                      <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                      <path d="M12 12H3" />
                      <path d="M16 6H3" />
                      <path d="M12 18H3" />
                    </IconSvg>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('backgroundMusic', undefined)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    title={t('editor:settings.music.clearMusic')}
                  >
                    <IconSvg className="h-5 w-5">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </IconSvg>
                  </button>
                  <button
                    type="button"
                    onClick={() => musicInputRef.current?.click()}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    title={t('editor:settings.music.changeMusic')}
                  >
                    <IconSvg className="h-5 w-5">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M8 16H3v5" />
                    </IconSvg>
                  </button>
                </div>
              </div>

              {/* 播放器 */}
              <audio
                src={settings.backgroundMusic?.url || ''}
                controls
                className="w-full"
              />

              {/* 音乐图标 */}
              <section>
                <SectionTitle>{t('editor:settings.music.musicIcon')}</SectionTitle>
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded border border-gray-200 bg-white">
                    {settings.backgroundMusic?.icon ? (
                      <img
                        src={settings.backgroundMusic.icon}
                        alt="music icon"
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <IconSvg className="h-8 w-8 text-gray-300">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="2" />
                      </IconSvg>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={settings.closeBackgroundMusic}
                        onChange={(e) => updateSetting('closeBackgroundMusic', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                      />
                      {t('editor:settings.music.closeMusic')}
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={settings.hideMusicIcon}
                        onChange={(e) => updateSetting('hideMusicIcon', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                      />
                      {t('editor:settings.music.hideIcon')}
                    </label>
                  </div>
                </div>
              </section>

              {/* 图标预设 */}
              <section>
                <SectionTitle>{t('editor:settings.music.iconPresets')}</SectionTitle>
                <div className="grid grid-cols-5 gap-2">
                  {MUSIC_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() =>
                        updateSetting('backgroundMusic', {
                          ...(settings.backgroundMusic ?? {
                            name: '',
                            url: '',
                            icon: MUSIC_PRESETS[MUSIC_PRESETS.length - 1].src,
                          }),
                          icon: preset.src,
                        })
                      }
                      className={`flex aspect-square items-center justify-center rounded border bg-white ${
                        settings.backgroundMusic?.icon === preset.src
                          ? 'border-blue-500 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <img
                        src={preset.src}
                        alt={preset.key}
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="space-y-6">
              {/* 访问设置 */}
              <section>
                <SectionTitle>{t('editor:settings.share.access')}</SectionTitle>
                <select
                  value={settings.access}
                  onChange={(e) =>
                    updateSetting('access', e.target.value as ProjectSettings['access'])
                  }
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="allow">{t('editor:settings.share.accessAllow')}</option>
                  <option value="password">{t('editor:settings.share.accessPassword')}</option>
                  <option value="deny">{t('editor:settings.share.accessDeny')}</option>
                </select>
              </section>

              {/* 访问密钥 */}
              <section>
                <FieldLabel>
                  {t('editor:settings.share.accessKey')}
                  <HelpIcon />
                </FieldLabel>
                <input
                  type="text"
                  value={settings.accessPassword || ''}
                  onChange={(e) => updateSetting('accessPassword', e.target.value.slice(0, 4))}
                  maxLength={4}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder={t('editor:settings.share.accessKeyPlaceholder')}
                />
              </section>

              {/* 允许访问日期 */}
              <section>
                <FieldLabel>
                  {t('editor:settings.share.accessDate')}
                  <HelpIcon />
                </FieldLabel>
                <div className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={settings.accessDateStart || ''}
                    onChange={(e) => updateSetting('accessDateStart', e.target.value || undefined)}
                    className="flex-1 text-sm outline-none"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={settings.accessDateEnd || ''}
                    onChange={(e) => updateSetting('accessDateEnd', e.target.value || undefined)}
                    className="flex-1 text-sm outline-none"
                  />
                </div>
              </section>

              {/* 分享次数与微信分享 */}
              <section className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={settings.showShareCountInTitle}
                    onChange={(e) => updateSetting('showShareCountInTitle', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                  />
                  {t('editor:settings.share.showShareCountInTitle')}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={settings.showShareCountInDesc}
                    onChange={(e) => updateSetting('showShareCountInDesc', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                  />
                  {t('editor:settings.share.showShareCountInDesc')}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={settings.disableWechatShare}
                    onChange={(e) => updateSetting('disableWechatShare', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-blue-500 focus:ring-blue-500"
                  />
                  {t('editor:settings.share.disableWechatShare')}
                </label>
              </section>
            </div>
          )}
        </div>

        {/* 底部保存按钮 */}
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading}
            className="w-full rounded bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {t('editor:settings.save')}
          </button>
        </div>
      </div>
    </>
  );
}
