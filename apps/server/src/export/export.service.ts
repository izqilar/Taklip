import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getBrowser, buildRenderUrls } from './browser';
import { checkWorkFontLicense } from '../common/font-license';
import { collectFontFamilies } from '@h5design/core';
import type { Project } from '@h5design/core';
import { randomBytes } from 'crypto';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

/**
 * 服务端导出（**硬门槛**）
 *
 * 为什么必须服务端做：编辑器/导出若留在客户端（canvas.toDataURL / MediaRecorder），
 * 用户可以直接绕过付费校验拿到高清无水印成品。改为服务端渲染后：
 * - 渲染所需 schema 由服务端按 projectId 读取，客户端无法注入；
 * - 是否加水印、导出分辨率，全部由服务端依据字体授权结果决定；
 * - 客户端拿到的只是最终二进制，拿不到未降级的中间产物。
 *
 * 授权策略（docs/font-licensing-dev-doc.md）：
 * - 已购买来源付费模板（或作品未用付费字体）→ 原始分辨率 deviceScaleFactor=2、无水印；
 * - 未授权 → deviceScaleFactor=1（低分辨率）+ 斜纹水印，但**仍渲染付费字体**，
 *   以便用户看到真实排版效果后再决定是否购买。
 */

export type ExportSource = 'draft' | 'published';
export type ExportImageFormat = 'png' | 'jpeg' | 'webp';
export type ExportMode = 'current' | 'all';

export interface RenderPayload {
  project: Project;
  watermark: boolean;
  /** 渲染页需要用 FontFace 注册的自定义字体 */
  fonts: { family: string; files: Record<string, string> }[];
}

interface TokenEntry {
  payload: RenderPayload;
  userId: string;
  /** 分辨率倍率（deviceScaleFactor）：授权 2，未授权 1 */
  scale: number;
  expiresAt: number;
}

const TOKEN_TTL_MS = 10 * 60 * 1000;

