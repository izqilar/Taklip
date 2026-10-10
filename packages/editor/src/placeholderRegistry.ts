/**
 * 占位符注册表（编辑器侧只读缓存 + React hook）
 *
 * 改造清单 §B：编辑器「只绑定、不创建」。注册表是运营端独占写的配置真相源；
 * 编辑器通过宿主注入的 `services.listPlaceholders()` 拉取，模块级缓存 + in-flight 去重，
 * 并支持按元素类型过滤、当前 locale 取标签、接口失败/未注入时完整回落旧逻辑。
 *
 * ★ 回落铁律：注册表为空 / 接口失败 / 宿主未注入 `listPlaceholders` 时，
 *   本模块返回 `entries === null`，调用方据此退回 `GUEST_FIELD_DEFS + ext_` 自由输入，
 *   绝不阻断现有创作与渲染。
 */

import { useEffect, useState } from 'react';
import { services, type PlaceholderRegistryEntry } from './services';

let cache: PlaceholderRegistryEntry[] | null = null;
let inflight: Promise<PlaceholderRegistryEntry[] | null> | null = null;

/** 拉取并缓存注册表（幂等、in-flight 去重、失败回落 null） */
export async function fetchPlaceholderRegistry(): Promise<PlaceholderRegistryEntry[] | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const svc = services.listPlaceholders;
      if (typeof svc !== 'function') return null;
      const items = await svc();
      cache = Array.isArray(items) ? items : [];
      return cache;
    } catch {
      // 接口失败 → 完整回落旧逻辑（下拉退回 GUEST_FIELD_DEFS + ext_）
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 强制清空缓存（宿主切换账号 / 刷新配置时调用） */
export function invalidatePlaceholderRegistry(): void {
  cache = null;
  inflight = null;
}

/** 元素类型 → 允许绑定的占位符 type 集合（改造清单 §B：类型过滤） */
export function allowedPlaceholderTypes(elType: string): string[] {
  if (elType === 'image') return ['image'];
  // 文本类元素（text 及其它）只接受 text/datetime/address
  return ['text', 'datetime', 'address'];
}

/** 单语言标签（运营端按当前语言录入；无则回落 key） */
export function placeholderLabel(entry: PlaceholderRegistryEntry, _locale?: string): string {
  return entry.label?.trim() || entry.key;
}

/** 单语言默认值（设计态样例候选；无则空串） */
export function placeholderDefault(entry: PlaceholderRegistryEntry, _locale?: string): string {
  return entry.defaultValue?.trim() || '';
}

export interface UseRegistryResult {
  /** 按元素类型过滤后的占位符；null = 接口未就绪/失败（应回落旧逻辑） */
  entries: PlaceholderRegistryEntry[] | null;
  /** 是否进入「注册表模式」（注册表已就绪且含本类型占位符） */
  available: boolean;
}

/**
 * 读取并按元素类型过滤注册表。
 * - `entries === null`：接口未就绪/失败 → 调用方回落旧逻辑。
 * - `available === true`：注册表有本类型占位符 → 下拉只读这些项、无自定义输入。
 */
export function usePlaceholderRegistry(elType: string): UseRegistryResult {
  const [entries, setEntries] = useState<PlaceholderRegistryEntry[] | null>(cache);

  useEffect(() => {
    let alive = true;
    fetchPlaceholderRegistry().then((res) => {
      if (!alive) return;
      setEntries(res ? res.filter((p) => allowedPlaceholderTypes(elType).includes(p.type)) : null);
    });
    return () => {
      alive = false;
    };
  }, [elType]);

  return { entries, available: entries !== null && entries.length > 0 };
}
