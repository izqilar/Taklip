// 统一从共享 core 包导出类型，业务层只从这里引入
export type {
  Element,
  ElementType,
  Project,
  Page,
  TextElement,
  ImageElement,
  RectElement,
  CircleElement,
  LineElement,
  BaseElement,
  ProjectRecord,
} from '@h5design/core';

export { createElement, createProject, genId, CANVAS_DEFAULT } from '@h5design/core';
