/**
 * 视频导出音频 / 录制器合成工具。
 *
 * 导出管线（konvaVideoExport.ts / exportVideo.ts）通过 canvas.captureStream 录制「仅视频轨」，
 * 而背景音乐在预览/发布态由 MusicPlayer 组件播放（该组件并不参与导出渲染），因此原始导出的
 * 视频没有声音。本模块把背景音乐的音频轨与画布视频轨合并，交给 MediaRecorder 一起录制；同时
 * 提供带 fallback 的 MediaRecorder 创建，避免浏览器因编码配置不支持而抛错。
 *
 * 音频合成方案（关键）：
 * 旧实现用 <audio>.captureStream() 直接采集音轨。该方式有两个硬伤——
 *  1) Chrome 在合成 WAV（PCM）音轨时 recorder 经常成功创建却不产数据，最终 onstop 得到空 Blob；
 *  2) 受 autoplay 策略影响，音轨常常为空、导出无声。
 * 因此这里改为「Web Audio API 解码 → MediaStreamAudioDestinationNode」：用 fetch 拉取音频，
 * decodeAudioData 解码（WAV/MP3 等浏览器可解码格式均可），再经 AudioContext 输出到一个
 * MediaStream，交给 MediaRecorder 录制。该 MediaStream 的音轨是浏览器可正常编码为 opus 的
 * 实时轨，彻底绕开 WAV 合成失败的坑，且对 MP3 同样稳健。
 *
 * 注意 autoplay 策略：createBackgroundMusicPlayer 必须在「用户手势（点击导出）」的同步调用链内
 * 被调用（其内部已 resume AudioContext），否则浏览器会拦截自动播放导致音轨为空、导出无声。
 */
import type { Project } from '@h5design/core';

/** 背景音乐句柄：导出时用其 stream 与视频轨合成，start/stop 控制播放与资源释放 */
export interface BgmHandle {
  /** 含一条音频轨的 MediaStream，交给 MediaRecorder 与画布视频轨合成 */
  stream: MediaStream;
  /** 在 recorder.start 之前调用，使背景音乐与画面同步起播 */
  start: () => void;
  /** 录制结束后调用，停止播放并释放 AudioContext */
  stop: () => void;
}

/**
 * 在用户手势调用链内解码并准备背景音乐，返回 BgmHandle。
 * 无背景音乐、背景音乐被关闭（closeBackgroundMusic）、或解码失败时返回 null（导出无声视频）。
 * 作品内音乐均为同源地址（/uploads 用户上传 或 /public/music 系统音乐），fetch 无需跨域处理。
 */
export function createBackgroundMusicPlayer(project: Project): Promise<BgmHandle | null> {
  const settings = project.settings;
  const bgm = settings && !settings.closeBackgroundMusic ? settings.backgroundMusic : undefined;
  if (!bgm?.url) return Promise.resolve(null);
  const url = bgm.url.trim();
  return buildBgmHandle(url).catch((err) => {
    console.warn('[export-video] BGM prepare failed, export silent video:', err);
    return null;
  });
}

/** 拉取并解码背景音乐，构造可混入录制流的音频句柄 */
async function buildBgmHandle(url: string): Promise<BgmHandle> {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error('AudioContext unsupported');

  const ctx = new Ctor();
  // 必须在用户手势链内 resume，否则后续 source 无声音（autoplay 策略）
  try {
    await ctx.resume();
  } catch {
    /* ignore */
  }

  // 拉取音频并解码（同源，无需 crossOrigin）
  const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!resp.ok) {
    void ctx.close().catch(() => undefined);
    throw new Error('BGM fetch failed: ' + resp.status);
  }
  const arrayBuf = await resp.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arrayBuf);

  // 输出到 MediaStream（实时音频轨）供录制封装；不接 ctx.destination，导出过程中静音、不放音
  const dest = ctx.createMediaStreamDestination();
  let source: AudioBufferSourceNode | null = null;
  let started = false;

  const start = () => {
    if (started) return;
    started = true;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      /* ignore */
    }
    source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.loop = true;
    // 仅连到 MediaStreamDestination 供录制封装；不连 ctx.destination，导出过程静音不放音
    source.connect(dest);
    source.start(0);
  };

  const stop = () => {
    try {
      source?.stop();
    } catch {
      /* ignore */
    }
    try {
      source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      dest.disconnect();
    } catch {
      /* ignore */
    }
    void ctx.close().catch(() => undefined);
  };

  if (dest.stream.getAudioTracks().length === 0) {
    void ctx.close().catch(() => undefined);
    throw new Error('BGM audio track unavailable');
  }
  return { stream: dest.stream, start, stop };
}

