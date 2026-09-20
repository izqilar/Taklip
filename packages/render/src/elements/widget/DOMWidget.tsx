import type { WidgetElement } from '@h5design/core';
import { WIDGET_REGISTRY } from './widgetModules';

interface DOMWidgetProps {
  el: WidgetElement;
  style: React.CSSProperties;
  dataAttrs?: Record<string, string>;
}

export default function DOMWidget({ el, style, dataAttrs }: DOMWidgetProps) {
  const def = WIDGET_REGISTRY[el.widget];
  if (!def) return null;
  const Comp = def.DOM;
  return <Comp el={el} style={style} dataAttrs={dataAttrs} />;
}
