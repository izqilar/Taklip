/**
 * 发布设置对话框 — 三选项卡式布局（立即发布 / 导出图片 / 导出视频）
 * 集发布、导出图片、导出视频、支付预览于一体
 */
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@h5design/core';
import { api, type PublishResult } from '@/api/client';
import DOMRenderer from '@/components/Preview/DOMRenderer';
import { exportProjectToVideo } from '@/utils/konvaVideoExport';

/** 导出图片参数：范围（指定页/长图）+ 图片格式（jpeg/png/webp）+ 指定页码（0-based） */
export interface ImageExportOptions {
  mode: 'current' | 'all';
  format: ImageFormat;
  page: number;
}

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  project: Project;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onExport?: (opts: ImageExportOptions) => void;
}

type TabKey = 'publish' | 'exportImage' | 'exportVideo';
type ImageExportScope = 'page' | 'longImage';
export type ImageFormat = 'jpeg' | 'png' | 'webp';
type VideoFormat = 'mp4' | 'webm' | 'gif';

/** 按目标 scale 计算实际像素尺寸并裁剪溢出，避免 transform:scale 仍占原始布局高度 */
function ScaledPreview({ project, currentPage }: { project: Project; currentPage: number }) {
  const scale = 0.38;
  const width = Math.round((project.width ?? 375) * scale);
  const height = Math.round((project.height ?? 667) * scale);
  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      style={{ width, height }}
    >
      <DOMRenderer project={project} currentPage={currentPage} scale={scale} animated />
    </div>
  );
}

/** 模拟二维码占位图案 */
function QRPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-20 w-20 flex-col items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400">
      <svg className="mb-1 h-6 w-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h7v7h-7z" />
        <path d="M14 17h7M17 14v7" />
      </svg>
      {label}
    </div>
  );
}

