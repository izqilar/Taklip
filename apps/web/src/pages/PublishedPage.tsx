/**
 * H5 发布页 — 公开访问 /p/:publishCode
 * 从后端加载 Schema，用 DOM 渲染器展示，并提供分享/二维码面板（A2）
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
// PublishedH5 定义在 @h5design/render（共享渲染器，零 GSAP / 零 Konva）。
// 注意：render 默认的 animationPlayer 是 no-op，**不播放入场/循环动画**；
// 这里从编辑器内核的 `animations` **子入口**单独取 GSAP 播放器注入 —— 该子入口
// 只依赖 gsap，不会把 Konva/画布内核拖进发布页（详见 packages/editor/src/animations/index.ts）。
import {PublishedH5} from '@h5design/render';
import {playElementAnimation} from '@h5design/editor/animations';
import { useLanguageDirection } from '@/hooks/useLanguageDirection';
import {
  buildShareUrl,
  generateQrDataUrl,
  downloadDataUrl,
  copyToClipboard,
  setOgTags,
} from '@/utils/share';
import type { Project, FontMeta } from '@h5design/core';
import { collectFontFamilies, ensureFontsByFamilies, setFontCatalog } from '@h5design/core';

export default function PublishedPage() {
  const { t } = useTranslation(['common', 'errors']);
  const { dir } = useLanguageDirection();
  const { publishCode } = useParams<{ publishCode: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isWechat, setIsWechat] = useState(false);

  const shareUrl = publishCode ? buildShareUrl(publishCode) : '';

  useEffect(() => {
    if (!publishCode) return;
    setLoading(true);
    api
      .getPublished(publishCode)
      .then((data) => {
        const proj = data.schema as Project;
        setProject(proj);
        setTitle(data.title);
        document.title = `${data.title} - H5`;
      })
      .catch(() => {
        setError(t('errors:error.pageNotFound'));
      })
      .finally(() => setLoading(false));
  }, [publishCode, t]);

  // 生成分享二维码 + 写入 OG 元信息
  useEffect(() => {
    if (!publishCode || !shareUrl) return;
    const cover =
      (project as unknown as { cover?: string | null })?.cover ??
      (project as unknown as { settings?: { coverImage?: string | null } })?.settings?.coverImage ??
      null;
    setOgTags({ title, url: shareUrl, image: cover ?? undefined });
    generateQrDataUrl(shareUrl)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [publishCode, shareUrl, project, title]);

  useEffect(() => {
    setIsWechat(/MicroMessenger/i.test(navigator.userAgent));
  }, []);

  // 自定义字体：拉取目录并注册本作品用到的字体。
  // 不注册的话发布页会静默回退成系统字体（字形对、但排版宽度会偏）。
  // 注册完成后由 SchemaRenderer 的 `loadingdone` 监听自动重新排版。
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = (await api.fonts()) as FontMeta[];
        if (cancelled) return;
        setFontCatalog(list);
        await ensureFontsByFamilies(collectFontFamilies(project));
      } catch {
        /* 字体目录不可用时静默降级为系统字体 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveQr = () => {
    if (qrDataUrl) downloadDataUrl(qrDataUrl, `qrcode-${publishCode ?? 'h5'}.png`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-400">
        {t('common:status.loading')}
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-gray-400">
        <p className="mb-2 text-4xl">😢</p>
        <p>{error ?? t('errors:error.pageNotExist')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-start pt-4">
        <div className="w-full overflow-hidden rounded-lg shadow-2xl">
          <PublishedH5 project={project} animationPlayer={playElementAnimation} />
        </div>

        {/* 分享条：二维码 / 复制链接 / 微信引导（RTL 下随 dir 自动镜像） */}
        <div
          dir={dir}
          className="mt-4 w-full rounded-lg border border-gray-800 bg-gray-900 p-4 text-gray-200"
        >
          <div className="flex items-center gap-4">
            {/* 二维码卡片 */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-28 w-28 items-center justify-center rounded bg-white p-1">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" className="h-full w-full" />
                ) : (
                  <span className="text-xs text-gray-400">...</span>
                )}
              </div>
              <button
                onClick={handleSaveQr}
                disabled={!qrDataUrl}
                className="rounded bg-brand-600 px-2 py-1 text-xs text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {t('common:share.saveQr')}
              </button>
            </div>

            {/* 复制链接 + 提示 */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="truncate text-xs text-gray-400">{shareUrl}</div>
              <button
                onClick={handleCopy}
                className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white transition hover:bg-gray-600"
              >
                {copied ? t('common:share.copied') : t('common:share.copyLink')}
              </button>
              <p className="text-xs leading-relaxed text-gray-500">
                {isWechat
                  ? t('common:share.wechatHint')
                  : t('common:share.openInWechat')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
