/**
 * Konva 离屏视频导出（高清 1080×1920 / 30fps / 高码率）。
 *
 * 与 exportVideo.ts（html-to-image 截 DOM）不同，本管线直接复用编辑器已有的
 * Konva 渲染（KonvaElement）与 Konva 动画播放器（konvaPlayer.playAnimationsOnNode）：
 *  - 在离屏 react-konva <Stage> 上以 pixelRatio = 2.88 渲染，stage.toCanvas 即为 1080×1920 高清帧；
 *  - 每个元素的对象动画通过 playAnimationsOnNode 在 Konva 节点上**真实播放**（与编辑器/预览同源），
 *    逐帧截取「当前动画态」→ 真 30fps，不再有 html-to-image 序列化 DOM 的性能瓶颈；
 *  - 页面背景（颜色 / 背景图）与元素按 zIndex 排序一并渲染，保证与编辑器一致；
 *  - 页面间交叉淡入到下一页「首帧（动画初始态）」，第一页到最后一页形成连贯时间线。
 *
 * 关键稳定性设计（彻底解决「只有第一页渲染完整、第二页起对象丢失 / 动画截断」）：
 *  1. 每一页都用**独立的 createRoot + 独立容器**挂载一个全新的 Konva.Stage（与第 1 页同路径），
 *     渲染完成即卸载，绝不复用同一个 Stage 跨页渲染——规避「复用 Stage / 跨页切 Layer」时
 *     react-konva 在第二次挂载后内容子节点不提交的渲染缺陷。
 *  2. 动画播放用 konvaPlayer.playAnimationsOnNode（Konva.Tween，已验证每一页都正确渲染），
 *     不再用「外部 GSAP 时间线 seek 改写节点属性」的方式（那种方式在 2nd+ Stage 上会让入场动画
 *     节点卡在隐藏起始态而整页对象丢失）。
 *  3. 截帧用**真实时间驱动的 requestAnimationFrame 循环**（按 30fps 抽帧），与 Konva.Tween 的 rAF 播放同源，
 *     逐帧都精确对应动画进度，杜绝原先 performance.now() 墙钟 + delay(1000/30) 与 rAF 播放脱节导致的
 *     动画被截断、跳帧；录制的停止时长由 computePageAnimDuration（与播放同源）精确给出。
 *
 * 三种输出格式（由发布设置对话框选择）：
 *  - mp4  ：MediaRecorder 编码 H.264(AVC)+AAC，封装背景音乐音频轨
 *  - webm ：MediaRecorder 编码 VP9+Opus，封装背景音乐音频轨
 *  - gif  ：逐帧截帧后用 gifenc 编码为动态 GIF 图片（无音频，降低帧率以控制体积）
 *
 * 音频封装修复（关键）：
 *  旧实现在「创建 MediaRecorder 之后」才 start 背景音乐，导致音轨在录制器创建瞬间其实并未 live，
 *  被音频合成兜底逻辑丢弃 → 导出无声。现改为：在用户手势链内解码、并在 createRecorderWithFormat
 *  之前调用 BgmHandle.start()，保证音轨已 live 再交给录制器。
 *
 * 复用：preloadImages / cloneAndInline（来自 exportVideo.ts）保证图片本地化，避免 CORS / 二次远程拉取。
 */
