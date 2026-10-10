/**
 * 批量请柬 · 个性化引擎（规范 §7 / §8）
 *
 * **纯函数、零 DOM 依赖**：放 `@h5design/core`，服务端批量渲染与浏览器实时预览共用同一实现，
 * 保证「预览所见 == 导出所得」。
 *
 * 工作模型：模板 schema 只定义一次（元素带 `binding.key` 变量标注），
 * 名单在生成循环里被「逐行读取 → 替换 → 渲染」；名单**绝不** baked 进模板。
 */

import type { Element, Project, TextElement, VariableFitMode } from './schema';
import { DEFAULT_VARIABLE_FIT } from './schema';
import { inferTitle, getGuestFieldDef } from './guest-fields';
import type { GuestData } from './guest-fields';

/** 变量映射：元素 binding.key → 名单字段 key。缺省为恒等映射。 */
export type GuestMapping = Record<string, string>;

/** 个性化上下文（单条名单记录） */
export interface PersonalizeRecord {
  id?: string;
  data: GuestData;
}

/** 深克隆（structuredClone 不可用时回退 JSON） */
function deepClone<T>(v: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(v);
    } catch {
      /* 含不可克隆值时回退 */
    }
  }
  return JSON.parse(JSON.stringify(v)) as T;
}

/** 取元素上「可写文本」的判定：仅 text 元素有 text 字段 */
function asTextElement(el: Element): TextElement | null {
  return (el as TextElement).type === 'text' ? (el as TextElement) : null;
}

/** 取元素上的图片地址字段（image / video 等按 duck typing 处理，避免耦合全部联合类型） */
function imageSrcOf(el: Element): string | undefined {
  const anyEl = el as unknown as { src?: unknown };
  return typeof anyEl.src === 'string' ? anyEl.src : undefined;
}

/**
 * 收集 schema 内全部变量 key（按出现顺序去重）。
 * 用于编辑器变量面板展示与「模板变量 vs 名单字段」映射校验。
 */