/**
 * 将画布视频轨与背景音乐音频轨合并为一个 MediaStream。
 * 若音频流无可用音轨，则回退为仅视频轨。
 */
export function createVideoAudioStream(
  canvas: HTMLCanvasElement,
  fps: number,
  audioStream: MediaStream | null,
): MediaStream {
  const videoStream = canvas.captureStream(fps);
  if (!audioStream || audioStream.getAudioTracks().length === 0) return videoStream;
  const aTrack = audioStream.getAudioTracks()[0];
  // readyState 为 ended / muted 表示音轨不可用，混入会导致 MediaRecorder 不产数据；降级为纯视频。
  if (aTrack.readyState === 'ended' || aTrack.muted) return videoStream;
  return new MediaStream([...videoStream.getVideoTracks(), aTrack]);
}

const DEFAULT_VIDEO_BITS_PER_SECOND = 12_000_000;

// 浏览器 MediaRecorder 对 WebM/VPx 支持最好；MP4 需用 High Profile 级别才能承载 1080p。
// avc1.42E01E 为 Baseline 3.0，最大仅 720×480 左右，不能用于 1080×1920 导出。
const AUDIO_ENABLED_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.640028,mp4a.40.2', // High Profile Level 4.0，支持 1080p
  'video/mp4;codecs=avc1.64001f,mp4a.40.2', // High Profile Level 3.1
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Baseline（兼容性备选）
  'video/mp4',
];

const AUDIO_DISABLED_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.64001f',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
];

// 如果高码率失败，逐级降码率再试；部分浏览器/系统对 12Mbps 不支持。
const BITS_PER_SECOND_CANDIDATES = [12_000_000, 8_000_000, 5_000_000, 2_500_000, 1_000_000];

function tryCreateRecorder(
  stream: MediaStream,
  mimeType: string,
  videoBitsPerSecond: number,
): MediaRecorder | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (!MediaRecorder.isTypeSupported(mimeType)) return null;
  try {
    return new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  } catch {
    return null;
  }
}

/**
 * 为导出视频创建最合适的 MediaRecorder。
 * 优先尝试「视频+音频」编码组合；若全部失败则回退到「纯视频」；仍失败返回 null。
 * 返回的 mimeType 为 recorder.mimeType（浏览器实际采用的类型），用于 Blob 与扩展名。
 */
export function createRecorderForExport(
  canvas: HTMLCanvasElement,
  fps: number,
  audioStream: MediaStream | null,
  options?: { videoBitsPerSecond?: number },
): { recorder: MediaRecorder; mimeType: string } | null {
  const preferredBps = options?.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND;
  const bpsList = BITS_PER_SECOND_CANDIDATES.includes(preferredBps)
    ? BITS_PER_SECOND_CANDIDATES
    : [preferredBps, ...BITS_PER_SECOND_CANDIDATES];

  // 先拿到带音频的合并流；音频不可用时它会自动降级为纯视频流。
  // 这样回退阶段可以复用同一个 videoStream，避免多次 captureStream 可能带来的状态问题。
  const combinedStream = createVideoAudioStream(canvas, fps, audioStream);
  const hasAudioTrack = combinedStream.getAudioTracks().length > 0;

  if (hasAudioTrack) {
    for (const bps of bpsList) {
      for (const candidate of AUDIO_ENABLED_CANDIDATES) {
        const recorder = tryCreateRecorder(combinedStream, candidate, bps);
        if (recorder) return { recorder, mimeType: recorder.mimeType || candidate };
      }
    }
  }

  // 回退：纯视频轨（复用 combinedStream 的视频轨，不再二次 captureStream）
  const videoOnlyStream = new MediaStream(combinedStream.getVideoTracks());
  for (const bps of bpsList) {
    for (const candidate of AUDIO_DISABLED_CANDIDATES) {
      const recorder = tryCreateRecorder(videoOnlyStream, candidate, bps);
      if (recorder) return { recorder, mimeType: recorder.mimeType || candidate };
    }
  }

  return null;
}

