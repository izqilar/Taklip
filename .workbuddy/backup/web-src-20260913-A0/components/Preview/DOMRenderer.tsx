/**
 * DOMRenderer — Web 端的「发布态渲染器」薄包装层。
 *
 * 真实渲染逻辑已抽到 @h5design/render 共享包（SchemaRenderer / PublishedH5），
 * 本文件只负责把 Web 端自己的 GSAP 动画播放器（playElementAnimation）注入进去，
 * 从而保证编辑器预览 / 视频导出 / 已发布页与共享渲染器完全一致，且动画行为保持原样。
 *
 * 这样 web 与 admin（未来）import 的是同一份渲染实现 ——「设计一次，三端一致」的根本保障。
 */
import SchemaRenderer, {
  PublishedH5 as RenderPublishedH5,
  type SchemaRendererProps,
} from '@h5design/render';
import type { Project } from '@h5design/core';
import { playElementAnimation } from '@/animations/presets';

export type { SchemaRendererProps };

/** 默认导出的发布态渲染器（注入 GSAP 动画播放器）。 */
export default function DOMRenderer(props: SchemaRendererProps) {
  return <SchemaRenderer {...props} animationPlayer={playElementAnimation} />;
}

/** 多页发布态完整渲染器（注入 GSAP 动画播放器）。 */
export function PublishedH5({ project }: { project: Project }) {
  return <RenderPublishedH5 project={project} animationPlayer={playElementAnimation} />;
}
