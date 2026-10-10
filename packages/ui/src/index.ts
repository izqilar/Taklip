export { DesignGalleryCard, default } from './DesignGalleryCard';
export type {
  DesignGalleryCardProps,
  DesignActionCaps,
  DesignKind,
} from './DesignGalleryCard';

// 模板字段设计（web 与 admin 两端共用的详情页组件）
export { TemplateFieldDesign, default as TemplateFieldDesignDefault } from './TemplateFieldDesign';
export type { TemplateFieldDesignProps, GuestFieldDef } from './TemplateFieldDesign';

// 纯函数能力解析（零 React/i18n 依赖，可被单测直接消费）
export { resolveActionGroups, ACTION_ORDER } from './resolveActions';
export type {
  ActionGroup,
  ActionKey,
  ActionDef,
  Variant,
} from './resolveActions';
