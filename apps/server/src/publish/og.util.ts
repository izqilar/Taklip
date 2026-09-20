/**
 * OG（Open Graph）HTML 构建工具 — 供发布页分享卡片使用。
 * 返回的纯 meta 文档供社交/IM 爬虫读取（微信、QQ、Telegram 等），不含 JS 跳转。
 */

export interface OgMeta {
  title: string;
  description: string;
  image?: string;
  url: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOgHtml(meta: OgMeta): string {
  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const imageLine = meta.image
    ? `    <meta property="og:image" content="${escapeHtml(meta.image)}" />\n    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${url}" />
${imageLine}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <title>${title}</title>
</head>
<body></body>
</html>`;
}

/** 社交/IM 爬虫 UA 识别（命中则返回 OG HTML） */
export const CRAWLER_UA_RE =
  /(facebookexternalhit|twitterbot|telegrambot|whatsapp|wechat|micromessenger|qq\/|weibo|linkedinbot|slackbot|discordbot|pinterest|reddit|bot|spider|crawler|preview|scanner)/i;