export function collectBindingKeys(schema: Project | null | undefined): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const pages = schema?.pages ?? [];
  for (const page of pages) {
    for (const el of page.elements ?? []) {
      const k = el.binding?.key;
      if (k && !seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

/** 模板变量聚合视图（设计态 / 体检用，方案 §5.2） */
export interface TemplateVariableView {
  /** 变量 key（恒等于名单字段 key，D4） */
  key: string;
  /** 中文名：标准字段取 GuestFieldDef.label，自定义字段回落 key 本身 */
  label: string;
  /** 人类可读变量名（C 方案 binding.name），展示与默认候选用；缺省回落 label */
  name?: string;
  /** 是否标准名单字段（非 ext_ 前缀） */
  isStandard: boolean;
  /** 命中的元素 id（同一模板中重复占位 → 多个） */
  elementIds: string[];
  /** 设计态样例（首个命中元素的 sample，缺省回落 example） */
  sample: string;
  /** 运行态兜底（首个命中元素非空 fallback） */
  fallback?: string;
  /** 溢出策略（首个命中元素的 fit，缺省 'shrink'） */
  fit: VariableFitMode;
}

/**
 * 聚合 schema 内全部变量（按出现顺序去重），输出编辑器变量面板 / 体检所需的视图。
 *
 * ★ 与 `collectBindingKeys` 的区别：后者只返回 key 列表；本函数额外聚合
 *   命中元素、样例、兜底与溢出策略，**不新增表**（方案 §5.2：变量本质是元素上的标注，
 *   建表会与 schema 产生双写不一致）。
 */
export function collectBindings(schema: Project | null | undefined): TemplateVariableView[] {
  const out: TemplateVariableView[] = [];
  const index = new Map<string, TemplateVariableView>();
  for (const page of schema?.pages ?? []) {
    for (const el of page.elements ?? []) {
      const key = el.binding?.key;
      if (!key) continue;
      let v = index.get(key);
      if (!v) {
        v = {
          key,
          label: getGuestFieldDef(key)?.label ?? key,
          name: el.binding?.name,
          isStandard: !key.startsWith('ext_'),
          elementIds: [],
          sample: resolveDesignValue(el),
          fallback: el.binding?.fallback,
          fit: el.binding?.fit ?? DEFAULT_VARIABLE_FIT,
        };
        index.set(key, v);
        out.push(v);
      }
      // 首个命中元素决定 sample/fallback/fit；后续命中仅累加 elementIds。
      // 若首个元素的 sample 为空而后继有值，则补上（避免展示空白样例）。
      if (!v.sample) v.sample = resolveDesignValue(el);
      if (!v.fallback) v.fallback = el.binding?.fallback;
      if (!v.name) v.name = el.binding?.name;
      v.elementIds.push(el.id);
    }
  }
  return out;
}

/**
 * 由人类可读变量名生成稳定 ASCII slug（C 方案：变量 key 与命名解耦）。
 *
 * - 同输入同输出；同模板内同名元素自然合并为同一 key。
 * - 仅作者初始标记时调用一次并冻结；后续改名只更新 `binding.name`，不改 key（保证映射不断）。
 * - key 永不取中文，规避 `TOKEN_RE` 仅 ASCII 导致 `{{新人姓名}}` 原样打印（P0）。
 */
export function deriveSlug(name: string): string {
  const s = (name ?? '').trim();
  if (!s) return 'v_empty';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `v_${(h >>> 0).toString(16).padStart(8, '0').slice(0, 6)}`;
}

/**
 * 生成期画布点选的「元素级绑定」落点（项目级，不回写模板）。
 * key 为 ASCII slug（同 C 方案），name 为人类可读名。
 */
export interface ElementBindingEntry {
  key: string;
  name?: string;
  listField?: string;
}
export type ElementBindings = Record<string, ElementBindingEntry>;

/**
 * 将项目级元素绑定注入模板 schema，返回新 schema（不改原对象）。
 * 供 runJob 在 personalizeSchema 之前调用：D 方案点选的元素因此成为变量。
 */
export function applyElementBindings(
  base: Project | null | undefined,
  elementBindings: ElementBindings | null | undefined,
): Project {
  if (!base || !elementBindings) return base as Project;
  const cloned = JSON.parse(JSON.stringify(base)) as Project;
  for (const page of cloned.pages ?? []) {
    for (const el of page.elements ?? []) {
      const eb = elementBindings[el.id];
      if (eb?.key) {
        el.binding = { key: eb.key, ...(eb.name ? { name: eb.name } : {}), ...(el.binding ?? {}) };
      }
    }
  }
  return cloned;
}

/**
 * 解析某个变量 key 对应的实际值。
 *
 * 取值链（严格有序，方案 §1.4 / §2.4）：
 *   显式映射字段(D4 后即同名字段) → `fallback` 兜底值 → 称谓性别推断(仅 guest_title) → ''
 *
 * ★ 顺序说明：`fallback` 优先于 `inferTitle` —— fallback 是用户显式填写的意图，
 *   inferTitle 只是「没填称谓时按性别猜」的默认行为，显式应压过推断。
 */
export function resolveBindingValue(
  key: string,
  data: GuestData,
  mapping?: GuestMapping,
  fallback?: string,
): string {
  const sourceKey = mapping?.[key] ?? key;
  const raw = data?.[sourceKey];
  if (raw != null && raw !== '') return String(raw);
  if (fallback != null && fallback !== '') return fallback;
  // 称谓兜底：guest_title 留空时按 gender 推断（规范 §9.1）
  if (key === 'guest_title' || sourceKey === 'guest_title') return inferTitle(data);
  return '';
}

/**
 * 设计态展示值（方案 §1.4）：编辑器画布 / 模板选择预览 / 缩略图用。
 *
 * ★ 存在意义：绑定后若直接取名单值，名单尚未选择时元素会显示空白，
 *   用户无法判断「替换后排版会不会被破坏」。设计态恒定显示样例值。
 *
 * 取值链：`binding.sample` → `GuestFieldDef.example`（标准字段） → 空串。
 */
export function resolveDesignValue(el: Element): string {
  const key = el.binding?.key;
  if (!key) return '';
  const sample = el.binding?.sample;
  if (sample != null && sample !== '') return sample;
  return getGuestFieldDef(key)?.example ?? '';
}

/**
 * 判断元素是否为「整段变量元素」。
 *
 * ★ D2 作用域判定（决定性）：只有整段变量元素在值为空时才隐藏。
 *   混合文案元素（`text` 含 `{{token}}`）是句子的一部分（如「尊敬的 {{guest_name}}」），
 *   整体隐藏会破坏句式与版式，因此空令牌只替换为空串、保留前后缀、元素照常显示。
 */
export function isWholeElementVariable(el: Element): boolean {
  if (!el.binding?.key) return false;
  const text = (el as TextElement).text;
  if (typeof text === 'string' && text.includes('{{')) return false;
  return true;
}

/** `{{key}}` 令牌替换（用于 "尊敬的 {{guest_name}} {{guest_title}}" 这类混合文案） */
const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * `{{key}}` 令牌替换（用于 "尊敬的 {{guest_name}} {{guest_title}}" 这类混合文案）。
 * @param fallbacks 可选：key → 该变量的兜底值。混合文案里可能含多个令牌，
 *                  按 key 逐个取各自的 fallback，而非整段共用一个。
 */
export function applyTokens(
  text: string,
  data: GuestData,
  mapping?: GuestMapping,
  fallbacks?: GuestMapping,
): string {
  if (!text || !text.includes('{{')) return text;
  return text.replace(TOKEN_RE, (_m, key: string) =>
    resolveBindingValue(key, data, mapping, fallbacks?.[key]),
  );
}

/** 单个元素的个性化替换（返回新对象，不改原对象） */
function personalizeElement(el: Element, data: GuestData, mapping?: GuestMapping): Element {
  const next = { ...el } as Element;
  const key = el.binding?.key;
  const fallback = el.binding?.fallback;
  // D2：仅整段变量元素在值为空时隐藏（混合文案元素保留前后缀）
  const hideWhenEmpty = isWholeElementVariable(el);
  // 混合文案里可能含多个令牌，按 key 逐个取各自 fallback
  const fallbacks: GuestMapping | undefined = key && fallback ? { [key]: fallback } : undefined;

  const textEl = asTextElement(next);
  if (textEl) {
    if (key) {
      const current = textEl.text ?? '';
      if (current.includes('{{')) {
        // 混合文案：按令牌替换，保留前后缀；空令牌 → 空串，元素不隐藏
        textEl.text = applyTokens(current, data, mapping, fallbacks);
      } else {
        // 整段替换（规范 §7）
        const v = resolveBindingValue(key, data, mapping, fallback);
        textEl.text = v;
        if (v === '' && hideWhenEmpty) (next as { visible: boolean }).visible = false;
      }
    } else if (textEl.text?.includes('{{')) {
      textEl.text = applyTokens(textEl.text, data, mapping);
    }
    // i18n 多语种文案同步替换，避免预览语种回落成模板原文
    if (textEl.i18n && Object.keys(textEl.i18n).length) {
      const i18n: Record<string, string> = {};
      for (const [lang, t] of Object.entries(textEl.i18n)) {
        if (key && !t.includes('{{')) {
          const v = resolveBindingValue(key, data, mapping, fallback);
          i18n[lang] = v;
          if (v === '' && hideWhenEmpty) (next as { visible: boolean }).visible = false;
        } else {
          i18n[lang] = applyTokens(t, data, mapping, fallbacks);
        }
      }
      textEl.i18n = i18n;
    }
    return next;
  }

  // 非文本元素：图片类按 src 替换；src 为空则该图无从展示，同样按 D2 隐藏
  const src = imageSrcOf(next);
  if (key && src !== undefined) {
    const v = resolveBindingValue(key, data, mapping, fallback);
    (next as unknown as { src: string }).src = v;
    if (v === '' && hideWhenEmpty) (next as { visible: boolean }).visible = false;
  }
  return next;
}

/**
 * 个性化整个 schema：深克隆模板 → 逐元素替换变量 → 返回**新** schema。
 *
 * - 不修改入参 `baseSchema`（模板保持单份真值）
 * - 未标注 `binding` 的元素原样保留
 * - 返回的 schema 可供渲染管线（预览 / 导出）直接消费
 */
export function personalizeSchema(
  baseSchema: Project,
  record: PersonalizeRecord,
  mapping?: GuestMapping,
): Project {
  const data = record.data ?? {};
  const out = deepClone(baseSchema);
  out.pages = (out.pages ?? []).map((page) => ({
    ...page,
    elements: (page.elements ?? []).map((el) => personalizeElement(el, data, mapping)),
  }));
  return out;
}

/**
 * 批量个性化（同模板 + 多条记录）。
 * @returns 与 `records` 同序的 schema 数组
 */
export function personalizeSchemas(
  baseSchema: Project,
  records: PersonalizeRecord[],
  mapping?: GuestMapping,
): Project[] {
  return records.map((r) => personalizeSchema(baseSchema, r, mapping));
}

/**
 * 模板变量 vs 名单字段的映射体检：
 * 找出「模板用了但名单没有对应字段」的变量，供前端在生成前提示。
 */
export function diffBindingKeys(
  schema: Project | null | undefined,
  availableFields: readonly string[],
  mapping?: GuestMapping,
): { missing: string[]; used: string[] } {
  const used = collectBindingKeys(schema);
  const avail = new Set(availableFields);
  const missing = used.filter((k) => !avail.has(mapping?.[k] ?? k));
  return { missing, used };
}
