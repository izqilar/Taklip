/**
 * 分享工具集（A2 发布页分享 / A3 已发布管理 共用）
 * - buildShareUrl：统一生成 /p/:publishCode 公开访问链接
 * - generateQrDataUrl：生成可扫码的分享二维码（dataURL）
 * - downloadDataUrl：触发浏览器下载
 * - copyToClipboard：复制文本（带 execCommand 兜底，兼容非安全上下文）
 * - setOgTags：写入 OG 元信息，提升 IM 粘贴预览
 */
import QRCode from 'qrcode';

/** 由发布码生成标准分享 URL（统一来源，替换散落的拼接逻辑） */
export function buildShareUrl(publishCode: string): string {
  return `${window.location.origin}/p/${publishCode}`;
}

/** 生成二维码 dataURL（可嵌入 <img> 或下载） */
export async function generateQrDataUrl(url: string, size = 240): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** 触发浏览器下载一个 dataURL 文件 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** 复制文本到剪贴板，优先 Clipboard API，失败回退 execCommand */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 回退到 execCommand */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-10000px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 写入 / 更新 OG 元信息（仅影响「当前页」，SPA 局限，外部卡片预览需服务端渲染） */
export function setOgTags(opts: { title?: string; url?: string; image?: string }): void {
  const ensure = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  if (opts.title) ensure('og:title', opts.title);
  if (opts.url) ensure('og:url', opts.url);
  if (opts.image) ensure('og:image', opts.image);
}
