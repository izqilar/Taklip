/**
 * 元素注册表 — 平台核心扩展机制
 *
 * 新增元素类型只需：
 * 1. 在 core/src/schema.ts 定义类型
 * 2. 在 core/src/constants.ts 的 createElement 添加默认值
 * 3. 在此处注册 { labelKey, icon, baseFields, typeFields }
 *
 * 画布渲染器和属性面板都从注册表读取配置，无需修改它们的代码。
 *
 * i18n 约定：注册表内部不存放任何语言文案，只存放带命名空间前缀的
 * i18n key（如 'editor:property.width'），由视图层调用 t() 翻译。
 */

import type { ElementType, Element } from '@h5design/core';

/* ───────── 属性字段定义 ───────── */

export type FieldType =
  | 'number'
  | 'text'
  | 'color'
  | 'select'
  | 'slider'
  | 'textarea'
  | 'fontStyle'
  | 'textDecoration'
  | 'align'
  | 'verticalAlign';

export interface PropertyOption {
  /** i18n key，带命名空间前缀 */
  labelKey: string;
  value: string;
}

export interface PropertyField {
  key: string;
  /** i18n key，带命名空间前缀，如 'editor:property.width' */
  labelKey: string;
  type: FieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: PropertyOption[];
  /** 该属性改变时是否需要 pushHistory（连续操作如 slider 设为 false，由调用方在 blur 时 push） */
  continuous?: boolean;
}

/* ───────── 元素注册项 ───────── */

export interface ElementRegistration {
  type: ElementType;
  /** i18n key，带命名空间前缀，如 'editor:element.text' */
  labelKey: string;
  icon: string;
  /** 通用属性字段（位置/尺寸/旋转/透明度等，所有元素共享） */
  baseFields: PropertyField[];
  /** 类型专属属性字段 */
  typeFields: PropertyField[];
}

/* ───────── 通用属性字段 ───────── */

const COMMON_FIELDS: PropertyField[] = [
  {
    key: 'name',
    labelKey: 'editor:property.name',
    type: 'text',
  },
  { key: 'x', labelKey: 'editor:property.x', type: 'number', step: 1 },
  { key: 'y', labelKey: 'editor:property.y', type: 'number', step: 1 },
  { key: 'width', labelKey: 'editor:property.width', type: 'number', step: 1, min: 5 },
  { key: 'height', labelKey: 'editor:property.height', type: 'number', step: 1, min: 5 },
  {
    key: 'rotation',
    labelKey: 'editor:property.rotation',
    type: 'slider',
    min: 0,
    max: 360,
    step: 1,
    continuous: true,
  },
  {
    key: 'opacity',
    labelKey: 'editor:property.opacity',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    continuous: true,
  },
];

/* ───────── 动画属性字段 ───────── */

const ENTER_OPTIONS: PropertyOption[] = [
  { labelKey: 'editor:animation.none', value: 'none' },
  { labelKey: 'editor:animation.fadeIn', value: 'fadeIn' },
  { labelKey: 'editor:animation.slideIn', value: 'slideIn' },
  { labelKey: 'editor:animation.zoomIn', value: 'zoomIn' },
  { labelKey: 'editor:animation.bounceIn', value: 'bounceIn' },
  { labelKey: 'editor:animation.rotateIn', value: 'rotateIn' },
  { labelKey: 'editor:animation.flipIn', value: 'flipIn' },
];

const EASING_OPTIONS: PropertyOption[] = [
  { labelKey: 'editor:animation.linear', value: 'linear' },
  { labelKey: 'editor:animation.ease', value: 'ease' },
  { labelKey: 'editor:animation.easeIn', value: 'easeIn' },
  { labelKey: 'editor:animation.easeOut', value: 'easeOut' },
  { labelKey: 'editor:animation.easeInOut', value: 'easeInOut' },
  { labelKey: 'editor:animation.bounce', value: 'bounce' },
];

const LOOP_OPTIONS: PropertyOption[] = [
  { labelKey: 'editor:animation.none', value: 'none' },
  { labelKey: 'editor:animation.pulse', value: 'pulse' },
  { labelKey: 'editor:animation.shake', value: 'shake' },
  { labelKey: 'editor:animation.float', value: 'float' },
  { labelKey: 'editor:animation.spin', value: 'spin' },
];

export const ANIMATION_FIELDS: PropertyField[] = [
  {
    key: 'animation.enter',
    labelKey: 'editor:animation.enter',
    type: 'select',
    options: ENTER_OPTIONS,
  },
  {
    key: 'animation.enterDuration',
    labelKey: 'editor:animation.enterDuration',
    type: 'slider',
    min: 0.1,
    max: 5,
    step: 0.1,
    continuous: true,
  },
  {
    key: 'animation.enterDelay',
    labelKey: 'editor:animation.enterDelay',
    type: 'slider',
    min: 0,
    max: 5,
    step: 0.1,
    continuous: true,
  },
  {
    key: 'animation.enterEasing',
    labelKey: 'editor:animation.enterEasing',
    type: 'select',
    options: EASING_OPTIONS,
  },
  {
    key: 'animation.loop',
    labelKey: 'editor:animation.loop',
    type: 'select',
    options: LOOP_OPTIONS,
  },
  {
    key: 'animation.loopDuration',
    labelKey: 'editor:animation.loopDuration',
    type: 'slider',
    min: 0.5,
    max: 10,
    step: 0.1,
    continuous: true,
  },
];

