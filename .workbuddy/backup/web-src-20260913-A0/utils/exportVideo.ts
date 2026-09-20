/**
 * 将 H5 作品导出为视频（MP4 / WebM）。
 *
 * 实现思路（时间线驱动、含对象动画）：
 *  1. 预加载作品内所有图片为 dataURL，并把它们直接写回作品副本（cloneAndInline），
 *     使 DOMRenderer 渲染时直接使用 dataURL，避免 html-to-image 二次远程拉取图片
 *     （远程拉取在 CORS / 缓存竞态下极易失败，曾导致整屏空白）。
 *  2. 逐页挂载 DOMRenderer（animated=true），让每个元素的「入场 / 强调 / 循环」动画
 *     真正在 DOM 上播放（与编辑器、预览态同一条 GSAP 链路），按固定帧率把「当前动画态」
 *     截成 canvas 帧绘到录制画布上 —— 因此视频完整还原了原始视觉元素与对象动画。
 *  3. 页面之间做交叉淡入（cross-fade）：先截下一页的「静止（设计态）」帧，与当前页末帧
 *     叠加混合，再挂载下一页让其对象动画接着播放，形成连贯的时间线。
 *  4. 用 canvas.captureStream + MediaRecorder 录制为视频 Blob 并触发下载。
 *
 * 关键坑（历史上导致「视频空白」）：html-to-image 的 toCanvas 会把传入节点克隆后直接
 * 放进 SVG <foreignObject> 的 (0,0)，且不做任何坐标补偿。若被截节点自身带
 * `position:fixed; left:-10000px`（早期离屏定位写法），该 inline 样式会被原样复制进克隆体，
 * 导致整页内容被推到 -10000px、完全落在 0..width 的 viewBox 之外 → 截出纯白画布。
 * 修复：离屏定位交给「外层 wrapper」（left:-10000px），而真正被截的 host 自身固定在
 * `left:0; top:0`，其克隆体即落在 (0,0)，内容正确呈现。
 *
 * 关键坑（历史上导致「永久卡在 视频导出中…」）：播放帧序列原先用 requestAnimationFrame 驱动，
 * 而 rAF 在页面失焦/被遮挡/DevTools 暂停时会被节流甚至暂停，导致 tick 永不触发、
 * Promise 永不 resolve。修复：改用基于 setTimeout 的时间驱动，并为「单帧渲染」和
 * 「录制收尾」各加一道超时兜底，保证整条链路一定会 settle（成功或抛错）。
 *
 * 优先输出真正的 MP4（H.264/AAC），浏览器不支持时回退到 WebM，文件扩展名随实际编码自动调整。
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { toCanvas } from 'html-to-image';
import DOMRenderer from '@/components/Preview/DOMRenderer';
import type { Project, Element, Page } from '@h5design/core';
import {
  createBackgroundMusicPlayer,
  createRecorderForExport,
  getVideoExtension,
} from '@/utils/audioCapture';

const CAPTURE_FPS = 20; // 截帧节奏（每帧在录制画布上停留约 1000/CAPTURE_FPS ms）
const HOLD_SECONDS = 1.2; // 单页对象动画播完后，静止停留的时间（让观众看清成品）
const TRANSITION_SECONDS = 0.8; // 跨页交叉淡入时长（秒）
const RENDER_TIMEOUT_MS = 20000; // 单帧离屏渲染超时
const RECORDER_STOP_TIMEOUT_MS = 15000; // 录制收尾超时

function resolveUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

/** 从任意字符串（裸 URL 或 CSS url(...)）中提取内部图片地址，跳过 data: */
function extractImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  const inner = (m ? m[1] : raw).trim();
  if (!inner || inner.startsWith('data:')) return null;
  return inner;
}

/** 收集作品中出现的所有图片 URL（元素 src/poster、页面与元素的 backgroundImage，支持 CSS url(...) 形式） */
function collectImageUrls(project: Project): string[] {
  const set = new Set<string>();
  const pages = (project.pages ?? []) as Page[];
  for (const page of pages) {
    const bg = extractImageUrl(page.backgroundImage);
    if (bg) set.add(bg);
    for (const el of page.elements ?? []) {
      const e = el as Element & { src?: string; poster?: string; backgroundImage?: string; type?: string };
      const src = extractImageUrl(e.src);
      if (src) set.add(src);
      if (e.type === 'video') {
        const poster = extractImageUrl(e.poster);
        if (poster) set.add(poster);
      }
      const ebg = extractImageUrl(e.backgroundImage);
      if (ebg) set.add(ebg);
    }
  }
  return Array.from(set).map((u) => resolveUrl(u));
}

