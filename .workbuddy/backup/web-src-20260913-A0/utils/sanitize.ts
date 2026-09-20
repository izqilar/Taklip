/**
 * URL 安全校验 — 防止 XSS（javascript: 等危险协议注入到 <a href> / <img src> / <video src>）。
 *
 * 设计原则：
 * - 外链（button.link）：仅允许 http/https/mailto/tel，以及站内相对路径
 * - 媒体（image.src / video.src）：仅允许 http/https/data:image，以及站内相对路径
 * - 任何 javascript:/data:text-html 等危险协议一律返回空串，调用方降级为占位/纯文本
 */

const LINK_PROTOCOL = /^(https?:|mailto:|tel:)/i;

function isRelative(url: string): boolean {
  return (
    url.startsWith('/') ||
    url.startsWith('./') ||
    url.startsWith('../')
  );
}

/** 校验外链（按钮跳转）。返回安全 URL，否则返回空串。 */
export function safeLink(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isRelative(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    return LINK_PROTOCOL.test(u.protocol) ? trimmed : '';
  } catch {
    return '';
  }
}

/** 校验媒体地址（图片/视频）。返回安全 URL，否则返回空串。 */
export function safeMedia(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // 相对路径（站内 /uploads）直接放行
  if (isRelative(trimmed)) return trimmed;
  // data: 媒体（我们内联导出的图片/视频）放行；其余 data:（如 data:text/html）属危险协议，拦截。
  // 注意：不能依赖 new URL(trimmed).protocol 判断，因为 new URL('data:image/png;...').protocol
  // 返回的是 'data:' 而非 'data:image/'，旧正则 ^(https?:|data:image\/) 会因此误杀所有图片 dataURL，
  // 导致导出图片时内联好的 dataURL 被 safeMedia 清空、ImageElementView 退化为占位框。
  if (/^data:/i.test(trimmed)) {
    return /^(data:image\/|data:video\/|data:audio\/)/i.test(trimmed) ? trimmed : '';
  }
  try {
    const u = new URL(trimmed);
    return /^(https?:)$/i.test(u.protocol) ? trimmed : '';
  } catch {
    return '';
  }
}
/**
 * 校验并清洗「背景图字段」。页面/元素的 backgroundImage 有两种存储形态：
 *  - 裸 URL：`/uploads/x.webp`、`data:image/...`（编辑器常态）
 *  - 已包裹的 `url(...)`：`url(data:image/...)`、`url(/uploads/x.webp)`
 *    （exportVideo.cloneAndInline 会把内联后的 dataURL 以 `url(...)` 形式写回 backgroundImage）
 *
 * 旧实现 `url(${safeMedia(page.backgroundImage)})` 在导出时会对「已是 url(...) 包裹」的值
 * 二次包裹并让 safeMedia 对 `url(...)` 整体抛错返回空串 → 导出背景图彻底丢失。
 * 本函数统一提取内部地址 → safeMedia 校验 → 重新包成 `url(...)`，对两种形态都安全。
 */
export function safeBackgroundImage(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // 已包裹形式：提取内部地址
  const m = /^url\(\s*['"]?([^'")]+)['"]?\s*\)$/i.exec(trimmed);
  const inner = (m ? m[1] : trimmed).trim();
  const safe = safeMedia(inner);
  return safe ? `url(${safe})` : '';
}


/**
 * 校验并清洗「外链视频嵌入代码」（<iframe>/<embed>/<video>/<object>）。
 * 仅保留白名单标签与属性，剥离 script/style、on* 事件处理器、危险协议（javascript: 等），
 * 并强制 src 必须是 http(s) 或协议相对地址。返回可直接 dangerouslySetInnerHTML 的安全 HTML，
 * 无有效内容时返回空串。
 *
 * 注意：仅在浏览器环境（存在 DOMParser）下可用。
 */
const EMBED_ALLOWED_TAGS = new Set([
  'iframe',
  'embed',
  'video',
  'object',
  'source',
  'div',
  'span',
  'a',
  'img',
  'br',
  'p',
]);
const EMBED_ALLOWED_ATTRS = new Set([
  'src',
  'width',
  'height',
  'frameborder',
  'allowfullscreen',
  'allow',
  'scrolling',
  'style',
  'class',
  'id',
  'title',
  'name',
  'type',
  'poster',
  'controls',
  'autoplay',
  'loop',
  'muted',
  'playsinline',
]);

export function sanitizeEmbedHtml(html?: string | null): string {
  if (!html || typeof html !== 'string') return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return '';
  const doc = new window.DOMParser().parseFromString(html, 'text/html');

  const walk = (root: Element) => {
    const children = Array.from(root.children);
    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      if (!EMBED_ALLOWED_TAGS.has(tag) || tag === 'script' || tag === 'style') {
        child.remove();
        continue;
      }
      // 剥离危险属性 / 危险值
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim();
        const safeAttr = EMBED_ALLOWED_ATTRS.has(name) || name.startsWith('data-');
        const safeVal = !/^\s*javascript:/i.test(val);
        if (!safeAttr || !safeVal) {
          child.removeAttribute(attr.name);
        }
      }
      // src 必须是 http(s) 或协议相对，否则移除该节点（避免本地文件/危险协议）
      const src = child.getAttribute('src');
      if (src && !/^(https?:|\/\/)/i.test(src.trim())) {
        child.remove();
        continue;
      }
      // 媒体播放器需显式委派 autoplay / 声音 / 全屏 权限，否则浏览器 autoplay 策略
      // 会静音（画面正常但无声音，如 Bilibili 嵌入代码）。补齐 allow 与 allowfullscreen。
      if (tag === 'iframe' || tag === 'embed' || tag === 'video') {
        if (!child.hasAttribute('allowfullscreen')) {
          child.setAttribute('allowfullscreen', 'true');
        }
        const allow = (child.getAttribute('allow') || '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const need of ['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture', 'microphone']) {
          if (!allow.includes(need)) allow.push(need);
        }
        child.setAttribute('allow', allow.join('; '));
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML.trim();
}
