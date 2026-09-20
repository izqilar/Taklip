/**
 * 把「一键制作」表单收集到的值写入克隆后的模板 schema。
 * 映射规则（依据元素 .bind）：
 *  - image 元素  → 写 src（单图，逗号分隔视为多图则取第一张）
 *  - gallery 元素 → 写 images（多图，逗号分隔）
 *  - 其余含 text 字段的元素（text / button）→ 写 text
 * 无对应 bind 的元素保持不变，模板可优雅降级。
 */
import type { Project } from '@h5design/core';

export type QuickMakeFormValues = Record<string, string>;

export function applyFormData(schema: Project, values: QuickMakeFormValues): Project {
  // 深拷贝，避免污染原始模板 schema
  const next: Project = JSON.parse(JSON.stringify(schema));

  for (const page of next.pages) {
    for (const el of page.elements) {
      if (!el.bind) continue;
      const raw = values[el.bind];
      if (raw === undefined || raw === '') continue;

      if (el.type === 'image') {
        // 多图上传时以逗号拼接，取第一张作为封面
        el.src = raw.split(',').map((s) => s.trim()).filter(Boolean)[0] ?? raw;
      } else if (el.type === 'gallery') {
        el.images = raw.split(',').map((s) => s.trim()).filter(Boolean);
      } else if ('text' in el) {
        // text / button 元素均含 text 字段
        (el as { text: string }).text = raw;
      }
    }
  }

  return next;
}
