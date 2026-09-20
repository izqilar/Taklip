import type { CSSProperties, ReactElement } from 'react';
import type { WidgetElement, WidgetKind } from '@h5design/core';

/** 属性面板里某一数据字段的定义（数据驱动渲染） */
export interface WidgetFieldDef {
  /** 对应 el.data 的键 */
  key: string;
  /** i18n key（带命名空间前缀，如 'editor:widget.fields.title'） */
  labelKey: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'switch' | 'image' | 'select' | 'options';
  options?: { labelKey: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** 占位提示 i18n key（可选） */
  placeholderKey?: string;
}

/** 顶层通用字段（提升为 WidgetElement 顶层属性，便于统一渲染） */
export type WidgetCommonField = 'title' | 'text' | 'themeColor' | 'textColor' | 'bgColor';

export interface WidgetDOMProps {
  el: WidgetElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

/** 单个 widget 的完整定义 */
export interface WidgetDef {
  kind: WidgetKind;
  /** 展示名称 i18n key（复用组件菜单翻译） */
  labelKey: string;
  /** 画布预览用的图标（emoji 或短文本） */
  icon: string;
  category: 'view' | 'interactive' | 'form' | 'feature';
  defaultSize: { width: number; height: number };
  /** 默认顶层字段 + data（均为可选，按需返回） */
  createDefault: () => Partial<
    Pick<WidgetElement, 'title' | 'text' | 'themeColor' | 'textColor' | 'bgColor' | 'data'>
  >;
  /** 需要在属性面板里展示的顶层通用字段 */
  commonFields?: WidgetCommonField[];
  /** data 内的可编辑字段 */
  fields: WidgetFieldDef[];
  /** 发布态 DOM 渲染组件 */
  DOM: (props: WidgetDOMProps) => ReactElement;
}
