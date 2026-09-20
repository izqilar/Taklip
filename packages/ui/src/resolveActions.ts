/**
 * 纯函数：把「capabilities（调用方算好的按钮显隐布尔）+ on（回调字典）」解析成三层操作栏。
 * 零 React / 零 i18n 依赖，便于单元测试（见 resolveActions.test.ts）。
 * 外壳 DesignGalleryCard 仅消费本模块的输出做渲染，不在组件内做任何权限判断。
 */

export type DesignKind = 'work' | 'template';

export type DesignActionCaps = {
  preview?: boolean;
  detail?: boolean;
  edit?: boolean;
  export?: boolean;
  delete?: boolean;
  /** 取消发布（已发布作品下架线上 H5；运营端监督视角保留，置于顶栏「导出」之后） */
  unpublish?: boolean;
  submitAsTemplate?: boolean;
  /** 模板：使用模板（克隆为新作品并进入编辑器） */
  use?: boolean;
  /** 作品额外：发布（见文档第 9 章待决，按需开启） */
  publish?: boolean;
};

export type Variant = 'primary' | 'danger' | 'ghost';
export type ActionGroup = 'top' | 'center' | 'bottom';
export type ActionKey = keyof DesignActionCaps;

export interface ActionDef {
  key: ActionKey;
  variant: Variant;
  group: ActionGroup;
}

/** 按钮定序：决定每个 group 内渲染顺序与样式变体。 */
export const ACTION_ORDER: ActionDef[] = [
  { key: 'detail', variant: 'ghost', group: 'top' },
  { key: 'export', variant: 'primary', group: 'top' },
  { key: 'unpublish', variant: 'primary', group: 'top' },
  { key: 'publish', variant: 'primary', group: 'top' },
  { key: 'delete', variant: 'danger', group: 'top' },
  { key: 'preview', variant: 'primary', group: 'center' },
  { key: 'edit', variant: 'ghost', group: 'center' },
];

/**
 * 解析三层操作栏。
 * 规则：仅当 caps[key] 为真 且 on[key] 存在时才渲染（capability 闸门 + 回调闸门双控）。
 * bottom 层按 kind 条件出现：work→提交为模板，template→使用模板。
 */
export function resolveActionGroups(
  kind: DesignKind,
  caps: DesignActionCaps,
  on: Partial<Record<ActionKey, (item: any) => void>>,
): Record<ActionGroup, ActionDef[]> {
  const pick = (g: ActionGroup): ActionDef[] =>
    ACTION_ORDER.filter((o) => o.group === g && caps[o.key] && on[o.key]);

  const top = pick('top');
  const center = pick('center');
  const bottom = pick('bottom');
  if (kind === 'work' && caps.submitAsTemplate && on.submitAsTemplate) {
    bottom.push({ key: 'submitAsTemplate', variant: 'primary', group: 'bottom' });
  }
  if (kind === 'template' && caps.use && on.use) {
    bottom.push({ key: 'use', variant: 'primary', group: 'bottom' });
  }
  return { top, center, bottom };
}