/** 选项卡按钮组件 */
function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-t-md cursor-pointer ${
        active
          ? 'bg-green-500 text-white shadow-sm'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

/** 共享的底部区域：价格 + 支付类型 + 二维码 + 提示 */
function PaymentSection({
  priceLabel,
  coin,
  vipFree,
  payTypeLabel,
  alipayLabel,
  wechatPayLabel,
  alipayQRLabel,
  wechatQRLabel,
  tipText,
  payType,
  setPayType,
}: {
  priceLabel: string;
  coin: string;
  vipFree: string;
  payTypeLabel: string;
  alipayLabel: string;
  wechatPayLabel: string;
  alipayQRLabel: string;
  wechatQRLabel: string;
  tipText: string;
  payType: 'alipay' | 'wechat';
  setPayType: (v: 'alipay' | 'wechat') => void;
}) {
  return (
    <>
      {/* 分隔线 */}
      <div className="border-b border-gray-200" />

      {/* 价格 */}
      <div className="flex items-center text-sm">
        <span className="text-gray-600">{priceLabel}</span>
        <span className="ml-2 text-lg font-bold text-orange-500">20{coin}</span>
        <span className="ml-3 rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-600">
          {vipFree}
        </span>
      </div>

      {/* 支付类型 */}
      <div>
        <div className="mb-2 text-sm text-gray-600">{payTypeLabel}</div>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              name="payType"
              value="alipay"
              checked={payType === 'alipay'}
              onChange={() => setPayType('alipay')}
              className="h-4 w-4 text-blue-500"
            />
            {alipayLabel}
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              name="payType"
              value="wechat"
              checked={payType === 'wechat'}
              onChange={() => setPayType('wechat')}
              className="h-4 w-4 text-green-500"
            />
            {wechatPayLabel}
          </label>
        </div>
      </div>

      {/* 二维码占位 */}
      <div className="flex gap-4">
        <QRPlaceholder label={alipayQRLabel} />
        <QRPlaceholder label={wechatQRLabel} />
      </div>

      {/* 温馨提示 */}
      <p className="text-xs text-orange-500">{tipText}</p>
    </>
  );
}

export default function PublishModal({
  open,
  onClose,
  projectId,
  project,
  currentPage = 0,
  onPageChange,
  onExport,
}: PublishModalProps) {
  const { t } = useTranslation(['publish', 'common']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [payType, setPayType] = useState<'alipay' | 'wechat'>('alipay');
  const [videoExporting, setVideoExporting] = useState(false);

  // 选项卡状态
  const [activeTab, setActiveTab] = useState<TabKey>('publish');

  // 导出图片选项
  const [imageScope, setImageScope] = useState<ImageExportScope>('page');
  const [imageFormat, setImageFormat] = useState<ImageFormat>('jpeg');

  // 导出视频选项
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('mp4');

  // 预览页码（单一数据源：驱动预览区渲染 + 导出图片页码输入框，支持翻页）
  const totalPages = project.pages?.length ?? 1;
  const [previewPage, setPreviewPage] = useState(currentPage);

  // 同步外部 currentPage 变化（如编辑器切换页面后打开弹窗），open 时重新对齐
  useEffect(() => {
    if (open) setPreviewPage(currentPage);
  }, [currentPage, open]);

  const handlePublish = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      await api.updateProject(projectId, {
        title: project.title,
        schema: project,
      });
      const res = await api.publish(projectId);
      setResult(res);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[publish] failed:', err);
      setError(t('publish:publishFail'));
    } finally {
      setLoading(false);
    }
  }, [projectId, project, t]);

  const handleExportImage = useCallback(() => {
    onExport?.({
      mode: imageScope === 'page' ? 'current' : 'all',
      format: imageFormat,
      page: previewPage,
    });
  }, [imageScope, imageFormat, previewPage, onExport]);

  const handleExportVideo = useCallback(async () => {
    if (videoExporting) return;
    setVideoExporting(true);
    try {
      // 把用户在「导出视频」选项卡选择的格式（mp4 / webm / gif）透传，导出对应格式文件
      await exportProjectToVideo(project, videoFormat);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[export-video] failed:', err);
      alert(err instanceof Error ? err.message : t('publish:exportVideoFail'));
    } finally {
      setVideoExporting(false);
    }
  }, [project, videoFormat, t, videoExporting]);

  const fullUrl = result ? `${window.location.origin}/p/${result.publishCode}` : '';

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fullUrl]);

  const handlePrevPage = useCallback(() => {
    setPreviewPage((prev) => {
      const next = Math.max(0, prev - 1);
      onPageChange?.(next);
      return next;
    });
  }, [onPageChange]);

  const handleNextPage = useCallback(() => {
    setPreviewPage((prev) => {
      const next = Math.min(totalPages - 1, prev + 1);
      onPageChange?.(next);
      return next;
    });
  }, [totalPages, onPageChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-2.5">
          <h2 className="text-base font-bold text-gray-800">{t('publish:publishSettingsTitle')}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('publish:close')}
          >
            ✕
          </button>
        </div>

        {/* 主体 */}
        <div className="flex">
          {/* 左侧：选项卡 + 内容 */}
          <div className="flex-1 p-4">
            {loading ? (
              <div className="py-6 text-center text-green-500">{t('publish:publishing')}</div>
            ) : error ? (
              <div className="space-y-4">
                <p className="text-red-500">{error}</p>
                <button
                  onClick={handlePublish}
                  className="w-full rounded-lg bg-green-500 py-2.5 font-medium text-white transition hover:bg-green-600"
                >
                  {t('common:button.retry', { defaultValue: 'Retry' })}
                </button>
              </div>
            ) : result ? (
              <div className="space-y-4 text-center">
                <div className="text-3xl">🎉</div>
                <p className="font-medium text-gray-800">{t('publish:publishSuccess')}</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="break-all text-sm text-green-500">{fullUrl}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-medium text-white transition hover:bg-green-400"
                  >
                    {copied ? t('publish:copySuccess') : t('publish:copyLink')}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    {t('publish:close')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ====== 选项卡栏 ====== */}
                <div className="mb-3 flex gap-1 border-b border-gray-200 pb-0">
                  <TabButton
                    active={activeTab === 'publish'}
                    label={t('publish:tabPublish')}
                    onClick={() => setActiveTab('publish')}
                  />
                  <TabButton
                    active={activeTab === 'exportImage'}
                    label={t('publish:tabExportImage')}
                    onClick={() => setActiveTab('exportImage')}
                  />
                  <TabButton
                    active={activeTab === 'exportVideo'}
                    label={t('publish:tabExportVideo')}
                    onClick={() => setActiveTab('exportVideo')}
                  />
                </div>

                {/* ====== 选项卡内容 ====== */}

                {/* --- 立即发布选项卡 --- */}
                {activeTab === 'publish' && (
                  <div className="space-y-3.5">
                    {/* H5格式说明 */}
                    <p className="text-sm text-green-500">
                      {t('publish:h5FormatDesc')}
                    </p>

                    {/* 发布按钮 */}
                    <button
                      onClick={handlePublish}
                      disabled={!projectId}
                      className="w-full rounded-lg bg-green-500 py-2.5 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
                    >
                      {t('publish:publishNow')}
                    </button>

                    <PaymentSection
                      priceLabel={t('publish:priceLabel')}
                      coin={t('publish:coin')}
                      vipFree={t('publish:vipFree')}
                      payTypeLabel={t('publish:payType')}
                      alipayLabel={t('publish:alipay')}
                      wechatPayLabel={t('publish:wechatPay')}
                      alipayQRLabel={t('publish:alipayQR')}
                      wechatQRLabel={t('publish:wechatQR')}
                      tipText={t('publish:publishTip')}
                      payType={payType}
                      setPayType={setPayType}
                    />
                  </div>
                )}

                {/* --- 导出图片选项卡 --- */}
                {activeTab === 'exportImage' && (
                  <div className="space-y-3.5">
                    {/* 导出范围 */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="imageScope"
                          value="page"
                          checked={imageScope === 'page'}
                          onChange={() => setImageScope('page')}
                          className="h-4 w-4"
                        />
                        {t('publish:exportPage')}
                        <input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={previewPage + 1}
                          onChange={(e) => {
                            const num = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1));
                            setPreviewPage(num - 1);
                          }}
                          className="w-14 rounded border border-gray-300 px-2 py-0.5 text-center text-sm leading-tight focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        {t('publish:pageUnit')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="imageScope"
                          value="longImage"
                          checked={imageScope === 'longImage'}
                          onChange={() => setImageScope('longImage')}
                          className="h-4 w-4"
                        />
                        {t('publish:exportLongImageOption')}
                      </label>
                    </div>

                    {/* 导出格式 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="text-sm text-gray-600">{t('publish:imageFormat')}</span>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="imageFormat"
                          value="jpeg"
                          checked={imageFormat === 'jpeg'}
                          onChange={() => setImageFormat('jpeg')}
                          className="h-4 w-4"
                        />
                        {t('publish:formatJpeg')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="imageFormat"
                          value="png"
                          checked={imageFormat === 'png'}
                          onChange={() => setImageFormat('png')}
                          className="h-4 w-4"
                        />
                        {t('publish:formatPng')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="imageFormat"
                          value="webp"
                          checked={imageFormat === 'webp'}
                          onChange={() => setImageFormat('webp')}
                          className="h-4 w-4"
                        />
                        {t('publish:formatWebp')}
                      </label>
                    </div>

                    {/* 导出按钮 */}
                    <button
                      onClick={handleExportImage}
                      className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600"
                    >
                      {t('publish:tabExportImage')}
                    </button>

                    <PaymentSection
                      priceLabel={t('publish:priceLabel')}
                      coin={t('publish:coin')}
                      vipFree={t('publish:vipFree')}
                      payTypeLabel={t('publish:payType')}
                      alipayLabel={t('publish:alipay')}
                      wechatPayLabel={t('publish:wechatPay')}
                      alipayQRLabel={t('publish:alipayQR')}
                      wechatQRLabel={t('publish:wechatQR')}
                      tipText={t('publish:publishTip')}
                      payType={payType}
                      setPayType={setPayType}
                    />
                  </div>
                )}

                {/* --- 导出视频选项卡 --- */}
                {activeTab === 'exportVideo' && (
                  <div className="space-y-3.5">
                    {/* 视频格式 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="text-sm text-gray-600">{t('publish:videoFormat')}</span>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="videoFormat"
                          value="mp4"
                          checked={videoFormat === 'mp4'}
                          onChange={() => setVideoFormat('mp4')}
                          className="h-4 w-4"
                        />
                        {t('publish:formatMp4')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="videoFormat"
                          value="webm"
                          checked={videoFormat === 'webm'}
                          onChange={() => setVideoFormat('webm')}
                          className="h-4 w-4"
                        />
                        {t('publish:formatWebm')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="videoFormat"
                          value="gif"
                          checked={videoFormat === 'gif'}
                          onChange={() => setVideoFormat('gif')}
                          className="h-4 w-4"
                        />
                        {t('publish:formatGif')}
                      </label>
                    </div>

                    {/* 导出按钮 */}
                    <button
                      onClick={handleExportVideo}
                      disabled={videoExporting}
                      className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                    >
                      {videoExporting ? t('publish:exportingVideo') : t('publish:tabExportVideo')}
                    </button>

                    <PaymentSection
                      priceLabel={t('publish:priceLabel')}
                      coin={t('publish:coin')}
                      vipFree={t('publish:vipFree')}
                      payTypeLabel={t('publish:payType')}
                      alipayLabel={t('publish:alipay')}
                      wechatPayLabel={t('publish:wechatPay')}
                      alipayQRLabel={t('publish:alipayQR')}
                      wechatQRLabel={t('publish:wechatQR')}
                      tipText={t('publish:publishTip')}
                      payType={payType}
                      setPayType={setPayType}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 右侧：预览 + 翻页按钮 */}
          <div className="flex w-auto min-w-[120px] flex-col items-center border-l border-gray-200 bg-gray-50 p-3">
            <div className="mb-1.5 flex w-full items-center justify-between">
              <span className="text-sm font-medium text-gray-600">{t('publish:previewLabel')}</span>
              <span className="text-xs text-gray-400">
                {previewPage + 1} / {totalPages}
              </span>
            </div>
            <ScaledPreview project={project} currentPage={previewPage} />

            {/* 翻页导航按钮 */}
            <div className="mt-2 flex w-full gap-2">
              <button
                onClick={handlePrevPage}
                disabled={previewPage <= 0}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={t('publish:prevPage')}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={handleNextPage}
                disabled={previewPage >= totalPages - 1}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={t('publish:nextPage')}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
