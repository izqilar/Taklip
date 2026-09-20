declare module 'gifenc' {
  /** 调色板：每个颜色为 [r, g, b] 或 [r, g, b, a] */
  export type Palette = number[][];

  export interface WriteFrameOptions {
    palette?: Palette;
    transparent?: boolean;
    transparentIndex?: number;
    /** 单帧延迟（毫秒） */
    delay?: number;
    /** 0 = 循环播放；-1 = 不重复 */
    repeat?: number;
    first?: boolean;
    dispose?: number;
    colorDepth?: number;
  }

  export interface GIFEncoder {
    writeFrame(
      indexed: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    readonly buffer: ArrayBuffer;
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GIFEncoder;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): Palette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string,
  ): Uint8Array;

  const _default: { GIFEncoder: typeof GIFEncoder; quantize: typeof quantize; applyPalette: typeof applyPalette };
  export default _default;
}
