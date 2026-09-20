/**
 * 外链视频解析 — 将用户填入的「视频地址 / 嵌入代码」统一解析为可渲染的两种形态：
 *  - video：直链媒体文件（.mp4 / .webm ...），用原生 <video> 播放
 *  - embed：<iframe> 内嵌（平台分享链接转换后的嵌入地址，或用户直接粘贴的嵌入代码）
 *
 * 设计要点：
 *  - 直链媒体文件 → <video src>
 *  - 含 <iframe>/<embed>/<video> 标签的整段嵌入代码 → 清洗后原样渲染
 *  - 平台分享链接（YouTube / Bilibili / Youku / Tencent / Vimeo 等 watch 页）
 *    → 转换为对应 embed iframe 地址
 *  - 其它 http(s) 链接 → 兜底用 <iframe> 内嵌
 */

import type { VideoElement } from '@h5design/core';
import { sanitizeEmbedHtml } from './sanitize';

/** 常见直链媒体文件后缀 */
const MEDIA_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|flv|mp3|m4a|wav|aac)(\?.*)?$/i;

export type ResolvedVideo =
  | {
      kind: 'video';
      src: string;
      poster?: string;
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
    }
  | { kind: 'embed'; html: string }
  | { kind: 'none' };

/** 判断是否为整段嵌入代码（而非纯 URL） */
function looksLikeEmbedCode(s: string): boolean {
  return /<(iframe|embed|video|object)\b/i.test(s);
}

/** 转义用于属性值的 HTML 特殊字符 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 将各平台「分享/播放页」链接转换为可内嵌的 iframe 地址。
 * 已为 embed 形态的不重复处理。
 */
function toEmbedUrl(u: URL, opts: { autoplay?: boolean; muted?: boolean }): string {
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  // YouTube
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    let id = '';
    if (host.includes('youtu.be')) {
      id = path.slice(1);
    } else if (path.startsWith('/embed/')) {
      return u.toString(); // 已是 embed
    } else if (path.startsWith('/shorts/')) {
      id = path.split('/')[2] || '';
    } else {
      id = u.searchParams.get('v') || '';
    }
    id = id.replace(/\/.*$/, '');
    if (id) {
      const params = new URLSearchParams();
      params.set('rel', '0');
      if (opts.autoplay) params.set('autoplay', '1');
      if (opts.muted) params.set('mute', '1');
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }
  }

  // Bilibili
  if (host.includes('bilibili.com') || host.includes('b23.tv')) {
    if (host.includes('player.bilibili.com')) return u.toString();
    const m = path.match(/\/(video|bangumi)\/(BV[\w]+|av\d+)/i) || path.match(/\/BV[\w]+/i);
    let bvid = '';
    if (m) bvid = (m[2] || m[0].replace(/\//g, '')).replace(/^av/i, 'av');
    if (bvid) {
      return `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=${opts.autoplay ? 1 : 0}`;
    }
  }

  // Youku
  if (host.includes('youku.com')) {
    if (host.includes('player.youku.com')) return u.toString();
    const m = path.match(/id_([A-Za-z0-9]+)/);
    if (m) return `https://player.youku.com/embed/${m[1]}`;
  }

  // Tencent 视频
  if (host.includes('v.qq.com')) {
    if (host.includes('txp.iframe') || path.startsWith('/txp/')) return u.toString();
    // /x/page/ID.html 或 /x/cover/xxx/ID.html
    const m = path.match(/\/([a-zA-Z0-9]+)\.html$/);
    const vid = m ? m[1] : u.searchParams.get('vid') || '';
    if (vid) {
      return `https://v.qq.com/txp/iframe/player.html?vid=${vid}${opts.autoplay ? '&autoplay=1' : ''}`;
    }
  }

  // Vimeo
  if (host.includes('vimeo.com')) {
    if (path.startsWith('/video/')) return u.toString();
    const m = path.match(/\/(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }

  // 未识别的平台 → 直接内嵌原链接（部分站点可能因 X-Frame-Options 拒绝内嵌，属站点策略限制）
  return u.toString();
}

/** 兜底 iframe 包裹（用于未被识别为媒体的普通 http(s) 链接） */
function buildFallbackIframe(url: string): string {
  return `<iframe src="${escapeAttr(url)}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture" scrolling="no" style="width:100%;height:100%;border:0;display:block;"></iframe>`;
}

export function resolveExternalVideo(el: VideoElement): ResolvedVideo {
  const raw = (el.src || '').trim();
  if (!raw) return { kind: 'none' };

  // 1) 整段嵌入代码
  if (looksLikeEmbedCode(raw)) {
    const html = sanitizeEmbedHtml(raw);
    return html ? { kind: 'embed', html } : { kind: 'none' };
  }

  // 2) URL
  let url: string;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'none' };
    url = toEmbedUrl(u, { autoplay: !!el.autoplay, muted: !!el.muted });
  } catch {
    return { kind: 'none' };
  }

  // 3) 直链媒体文件 → <video>
  if (MEDIA_EXT.test(url)) {
    return {
      kind: 'video',
      src: url,
      poster: el.poster ? el.poster.trim() : undefined,
      autoplay: el.autoplay,
      muted: el.muted,
      loop: el.loop,
    };
  }

  // 4) 其余（共享链接已转换 / 未识别站点）→ iframe 内嵌
  return { kind: 'embed', html: buildFallbackIframe(url) };
}
