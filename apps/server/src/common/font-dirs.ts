import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * 字体目录解析。
 *
 * ⚠️ 关键背景：服务端进程由 watchdog 以 `cwd = apps/server` 启动，所以
 * `join(process.cwd(), 'uploads')` 指向的是 **apps/server/uploads**（实际托管目录）。
 * 而项目根也有一个 `uploads/`（便于随仓库管理字体素材），两者不是同一个目录。
 *
 * 因此字体目录按优先级取第一个真实存在的：
 *   1. 环境变量 FONTS_DIR（部署时显式指定）
 *   2. <cwd>/uploads/fonts              —— 即 apps/server/uploads/fonts
 *   3. <项目根>/uploads/fonts           —— 即 D:\...\uploads\fonts（cwd 上溯两级）
 *
 * 保证「字体放哪个 uploads 下都能被扫描到」，避免管理时踩空。
 */
export function resolveFontsDir(): string {
  const cands = [
    process.env.FONTS_DIR,
    join(process.cwd(), 'uploads', 'fonts'),
    resolve(process.cwd(), '..', '..', 'uploads', 'fonts'),
  ].filter((v): v is string => !!v);

  for (const d of cands) {
    if (existsSync(d)) return d;
  }
  // 都不存在时返回默认位置（扫描会自然得到 0 条，不会报错）
  return cands[1] ?? join(process.cwd(), 'uploads', 'fonts');
}

/** 字体文件的对外 URL 前缀（静态托管，见 main.ts） */
export const FONTS_URL_PREFIX = '/uploads/fonts/';