/** 1x1 透明 PNG：无法内联的远程图片兜底，避免 html-to-image 跨域加载失败导致整图导出中断 */
export const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function isRemoteUrl(u: string): boolean {
  return /^https?:\/\//i.test(u) || u.startsWith('//');
}

/** 把 CSS 字符串中的 url(...) 引用替换为已内联的 dataURL；无法内联的远程引用替换为透明占位 */
function replaceCssUrls(css: string, map: Map<string, string>): string {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (_m, raw: string) => {
    const inner = raw.trim();
    if (inner.startsWith('data:')) return `url(${inner})`;
    const d = map.get(resolveUrl(inner));
    if (d) return `url(${d})`;
    if (isRemoteUrl(inner)) return `url(${TRANSPARENT_PNG})`;
    return `url(${inner})`;
  });
}

/** 裸 URL（/uploads/x.png 或 http...）包成 url(...) 形式，便于统一走 replaceCssUrls */
function normalizeBg(bg: string): string {
  const u = bg.trim();
  if (u.startsWith('data:') || isRemoteUrl(u) || u.startsWith('/')) return `url(${u})`;
  return bg;
}

/** 把单个 URL 拉取并转成 dataURL；仅图片可内联，失败返回 null（交由兜底占位） */
async function urlToDataURL(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 预加载所有图片为 dataURL，返回「原始解析 URL -> dataURL」映射 */
export async function preloadImages(project: Project): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const raw = collectImageUrls(project);
  await Promise.all(
    raw.map(async (u) => {
      const data = await urlToDataURL(u);
      if (data) map.set(u, data);
    }),
  );
  return map;
}

/** 若 url 已内联返回 dataURL；无法内联的任何图片（远程或相对路径）均返回透明占位，
 *  避免 toPng 二次 fetch 时因 CORS / vite fallback 拿到 HTML 页面而整体失败。 */
function inlineIf(url: string | undefined, map: Map<string, string>): string | undefined {
  if (!url) return url;
  if (url.startsWith('data:')) return url;
  const d = map.get(resolveUrl(url));
  if (d) return d;
  return TRANSPARENT_PNG;
}

/** 深拷贝作品，并把所有图片地址替换为预加载的 dataURL（渲染时直接命中本地数据，避免二次远程拉取） */
export function cloneAndInline(project: Project, map: Map<string, string>): Project {
  let clone: Project;
  try {
    clone = structuredClone(project);
  } catch {
    clone = JSON.parse(JSON.stringify(project));
  }
  for (const p of clone.pages ?? []) {
    if (p.backgroundImage) p.backgroundImage = replaceCssUrls(normalizeBg(p.backgroundImage), map);
    for (const el of p.elements ?? []) {
      const e = el as Element & { src?: string; poster?: string; backgroundImage?: string; type?: string };
      if (e.type === 'image' && e.src) {
        e.src = inlineIf(e.src, map) as string;
      }
      if (e.type === 'video') {
        // 视频无法内联为 dataURL：能内联则用，否则清空 src 避免远程视频跨域加载失败
        if (e.src) e.src = map.get(resolveUrl(e.src)) ?? '';
        if (e.poster) e.poster = inlineIf(e.poster, map) as string;
      }
      if (e.backgroundImage) e.backgroundImage = replaceCssUrls(normalizeBg(e.backgroundImage), map);
    }
  }
  return clone;
}

/** 生成一张纯白占位帧（某帧渲染失败时使用，保证导出不中断） */
function makeBlankCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  return c;
}

/** Promise 超时兜底：超时则 reject，保证调用方一定能 settle */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 取出元素的动画配置数组（兼容 animation 为单个对象或数组两种情况） */
function getAnims(config: unknown): Array<{ category?: string; type?: string; duration?: number; delay?: number }> {
  if (!config || typeof config !== 'object') return [];
  const a = (config as { animation?: unknown }).animation;
  if (!a) return [];
  if (Array.isArray(a)) return a as Array<{ category?: string; type?: string; duration?: number; delay?: number }>;
  return [a as { category?: string; type?: string; duration?: number; delay?: number }];
}