import { createElement, useEffect, useMemo, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Konva from 'konva';
import { Stage, Layer, Rect, Image as KonvaImage } from 'react-konva';
import type { Project, Page, Element } from '@h5design/core';
import { useFontLoadEpoch } from '../components/Canvas/konvaShared';
import KonvaElement from '../components/Canvas/KonvaElement';
import { playAnimationsOnNode, applyEnterStartState } from '../animations/konvaPlayer';
import { computePageAnimDuration, getAnimationConfigs } from '../animations/konvaTimeline';
import { preloadImages, cloneAndInline } from './exportVideo';
import {
  createBackgroundMusicPlayer,
  createRecorderWithFormat,
  getVideoExtension,
  type VideoExportFormat,
} from './audioCapture';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const TARGET_W = 1080;
const TARGET_H = 1920;
const CAPTURE_FPS = 30; // 截帧节奏（录制流 30fps）
const GIF_FPS = 12; // GIF 动图帧率（降低以控制体积）
const HOLD_SECONDS = 1.2; // 单页对象动画播完后静止停留
const TRANSITION_SECONDS = 0.8; // 跨页交叉淡入时长
const RECORDER_STOP_TIMEOUT_MS = 15000; // 录制收尾超时
const GIF_MAX_DIM = 480; // GIF 最长边上限（控制文件体积）

type ImgMap = Map<string, HTMLImageElement | null>;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 单帧渲染失败时的白帧兜底 */
function makeBlankCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, width, height);
  }
  return c;
}

/** Promise 超时兜底 */
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

/** 页面背景（颜色 + 背景图）节点，复刻编辑器 PageBackgroundImage 的逻辑 */
function buildPageBackground(
  width: number,
  height: number,
  page: Page | undefined,
  images: ImgMap,
): ReactElement[] {
  const nodes: ReactElement[] = [];
  nodes.push(
    createElement(Rect, {
      key: 'page-bg',
      x: 0,
      y: 0,
      width,
      height,
      fill: (page?.background as string) || '#ffffff',
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    }),
  );

  const bgImgSrc = page?.backgroundImage;
  if (bgImgSrc) {
    const m = /url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(bgImgSrc);
    const inner = (m ? m[1] : bgImgSrc).trim();
    const img = images.get(inner) ?? null;
    if (img) {
      const size = page?.backgroundSize ?? 'contain';
      const repeat = page?.backgroundRepeat ?? 'no-repeat';
      const imgW = img.naturalWidth || img.width || 1;
      const imgH = img.naturalHeight || img.height || 1;
      // 与编辑器 PageBackgroundImage 保持一致：背景图透明度（默认 1）
      const bgImgOpacity = page?.backgroundImageOpacity ?? 1;

      if (repeat !== 'no-repeat') {
        let scaleX = 1;
        let scaleY = 1;
        if (size === 'cover') {
          const s = Math.max(width / imgW, height / imgH);
          scaleX = s;
          scaleY = s;
        } else if (size === 'contain') {
          const s = Math.min(width / imgW, height / imgH);
          scaleX = s;
          scaleY = s;
        } else if (size === '100%' || size === '100% auto') {
          scaleX = width / imgW;
          scaleY = 1;
        } else if (size === '100% 100%') {
          scaleX = width / imgW;
          scaleY = height / imgH;
        } else if (size === 'auto 100%') {
          scaleX = 1;
          scaleY = height / imgH;
        }
        nodes.push(
          createElement(Rect, {
            key: 'page-bg-img',
            x: 0,
            y: 0,
            width,
            height,
            fillPatternImage: img,
            fillPatternRepeat: repeat as 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat',
            fillPatternScale: { x: scaleX, y: scaleY },
            opacity: bgImgOpacity,
            listening: false,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
          }),
        );
      } else {
        let drawW = imgW;
        let drawH = imgH;
        let x = 0;
        let y = 0;
        if (size === 'cover') {
          const s = Math.max(width / imgW, height / imgH);
          drawW = imgW * s;
          drawH = imgH * s;
          x = (width - drawW) / 2;
          y = (height - drawH) / 2;
        } else if (size === 'contain') {
          const s = Math.min(width / imgW, height / imgH);
          drawW = imgW * s;
          drawH = imgH * s;
          x = (width - drawW) / 2;
          y = (height - drawH) / 2;
        } else if (size === '100%' || size === '100% auto') {
          drawW = width;
          drawH = (width / imgW) * imgH;
        } else if (size === '100% 100%') {
          drawW = width;
          drawH = height;
        } else if (size === 'auto 100%') {
          drawW = (height / imgH) * imgW;
          drawH = height;
        }
        nodes.push(
          createElement(KonvaImage, {
            key: 'page-bg-img',
            x,
            y,
            width: drawW,
            height: drawH,
            image: img,
            opacity: bgImgOpacity,
            listening: false,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
          }),
        );
      }
    }
  }
  return nodes;
}