/* ───────── 注册表 ───────── */

const registry = new Map<ElementType, ElementRegistration>();

export function registerElement(reg: ElementRegistration): void {
  registry.set(reg.type, reg);
}

export function getElementRegistration(
  type: ElementType,
): ElementRegistration | undefined {
  return registry.get(type);
}

export function getAllRegisteredElements(): ElementRegistration[] {
  return Array.from(registry.values());
}

/* ───────── 注册所有内置元素 ───────── */

registerElement({
  type: 'text',
  labelKey: 'editor:element.text',
  icon: 'T',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'text', labelKey: 'editor:property.content', type: 'textarea' },
    {
      key: 'fontSize',
      labelKey: 'editor:property.fontSize',
      type: 'number',
      min: 8,
      max: 200,
      step: 1,
    },
    {
      key: 'fontFamily',
      labelKey: 'editor:property.fontFamily',
      type: 'select',
      options: [
        { labelKey: 'editor:font.default', value: 'sans-serif' },
        { labelKey: 'editor:font.serif', value: 'serif' },
        { labelKey: 'editor:font.monospace', value: 'monospace' },
        { labelKey: 'editor:font.heiTi', value: 'Microsoft YaHei, PingFang SC, sans-serif' },
        { labelKey: 'editor:font.songTi', value: 'SimSun, Songti SC, serif' },
        { labelKey: 'editor:font.kaiTi', value: 'KaiTi, STKaiti, serif' },
      ],
    },
    { key: 'fill', labelKey: 'editor:property.textColor', type: 'color' },
    { key: 'backgroundColor', labelKey: 'editor:property.backgroundColor', type: 'color' },
    { key: 'align', labelKey: 'editor:property.align', type: 'align' },
    { key: 'fontStyle', labelKey: 'editor:property.fontStyle', type: 'fontStyle' },
    { key: 'textDecoration', labelKey: 'editor:property.textDecoration', type: 'textDecoration' },
    {
      key: 'lineHeight',
      labelKey: 'editor:property.lineHeight',
      type: 'slider',
      min: 0.5,
      max: 3,
      step: 0.1,
      continuous: true,
    },
    {
      key: 'letterSpacing',
      labelKey: 'editor:property.letterSpacing',
      type: 'number',
      step: 0.5,
      min: -10,
      max: 50,
    },
    { key: 'verticalAlign', labelKey: 'editor:property.verticalAlign', type: 'verticalAlign' },
    {
      key: 'wordBreak',
      labelKey: 'editor:property.wordBreak',
      type: 'select',
      options: [
        { labelKey: 'editor:wordBreak.normal', value: 'normal' },
        { labelKey: 'editor:wordBreak.breakAll', value: 'break-all' },
        { labelKey: 'editor:wordBreak.keepAll', value: 'keep-all' },
        { labelKey: 'editor:wordBreak.breakWord', value: 'break-word' },
      ],
    },
  ],
});

registerElement({
  type: 'rect',
  labelKey: 'editor:element.rect',
  icon: '▭',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'fill', labelKey: 'editor:property.fillShape', type: 'color' },
    { key: 'stroke', labelKey: 'editor:property.stroke', type: 'color' },
    {
      key: 'strokeWidth',
      labelKey: 'editor:property.strokeWidth',
      type: 'number',
      min: 0,
      max: 20,
      step: 0.5,
    },
    {
      key: 'cornerRadius',
      labelKey: 'editor:property.cornerRadius',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      continuous: true,
    },
  ],
});

registerElement({
  type: 'circle',
  labelKey: 'editor:element.circle',
  icon: '◯',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'fill', labelKey: 'editor:property.fillShape', type: 'color' },
    { key: 'radius', labelKey: 'editor:property.radius', type: 'number', min: 1, step: 1 },
  ],
});

registerElement({
  type: 'line',
  labelKey: 'editor:element.line',
  icon: '╱',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'stroke', labelKey: 'editor:property.fill', type: 'color' },
    {
      key: 'strokeWidth',
      labelKey: 'editor:property.lineWidth',
      type: 'number',
      min: 1,
      max: 50,
      step: 0.5,
    },
  ],
});

registerElement({
  type: 'image',
  labelKey: 'editor:element.image',
  icon: '🖼',
  baseFields: COMMON_FIELDS,
  typeFields: [{ key: 'src', labelKey: 'editor:property.src', type: 'text' }],
});

registerElement({
  type: 'button',
  labelKey: 'editor:element.button',
  icon: 'B',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'text', labelKey: 'editor:property.content', type: 'textarea' },
    { key: 'fill', labelKey: 'editor:property.background', type: 'color' },
    { key: 'color', labelKey: 'editor:property.textColor', type: 'color' },
    {
      key: 'fontSize',
      labelKey: 'editor:property.fontSize',
      type: 'number',
      min: 8,
      max: 200,
      step: 1,
    },
    {
      key: 'radius',
      labelKey: 'editor:property.cornerRadius',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
    },
    { key: 'link', labelKey: 'editor:property.link', type: 'text' },
  ],
});

