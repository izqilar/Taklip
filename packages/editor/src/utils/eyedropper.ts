/**
 * 取色器（Eyedropper / 吸管）—— 在画布上吸取「光标所对准的那一点」的颜色。
 *
 * 设计要点：
 * 1. 取色源是 Konva 的场景画布（与用户肉眼所见完全一致的单层合成结果），
 *    因此填充、叠加层、图片里的像素都能取到，而不是只读元素的颜色属性。
 * 2. 取色期间把画布切到「取色模式」（store.colorPickMode）：
 *    EditorCanvas 会隐藏选择框 / 辅助线 / 变换器 —— 否则吸管会吸到那圈蓝色选框。
 * 3. 会话用 document 级 capture 监听，配合 EditorCanvas 的取色遮罩（阻断画布交互），
 *    做到「点画布=取色、点别处=取消、Esc=取消」。
 *    注意：只有点在画布范围内才阻止事件继续传播，避免面板按钮被吞掉。
 * 4. 若画布被跨域图片污染（未返回 CORS 头时会降级成不带 crossOrigin 的图片），
 *    getImageData 会抛 SecurityError —— 此时自动降级到浏览器原生 EyeDropper API。
 *
 * 同一时刻只允许一个取色会话；新会话会先静默取消旧的（避免回调串台）。
 */

import { rgbaToCss } from '@h5design/core';
import { useEditorStore } from '../store/editorStore';

export interface EyedropperHandlers {
  /** 取到颜色：CSS 颜色字符串 */
  onPick: (css: string) => void;
  /** 取消（Esc / 点了画布外的区域 / 点了完全透明的像素 / 环境不支持） */
  onCancel: () => void;
  /** 跟随光标提示里的说明文案（如「点击画布取色 · Esc 取消」） */
  hintLabel?: string;
}

interface ActiveSession {
  cancel: () => void;
}

let activeSession: ActiveSession | null = null;

/** 当前是否有取色会话进行中 */
export function isEyedropperActive(): boolean {
  return !!activeSession;
}

/** 取消当前取色会话（不会触发任何回调，用于会话替换/组件卸载） */
export function cancelEyedropper(): void {
  const session = activeSession;
  activeSession = null;
  session?.cancel();
}

/** 取场景画布：优先取第一层（内容层）的 canvas —— 编辑器只有一个 Layer */
function getSceneCanvas(): HTMLCanvasElement | null {
  const stage = useEditorStore.getState().stageRef;
  if (!stage) return null;
  try {
    const first = stage.getLayers()[0];
    const native = first?.getNativeCanvasElement?.();
    if (native) return native;
  } catch {
    // 老版本 Konva 没有该 API：走下面的兜底查询
  }
  const found = stage.container()?.querySelector('canvas');
  return (found as HTMLCanvasElement | null) ?? null;
}

interface SampleResult {
  /** 该点是否落在画布范围内 */
  inside: boolean;
  /** 颜色（CSS 字符串）；null 表示此处没有可见颜色（完全透明） */
  css: string | null;
}

/**
 * 读取指定客户区坐标处的画布像素颜色。
 * 画布被跨域内容污染时 getImageData 会抛 SecurityError，由调用方决定降级策略。
 */
function sampleColorAt(clientX: number, clientY: number): SampleResult {
  const canvas = getSceneCanvas();
  if (!canvas) return { inside: false, css: null };
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { inside: false, css: null };
  if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
    return { inside: false, css: null };
  }

  // CSS 像素 → canvas 实际像素（Konva 内部按 devicePixelRatio 放大，必须换算）
  const sx = Math.min(canvas.width - 1, Math.max(0, Math.floor((clientX - rect.left) * (canvas.width / rect.width))));
  const sy = Math.min(canvas.height - 1, Math.max(0, Math.floor((clientY - rect.top) * (canvas.height / rect.height))));

  const ctx = canvas.getContext('2d');
  if (!ctx) return { inside: true, css: null };
  const data = ctx.getImageData(sx, sy, 1, 1).data;
  const alpha = data[3] / 255;
  if (alpha <= 0) return { inside: true, css: null }; // 完全透明 = 这里没有颜色
  return { inside: true, css: rgbaToCss({ r: data[0], g: data[1], b: data[2], a: alpha }) };
}

/* ───────── 跟随光标的色块提示（纯 DOM，避免每次移动都触发 React 重渲染） ───────── */

interface Hint {
  root: HTMLDivElement;
  swatch: HTMLSpanElement;
  text: HTMLSpanElement;
}

