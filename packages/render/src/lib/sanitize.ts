/**
 * 消毒工具统一从 @h5design/core 取用（单一真源，浏览器/Node 同构）。
 * 本文件仅做 re-export，避免 render 与 core 各持一份导致逻辑漂移。
 * 历史实现见 packages/core/src/sanitize.ts。
 */
export {
  safeLink,
  safeMedia,
  safeBackgroundImage,
  sanitizeEmbedHtml,
  sanitizeSchema,
  looksLikeEmbedCode,
} from '@h5design/core';