registerElement({
  type: 'video',
  labelKey: 'editor:element.video',
  icon: '▶',
  baseFields: COMMON_FIELDS,
  typeFields: [{ key: 'src', labelKey: 'editor:property.videoSrc', type: 'text' }],
});

registerElement({
  type: 'star',
  labelKey: 'editor:element.star',
  icon: '★',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'fill', labelKey: 'editor:property.fillShape', type: 'color' },
    { key: 'stroke', labelKey: 'editor:property.stroke', type: 'color' },
    {
      key: 'strokeWidth',
      labelKey: 'editor:property.strokeWidth',
      type: 'number',
      min: 0,
      max: 20,
      step: 0.5,
    },
    {
      key: 'points',
      labelKey: 'editor:property.points',
      type: 'number',
      min: 3,
      max: 12,
      step: 1,
    },
  ],
});

registerElement({
  type: 'triangle',
  labelKey: 'editor:element.triangle',
  icon: '▲',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'fill', labelKey: 'editor:property.fillShape', type: 'color' },
    { key: 'stroke', labelKey: 'editor:property.stroke', type: 'color' },
    {
      key: 'strokeWidth',
      labelKey: 'editor:property.strokeWidth',
      type: 'number',
      min: 0,
      max: 20,
      step: 0.5,
    },
  ],
});

registerElement({
  type: 'calendar',
  labelKey: 'editor:element.calendar',
  icon: '📅',
  baseFields: COMMON_FIELDS,
  typeFields: [
    { key: 'year', labelKey: 'editor:property.year', type: 'number', min: 1900, max: 2100, step: 1 },
    { key: 'month', labelKey: 'editor:property.month', type: 'number', min: 1, max: 12, step: 1 },
    { key: 'highlightDay', labelKey: 'editor:property.highlightDay', type: 'number', min: 1, max: 31, step: 1 },
    { key: 'locale', labelKey: 'editor:property.locale', type: 'select', options: [{ labelKey: 'editor:locale.zhCN', value: 'zh-CN' }, { labelKey: 'editor:locale.en', value: 'en' }] },
    { key: 'marker', labelKey: 'editor:property.marker', type: 'select', options: [{ labelKey: 'editor:marker.heart', value: 'heart' }, { labelKey: 'editor:marker.star', value: 'star' }, { labelKey: 'editor:marker.flower', value: 'flower' }, { labelKey: 'editor:marker.diamond', value: 'diamond' }, { labelKey: 'editor:marker.circle', value: 'circle' }, { labelKey: 'editor:marker.snow', value: 'snow' }] },
    { key: 'themeColor', labelKey: 'editor:property.themeColor', type: 'color' },
    { key: 'dayColor', labelKey: 'editor:property.dayColor', type: 'color' },
    { key: 'iconColor', labelKey: 'editor:property.iconColor', type: 'color' },
    { key: 'textColor', labelKey: 'editor:property.textColor', type: 'color' },
    { key: 'bgColor', labelKey: 'editor:property.backgroundColor', type: 'color' },
    { key: 'iconAnimation', labelKey: 'editor:property.iconAnimation', type: 'select', options: [{ labelKey: 'editor:switch.on', value: 'true' }, { labelKey: 'editor:switch.off', value: 'false' }] },
    { key: 'fontFamily', labelKey: 'editor:property.fontFamily', type: 'select', options: [{ labelKey: 'editor:font.default', value: 'sans-serif' }, { labelKey: 'editor:font.serif', value: 'serif' }, { labelKey: 'editor:font.heiTi', value: 'Microsoft YaHei, PingFang SC, sans-serif' }, { labelKey: 'editor:font.songTi', value: 'SimSun, Songti SC, serif' }] },
    { key: 'alias', labelKey: 'editor:property.alias', type: 'text' },
  ],
});

registerElement({
  type: 'gallery',
  labelKey: 'editor:element.gallery',
  icon: '🖼',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'puzzle',
  labelKey: 'editor:element.puzzle',
  icon: '🧩',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'countdown',
  labelKey: 'editor:element.countdown',
  icon: '⏳',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'mapNav',
  labelKey: 'editor:element.mapNav',
  icon: '📍',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'messageBoard',
  labelKey: 'editor:element.messageBoard',
  icon: '💬',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'timeline',
  labelKey: 'editor:element.timeline',
  icon: '🕒',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'like',
  labelKey: 'editor:element.like',
  icon: '❤️',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

registerElement({
  type: 'widget',
  labelKey: 'editor:element.widget',
  icon: '▦',
  baseFields: COMMON_FIELDS,
  typeFields: [],
});

/* ───────── 获取某元素的所有可编辑属性字段 ───────── */

export function getPropertyFields(el: Element): PropertyField[] {
  const reg = getElementRegistration(el.type);
  if (!reg) return COMMON_FIELDS;
  return [...reg.baseFields, ...reg.typeFields];
}
