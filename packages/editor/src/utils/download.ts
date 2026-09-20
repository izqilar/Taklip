/**
 * 触发浏览器下载一个 dataURL 文件。
 *
 * 从 web 端 `utils/share.ts` 抽离出来的等价实现：内核只需要这一个下载能力，
 * 而 `share.ts` 的其余部分（分享链接/二维码/OG 标签）属于 web 发布页业务，
 * 留在 web 侧，避免发布页反向依赖编辑器内核（见文档 §0-D5/D8）。
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 触发浏览器下载一个 Blob（服务端导出走这条路）。
 * 相比 dataURL，Blob 不会把整份二进制塞进字符串，大图/视频场景内存友好得多。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    downloadDataUrl(url, filename);
  } finally {
    // 立即撤销会让部分浏览器来不及下载，延后释放
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