/** 计算单页对象动画的最大结束时间（delay + duration），无动画返回 0 */
function pageAnimsDuration(page: Page): number {
  let maxEnd = 0;
  for (const el of page.elements ?? []) {
    const anims = getAnims((el as { animation?: unknown }).animation);
    for (const cfg of anims) {
      const dur = Number(cfg.duration ?? 0.6);
      const delaySec = Number(cfg.delay ?? 0);
      if (Number.isFinite(dur) && Number.isFinite(delaySec)) maxEnd = Math.max(maxEnd, delaySec + dur);
    }
  }
  return maxEnd;
}

interface MountHandle {
  wrapper: HTMLDivElement;
  host: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}

/**
 * 离屏挂载某一页用于截图。
 * 关键：外层 wrapper 负责离屏定位（left:-10000px），被截的 host 自身固定在 (0,0)，
 * 其克隆体即可正确落在 SVG 的 (0,0) 原点，内容不再被推到画布外。
 */
function mountPage(
  inlineProject: Project,
  pageIndex: number,
  width: number,
  height: number,
  animated: boolean,
): MountHandle {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed; left:-10000px; top:0; width:${width}px; height:${height}px; z-index:0; pointer-events:none;`;
  const host = document.createElement('div');
  host.style.cssText = `position:absolute; left:0; top:0; width:${width}px; height:${height}px; overflow:hidden; background:#ffffff;`;
  wrapper.appendChild(host);
  document.body.appendChild(wrapper);
  const root = createRoot(host);
  root.render(
    createElement(DOMRenderer, { project: inlineProject, currentPage: pageIndex, scale: 1, animated }),
  );
  return { wrapper, host, root };
}

/** 等待 React 提交 + 图片解码，确保截图时 DOM 已就绪（尽量短，避免错过对象入场动画的开头） */
async function settle(host: HTMLElement) {
  await delay(300);
  await Promise.all(
    Array.from(host.querySelectorAll('img')).map((img) =>
      (img as HTMLImageElement).decode().catch(() => undefined),
    ),
  );
  await delay(80);
}

/** 把当前 host 截成一张 canvas 帧（失败返回白帧，保证不中断） */
async function captureFrame(
  host: HTMLElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  try {
    return await withTimeout(
      toCanvas(host, {
        width,
        height,
        pixelRatio: 1,
        cacheBust: false,
        backgroundColor: '#ffffff',
      }),
      RENDER_TIMEOUT_MS,
      '帧渲染超时',
    );
  } catch (err) {
    if (import.meta.env.DEV) console.error('[export-video] capture failed:', err);
    return makeBlankCanvas(width, height);
  }
}

function unmountPage(handle: MountHandle) {
  try {
    handle.root.unmount();
  } catch {
    /* 忽略卸载异常 */
  }
  if (handle.wrapper.parentNode) handle.wrapper.parentNode.removeChild(handle.wrapper);
}

/** 把帧绘制到录制画布 */
function drawFrame(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  try {
    ctx.drawImage(frame, 0, 0, width, height);
  } catch {
    /* 忽略绘制异常 */
  }
}