/** 构建单页 Layer 子节点：背景 + 按 zIndex 排序的元素 */
function buildPageChildren(
  width: number,
  height: number,
  page: Page | undefined,
  images: ImgMap,
  scaleK: number,
  fontEpoch: number,
): ReactElement[] {
  const children = buildPageBackground(width, height, page, images);
  const sorted = [...(page?.elements ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const el of sorted) {
    children.push(createElement(KonvaElement, { key: el.id, el, images, scaleK, fontEpoch }));
  }
  return children;
}

interface ExportStageProps {
  project: Project;
  pageIndex: number;
  images: ImgMap;
  scaleK: number;
  stageRef: { current: Konva.Stage | null };
  onRendered: () => void;
}

function ExportStage({ project, pageIndex, images, scaleK, stageRef, onRendered }: ExportStageProps) {
  const width = project.width ?? 375;
  const height = project.height ?? 667;
  const page = (project.pages ?? [])[pageIndex];
  // 字体加载纪元：字体异步加载完成后 +1，驱动离屏文本节点 key 变化以强制 Konva 重测折行
  const fontEpoch = useFontLoadEpoch();

  const children = useMemo<ReactElement[]>(
    () => buildPageChildren(width, height, page, images, scaleK, fontEpoch),
    [width, height, page, images, scaleK, fontEpoch],
  );

  useEffect(() => {
    onRendered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex]);

  return createElement(
    Stage as never,
    {
      ref: (n: Konva.Stage | null) => {
        stageRef.current = n;
      },
      width,
      height,
      pixelRatio: scaleK,
    },
    createElement(Layer as never, { key: 'layer-' + pageIndex }, ...children),
  );
}

/** 把当前舞台截取为高清 canvas 帧（失败返回白帧）。 */
function captureFrame(stage: Konva.Stage, scaleK: number, outW: number, outH: number): HTMLCanvasElement {
  try {
    return stage.toCanvas({ pixelRatio: scaleK });
  } catch {
    return makeBlankCanvas(outW, outH);
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  try {
    ctx.drawImage(frame, 0, 0, width, height);
  } catch {
    /* ignore */
  }
}

/** 将两帧按 alpha 交叉混合（frameB 叠在 frameA 之上） */
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

async function waitForPageReady(stage: Konva.Stage, page: Page | undefined): Promise<void> {
  const ids = (page?.elements ?? []).map((el: Element) => el.id);
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const layer = stage.getLayers()[0];
    if (layer && layer.getChildren().length > 0) {
      const allFound = ids.length === 0 || ids.every((id) => !!stage.findOne('#' + id));
      if (allFound) return;
    }
    await delay(80);
  }
}

/** 为本页所有带动画的元素播放 Konva 动画，返回清理函数列表 */
function playPageAnimations(stage: Konva.Stage, page: Page | undefined): Array<() => void> {
  const cleanups: Array<() => void> = [];
  for (const el of page?.elements ?? []) {
    const configs = getAnimationConfigs(el);
    if (!configs.length) continue;
    const node = stage.findOne('#' + el.id) as Konva.Node | undefined;
    if (!node) continue;
    const cleanup = playAnimationsOnNode(node, configs);
    if (cleanup) cleanups.push(cleanup);
  }
  return cleanups;
}

/** 为本页所有带动画的元素瞬切到「入场起始（隐藏）态」，返回还原函数列表 */
function applyPageEnterStart(stage: Konva.Stage, page: Page | undefined): Array<() => void> {
  const restores: Array<() => void> = [];
  for (const el of page?.elements ?? []) {
    const configs = getAnimationConfigs(el);
    if (!configs.length) continue;
    const node = stage.findOne('#' + el.id) as Konva.Node | undefined;
    if (!node) continue;
    const restore = applyEnterStartState(node, configs);
    if (restore) restores.push(restore);
  }
  return restores;
}

/** 以真实时间驱动的 rAF 循环逐帧截帧（按 CAPTURE_FPS 抽帧），动画播放与截帧同源，杜绝截断/跳帧。 */
function captureRealtime(
  stage: Konva.Stage,
  animTotal: number,
  scaleK: number,
  outW: number,
  outH: number,
  rctx: CanvasRenderingContext2D,
  lastFrameRef: { current: HTMLCanvasElement | null },
): Promise<void> {
  return new Promise<void>((resolve) => {
    const totalMs = (animTotal + HOLD_SECONDS) * 1000;
    const start = performance.now();
    let lastCap = -1;
    const tick = () => {
      const elapsed = performance.now() - start;
      const frameIdx = Math.floor(elapsed / (1000 / CAPTURE_FPS));
      if (frameIdx !== lastCap) {
        lastCap = frameIdx;
        stage.draw();
        const frame = captureFrame(stage, scaleK, outW, outH);
        lastFrameRef.current = frame;
        drawFrame(rctx, frame, outW, outH);
      }
      if (elapsed >= totalMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** GIF 专用：以真实时间驱动 rAF 循环逐帧截帧（按 GIF_FPS 抽帧），每帧交给 pushFrame 处理（含降采样+量化）。 */
function captureGifRealtime(
  stage: Konva.Stage,
  animTotal: number,
  scaleK: number,
  outW: number,
  outH: number,
  pushFrame: (frame: HTMLCanvasElement) => void,
  lastFrameRef: { current: HTMLCanvasElement | null },
): Promise<void> {
  return new Promise<void>((resolve) => {
    const totalMs = (animTotal + HOLD_SECONDS) * 1000;
    const frameMs = 1000 / GIF_FPS;
    const start = performance.now();
    let lastCap = -1;
    const tick = () => {
      const elapsed = performance.now() - start;
      const frameIdx = Math.floor(elapsed / frameMs);
      if (frameIdx !== lastCap) {
        lastCap = frameIdx;
        stage.draw();
        const frame = captureFrame(stage, scaleK, outW, outH);
        pushFrame(frame);
        lastFrameRef.current = frame;
      }
      if (elapsed >= totalMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** 每页独立 createRoot + 独立容器，挂载全新 Konva.Stage（与第 1 页同渲染路径） */
async function mountPage(
  inlineProject: Project,
  images: ImgMap,
  idx: number,
  width: number,
  height: number,
  k: number,
): Promise<{ root: Root; container: HTMLDivElement; stageRef: { current: Konva.Stage | null } }> {
  const container = document.createElement('div');
  container.style.cssText = `position:fixed; left:-10000px; top:0; width:${width}px; height:${height}px; z-index:0; pointer-events:none; overflow:hidden; background:#ffffff;`;
  document.body.appendChild(container);
  const root = createRoot(container);
  const stageRef: { current: Konva.Stage | null } = { current: null };
  let resolveReady: (() => void) | null = null;
  const whenRendered = () => new Promise<void>((res) => {
    resolveReady = res;
  });
  const handleRendered = () => {
    resolveReady?.();
    resolveReady = null;
  };
  root.render(
    createElement(ExportStage, {
      project: inlineProject,
      pageIndex: idx,
      images,
      scaleK: k,
      stageRef,
      onRendered: handleRendered,
    }),
  );
  await whenRendered();
  await delay(120); // 子组件异步（图片解码/布局）收尾
  return { root, container, stageRef };
}

function unmountPage(h: { root: Root; container: HTMLDivElement }) {
  try {
    h.root.unmount();
  } catch {
    /* ignore */
  }
  if (h.container.parentNode) h.container.parentNode.removeChild(h.container);
}

/** 把录制好的 Blob 触发浏览器下载 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * mp4 / webm 导出：MediaRecorder 录制画布视频轨 + 背景音乐音频轨。
 * 关键修复：先 start 背景音乐（保证音轨 live），再用 createRecorderWithFormat 强制对应带音频的 MIME。
 */
async function exportMediaRecorder(
  project: Project,
  inlineProject: Project,
  images: ImgMap,
  width: number,
  height: number,
  k: number,
  outW: number,
  outH: number,
  format: 'mp4' | 'webm',
): Promise<void> {
  const pageCount = Math.max(1, inlineProject.pages?.length ?? 1);

  // 背景音乐：必须在用户手势链内解码，并在创建录制器「之前」起播，
  // 否则音轨在录制器创建瞬间可能仍处于 muted / 未就绪，被音频合成兜底逻辑丢弃 → 导出无声。
  const bgm = await createBackgroundMusicPlayer(project);
  if (bgm) {
    console.log('[export-video] BGM ready, audio track will be mixed into', format);
    bgm.start();
  }

  const rec = document.createElement('canvas');
  rec.width = outW;
  rec.height = outH;
  rec.style.cssText = 'position:fixed; left:0; top:0; width:1px; height:1px; opacity:0.01; pointer-events:none; z-index:-1;';
  document.body.appendChild(rec);
  const rctx = rec.getContext('2d');
  if (!rctx) {
    document.body.removeChild(rec);
    bgm?.stop();
    throw new Error('无法创建录制画布上下文');
  }
  rctx.fillStyle = '#f0f2f5';
  rctx.fillRect(0, 0, outW, outH);

  if (typeof rec.captureStream !== 'function') {
    document.body.removeChild(rec);
    bgm?.stop();
    throw new Error('当前浏览器不支持 canvas.captureStream，无法录制视频');
  }
  if (typeof MediaRecorder === 'undefined') {
    document.body.removeChild(rec);
    bgm?.stop();
    throw new Error('当前浏览器不支持 MediaRecorder，无法录制视频');
  }

  // 强制目标格式的带音频编码（mp4→H.264+AAC / webm→VP9+Opus），音频封装失败时降级纯视频。
  const recorderResult = createRecorderWithFormat(rec, CAPTURE_FPS, bgm?.stream ?? null, format, {
    videoBitsPerSecond: 12_000_000,
  });
  if (!recorderResult) {
    document.body.removeChild(rec);
    bgm?.stop();
    throw new Error('当前浏览器不支持任何可用的视频编码格式（请尝试 Chrome/Edge 最新版）');
  }
  const { recorder, mimeType } = recorderResult;
  console.log('[export-video] recorder ready', { mimeType, state: recorder.state, audio: !!bgm });

  const chunks: BlobPart[] = [];
  let totalBytes = 0;
  let stopCalledAt = 0;
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      const size = e.data?.size ?? 0;
      if (size > 0) {
        chunks.push(e.data);
        totalBytes += size;
      }
      console.log('[export-video] dataavailable', size, 'total', totalBytes);
    };
    recorder.onstop = () => {
      if (chunks.length > 0) {
        resolve(new Blob(chunks, { type: mimeType }));
        return;
      }
      const stopAt = stopCalledAt || performance.now();
      const wait = setInterval(() => {
        if (chunks.length > 0) {
          clearInterval(wait);
          resolve(new Blob(chunks, { type: mimeType }));
        } else if (performance.now() - stopAt > 300) {
          clearInterval(wait);
          reject(new Error('录制内容为空，可能当前浏览器不支持 canvas 视频采集'));
        }
      }, 30);
    };
    recorder.onerror = (e: Event) => {
      const err = (e as unknown as { error?: Error })?.error;
      console.error('[export-video] recorder error:', err);
      reject(err ?? new Error('录制失败'));
    };
    (rec as unknown as { _recorder?: MediaRecorder })._recorder = recorder;
    recorder.start(100);
    rctx.fillStyle = '#f0f2f5';
    rctx.fillRect(0, 0, outW, outH);
    console.log('[export-video] recorder started', { mimeType, state: recorder.state });
  });

  const stopRecorder = () => {
    const recorder = (rec as unknown as { _recorder?: MediaRecorder })._recorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        stopCalledAt = performance.now();
        recorder.requestData();
      } catch {
        /* ignore */
      }
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
  };

  const lastFrameRef: { current: HTMLCanvasElement | null } = { current: null };

  try {
    for (let i = 0; i < pageCount; i++) {
      const page = (inlineProject.pages ?? [])[i];
      const h = await mountPage(inlineProject, images, i, width, height, k);
      const stage = h.stageRef.current;
      if (!stage) {
        unmountPage(h);
        throw new Error('Konva 舞台未就绪');
      }

      await waitForPageReady(stage, page);
      stage.draw();

      const restores = applyPageEnterStart(stage, page);
      stage.draw();
      const firstFrame = captureFrame(stage, k, outW, outH);
      restores.forEach((r) => r());
      stage.draw();

      if (i > 0 && lastFrameRef.current) {
        const blendSteps = Math.max(2, Math.round(TRANSITION_SECONDS * CAPTURE_FPS));
        for (let s = 1; s <= blendSteps; s++) {
          const alpha = s / blendSteps;
          drawBlend(rctx, lastFrameRef.current, firstFrame, alpha, outW, outH);
          await delay(1000 / CAPTURE_FPS);
        }
      } else {
        lastFrameRef.current = firstFrame;
        drawFrame(rctx, firstFrame, outW, outH);
      }

      const animTotal = computePageAnimDuration(page);
      const cleanups = playPageAnimations(stage, page);
      await captureRealtime(stage, animTotal, k, outW, outH, rctx, lastFrameRef);
      cleanups.forEach((c) => c());
      unmountPage(h);
    }
  } finally {
    stopRecorder();
    bgm?.stop();
  }

  const blob = await withTimeout(finished, RECORDER_STOP_TIMEOUT_MS, '录制收尾超时');

  if (rec.parentNode) {
    try { rec.parentNode.removeChild(rec); } catch { /* ignore */ }
  }

  const ext = getVideoExtension(mimeType);
  downloadBlob(blob, `${project.title || 'h5'}.${ext}`);
}

/**
 * GIF 动图导出：复用同一套 Konva 离屏渲染与动画播放，按降低的帧率（GIF_FPS）逐帧截帧，
 * 降采样到合理尺寸后交给 gifenc 编码为动态 GIF（无音频）。
 */
async function exportGif(
  project: Project,
  inlineProject: Project,
  images: ImgMap,
  width: number,
  height: number,
  k: number,
  outW: number,
  outH: number,
): Promise<void> {
  const pageCount = Math.max(1, inlineProject.pages?.length ?? 1);

  // GIF 尺寸：保持比例，最长边限制在 GIF_MAX_DIM 以控制体积。
  const scale = Math.min(1, GIF_MAX_DIM / Math.max(width, height));
  const gifW = Math.max(1, Math.round(width * scale));
  const gifH = Math.max(1, Math.round(height * scale));

  const gif = GIFEncoder();
  const gifFrameMs = Math.round(1000 / GIF_FPS);

  const gifCanvas = document.createElement('canvas');
  gifCanvas.width = gifW;
  gifCanvas.height = gifH;
  const gctx = gifCanvas.getContext('2d', { willReadFrequently: true });
  if (!gctx) throw new Error('无法创建 GIF 画布上下文');

  const blendCanvas = document.createElement('canvas');
  blendCanvas.width = gifW;
  blendCanvas.height = gifH;
  const blendCtx = blendCanvas.getContext('2d');
  if (!blendCtx) throw new Error('无法创建 GIF 混合画布上下文');

  let frameIndex = 0;
  const lastFrameRef: { current: HTMLCanvasElement | null } = { current: null };

  // 将一帧（高清）降采样 + 量化 + 写入 GIF
  const pushFrame = (src: HTMLCanvasElement) => {
    gctx.clearRect(0, 0, gifW, gifH);
    gctx.drawImage(src, 0, 0, gifW, gifH);
    const imgData = gctx.getImageData(0, 0, gifW, gifH).data;
    const palette = quantize(imgData, 256);
    const indexed = applyPalette(imgData, palette);
    gif.writeFrame(indexed, gifW, gifH, {
      palette,
      delay: gifFrameMs,
      repeat: 0,
      first: frameIndex === 0,
    });
    lastFrameRef.current = src;
    frameIndex++;
  };

  try {
    for (let i = 0; i < pageCount; i++) {
      const page = (inlineProject.pages ?? [])[i];
      const h = await mountPage(inlineProject, images, i, width, height, k);
      const stage = h.stageRef.current;
      if (!stage) {
        unmountPage(h);
        throw new Error('Konva 舞台未就绪');
      }

      await waitForPageReady(stage, page);
      stage.draw();

      const restores = applyPageEnterStart(stage, page);
      stage.draw();
      const firstFrame = captureFrame(stage, k, outW, outH);
      restores.forEach((r) => r());
      stage.draw();

      if (i > 0 && lastFrameRef.current) {
        const blendSteps = Math.max(2, Math.round(TRANSITION_SECONDS * GIF_FPS));
        for (let s = 1; s <= blendSteps; s++) {
          const alpha = s / blendSteps;
          drawBlend(blendCtx, lastFrameRef.current, firstFrame, alpha, gifW, gifH);
          pushFrame(blendCanvas);
        }
      } else {
        pushFrame(firstFrame);
      }

      const animTotal = computePageAnimDuration(page);
      const cleanups = playPageAnimations(stage, page);
      await captureGifRealtime(stage, animTotal, k, outW, outH, pushFrame, lastFrameRef);
      cleanups.forEach((c) => c());
      unmountPage(h);
    }
  } finally {
    /* 挂载的离屏容器已在循环中 unmount，无需额外清理 */
  }

  gif.finish();
  const bytes = gif.bytes();
  downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'image/gif' }), `${project.title || 'h5'}.gif`);
}

/** 导出作品为视频/动图并触发下载；format 决定输出 mp4 / webm / gif。 */
export async function exportProjectToVideo(
  project: Project,
  format: VideoExportFormat = 'webm',
): Promise<void> {
  const width = project.width ?? 375;
  const height = project.height ?? 667;
  const pageCount = Math.max(1, project.pages?.length ?? 1);

  // 等比缩放填充 1080×1920
  const k = Math.min(TARGET_W / width, TARGET_H / height);
  const outW = Math.round(width * k);
  const outH = Math.round(height * k);

  // 1) 预加载图片并写回作品副本（渲染即命中本地 HTMLImageElement）
  const imgMap = await preloadImages(project);
  const inlineProject = cloneAndInline(project, imgMap);
  const images = await dataUrlsToImageMap(imgMap);

  if (format === 'gif') {
    await exportGif(project, inlineProject, images, width, height, k, outW, outH);
  } else {
    await exportMediaRecorder(project, inlineProject, images, width, height, k, outW, outH, format);
  }
}

/** 把预加载的「原始URL -> dataURL」映射转成「dataURL -> HTMLImageElement」映射 */
async function dataUrlsToImageMap(dataUrlMap: Map<string, string>): Promise<ImgMap> {
  const out = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    Array.from(dataUrlMap.entries()).map(async ([_url, dataUrl]) => {
      try {
        const img = await loadImage(dataUrl);
        out.set(dataUrl, img);
      } catch {
        out.set(dataUrl, null);
      }
    }),
  );
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}
