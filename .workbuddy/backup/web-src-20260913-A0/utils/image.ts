/**
 * 图片工具：读取真实像素尺寸 + 上传前校验。
 * 前端读取尺寸后随上传请求提交，使后端 Asset 记录拥有真实宽高，
 * 从而避免「顶部图片上传后回退到 200×200 默认缩放」的插入问题。
 */

/** 允许的图片 MIME 类型（与后端 fileFilter 保持一致） */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/tiff',
  'image/avif',
];

/** 最大上传体积（10MB，与后端 multer limits 保持一致） */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * 校验待上传的图片文件。
 * @returns 校验通过返回 null；否则返回 i18n 错误键（errors:error.*）
 */
export function validateImageFile(file: File): string | null {
  const typeOk = file.type
    ? ALLOWED_IMAGE_TYPES.includes(file.type) || /^image\//.test(file.type)
    : /\.(jpe?g|png|gif|webp|bmp|svg|ico|tiff?|avif)$/i.test(file.name);
  if (!typeOk) return 'errors:error.fileType';
  if (file.size > MAX_IMAGE_SIZE) return 'errors:error.fileTooLarge';
  return null;
}

/** 从 File 读取真实像素尺寸（优先 createImageBitmap，回退到 Image 元素） */
export function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // 部分浏览器（含实验标志）支持 createImageBitmap，直接拿到位图尺寸
    const tryBitmap = () => {
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(file)
          .then((bmp) => {
            const w = bmp.width;
            const h = bmp.height;
            bmp.close?.();
            if (w > 0 && h > 0) resolve({ width: w, height: h });
            else tryImg();
          })
          .catch(tryImg);
      } else {
        tryImg();
      }
    };

    const tryImg = () => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        URL.revokeObjectURL(url);
        if (w > 0 && h > 0) resolve({ width: w, height: h });
        else reject(new Error('Cannot read image dimensions'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Cannot read image dimensions'));
      };
      img.src = url;
    };

    tryBitmap();
  });
}