/** 根据实际录制 MIME 类型推断下载扩展名 */
export function getVideoExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

/** 视频导出目标格式（mp4 / webm 带音频；gif 为动图，无音频） */
export type VideoExportFormat = 'mp4' | 'webm' | 'gif';

/** 强制带音频的候选编码（按优先级，音频在前以确保音轨被封装） */
const FORMAT_AUDIO_CANDIDATES: Record<'mp4' | 'webm', string[]> = {
  mp4: [
    'video/mp4;codecs=avc1.640028,mp4a.40.2', // High Profile L4.0 + AAC（支持 1080p）
    'video/mp4;codecs=avc1.64001f,mp4a.40.2', // High Profile L3.1 + AAC
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Baseline + AAC（兼容备选）
    'video/mp4',
  ],
  webm: [
    'video/webm;codecs=vp9,opus', // VP9 + Opus（音画俱佳）
    'video/webm;codecs=vp8,opus', // VP8 + Opus
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ],
};

/** 纯视频（无音频）兜底候选，仅在带音频编码完全不可用时使用 */
const FORMAT_VIDEO_ONLY_CANDIDATES: Record<'mp4' | 'webm', string[]> = {
  mp4: ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.64001f', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'],
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
};

/**
 * 按目标格式强制创建 MediaRecorder：优先「视频+音频」编码组合（确保背景音乐被封装进文件），
 * 仅在完全不支持带音频编码时才降级为纯视频。返回的 mimeType 为浏览器实际采用类型。
 */
export function createRecorderWithFormat(
  canvas: HTMLCanvasElement,
  fps: number,
  audioStream: MediaStream | null,
  format: 'mp4' | 'webm',
  options?: { videoBitsPerSecond?: number },
): { recorder: MediaRecorder; mimeType: string; hasAudio: boolean } | null {
  const preferredBps = options?.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND;
  const bpsList = BITS_PER_SECOND_CANDIDATES.includes(preferredBps)
    ? BITS_PER_SECOND_CANDIDATES
    : [preferredBps, ...BITS_PER_SECOND_CANDIDATES];

  // 合并流：音频可用时自动带上音轨；音频不可用时降级为纯视频流。
  const combinedStream = createVideoAudioStream(canvas, fps, audioStream);
  const hasAudio = combinedStream.getAudioTracks().length > 0;
  const audioCands = FORMAT_AUDIO_CANDIDATES[format];

  // 1) 带音频优先
  for (const bps of bpsList) {
    for (const candidate of audioCands) {
      const recorder = tryCreateRecorder(combinedStream, candidate, bps);
      if (recorder) return { recorder, mimeType: recorder.mimeType || candidate, hasAudio };
    }
  }

  // 2) 纯视频兜底
  const videoOnlyStream = new MediaStream(combinedStream.getVideoTracks());
  const videoCands = FORMAT_VIDEO_ONLY_CANDIDATES[format];
  for (const bps of bpsList) {
    for (const candidate of videoCands) {
      const recorder = tryCreateRecorder(videoOnlyStream, candidate, bps);
      if (recorder) return { recorder, mimeType: recorder.mimeType || candidate, hasAudio: false };
    }
  }

  return null;
}