function createHint(hintLabel: string): Hint {
  const root = document.createElement('div');
  root.setAttribute('data-eyedropper-hint', '');
  root.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'z-index:2147483000',
    'pointer-events:none',
    'display:flex',
    'align-items:center',
    'gap:6px',
    'padding:4px 8px',
    'border-radius:6px',
    'background:rgba(17,24,39,0.88)',
    'box-shadow:0 4px 14px rgba(0,0,0,0.25)',
    'font:500 12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif',
    'color:#fff',
    'transform:translate(14px, 14px)',
    'white-space:nowrap',
  ].join(';');

  const swatch = document.createElement('span');
  swatch.style.cssText =
    'display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,0.7);background:transparent';

  const text = document.createElement('span');
  text.textContent = hintLabel;

  root.appendChild(swatch);
  root.appendChild(text);
  document.body.appendChild(root);
  return { root, swatch, text };
}

function updateHint(hint: Hint, css: string | null, clientX: number, clientY: number, hintLabel: string): void {
  hint.root.style.left = `${clientX}px`;
  hint.root.style.top = `${clientY}px`;
  if (css) {
    hint.swatch.style.background = css;
    hint.text.textContent = css;
  } else {
    hint.swatch.style.background = 'transparent';
    hint.text.textContent = hintLabel;
  }
}

/* ───────── 会话 ───────── */

/**
 * 开启取色会话。调用前请先关闭颜色对话框，让画布完全露出。
 * 取色结果通过 onPick 回传 —— ColorField 会把颜色先放进对话框的活动颜色标本，
 * 用户点「确定」后才写入元素的填充色 / 轮廓色属性。
 */
export function startEyedropper(handlers: EyedropperHandlers): void {
  cancelEyedropper();

  const hintLabel = handlers.hintLabel ?? '点击画布取色';
  if (!getSceneCanvas()) {
    // 没有画布（例如预览态）—— 直接取消，交由调用方恢复对话框
    handlers.onCancel();
    return;
  }

  useEditorStore.getState().setColorPickMode(true);

  const hint = createHint(hintLabel);
  let tainted = false;
  let finished = false;

  function cleanup() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', onWindowBlur);
    hint.root.remove();
    useEditorStore.getState().setColorPickMode(false);
    if (activeSession?.cancel === cancel) activeSession = null;
    // 交还交互权并重绘一次，把选择框 / 变换器还原出来
    useEditorStore.getState().stageRef?.batchDraw();
  }

  function finish(css: string | null) {
    if (finished) return;
    finished = true;
    cleanup();
    if (css) handlers.onPick(css);
    else handlers.onCancel();
  }

  function onMove(e: MouseEvent) {
    let result: SampleResult = { inside: false, css: null };
    try {
      result = sampleColorAt(e.clientX, e.clientY);
    } catch {
      tainted = true;
      result = { inside: false, css: null };
    }
    updateHint(hint, result.css, e.clientX, e.clientY, hintLabel);
  }

  function onDown(e: MouseEvent) {
    if (e.button !== 0) return; // 只响应左键

    let result: SampleResult = { inside: false, css: null };
    try {
      result = sampleColorAt(e.clientX, e.clientY);
    } catch {
      tainted = true;
      result = { inside: false, css: null };
    }

    if (!result.inside) {
      // 点在画布外（面板 / 其它区域）：取消取色，但不能吞掉这次点击
      finish(null);
      return;
    }

    // 点在画布上：吞掉事件，避免顺带拖拽/选中对象
    e.preventDefault();
    e.stopPropagation();

    if (result.css) {
      finish(result.css);
      return;
    }
    // 画布内但取不到颜色：跨域污染 → 尝试原生吸管；否则（透明像素）视为取消
    finish(null);
    if (tainted) void pickByNativeEyeDropper(handlers);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    }
  }

  function onWindowBlur() {
    // 切走标签页 / 焦点丢失：直接结束，避免会话悬挂在后台
    finish(null);
  }

  function cancel() {
    if (finished) return;
    finished = true;
    cleanup();
  }

  activeSession = { cancel };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', onWindowBlur);
}

/**
 * 降级通道：浏览器原生 EyeDropper API（Chromium 95+）。
 * 它从屏幕上直接取色，不受画布跨域污染影响；用户按 Esc 会 reject（视为取消）。
 */
async function pickByNativeEyeDropper(handlers: EyedropperHandlers): Promise<void> {
  const Ctor = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
  if (typeof Ctor !== 'function') {
    handlers.onCancel();
    return;
  }
  try {
    const result = await new Ctor().open();
    if (result?.sRGBHex) handlers.onPick(result.sRGBHex);
    else handlers.onCancel();
  } catch {
    handlers.onCancel();
  }
}