/** 将两帧按 alpha 交叉混合绘制到录制画布（frameB 叠在 frameA 之上） */
function drawBlend(
  ctx: CanvasRenderingContext2D,
  frameA: HTMLCanvasElement | null,
  frameB: HTMLCanvasElement,
  alpha: number,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  if (frameA) {
    try {
      ctx.drawImage(frameA, 0, 0, width, height);
    } catch {
      /* ignore */
    }
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  try {
    ctx.drawImage(frameB, 0, 0, width, height);
  } catch {
    /* ignore */
  }
  ctx.globalAlpha = 1;
}

/** 把当前作品导出为视频并触发下载（第一页到最后一页的对象动画作为一条连贯时间线） */
export async function exportProjectToVideo(project: Project): Promise<void> {
  const width = project.width ?? 375;
  const height = project.height ?? 667;
  const pageCount = Math.max(1, project.pages?.length ?? 1);

  // 背景音乐：必须在用户手势（点击「导出视频」）的同步调用链内解码并准备音轨，
  // 才能在 autoplay 策略下被允许，并能在后续与画布视频轨合成进导出视频（含 WAV 经 Web Audio 解码）。
  const bgm = await createBackgroundMusicPlayer(project);

  // 1) 预加载图片并写回作品副本（渲染即命中本地 dataURL）
  const imgMap = await preloadImages(project);
  const inlineProject = cloneAndInline(project, imgMap);

  // 2) 录制画布 + MediaRecorder
  const rec = document.createElement('canvas');
  rec.width = width;
  rec.height = height;
  const rctx = rec.getContext('2d');
  if (!rctx) throw new Error('无法创建录制画布上下文');

  // 创建带音频回退的 MediaRecorder：优先「视频+音频」编码，不支持则降级纯视频
  const recorderResult = createRecorderForExport(rec, CAPTURE_FPS, bgm?.stream ?? null);
  if (!recorderResult) {
    throw new Error('当前浏览器不支持 MediaRecorder 视频录制');
  }
  const { recorder, mimeType } = recorderResult;

  const chunks: BlobPart[] = [];
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (chunks.length > 0) resolve(new Blob(chunks, { type: mimeType }));
      else reject(new Error('录制内容为空，可能当前浏览器不支持 canvas 视频采集'));
    };
    recorder.onerror = (e: Event) => {
      const err = (e as unknown as { error?: Error })?.error;
      reject(err ?? new Error('录制失败'));
    };
    // 背景音乐与画布录制同步起播：必须在 recorder.start 之前调用，保证音画对齐。
    bgm?.start();
    // 把 recorder 暴露给外层 stop 使用
    (rec as unknown as { _recorder?: MediaRecorder })._recorder = recorder;
    recorder.start();
  });

  const stopRecorder = () => {
    const recorder = (rec as unknown as { _recorder?: MediaRecorder })._recorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
  };

  let lastFrame: HTMLCanvasElement | null = null;

  try {
    // 挂载第一页（动画播放）
    let current = mountPage(inlineProject, 0, width, height, true);
    await settle(current.host);
    // 立刻画一帧，避免开头长时间空白
    lastFrame = await captureFrame(current.host, width, height);
    drawFrame(rctx, lastFrame, width, height);

    for (let i = 0; i < pageCount; i++) {
      const duration = pageAnimsDuration(project.pages![i]) + HOLD_SECONDS;

      // 播放并截取本页的对象动画时间线
      const start = performance.now();
      while (true) {
        const t = (performance.now() - start) / 1000;
        if (t >= duration) break;
        const frame = await captureFrame(current.host, width, height);
        lastFrame = frame;
        drawFrame(rctx, frame, width, height);
        await delay(1000 / CAPTURE_FPS);
      }

      if (i < pageCount - 1) {
        // 截下一页的「静止/设计态」帧用于交叉淡入
        const nextRest = mountPage(inlineProject, i + 1, width, height, false);
        await settle(nextRest.host);
        const nextRestFrame = await captureFrame(nextRest.host, width, height);
        unmountPage(nextRest);

        // 当前页末帧 → 下一页静止帧 交叉淡入
        const blendSteps = Math.max(2, Math.round(TRANSITION_SECONDS * CAPTURE_FPS));
        for (let s = 1; s <= blendSteps; s++) {
          const alpha = s / blendSteps;
          drawBlend(rctx, lastFrame, nextRestFrame, alpha, width, height);
          await delay(1000 / CAPTURE_FPS);
        }
        lastFrame = nextRestFrame;

        // 卸载当前页，挂载下一页让其对象动画接着播放
        unmountPage(current);
        current = mountPage(inlineProject, i + 1, width, height, true);
        await settle(current.host);
      } else {
        // 最后一页：停留片刻后收尾
        if (lastFrame) {
          drawFrame(rctx, lastFrame, width, height);
          await delay(400);
        }
        unmountPage(current);
      }
    }
  } finally {
    stopRecorder();
    if (bgm) bgm.stop();
  }

  // 3) 等待录制结束（加超时兜底，避免 onstop 不触发导致永久卡死）
  const blob = await withTimeout(finished, RECORDER_STOP_TIMEOUT_MS, '录制收尾超时');

  const ext = getVideoExtension(mimeType);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.title || 'h5'}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 延迟回收，避免下载尚未开始时 ObjectURL 已失效
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