/** 取有效 schema（草稿优先于线上，与全站读写口径一致） */
function effectiveSchema(row: { schema?: unknown; draftSchema?: unknown }): unknown {
  return row.draftSchema && typeof row.draftSchema === 'object' ? row.draftSchema : row.schema;
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly tokens = new Map<string, TokenEntry>();

  private cleanupTokens(): void {
    const now = Date.now();
    for (const [k, v] of this.tokens) {
      if (v.expiresAt < now) this.tokens.delete(k);
    }
  }

  /**
   * 导出准备：读取作品 + 做字体授权判定 → 颁发一次性渲染凭证。
   * @returns token / 是否授权 / 未授权字体 / 页数与单页尺寸，供前端决定后续弹窗与下载行为
   */
  async prepare(projectId: string, userId: string, source: ExportSource) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('作品不存在或无权导出');

    const raw = effectiveSchema(project) as unknown as Project;
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Project).pages)) {
      throw new BadRequestException('作品数据为空，无法导出');
    }

    // 字体授权判定（与发布共用同一套判定，口径一致）
    const { licensed, missing } = await checkWorkFontLicense(
      this.prisma,
      { templateId: project.templateId, schema: raw },
      userId,
    );

    // 收集本次用到的自定义字体（付费/免费都注册，保证 Renderer 排版宽度正确）
    const families = collectFontFamilies(raw);
    const fontRows = families.length
      ? await this.prisma.font.findMany({
          where: { family: { in: families } },
          select: { family: true, files: true },
        })
      : [];

    const width = (raw as Project).width ?? 375;
    const height = (raw as Project).height ?? 667;
    const token = randomBytes(16).toString('hex');
    this.cleanupTokens();
    this.tokens.set(token, {
      payload: {
        project: raw,
        // 未授权 → 渲染页叠加水印（服务端决定，客户端无法关闭）
        watermark: !licensed,
        fonts: fontRows.map((f) => ({
          family: f.family,
          files: (f.files && typeof f.files === 'object' ? f.files : {}) as Record<string, string>,
        })),
      },
      userId,
      scale: licensed ? 2 : 1,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return {
      token,
      licensed,
      missing,
      pageCount: (raw as Project).pages?.length ?? 1,
      width,
      height,
    };
  }

  /** 渲染页回调：凭 token 换取 payload（token 具备短期有效性，天然限流） */
  getPayload(token: string): RenderPayload | null {
    this.cleanupTokens();
    const entry = this.tokens.get(token);
    if (!entry) return null;
    return entry.payload;
  }

  private getEntry(token: string): TokenEntry {
    this.cleanupTokens();
    const entry = this.tokens.get(token);
    if (!entry) throw new BadRequestException('导出凭证无效或已过期，请重新发起导出');
    return entry;
  }

  /**
   * 打开渲染页并等待就绪（带 IPv4/IPv6 回环互备）。
   * 必须在 `waitForSelector` 成功之后才返回，否则截图会截到半成品。
   */
  private async openRenderPage(page: import('puppeteer-core').Page, path: string): Promise<void> {
    let lastErr: unknown = null;
    for (const url of buildRenderUrls(path)) {
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
        // 渲染页在「字体注册完成 + 图片解码完成 + 布局稳定」后打该标记
        await page.waitForSelector('[data-export-ready="1"]', { timeout: 30_000 });
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('渲染页无法访问');
  }

  /**
   * 服务端截图导出图片。
   * @param page 0 基页码（mode='current' 时生效）
   * @param mode 'current' 单页 / 'all' 全部页纵向长图
   */
  async renderImage(opts: {
    token: string;
    page?: number;
    mode?: ExportMode;
    format?: ExportImageFormat;
  }): Promise<{ buffer: Buffer; contentType: string }> {
    const entry = this.getEntry(opts.token);
    const format = opts.format ?? 'png';
    const mode = opts.mode ?? 'current';

    const width = entry.payload.project.width ?? 375;
    const height = entry.payload.project.height ?? 667;
    const pageCount = Math.max(1, entry.payload.project.pages?.length ?? 1);
    const totalHeight = mode === 'all' ? height * pageCount : height;

    // canvas/截图面上限保护：过长时下调倍率，避免超出浏览器 16384px 限制
    let scale = entry.scale;
    const maxSide = 16384;
    if (Math.max(totalHeight, width) * scale > maxSide) {
      scale = Math.max(1, Math.floor(maxSide / Math.max(totalHeight, width)));
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width, height, deviceScaleFactor: scale });
      const idx = Math.min(Math.max(opts.page ?? 0, 0), pageCount - 1);
      await this.openRenderPage(
        page,
        // 参数名用 `et`（export token）而非 `token`：web 端 bootstrap.ts 出于安全会在
        // 页面加载时把地址栏上的 `token`/`user` 参数删掉（免登令牌不留在 URL），
        // 用 `token` 会导致渲染页永远读不到凭证。
        `/export-render?et=${encodeURIComponent(opts.token)}&mode=${mode}&page=${idx}`,
      );
      const stage = await page.$('#export-stage');
      const target = stage ?? page;
      const buffer = await target.screenshot({
        type: format === 'jpeg' ? 'jpeg' : format === 'webp' ? 'webp' : 'png',
        ...(format === 'png' ? {} : { quality: 92 }),
      }) as Buffer;
      const contentType =
        format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      return { buffer, contentType };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /**
   * 服务端导出视频：逐页截图后用 ffmpeg 合成为 slideshow（每页固定时长）。
   * 背景音乐混音不在本阶段范围（与发布页保持一致：视频仅画面）。
   */
  async renderVideo(opts: {
    token: string;
    secondsPerPage?: number;
  }): Promise<{ buffer: Buffer; contentType: string }> {
    const entry = this.getEntry(opts.token);
    const secondsPerPage = Math.min(Math.max(opts.secondsPerPage ?? 3, 1), 15);
    const width = entry.payload.project.width ?? 375;
    const height = entry.payload.project.height ?? 667;
    const pageCount = Math.max(1, entry.payload.project.pages?.length ?? 1);

    const dir = await mkdtemp(join(tmpdir(), 'h5export-'));
    try {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.setViewport({ width, height, deviceScaleFactor: entry.scale });
        for (let i = 0; i < pageCount; i += 1) {
          await this.openRenderPage(
            page,
            `/export-render?et=${encodeURIComponent(opts.token)}&mode=current&page=${i}`,
          );
          const stage = await page.$('#export-stage');
          const shot = (await (stage ?? page).screenshot({ type: 'png' })) as Buffer;
          await writeFile(join(dir, `page_${String(i).padStart(3, '0')}.png`), shot);
        }
      } finally {
        await page.close().catch(() => undefined);
      }

      const out = join(dir, 'out.mp4');
      await this.runFfmpeg([
        '-y',
        '-f', 'image2',
        '-framerate', String(1 / secondsPerPage),
        '-i', join(dir, 'page_%03d.png'),
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        out,
      ]);
      const buffer = await readFile(out);
      return { buffer, contentType: 'video/mp4' };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d) => {
        stderr += String(d).slice(0, 2000);
      });
      proc.on('error', (err) =>
        reject(new BadRequestException(`ffmpeg 启动失败：${err.message}`)),
      );
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new BadRequestException(`ffmpeg 合成视频失败（code=${code}）${stderr}`));
      });
    });
  }
}
