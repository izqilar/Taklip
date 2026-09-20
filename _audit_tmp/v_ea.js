import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=01644d01"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=01644d01"; const useState = __vite__cjsImport3_react["useState"]; const useCallback = __vite__cjsImport3_react["useCallback"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"];
import __vite__cjsImport4_reactI18next from "/node_modules/.vite/deps/react-i18next.js?v=01644d01"; const useTranslation = __vite__cjsImport4_reactI18next["useTranslation"];
import __vite__cjsImport5_reactRouterDom from "/node_modules/.vite/deps/react-router-dom.js?v=01644d01"; const useNavigate = __vite__cjsImport5_reactRouterDom["useNavigate"];
import { toCanvas } from "/node_modules/.vite/deps/html-to-image.js?v=01644d01";
import PageList from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Panel/PageList.tsx";
import PropertyPanel from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Panel/PropertyPanel.tsx";
import ErrorBoundary from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/ErrorBoundary.tsx";
import EditorCanvas from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Canvas/EditorCanvas.tsx";
import PreviewModal from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Preview/PreviewModal.tsx";
import PublishModal from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Publish/PublishModal.tsx";
import DOMRenderer from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Preview/DOMRenderer.tsx";
import VersionHistoryModal from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/VersionHistoryModal.tsx";
import SettingsPanel from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/SettingsPanel.tsx";
import MusicManagerModal from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/MusicManagerModal.tsx";
import ComponentLibraryMenu, {
  COMPONENT_ITEM_MAP
} from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/ComponentLibraryMenu.tsx";
import { useEditorStore, useCanUndo, useCanRedo } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/store/editorStore.ts";
import { useKeyboard } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/hooks/useKeyboard.ts";
import { services } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/services.ts";
import { validateImageFile, readImageDimensions } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/utils/image.ts";
import { preloadImages, cloneAndInline, TRANSPARENT_PNG } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/utils/exportVideo.ts";
import { downloadDataUrl, downloadBlob } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/utils/download.ts";
import { sanitizeSchema } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/render/src/index.ts";
import { buildFontEmbedCSS, collectFontFamilies, createDefaultSettings, drawWatermark } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/core/src/index.ts";
const TOOLS = [
  { key: "text", icon: "T", labelKey: "editor:tool.text" },
  { key: "shape", icon: "▭", labelKey: "editor:tool.shape" },
  { key: "multimedia", icon: "🎬", labelKey: "editor:tool.multimedia" },
  { key: "component", icon: "⊞", labelKey: "editor:tool.component" },
  { key: "effect", icon: "✨", labelKey: "editor:tool.effect" }
];
const MULTIMEDIA_MENU_ITEMS = [
  { key: "image", labelKey: "editor:tool.image" },
  { key: "music", labelKey: "editor:tool.music" },
  { key: "video", labelKey: "editor:tool.video" }
];
const TEXT_PRESETS = [
  { key: "body", labelKey: "editor:textPreset.body", fontSize: 14, fontWeight: "normal" },
  { key: "smallTitle", labelKey: "editor:textPreset.smallTitle", fontSize: 18, fontWeight: "bold" },
  { key: "subTitle", labelKey: "editor:textPreset.subTitle", fontSize: 24, fontWeight: "bold" },
  { key: "title", labelKey: "editor:textPreset.title", fontSize: 32, fontWeight: "bold" },
  { key: "bigTitle", labelKey: "editor:textPreset.bigTitle", fontSize: 48, fontWeight: "bold" }
];
function ShapeMenuIcon({ type }) {
  const iconClass = "h-4 w-4 text-current";
  switch (type) {
    case "rect":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "2", width: "12", height: "12", rx: "2" }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 80,
        columnNumber: 113
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 80,
        columnNumber: 14
      }, this);
    case "line":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: /* @__PURE__ */ jsxDEV("line", { x1: "3", y1: "13", x2: "13", y2: "3" }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 82,
        columnNumber: 135
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 82,
        columnNumber: 14
      }, this);
    case "arrow":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
        /* @__PURE__ */ jsxDEV("line", { x1: "3", y1: "13", x2: "13", y2: "3" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 86,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("polyline", { points: "6,3 13,3 13,10" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 87,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 85,
        columnNumber: 9
      }, this);
    case "ellipse":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxDEV("circle", { cx: "8", cy: "8", r: "6" }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 91,
        columnNumber: 113
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 91,
        columnNumber: 14
      }, this);
    case "polygon":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round", children: /* @__PURE__ */ jsxDEV("polygon", { points: "8,2 14,13 2,13" }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 93,
        columnNumber: 136
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 93,
        columnNumber: 14
      }, this);
    case "star":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round", children: /* @__PURE__ */ jsxDEV("polygon", { points: "8,2 9.5,6 14,6.5 10.5,9.5 11.5,14 8,11.5 4.5,14 5.5,9.5 2,6.5 6.5,6" }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 95,
        columnNumber: 136
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 95,
        columnNumber: 14
      }, this);
    case "library":
      return /* @__PURE__ */ jsxDEV("svg", { className: iconClass, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round", children: [
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "2", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 99,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "9", y: "2", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 100,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "9", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 101,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("polygon", { points: "11.5,14 9,9.5 14,9.5" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 102,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 98,
        columnNumber: 9
      }, this);
    default:
      return null;
  }
}
_c = ShapeMenuIcon;
function ComponentToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("rect", { width: "18", height: "7", x: "3", y: "3", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 122,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { width: "9", height: "7", x: "3", y: "14", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 123,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { width: "5", height: "7", x: "16", y: "14", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 124,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 112,
      columnNumber: 5
    },
    this
  );
}
_c2 = ComponentToolIcon;
function ShapeToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "M19.5 7a24 24 0 0 1 0 10" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 141,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M4.5 7a24 24 0 0 0 0 10" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 142,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M7 19.5a24 24 0 0 0 10 0" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 143,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M7 4.5a24 24 0 0 1 10 0" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 144,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "17", y: "17", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 145,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "17", y: "2", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 146,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "17", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 147,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "2", width: "5", height: "5", rx: "1" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 148,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 131,
      columnNumber: 5
    },
    this
  );
}
_c3 = ShapeToolIcon;
function ImageToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 165,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "9", cy: "9", r: "2" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 166,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 167,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 155,
      columnNumber: 5
    },
    this
  );
}
_c4 = ImageToolIcon;
function TextToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "M12 4v16" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 184,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 185,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M9 20h6" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 186,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 174,
      columnNumber: 5
    },
    this
  );
}
_c5 = TextToolIcon;
function MusicToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "M9 18V5l12-2v13" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 203,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "6", cy: "18", r: "3" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 204,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "18", cy: "16", r: "3" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 205,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 193,
      columnNumber: 5
    },
    this
  );
}
_c6 = MusicToolIcon;
function EffectToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 222,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M20 2v4" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 223,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M22 4h-4" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 224,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "4", cy: "20", r: "2" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 225,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 212,
      columnNumber: 5
    },
    this
  );
}
_c7 = EffectToolIcon;
function MultimediaToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "M15 15.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997a1 1 0 0 1-1.517-.86z" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 242,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "M21 12.17V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 243,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("path", { d: "m6 21 5-5" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 244,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "9", cy: "9", r: "2" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 245,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 232,
      columnNumber: 5
    },
    this
  );
}
_c8 = MultimediaToolIcon;
function VideoToolIcon({ className = "h-5 w-5" }) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 262,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 263,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 252,
      columnNumber: 5
    },
    this
  );
}
_c9 = VideoToolIcon;
const SHAPE_MENU_ITEMS = [
  { key: "rect", labelKey: "editor:shapeMenu.rect", shortcut: "R" },
  { key: "line", labelKey: "editor:shapeMenu.line", shortcut: "L" },
  { key: "arrow", labelKey: "editor:shapeMenu.arrow", shortcut: "Shift+L" },
  { key: "ellipse", labelKey: "editor:shapeMenu.ellipse", shortcut: "O" },
  { key: "polygon", labelKey: "editor:shapeMenu.polygon" },
  { key: "star", labelKey: "editor:shapeMenu.star" },
  { key: "library", labelKey: "editor:shapeMenu.library", shortcut: "…" }
];
function UndoIcon({ className }) {
  return /* @__PURE__ */ jsxDEV("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxDEV("path", { d: "M9 14 4 9l5-5" }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 281,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 282,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
    lineNumber: 280,
    columnNumber: 5
  }, this);
}
_c0 = UndoIcon;
function RedoIcon({ className }) {
  return /* @__PURE__ */ jsxDEV("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsxDEV("path", { d: "m15 14 5-5-5-5" }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 290,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 291,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
    lineNumber: 289,
    columnNumber: 5
  }, this);
}
_c1 = RedoIcon;
export default function EditorApp({ exportOnly = false, exitPath = "/dashboard" } = {}) {
  _s();
  useKeyboard();
  const { t } = useTranslation(["common", "editor", "errors"]);
  const navigate = useNavigate();
  const title = useEditorStore((s) => s.project.title);
  const setProjectTitle = useEditorStore((s) => s.setProjectTitle);
  const project = useEditorStore((s) => s.project);
  const activePage = useEditorStore((s) => s.activePage);
  const projectId = useEditorStore((s) => s.projectId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const setSaving = useEditorStore((s) => s.setSaving);
  const setDirty = useEditorStore((s) => s.setDirty);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const setProjectSettings = useEditorStore((s) => s.setProjectSettings);
  const addElement = useEditorStore((s) => s.addElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const hostMeta = useEditorStore((s) => s.hostMeta);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [fontWatermark, setFontWatermark] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [componentMenuOpen, setComponentMenuOpen] = useState(false);
  const [multimediaMenuOpen, setMultimediaMenuOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const textMenuTimer = useRef(null);
  const shapeMenuTimer = useRef(null);
  const componentMenuTimer = useRef(null);
  const multimediaMenuTimer = useRef(null);
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const exportRef = useRef(null);
  const exportPageRef = useRef(0);
  const exportAllRef = useRef(null);
  const [exportProject, setExportProject] = useState(null);
  const fileInputRef = useRef(null);
  const lastSaveAt = useRef(0);
  const exitingRef = useRef(false);
  const saveInFlight = useRef(null);
  const notifySaveFailed = useCallback(() => {
    alert(t("errors:error.saveFailed"));
  }, [t]);
  const saveProject = useCallback(
    (snapshot = false) => {
      if (saveInFlight.current) return saveInFlight.current;
      const run = (async () => {
        setSaving(true);
        try {
          const safeSchema = sanitizeSchema(project);
          if (projectId) {
            await services.updateProject(projectId, {
              title: project.title,
              schema: safeSchema,
              snapshot
            });
          } else {
            const res = await services.createProject(project.title);
            await services.updateProject(res.id, { schema: safeSchema, snapshot });
            setProjectId(String(res.id));
          }
          setDirty(false);
          lastSaveAt.current = Date.now();
          return true;
        } catch (err) {
          console.error("Save failed:", err);
          return false;
        } finally {
          setSaving(false);
          saveInFlight.current = null;
        }
      })();
      saveInFlight.current = run;
      return run;
    },
    [projectId, project, setSaving, setDirty, setProjectId]
  );
  const saveInBackground = useCallback(() => {
    void saveProject().then((ok) => {
      if (!ok) console.error("[autosave] 草稿保存失败，改动尚未落库");
    });
  }, [saveProject]);
  const autoSaveTimer = useRef(null);
  const saveDebounce = useRef(null);
  const saveInBackgroundRef = useRef(saveInBackground);
  useEffect(() => {
    saveInBackgroundRef.current = saveInBackground;
  }, [saveInBackground]);
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (useEditorStore.getState().isDirty) saveInBackgroundRef.current();
    }, 3e4);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!isDirty) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    const sinceLast = Date.now() - lastSaveAt.current;
    const wait = sinceLast < 8e3 ? Math.max(0, 8e3 - sinceLast) : 3e3;
    saveDebounce.current = setTimeout(() => {
      if (useEditorStore.getState().isDirty) saveInBackground();
    }, wait);
    return () => {
      if (saveDebounce.current) clearTimeout(saveDebounce.current);
    };
  }, [isDirty, saveInBackground]);
  useEffect(() => {
    const onBlur = () => {
      if (useEditorStore.getState().isDirty) saveInBackground();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [saveInBackground]);
  const refreshFontLicense = useCallback(async () => {
    if (!services.getFontLicense || !projectId) {
      setFontWatermark(false);
      return;
    }
    try {
      const r = await services.getFontLicense(project, projectId);
      setFontWatermark(!!r.watermark);
    } catch {
      setFontWatermark(false);
    }
  }, [project, projectId]);
  useEffect(() => {
    if (previewOpen) void refreshFontLicense();
  }, [previewOpen, refreshFontLicense]);
  const handleBack = useCallback(async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    try {
      if (saveDebounce.current) {
        clearTimeout(saveDebounce.current);
        saveDebounce.current = null;
      }
      for (let i = 0; i < 2; i += 1) {
        if (!useEditorStore.getState().isDirty) break;
        if (!await saveProject()) {
          notifySaveFailed();
          return;
        }
      }
      navigate(exitPath);
    } finally {
      exitingRef.current = false;
    }
  }, [saveProject, navigate, notifySaveFailed, exitPath]);
  const handleExport = useCallback(
    async (opts) => {
      const { mode, format, page } = opts;
      if (exportingRef.current) return;
      exportingRef.current = true;
      setExporting(true);
      exportPageRef.current = page;
      try {
        if (services.exportImage && projectId) {
          try {
            if (isDirty) {
              const saved = await saveProject();
              if (!saved) {
                notifySaveFailed();
                return;
              }
            }
            const r = await services.exportImage({
              projectId,
              page,
              mode: mode === "all" ? "all" : "current",
              format
            });
            const suffix = mode === "all" ? "-长图" : `-${page + 1}`;
            downloadBlob(r.blob, `${project.title || "h5"}${suffix}${formatExt(format)}`);
            if (!r.licensed && r.missing?.length) {
              alert(
                `本次导出为「试用版」（含水印、分辨率已降级）。

原因：使用到未授权付费字体 ${r.missing.join(
                  "、"
                )}。
购买包含该字体的付费模板后，即可导出高清无水印版本。`
              );
            }
            return;
          } catch (err) {
            console.warn("[export] 服务端导出失败，回退本地导出：", err);
          }
        }
        let localWatermark = false;
        if (services.getFontLicense && projectId) {
          try {
            localWatermark = !!(await services.getFontLicense(project, projectId)).watermark;
          } catch {
            localWatermark = false;
          }
        }
        const width = project.width ?? 375;
        const height = project.height ?? 667;
        console.log("[export] preloadImages start");
        const imgMap = await preloadImages(project);
        console.log("[export] preloadImages done, map size", imgMap.size);
        console.log("[export] cloneAndInline start");
        const inlineProject = cloneAndInline(project, imgMap);
        console.log("[export] cloneAndInline done");
        setExportProject(inlineProject);
        await new Promise((r) => setTimeout(r, 600));
        const exportPages = (mode === "all" ? project.pages ?? [] : [project.pages?.[page]]).filter(Boolean);
        let fontEmbedCSS = "";
        try {
          fontEmbedCSS = await buildFontEmbedCSS(collectFontFamilies(exportPages));
        } catch (err) {
          console.warn("[export] 内嵌自定义字体失败，导出文字可能回退系统字体：", err);
        }
        console.log("[export] fontEmbedCSS length =", fontEmbedCSS.length);
        const backgroundColor = format === "jpeg" ? "#ffffff" : "#f0f2f5";
        if (mode === "all") {
          const node = exportAllRef.current;
          if (!node) {
            console.warn("[export] exportAllRef is null");
            return;
          }
          await Promise.all(
            Array.from(node.querySelectorAll("img")).map(
              (img) => img.decode().catch(() => void 0)
            )
          );
          const imgSrcs = Array.from(node.querySelectorAll("img")).map((img) => img.src.slice(0, 120));
          console.log("[export] DOM ready (all), images=", imgSrcs.length, imgSrcs);
          const pageCount = Math.max(1, inlineProject.pages?.length ?? 1);
          const totalH = height * pageCount;
          let pixelRatio = 2;
          if (totalH * pixelRatio > 16384) {
            pixelRatio = Math.max(1, Math.floor(16384 / totalH));
          }
          console.log("[export] toCanvas(all) start", { width, totalH, pixelRatio, format });
          const canvas = await toCanvas(node, {
            // 已预加载并内联为 dataURL，无需 cacheBust；cacheBust 可能破坏 dataURL 导致 img error。
            cacheBust: false,
            imagePlaceholder: TRANSPARENT_PNG,
            // 不走 html-to-image 自带的字体抓取（它只扫 document.styleSheets，扫不到
            // FontFace 注册的字体，且跨域拉 CSS 失败会整体 reject）；改用上面由 core 生成的
            // fontEmbedCSS —— 含 @font-face + base64 data URL，无需任何网络请求。
            skipFonts: true,
            fontEmbedCSS,
            // 与编辑器画布底色一致：半透明背景色调与编辑器完全一致，
            // 避免导出后在白色查看器/白色录制底上观感偏浅，造成「透明度丢失」的错觉。
            backgroundColor,
            // 单张图片加载失败时记录 URL 并用占位图兜底，避免整张 SVG 加载失败。
            // 注意：html-to-image 只把返回值 resolve，不会自动改写 src；必须手动把 event.target.src
            // 设为占位图，否则克隆出的 <img> 仍保留失败的 data:text/html 或空 src，导出为空白。
            onImageErrorHandler: (event) => {
              const target = event && typeof event === "object" ? event.target : void 0;
              const failedSrc = target?.src;
              console.warn("[export] image load failed, using placeholder. src=", failedSrc);
              if (target && failedSrc !== TRANSPARENT_PNG) {
                try {
                  target.src = TRANSPARENT_PNG;
                } catch {
                }
              }
              return TRANSPARENT_PNG;
            },
            pixelRatio,
            width,
            height: totalH
          });
          const dataUrl = canvasToDataUrl(canvas, format);
          console.log("[export] toCanvas(all) done, length", dataUrl.length);
          downloadDataUrl(dataUrl, `${project.title || "h5"}-长图${formatExt(format)}`);
        } else {
          const node = exportRef.current;
          if (!node) {
            console.warn("[export] exportRef is null");
            return;
          }
          await Promise.all(
            Array.from(node.querySelectorAll("img")).map(
              (img) => img.decode().catch(() => void 0)
            )
          );
          const imgSrcs = Array.from(node.querySelectorAll("img")).map((img) => img.src.slice(0, 120));
          console.log("[export] DOM ready (current), images=", imgSrcs.length, imgSrcs);
          console.log("[export] toCanvas(current) start", { width, height, format, page: page + 1 });
          const canvas = await toCanvas(node, {
            cacheBust: false,
            imagePlaceholder: TRANSPARENT_PNG,
            skipFonts: true,
            fontEmbedCSS,
            // 与编辑器画布底色一致：半透明背景色调与编辑器完全一致。
            backgroundColor,
            onImageErrorHandler: (event) => {
              const target = event && typeof event === "object" ? event.target : void 0;
              const failedSrc = target?.src;
              console.warn("[export] image load failed, using placeholder. src=", failedSrc);
              if (target && failedSrc !== TRANSPARENT_PNG) {
                try {
                  target.src = TRANSPARENT_PNG;
                } catch {
                }
              }
              return TRANSPARENT_PNG;
            },
            pixelRatio: 2,
            width,
            height
          });
          if (localWatermark) {
            const ctx = canvas.getContext("2d");
            if (ctx) drawWatermark(ctx, { width, height });
          }
          const dataUrl = canvasToDataUrl(canvas, format);
          console.log("[export] toCanvas(current) done, length", dataUrl.length);
          downloadDataUrl(dataUrl, `${project.title || "h5"}-${page + 1}${formatExt(format)}`);
        }
      } catch (err) {
        console.error("[export] Export failed:", err);
        let detail = "未知错误";
        if (err instanceof Error) detail = `${err.name}: ${err.message}`;
        else if (err && typeof err === "object" && "type" in err) detail = `Event(${err.type})`;
        else
          detail = String(err);
        alert(`${t("editor:toolbar.exportFailed")}

${detail}`);
      } finally {
        exportingRef.current = false;
        setExporting(false);
        setExportProject(null);
      }
    },
    [project, t, projectId, isDirty, saveProject, notifySaveFailed]
  );
  function canvasToDataUrl(canvas, format) {
    if (format === "jpeg") return canvas.toDataURL("image/jpeg", 0.92);
    if (format === "webp") return canvas.toDataURL("image/webp", 0.92);
    return canvas.toDataURL("image/png");
  }
  function formatExt(format) {
    if (format === "jpeg") return ".jpg";
    if (format === "webp") return ".webp";
    return ".png";
  }
  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const errKey = validateImageFile(file);
        if (errKey) {
          alert(t(errKey));
          return;
        }
        let dims = null;
        try {
          dims = await readImageDimensions(file);
        } catch {
          dims = null;
        }
        const asset = await services.uploadAsset(file, dims ?? void 0);
        const w = dims?.width || asset.width || 200;
        const h = dims?.height || asset.height || 200;
        const scale = Math.min(w > 320 ? 320 / w : 1, h > 480 ? 480 / h : 1);
        addElement("image", {
          src: asset.url,
          width: Math.round(w * scale),
          height: Math.round(h * scale),
          naturalWidth: Math.round(w),
          naturalHeight: Math.round(h)
        });
      } catch (err) {
        console.error(err);
        alert(t("errors:error.uploadFailed"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [addElement, t]
  );
  const addTextPreset = useCallback(
    (preset) => {
      const width = Math.min(300, 360 - preset.fontSize);
      const height = Math.max(40, preset.fontSize * 2.2);
      addElement("text", {
        text: t("editor:defaults.textContent"),
        fontSize: preset.fontSize,
        fontStyle: preset.fontWeight,
        width,
        height
      });
    },
    [addElement, t]
  );
  const handleToolClick = (key) => {
    switch (key) {
      case "text":
        addTextPreset(TEXT_PRESETS[0]);
        break;
      case "shape":
        addShape("rect");
        break;
      case "component":
        addComponentComponent();
        break;
      case "multimedia":
        openMultimediaMenu();
        break;
      case "effect":
        alert(t("editor:tool.comingSoon"));
        break;
    }
  };
  const openTextMenu = () => {
    if (textMenuTimer.current) clearTimeout(textMenuTimer.current);
    setTextMenuOpen(true);
  };
  const closeTextMenu = () => {
    textMenuTimer.current = setTimeout(() => {
      setTextMenuOpen(false);
    }, 150);
  };
  const openShapeMenu = () => {
    if (shapeMenuTimer.current) clearTimeout(shapeMenuTimer.current);
    setShapeMenuOpen(true);
  };
  const closeShapeMenu = () => {
    shapeMenuTimer.current = setTimeout(() => {
      setShapeMenuOpen(false);
    }, 150);
  };
  const addShape = (key) => {
    if (key === "library") {
      alert(t("editor:tool.comingSoon"));
      return;
    }
    addElement(key);
    setShapeMenuOpen(false);
  };
  const openComponentMenu = () => {
    if (componentMenuTimer.current) clearTimeout(componentMenuTimer.current);
    setComponentMenuOpen(true);
  };
  const closeComponentMenu = () => {
    componentMenuTimer.current = setTimeout(() => {
      setComponentMenuOpen(false);
    }, 150);
  };
  const openMultimediaMenu = () => {
    if (multimediaMenuTimer.current) clearTimeout(multimediaMenuTimer.current);
    setMultimediaMenuOpen(true);
  };
  const closeMultimediaMenu = () => {
    multimediaMenuTimer.current = setTimeout(() => {
      setMultimediaMenuOpen(false);
    }, 150);
  };
  const addComponentComponent = (key) => {
    if (!key) {
      return;
    }
    const item = COMPONENT_ITEM_MAP[key];
    if (!item.elementType) {
      alert(t("editor:tool.comingSoon"));
      setComponentMenuOpen(false);
      return;
    }
    addElement(item.elementType, item.preset ?? {});
    setComponentMenuOpen(false);
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "editor-canvas-wrap flex h-screen flex-col overflow-hidden bg-white text-gray-800", children: [
    /* @__PURE__ */ jsxDEV(
      "input",
      {
        ref: fileInputRef,
        type: "file",
        accept: "image/*",
        onChange: handleUpload,
        className: "hidden"
      },
      void 0,
      false,
      {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 878,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("header", { className: "flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent", children: "TAKLIP H5" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 891,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "ml-3 flex items-center gap-1 border-l border-gray-200 pl-3", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: undo,
              disabled: !canUndo,
              title: t("editor:toolbar.undo"),
              className: "flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent",
              children: /* @__PURE__ */ jsxDEV(UndoIcon, { className: "h-5 w-5" }, void 0, false, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 902,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 896,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: redo,
              disabled: !canRedo,
              title: t("editor:toolbar.redo"),
              className: "flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent",
              children: /* @__PURE__ */ jsxDEV(RedoIcon, { className: "h-5 w-5" }, void 0, false, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 910,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 904,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 895,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setVersionOpen(true),
            title: t("editor:version.title"),
            className: "flex h-8 items-center gap-1 rounded border border-gray-200 px-2 text-sm text-gray-600 transition hover:border-blue-300 hover:text-blue-600",
            children: [
              /* @__PURE__ */ jsxDEV("svg", { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsxDEV("path", { d: "M3 3v5h5" }, void 0, false, {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 920,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("path", { d: "M3.05 13A9 9 0 1 0 6 5.3L3 8" }, void 0, false, {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 921,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("path", { d: "M12 7v5l4 2" }, void 0, false, {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 922,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 919,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: t("editor:version.title") }, void 0, false, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 924,
                columnNumber: 15
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 914,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 890,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 889,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: TOOLS.map((tool) => {
        const isText = tool.key === "text";
        const isShape = tool.key === "shape";
        const isComponent = tool.key === "component";
        const isMultimedia = tool.key === "multimedia";
        return /* @__PURE__ */ jsxDEV(
          "div",
          {
            className: "relative",
            onMouseEnter: isText ? openTextMenu : isShape ? openShapeMenu : isComponent ? openComponentMenu : isMultimedia ? openMultimediaMenu : void 0,
            onMouseLeave: isText ? closeTextMenu : isShape ? closeShapeMenu : isComponent ? closeComponentMenu : isMultimedia ? closeMultimediaMenu : void 0,
            children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => handleToolClick(tool.key),
                  className: "flex flex-col items-center justify-center rounded px-5 py-1.5 text-gray-600 transition hover:bg-blue-50 hover:text-blue-600",
                  children: [
                    tool.key === "component" ? /* @__PURE__ */ jsxDEV(ComponentToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 968,
                      columnNumber: 19
                    }, this) : tool.key === "shape" ? /* @__PURE__ */ jsxDEV(ShapeToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 970,
                      columnNumber: 19
                    }, this) : tool.key === "multimedia" ? /* @__PURE__ */ jsxDEV(MultimediaToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 972,
                      columnNumber: 19
                    }, this) : tool.key === "text" ? /* @__PURE__ */ jsxDEV(TextToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 974,
                      columnNumber: 19
                    }, this) : tool.key === "effect" ? /* @__PURE__ */ jsxDEV(EffectToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 976,
                      columnNumber: 19
                    }, this) : /* @__PURE__ */ jsxDEV("span", { className: "text-lg leading-none", children: tool.icon }, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 978,
                      columnNumber: 19
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "mt-0.5 text-xs", children: t(tool.labelKey) }, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 980,
                      columnNumber: 19
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 963,
                  columnNumber: 17
                },
                this
              ),
              isText && textMenuOpen && /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg",
                  onMouseEnter: openTextMenu,
                  onMouseLeave: closeTextMenu,
                  children: TEXT_PRESETS.map(
                    (preset) => /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        onClick: () => {
                          addTextPreset(preset);
                          setTextMenuOpen(false);
                        },
                        className: "flex w-full items-center justify-center px-4 py-2.5 text-center text-gray-700 transition hover:bg-blue-50 hover:text-blue-600",
                        style: { fontSize: preset.fontSize, fontWeight: preset.fontWeight },
                        title: t(preset.labelKey),
                        children: t(preset.labelKey)
                      },
                      preset.key,
                      false,
                      {
                        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                        lineNumber: 991,
                        columnNumber: 19
                      },
                      this
                    )
                  )
                },
                void 0,
                false,
                {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 985,
                  columnNumber: 17
                },
                this
              ),
              isShape && shapeMenuOpen && /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "absolute left-1/2 top-full z-50 mt-1 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg",
                  onMouseEnter: openShapeMenu,
                  onMouseLeave: closeShapeMenu,
                  children: SHAPE_MENU_ITEMS.map(
                    (item) => /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        onClick: () => addShape(item.key),
                        className: "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-600",
                        title: t(item.labelKey),
                        children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "flex items-center gap-3", children: [
                            /* @__PURE__ */ jsxDEV(ShapeMenuIcon, { type: item.key }, void 0, false, {
                              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                              lineNumber: 1022,
                              columnNumber: 27
                            }, this),
                            /* @__PURE__ */ jsxDEV("span", { children: t(item.labelKey) }, void 0, false, {
                              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                              lineNumber: 1023,
                              columnNumber: 27
                            }, this)
                          ] }, void 0, true, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1021,
                            columnNumber: 25
                          }, this),
                          item.shortcut && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: item.shortcut }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1026,
                            columnNumber: 21
                          }, this)
                        ]
                      },
                      item.key,
                      true,
                      {
                        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                        lineNumber: 1015,
                        columnNumber: 19
                      },
                      this
                    )
                  )
                },
                void 0,
                false,
                {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 1009,
                  columnNumber: 17
                },
                this
              ),
              isComponent && /* @__PURE__ */ jsxDEV(
                ComponentLibraryMenu,
                {
                  open: componentMenuOpen,
                  onMouseEnter: openComponentMenu,
                  onMouseLeave: closeComponentMenu,
                  onSelect: (key) => addComponentComponent(key)
                },
                void 0,
                false,
                {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 1035,
                  columnNumber: 17
                },
                this
              ),
              isMultimedia && multimediaMenuOpen && /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "absolute left-1/2 top-full z-50 mt-1 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg",
                  onMouseEnter: openMultimediaMenu,
                  onMouseLeave: closeMultimediaMenu,
                  children: MULTIMEDIA_MENU_ITEMS.map(
                    (item) => /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        type: "button",
                        onClick: () => {
                          if (item.key === "image") fileInputRef.current?.click();
                          else if (item.key === "music") setMusicModalOpen(true);
                          else
                            alert(t("editor:tool.comingSoon"));
                          setMultimediaMenuOpen(false);
                        },
                        className: "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-600",
                        title: t(item.labelKey),
                        children: [
                          item.key === "image" ? /* @__PURE__ */ jsxDEV(ImageToolIcon, { className: "h-5 w-5" }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1064,
                            columnNumber: 21
                          }, this) : item.key === "music" ? /* @__PURE__ */ jsxDEV(MusicToolIcon, { className: "h-5 w-5" }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1066,
                            columnNumber: 21
                          }, this) : /* @__PURE__ */ jsxDEV(VideoToolIcon, { className: "h-5 w-5" }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1068,
                            columnNumber: 21
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: t(item.labelKey) }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1070,
                            columnNumber: 25
                          }, this)
                        ]
                      },
                      item.key,
                      true,
                      {
                        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                        lineNumber: 1051,
                        columnNumber: 19
                      },
                      this
                    )
                  )
                },
                void 0,
                false,
                {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 1045,
                  columnNumber: 17
                },
                this
              )
            ]
          },
          tool.key,
          true,
          {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 937,
            columnNumber: 15
          },
          this
        );
      }) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 930,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        hostMeta && /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 border-l border-gray-200 pl-3", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "max-w-[200px] truncate text-sm font-semibold text-gray-700", children: hostMeta.title }, void 0, false, {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1085,
            columnNumber: 15
          }, this),
          hostMeta.version != null && /* @__PURE__ */ jsxDEV("span", { className: "rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600", children: [
            "v",
            hostMeta.version
          ] }, void 0, true, {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1087,
            columnNumber: 13
          }, this),
          hostMeta.hasDraft && /* @__PURE__ */ jsxDEV("span", { className: "rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600", children: "草稿" }, void 0, false, {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1090,
            columnNumber: 13
          }, this),
          hostMeta.actions
        ] }, void 0, true, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1084,
          columnNumber: 11
        }, this),
        isDirty && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-amber-500", children: [
          "● ",
          t("common:status.unsaved")
        ] }, void 0, true, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1096,
          columnNumber: 11
        }, this),
        !isDirty && !isSaving && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: t("common:status.saved") }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1099,
          columnNumber: 11
        }, this),
        isSaving && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-blue-500", children: t("common:status.saving") }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1102,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setPublishOpen(true),
            className: "rounded bg-red-500 px-3 py-1.5 text-sm text-white transition hover:bg-red-600",
            children: exportOnly ? t("editor:toolbar.exportWork") : t("editor:toolbar.publish")
          },
          void 0,
          false,
          {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1104,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleBack,
            className: "rounded bg-gray-500 px-3 py-1.5 text-sm text-white transition hover:bg-gray-600",
            children: t("editor:toolbar.exitEdit")
          },
          void 0,
          false,
          {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1110,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1081,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 887,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ jsxDEV(PageList, {}, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1121,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("main", { className: "min-w-0 flex-1 overflow-auto bg-[#f0f2f5]", children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { name: "画布", children: /* @__PURE__ */ jsxDEV(
        EditorCanvas,
        {
          onPreview: () => setPreviewOpen(true),
          onSettings: () => setSettingsOpen(true),
          onSave: async () => {
            const saved = await saveProject(true);
            if (!saved) notifySaveFailed();
          },
          isSaving
        },
        void 0,
        false,
        {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1124,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1123,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1122,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(ErrorBoundary, { name: "属性面板", children: /* @__PURE__ */ jsxDEV(PropertyPanel, {}, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1137,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1136,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 1120,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(PreviewModal, { open: previewOpen, onClose: () => setPreviewOpen(false), project }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 1142,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      PublishModal,
      {
        open: publishOpen,
        onClose: () => setPublishOpen(false),
        projectId,
        project,
        currentPage: activePage,
        onExport: handleExport,
        exportOnly
      },
      void 0,
      false,
      {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1143,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      VersionHistoryModal,
      {
        open: versionOpen,
        onClose: () => setVersionOpen(false),
        projectId
      },
      void 0,
      false,
      {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1152,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      SettingsPanel,
      {
        open: settingsOpen,
        onClose: () => setSettingsOpen(false),
        project,
        onSave: ({ title: newTitle, settings: newSettings }) => {
          if (newTitle !== project.title) setProjectTitle(newTitle);
          setProjectSettings(newSettings);
        }
      },
      void 0,
      false,
      {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1157,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      MusicManagerModal,
      {
        open: musicModalOpen,
        current: project.settings?.backgroundMusic,
        onClose: () => setMusicModalOpen(false),
        onSave: (music) => {
          setProjectSettings({
            ...createDefaultSettings(),
            ...project.settings ?? {},
            backgroundMusic: music
          });
          setMusicModalOpen(false);
        }
      },
      void 0,
      false,
      {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1167,
        columnNumber: 7
      },
      this
    ),
    exporting && exportProject && /* @__PURE__ */ jsxDEV(Fragment, { children: [
      /* @__PURE__ */ jsxDEV(
        "div",
        {
          "aria-hidden": true,
          style: {
            position: "fixed",
            left: -1e4,
            top: 0,
            width: exportProject.width ?? 375,
            height: exportProject.height ?? 667,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1
            // 不强制背景色：DOMRenderer 的 AnimatedPage 会根据 page.background 渲染，
            // 包括半透明背景；若 page.background 为空，AnimatedPage 已默认纯白兜底。
          },
          children: /* @__PURE__ */ jsxDEV(
            "div",
            {
              ref: exportRef,
              style: { width: exportProject.width ?? 375, height: exportProject.height ?? 667, overflow: "hidden" },
              children: /* @__PURE__ */ jsxDEV(DOMRenderer, { project: exportProject, currentPage: exportPageRef.current, scale: 1, animated: false }, void 0, false, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 1205,
                columnNumber: 15
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 1201,
              columnNumber: 13
            },
            this
          )
        },
        void 0,
        false,
        {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1185,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "div",
        {
          "aria-hidden": true,
          style: {
            position: "fixed",
            left: -1e4,
            top: 0,
            width: exportProject.width ?? 375,
            height: (exportProject.height ?? 667) * Math.max(1, exportProject.pages?.length ?? 1),
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1
          },
          children: /* @__PURE__ */ jsxDEV(
            "div",
            {
              ref: exportAllRef,
              style: {
                width: exportProject.width ?? 375,
                height: (exportProject.height ?? 667) * Math.max(1, exportProject.pages?.length ?? 1),
                overflow: "hidden"
              },
              children: exportProject.pages?.map(
                (_, i) => /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    style: { width: exportProject.width ?? 375, height: exportProject.height ?? 667, overflow: "hidden" },
                    children: /* @__PURE__ */ jsxDEV(DOMRenderer, { project: exportProject, currentPage: i, scale: 1, animated: false }, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 1236,
                      columnNumber: 19
                    }, this)
                  },
                  i,
                  false,
                  {
                    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                    lineNumber: 1232,
                    columnNumber: 13
                  },
                  this
                )
              )
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 1223,
              columnNumber: 13
            },
            this
          )
        },
        void 0,
        false,
        {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1209,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 1183,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
    lineNumber: 877,
    columnNumber: 5
  }, this);
}
_s(EditorApp, "veC1W5VrlQ72iLuRpOJbK8myqo8=", false, function() {
  return [useKeyboard, useTranslation, useNavigate, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useEditorStore, useCanUndo, useCanRedo, useEditorStore];
});
_c10 = EditorApp;
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1, _c10;
$RefreshReg$(_c, "ShapeMenuIcon");
$RefreshReg$(_c2, "ComponentToolIcon");
$RefreshReg$(_c3, "ShapeToolIcon");
$RefreshReg$(_c4, "ImageToolIcon");
$RefreshReg$(_c5, "TextToolIcon");
$RefreshReg$(_c6, "MusicToolIcon");
$RefreshReg$(_c7, "EffectToolIcon");
$RefreshReg$(_c8, "MultimediaToolIcon");
$RefreshReg$(_c9, "VideoToolIcon");
$RefreshReg$(_c0, "UndoIcon");
$RefreshReg$(_c1, "RedoIcon");
$RefreshReg$(_c10, "EditorApp");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QSxnQkFDTkEsZ0JBQ0FBLGdCQUNHQyxZQUNBQyxZQUNDRixjQUFjO0FBQUE7QUFBQSxPQXJCVG9EO0FBQVMsSUFBQXhCLElBQUFHLEtBQUFFLEtBQUFFLEtBQUFFLEtBQUFFLEtBQUFFLEtBQUFFLEtBQUFFLEtBQUFJLEtBQUFFLEtBQUErTjtBQUFBLGFBQUF0UCxJQUFBO0FBQUEsYUFBQUcsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBRSxLQUFBO0FBQUEsYUFBQUUsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBRSxLQUFBO0FBQUEsYUFBQUUsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBSSxLQUFBO0FBQUEsYUFBQUUsS0FBQTtBQUFBLGFBQUErTixNQUFBIiwibmFtZXMiOlsidXNlU3RhdGUiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZVRyYW5zbGF0aW9uIiwidXNlTmF2aWdhdGUiLCJ0b0NhbnZhcyIsIlBhZ2VMaXN0IiwiUHJvcGVydHlQYW5lbCIsIkVycm9yQm91bmRhcnkiLCJFZGl0b3JDYW52YXMiLCJQcmV2aWV3TW9kYWwiLCJQdWJsaXNoTW9kYWwiLCJET01SZW5kZXJlciIsIlZlcnNpb25IaXN0b3J5TW9kYWwiLCJTZXR0aW5nc1BhbmVsIiwiTXVzaWNNYW5hZ2VyTW9kYWwiLCJDb21wb25lbnRMaWJyYXJ5TWVudSIsIkNPTVBPTkVOVF9JVEVNX01BUCIsInVzZUVkaXRvclN0b3JlIiwidXNlQ2FuVW5kbyIsInVzZUNhblJlZG8iLCJ1c2VLZXlib2FyZCIsInNlcnZpY2VzIiwidmFsaWRhdGVJbWFnZUZpbGUiLCJyZWFkSW1hZ2VEaW1lbnNpb25zIiwicHJlbG9hZEltYWdlcyIsImNsb25lQW5kSW5saW5lIiwiVFJBTlNQQVJFTlRfUE5HIiwiZG93bmxvYWREYXRhVXJsIiwiZG93bmxvYWRCbG9iIiwic2FuaXRpemVTY2hlbWEiLCJidWlsZEZvbnRFbWJlZENTUyIsImNvbGxlY3RGb250RmFtaWxpZXMiLCJjcmVhdGVEZWZhdWx0U2V0dGluZ3MiLCJkcmF3V2F0ZXJtYXJrIiwiVE9PTFMiLCJrZXkiLCJpY29uIiwibGFiZWxLZXkiLCJNVUxUSU1FRElBX01FTlVfSVRFTVMiLCJURVhUX1BSRVNFVFMiLCJmb250U2l6ZSIsImZvbnRXZWlnaHQiLCJTaGFwZU1lbnVJY29uIiwidHlwZSIsImljb25DbGFzcyIsIl9jIiwiQ29tcG9uZW50VG9vbEljb24iLCJjbGFzc05hbWUiLCJfYzIiLCJTaGFwZVRvb2xJY29uIiwiX2MzIiwiSW1hZ2VUb29sSWNvbiIsIl9jNCIsIlRleHRUb29sSWNvbiIsIl9jNSIsIk11c2ljVG9vbEljb24iLCJfYzYiLCJFZmZlY3RUb29sSWNvbiIsIl9jNyIsIk11bHRpbWVkaWFUb29sSWNvbiIsIl9jOCIsIlZpZGVvVG9vbEljb24iLCJfYzkiLCJTSEFQRV9NRU5VX0lURU1TIiwic2hvcnRjdXQiLCJVbmRvSWNvbiIsIl9jMCIsIlJlZG9JY29uIiwiX2MxIiwiRWRpdG9yQXBwIiwiZXhwb3J0T25seSIsImV4aXRQYXRoIiwiX3MiLCJ0IiwibmF2aWdhdGUiLCJ0aXRsZSIsInMiLCJwcm9qZWN0Iiwic2V0UHJvamVjdFRpdGxlIiwiYWN0aXZlUGFnZSIsInByb2plY3RJZCIsImlzRGlydHkiLCJpc1NhdmluZyIsInNldFNhdmluZyIsInNldERpcnR5Iiwic2V0UHJvamVjdElkIiwic2V0UHJvamVjdFNldHRpbmdzIiwiYWRkRWxlbWVudCIsInVuZG8iLCJyZWRvIiwiY2FuVW5kbyIsImNhblJlZG8iLCJob3N0TWV0YSIsInByZXZpZXdPcGVuIiwic2V0UHJldmlld09wZW4iLCJwdWJsaXNoT3BlbiIsInNldFB1Ymxpc2hPcGVuIiwiZm9udFdhdGVybWFyayIsInNldEZvbnRXYXRlcm1hcmsiLCJ2ZXJzaW9uT3BlbiIsInNldFZlcnNpb25PcGVuIiwic2V0dGluZ3NPcGVuIiwic2V0U2V0dGluZ3NPcGVuIiwidGV4dE1lbnVPcGVuIiwic2V0VGV4dE1lbnVPcGVuIiwic2hhcGVNZW51T3BlbiIsInNldFNoYXBlTWVudU9wZW4iLCJjb21wb25lbnRNZW51T3BlbiIsInNldENvbXBvbmVudE1lbnVPcGVuIiwibXVsdGltZWRpYU1lbnVPcGVuIiwic2V0TXVsdGltZWRpYU1lbnVPcGVuIiwibXVzaWNNb2RhbE9wZW4iLCJzZXRNdXNpY01vZGFsT3BlbiIsInRleHRNZW51VGltZXIiLCJzaGFwZU1lbnVUaW1lciIsImNvbXBvbmVudE1lbnVUaW1lciIsIm11bHRpbWVkaWFNZW51VGltZXIiLCJleHBvcnRpbmciLCJzZXRFeHBvcnRpbmciLCJleHBvcnRpbmdSZWYiLCJleHBvcnRSZWYiLCJleHBvcnRQYWdlUmVmIiwiZXhwb3J0QWxsUmVmIiwiZXhwb3J0UHJvamVjdCIsInNldEV4cG9ydFByb2plY3QiLCJmaWxlSW5wdXRSZWYiLCJsYXN0U2F2ZUF0IiwiZXhpdGluZ1JlZiIsInNhdmVJbkZsaWdodCIsIm5vdGlmeVNhdmVGYWlsZWQiLCJhbGVydCIsInNhdmVQcm9qZWN0Iiwic25hcHNob3QiLCJjdXJyZW50IiwicnVuIiwic2FmZVNjaGVtYSIsInVwZGF0ZVByb2plY3QiLCJzY2hlbWEiLCJyZXMiLCJjcmVhdGVQcm9qZWN0IiwiaWQiLCJTdHJpbmciLCJEYXRlIiwibm93IiwiZXJyIiwiY29uc29sZSIsImVycm9yIiwic2F2ZUluQmFja2dyb3VuZCIsInRoZW4iLCJvayIsImF1dG9TYXZlVGltZXIiLCJzYXZlRGVib3VuY2UiLCJzYXZlSW5CYWNrZ3JvdW5kUmVmIiwic2V0SW50ZXJ2YWwiLCJnZXRTdGF0ZSIsImNsZWFySW50ZXJ2YWwiLCJjbGVhclRpbWVvdXQiLCJzaW5jZUxhc3QiLCJ3YWl0IiwiTWF0aCIsIm1heCIsInNldFRpbWVvdXQiLCJvbkJsdXIiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInJlZnJlc2hGb250TGljZW5zZSIsImdldEZvbnRMaWNlbnNlIiwiciIsIndhdGVybWFyayIsImhhbmRsZUJhY2siLCJpIiwiaGFuZGxlRXhwb3J0Iiwib3B0cyIsIm1vZGUiLCJmb3JtYXQiLCJwYWdlIiwiZXhwb3J0SW1hZ2UiLCJzYXZlZCIsInN1ZmZpeCIsImJsb2IiLCJmb3JtYXRFeHQiLCJsaWNlbnNlZCIsIm1pc3NpbmciLCJsZW5ndGgiLCJqb2luIiwid2FybiIsImxvY2FsV2F0ZXJtYXJrIiwid2lkdGgiLCJoZWlnaHQiLCJsb2ciLCJpbWdNYXAiLCJzaXplIiwiaW5saW5lUHJvamVjdCIsIlByb21pc2UiLCJleHBvcnRQYWdlcyIsInBhZ2VzIiwiZmlsdGVyIiwiQm9vbGVhbiIsImZvbnRFbWJlZENTUyIsImJhY2tncm91bmRDb2xvciIsIm5vZGUiLCJhbGwiLCJBcnJheSIsImZyb20iLCJxdWVyeVNlbGVjdG9yQWxsIiwibWFwIiwiaW1nIiwiZGVjb2RlIiwiY2F0Y2giLCJ1bmRlZmluZWQiLCJpbWdTcmNzIiwic3JjIiwic2xpY2UiLCJwYWdlQ291bnQiLCJ0b3RhbEgiLCJwaXhlbFJhdGlvIiwiZmxvb3IiLCJjYW52YXMiLCJjYWNoZUJ1c3QiLCJpbWFnZVBsYWNlaG9sZGVyIiwic2tpcEZvbnRzIiwib25JbWFnZUVycm9ySGFuZGxlciIsImV2ZW50IiwidGFyZ2V0IiwiZmFpbGVkU3JjIiwiZGF0YVVybCIsImNhbnZhc1RvRGF0YVVybCIsImN0eCIsImdldENvbnRleHQiLCJkZXRhaWwiLCJFcnJvciIsIm5hbWUiLCJtZXNzYWdlIiwidG9EYXRhVVJMIiwiaGFuZGxlVXBsb2FkIiwiZSIsImZpbGUiLCJmaWxlcyIsImVycktleSIsImRpbXMiLCJhc3NldCIsInVwbG9hZEFzc2V0IiwidyIsImgiLCJzY2FsZSIsIm1pbiIsInVybCIsInJvdW5kIiwibmF0dXJhbFdpZHRoIiwibmF0dXJhbEhlaWdodCIsInZhbHVlIiwiYWRkVGV4dFByZXNldCIsInByZXNldCIsInRleHQiLCJmb250U3R5bGUiLCJoYW5kbGVUb29sQ2xpY2siLCJhZGRTaGFwZSIsImFkZENvbXBvbmVudENvbXBvbmVudCIsIm9wZW5NdWx0aW1lZGlhTWVudSIsIm9wZW5UZXh0TWVudSIsImNsb3NlVGV4dE1lbnUiLCJvcGVuU2hhcGVNZW51IiwiY2xvc2VTaGFwZU1lbnUiLCJvcGVuQ29tcG9uZW50TWVudSIsImNsb3NlQ29tcG9uZW50TWVudSIsImNsb3NlTXVsdGltZWRpYU1lbnUiLCJpdGVtIiwiZWxlbWVudFR5cGUiLCJ0b29sIiwiaXNUZXh0IiwiaXNTaGFwZSIsImlzQ29tcG9uZW50IiwiaXNNdWx0aW1lZGlhIiwiY2xpY2siLCJ2ZXJzaW9uIiwiaGFzRHJhZnQiLCJhY3Rpb25zIiwibmV3VGl0bGUiLCJzZXR0aW5ncyIsIm5ld1NldHRpbmdzIiwiYmFja2dyb3VuZE11c2ljIiwibXVzaWMiLCJwb3NpdGlvbiIsImxlZnQiLCJ0b3AiLCJvdmVyZmxvdyIsIm9wYWNpdHkiLCJwb2ludGVyRXZlbnRzIiwiekluZGV4IiwiXyIsIl9jMTAiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRWRpdG9yQXBwLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe8lui+keWZqOS4u+e7hOS7tiDigJQg5YWr5Zu+IEg1IOe8lui+keWZqOmjjuagvFxuICog6aG26YOo5Yqf6IO95Yy6ICsg5bem5L6n6aG16Z2iL+WbvuWxgumdouadvyArIOS4remXtOeUu+W4gyArIOWPs+S+p+WxnuaAp+mdouadv1xuICovXG5pbXBvcnQgeyB1c2VTdGF0ZSwgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlUmVmIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgdXNlVHJhbnNsYXRpb24gfSBmcm9tICdyZWFjdC1pMThuZXh0JztcbmltcG9ydCB7IHVzZU5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyB0b0NhbnZhcyB9IGZyb20gJ2h0bWwtdG8taW1hZ2UnO1xuaW1wb3J0IFBhZ2VMaXN0IGZyb20gJy4uL1BhbmVsL1BhZ2VMaXN0JztcbmltcG9ydCBQcm9wZXJ0eVBhbmVsIGZyb20gJy4uL1BhbmVsL1Byb3BlcnR5UGFuZWwnO1xuaW1wb3J0IEVycm9yQm91bmRhcnkgZnJvbSAnLi4vRXJyb3JCb3VuZGFyeSc7XG5pbXBvcnQgRWRpdG9yQ2FudmFzIGZyb20gJy4uL0NhbnZhcy9FZGl0b3JDYW52YXMnO1xuaW1wb3J0IFByZXZpZXdNb2RhbCBmcm9tICcuLi9QcmV2aWV3L1ByZXZpZXdNb2RhbCc7XG5pbXBvcnQgUHVibGlzaE1vZGFsIGZyb20gJy4uL1B1Ymxpc2gvUHVibGlzaE1vZGFsJztcbmltcG9ydCB0eXBlIHsgSW1hZ2VFeHBvcnRPcHRpb25zLCBJbWFnZUZvcm1hdCB9IGZyb20gJy4uL1B1Ymxpc2gvUHVibGlzaE1vZGFsJztcbmltcG9ydCBET01SZW5kZXJlciBmcm9tICcuLi9QcmV2aWV3L0RPTVJlbmRlcmVyJztcbmltcG9ydCBWZXJzaW9uSGlzdG9yeU1vZGFsIGZyb20gJy4vVmVyc2lvbkhpc3RvcnlNb2RhbCc7XG5pbXBvcnQgU2V0dGluZ3NQYW5lbCBmcm9tICcuL1NldHRpbmdzUGFuZWwnO1xuaW1wb3J0IE11c2ljTWFuYWdlck1vZGFsIGZyb20gJy4vTXVzaWNNYW5hZ2VyTW9kYWwnO1xuaW1wb3J0IENvbXBvbmVudExpYnJhcnlNZW51LCB7XG4gIENPTVBPTkVOVF9JVEVNX01BUCxcbiAgdHlwZSBDb21wb25lbnRJdGVtS2V5LFxufSBmcm9tICcuL0NvbXBvbmVudExpYnJhcnlNZW51JztcbmltcG9ydCB7IHVzZUVkaXRvclN0b3JlLCB1c2VDYW5VbmRvLCB1c2VDYW5SZWRvIH0gZnJvbSAnLi4vLi4vc3RvcmUvZWRpdG9yU3RvcmUnO1xuaW1wb3J0IHsgdXNlS2V5Ym9hcmQgfSBmcm9tICcuLi8uLi9ob29rcy91c2VLZXlib2FyZCc7XG5pbXBvcnQgeyBzZXJ2aWNlcyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzJztcbmltcG9ydCB7IHZhbGlkYXRlSW1hZ2VGaWxlLCByZWFkSW1hZ2VEaW1lbnNpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW1hZ2UnO1xuaW1wb3J0IHsgcHJlbG9hZEltYWdlcywgY2xvbmVBbmRJbmxpbmUsIFRSQU5TUEFSRU5UX1BORyB9IGZyb20gJy4uLy4uL3V0aWxzL2V4cG9ydFZpZGVvJztcbmltcG9ydCB7IGRvd25sb2FkRGF0YVVybCwgZG93bmxvYWRCbG9iIH0gZnJvbSAnLi4vLi4vdXRpbHMvZG93bmxvYWQnO1xuaW1wb3J0IHR5cGUgeyBFbGVtZW50LCBFbGVtZW50VHlwZSwgUHJvamVjdCB9IGZyb20gJ0BoNWRlc2lnbi9jb3JlJztcbmltcG9ydCB7IHNhbml0aXplU2NoZW1hIH0gZnJvbSAnQGg1ZGVzaWduL3JlbmRlcic7XG5pbXBvcnQgeyBidWlsZEZvbnRFbWJlZENTUywgY29sbGVjdEZvbnRGYW1pbGllcywgY3JlYXRlRGVmYXVsdFNldHRpbmdzLCBkcmF3V2F0ZXJtYXJrIH0gZnJvbSAnQGg1ZGVzaWduL2NvcmUnO1xuXG5jb25zdCBUT09MUyA9IFtcbiAgeyBrZXk6ICd0ZXh0JywgaWNvbjogJ1QnLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLnRleHQnIH0sXG4gIHsga2V5OiAnc2hhcGUnLCBpY29uOiAn4patJywgbGFiZWxLZXk6ICdlZGl0b3I6dG9vbC5zaGFwZScgfSxcbiAgeyBrZXk6ICdtdWx0aW1lZGlhJywgaWNvbjogJ/CfjqwnLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLm11bHRpbWVkaWEnIH0sXG4gIHsga2V5OiAnY29tcG9uZW50JywgaWNvbjogJ+KKnicsIGxhYmVsS2V5OiAnZWRpdG9yOnRvb2wuY29tcG9uZW50JyB9LFxuICB7IGtleTogJ2VmZmVjdCcsIGljb246ICfinKgnLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLmVmZmVjdCcgfSxcbl0gYXMgY29uc3Q7XG5cbi8qKiDlpJrlqpLkvZPkuIvmi4npobnvvJrlm77niYcgLyDpn7PkuZAgLyDop4bpopHvvIjlm77moIfmsr/nlKjpobbpg6jlt6XlhbfmoI/lr7nlupTnmoQgSW1hZ2VUb29sSWNvbiAvIE11c2ljVG9vbEljb24gLyBWaWRlb1Rvb2xJY29u77yJ44CCICovXG5jb25zdCBNVUxUSU1FRElBX01FTlVfSVRFTVM6IHsga2V5OiAnaW1hZ2UnIHwgJ211c2ljJyB8ICd2aWRlbyc7IGxhYmVsS2V5OiBzdHJpbmcgfVtdID0gW1xuICB7IGtleTogJ2ltYWdlJywgbGFiZWxLZXk6ICdlZGl0b3I6dG9vbC5pbWFnZScgfSxcbiAgeyBrZXk6ICdtdXNpYycsIGxhYmVsS2V5OiAnZWRpdG9yOnRvb2wubXVzaWMnIH0sXG4gIHsga2V5OiAndmlkZW8nLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLnZpZGVvJyB9LFxuXTtcblxuY29uc3QgVEVYVF9QUkVTRVRTID0gW1xuICB7IGtleTogJ2JvZHknLCBsYWJlbEtleTogJ2VkaXRvcjp0ZXh0UHJlc2V0LmJvZHknLCBmb250U2l6ZTogMTQsIGZvbnRXZWlnaHQ6ICdub3JtYWwnIGFzIGNvbnN0IH0sXG4gIHsga2V5OiAnc21hbGxUaXRsZScsIGxhYmVsS2V5OiAnZWRpdG9yOnRleHRQcmVzZXQuc21hbGxUaXRsZScsIGZvbnRTaXplOiAxOCwgZm9udFdlaWdodDogJ2JvbGQnIGFzIGNvbnN0IH0sXG4gIHsga2V5OiAnc3ViVGl0bGUnLCBsYWJlbEtleTogJ2VkaXRvcjp0ZXh0UHJlc2V0LnN1YlRpdGxlJywgZm9udFNpemU6IDI0LCBmb250V2VpZ2h0OiAnYm9sZCcgYXMgY29uc3QgfSxcbiAgeyBrZXk6ICd0aXRsZScsIGxhYmVsS2V5OiAnZWRpdG9yOnRleHRQcmVzZXQudGl0bGUnLCBmb250U2l6ZTogMzIsIGZvbnRXZWlnaHQ6ICdib2xkJyBhcyBjb25zdCB9LFxuICB7IGtleTogJ2JpZ1RpdGxlJywgbGFiZWxLZXk6ICdlZGl0b3I6dGV4dFByZXNldC5iaWdUaXRsZScsIGZvbnRTaXplOiA0OCwgZm9udFdlaWdodDogJ2JvbGQnIGFzIGNvbnN0IH0sXG5dO1xuXG5mdW5jdGlvbiBTaGFwZU1lbnVJY29uKHsgdHlwZSB9OiB7IHR5cGU6IHN0cmluZyB9KSB7XG4gIGNvbnN0IGljb25DbGFzcyA9ICdoLTQgdy00IHRleHQtY3VycmVudCc7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3JlY3QnOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCI+PHJlY3QgeD1cIjJcIiB5PVwiMlwiIHdpZHRoPVwiMTJcIiBoZWlnaHQ9XCIxMlwiIHJ4PVwiMlwiIC8+PC9zdmc+O1xuICAgIGNhc2UgJ2xpbmUnOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCI+PGxpbmUgeDE9XCIzXCIgeTE9XCIxM1wiIHgyPVwiMTNcIiB5Mj1cIjNcIiAvPjwvc3ZnPjtcbiAgICBjYXNlICdhcnJvdyc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8c3ZnIGNsYXNzTmFtZT17aWNvbkNsYXNzfSB2aWV3Qm94PVwiMCAwIDE2IDE2XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2VXaWR0aD1cIjEuNVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIj5cbiAgICAgICAgICA8bGluZSB4MT1cIjNcIiB5MT1cIjEzXCIgeDI9XCIxM1wiIHkyPVwiM1wiIC8+XG4gICAgICAgICAgPHBvbHlsaW5lIHBvaW50cz1cIjYsMyAxMywzIDEzLDEwXCIgLz5cbiAgICAgICAgPC9zdmc+XG4gICAgICApO1xuICAgIGNhc2UgJ2VsbGlwc2UnOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCI+PGNpcmNsZSBjeD1cIjhcIiBjeT1cIjhcIiByPVwiNlwiIC8+PC9zdmc+O1xuICAgIGNhc2UgJ3BvbHlnb24nOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiPjxwb2x5Z29uIHBvaW50cz1cIjgsMiAxNCwxMyAyLDEzXCIgLz48L3N2Zz47XG4gICAgY2FzZSAnc3Rhcic6XG4gICAgICByZXR1cm4gPHN2ZyBjbGFzc05hbWU9e2ljb25DbGFzc30gdmlld0JveD1cIjAgMCAxNiAxNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIxLjVcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCI+PHBvbHlnb24gcG9pbnRzPVwiOCwyIDkuNSw2IDE0LDYuNSAxMC41LDkuNSAxMS41LDE0IDgsMTEuNSA0LjUsMTQgNS41LDkuNSAyLDYuNSA2LjUsNlwiIC8+PC9zdmc+O1xuICAgIGNhc2UgJ2xpYnJhcnknOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPHN2ZyBjbGFzc05hbWU9e2ljb25DbGFzc30gdmlld0JveD1cIjAgMCAxNiAxNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIxLjVcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCI+XG4gICAgICAgICAgPHJlY3QgeD1cIjJcIiB5PVwiMlwiIHdpZHRoPVwiNVwiIGhlaWdodD1cIjVcIiByeD1cIjFcIiAvPlxuICAgICAgICAgIDxyZWN0IHg9XCI5XCIgeT1cIjJcIiB3aWR0aD1cIjVcIiBoZWlnaHQ9XCI1XCIgcng9XCIxXCIgLz5cbiAgICAgICAgICA8cmVjdCB4PVwiMlwiIHk9XCI5XCIgd2lkdGg9XCI1XCIgaGVpZ2h0PVwiNVwiIHJ4PVwiMVwiIC8+XG4gICAgICAgICAgPHBvbHlnb24gcG9pbnRzPVwiMTEuNSwxNCA5LDkuNSAxNCw5LjVcIiAvPlxuICAgICAgICA8L3N2Zz5cbiAgICAgICk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIENvbXBvbmVudFRvb2xJY29uKHsgY2xhc3NOYW1lID0gJ2gtNSB3LTUnIH06IHsgY2xhc3NOYW1lPzogc3RyaW5nIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8c3ZnXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgIHN0cm9rZVdpZHRoPXsyfVxuICAgICAgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCJcbiAgICAgIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIlxuICAgICAgY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgPlxuICAgICAgPHJlY3Qgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjdcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIxXCIgLz5cbiAgICAgIDxyZWN0IHdpZHRoPVwiOVwiIGhlaWdodD1cIjdcIiB4PVwiM1wiIHk9XCIxNFwiIHJ4PVwiMVwiIC8+XG4gICAgICA8cmVjdCB3aWR0aD1cIjVcIiBoZWlnaHQ9XCI3XCIgeD1cIjE2XCIgeT1cIjE0XCIgcng9XCIxXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gU2hhcGVUb29sSWNvbih7IGNsYXNzTmFtZSA9ICdoLTUgdy01JyB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICBzdHJva2VXaWR0aD17Mn1cbiAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICBzdHJva2VMaW5lam9pbj1cInJvdW5kXCJcbiAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgID5cbiAgICAgIDxwYXRoIGQ9XCJNMTkuNSA3YTI0IDI0IDAgMCAxIDAgMTBcIiAvPlxuICAgICAgPHBhdGggZD1cIk00LjUgN2EyNCAyNCAwIDAgMCAwIDEwXCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNNyAxOS41YTI0IDI0IDAgMCAwIDEwIDBcIiAvPlxuICAgICAgPHBhdGggZD1cIk03IDQuNWEyNCAyNCAwIDAgMSAxMCAwXCIgLz5cbiAgICAgIDxyZWN0IHg9XCIxN1wiIHk9XCIxN1wiIHdpZHRoPVwiNVwiIGhlaWdodD1cIjVcIiByeD1cIjFcIiAvPlxuICAgICAgPHJlY3QgeD1cIjE3XCIgeT1cIjJcIiB3aWR0aD1cIjVcIiBoZWlnaHQ9XCI1XCIgcng9XCIxXCIgLz5cbiAgICAgIDxyZWN0IHg9XCIyXCIgeT1cIjE3XCIgd2lkdGg9XCI1XCIgaGVpZ2h0PVwiNVwiIHJ4PVwiMVwiIC8+XG4gICAgICA8cmVjdCB4PVwiMlwiIHk9XCIyXCIgd2lkdGg9XCI1XCIgaGVpZ2h0PVwiNVwiIHJ4PVwiMVwiIC8+XG4gICAgPC9zdmc+XG4gICk7XG59XG5cbmZ1bmN0aW9uIEltYWdlVG9vbEljb24oeyBjbGFzc05hbWUgPSAnaC01IHctNScgfTogeyBjbGFzc05hbWU/OiBzdHJpbmcgfSkge1xuICByZXR1cm4gKFxuICAgIDxzdmdcbiAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICBmaWxsPVwibm9uZVwiXG4gICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgc3Ryb2tlV2lkdGg9ezJ9XG4gICAgICBzdHJva2VMaW5lY2FwPVwicm91bmRcIlxuICAgICAgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiXG4gICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICA+XG4gICAgICA8cmVjdCB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIyXCIgcnk9XCIyXCIgLz5cbiAgICAgIDxjaXJjbGUgY3g9XCI5XCIgY3k9XCI5XCIgcj1cIjJcIiAvPlxuICAgICAgPHBhdGggZD1cIm0yMSAxNS0zLjA4Ni0zLjA4NmEyIDIgMCAwIDAtMi44MjggMEw2IDIxXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gVGV4dFRvb2xJY29uKHsgY2xhc3NOYW1lID0gJ2gtNSB3LTUnIH06IHsgY2xhc3NOYW1lPzogc3RyaW5nIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8c3ZnXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgIHN0cm9rZVdpZHRoPXsyfVxuICAgICAgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCJcbiAgICAgIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIlxuICAgICAgY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgPlxuICAgICAgPHBhdGggZD1cIk0xMiA0djE2XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNNCA3VjVhMSAxIDAgMCAxIDEtMWgxNGExIDEgMCAwIDEgMSAxdjJcIiAvPlxuICAgICAgPHBhdGggZD1cIk05IDIwaDZcIiAvPlxuICAgIDwvc3ZnPlxuICApO1xufVxuXG5mdW5jdGlvbiBNdXNpY1Rvb2xJY29uKHsgY2xhc3NOYW1lID0gJ2gtNSB3LTUnIH06IHsgY2xhc3NOYW1lPzogc3RyaW5nIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8c3ZnXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgIHN0cm9rZVdpZHRoPXsyfVxuICAgICAgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCJcbiAgICAgIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIlxuICAgICAgY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgPlxuICAgICAgPHBhdGggZD1cIk05IDE4VjVsMTItMnYxM1wiIC8+XG4gICAgICA8Y2lyY2xlIGN4PVwiNlwiIGN5PVwiMThcIiByPVwiM1wiIC8+XG4gICAgICA8Y2lyY2xlIGN4PVwiMThcIiBjeT1cIjE2XCIgcj1cIjNcIiAvPlxuICAgIDwvc3ZnPlxuICApO1xufVxuXG5mdW5jdGlvbiBFZmZlY3RUb29sSWNvbih7IGNsYXNzTmFtZSA9ICdoLTUgdy01JyB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICBzdHJva2VXaWR0aD17Mn1cbiAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICBzdHJva2VMaW5lam9pbj1cInJvdW5kXCJcbiAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgID5cbiAgICAgIDxwYXRoIGQ9XCJNMTEuMDE3IDIuODE0YTEgMSAwIDAgMSAxLjk2NiAwbDEuMDUxIDUuNTU4YTIgMiAwIDAgMCAxLjU5NCAxLjU5NGw1LjU1OCAxLjA1MWExIDEgMCAwIDEgMCAxLjk2NmwtNS41NTggMS4wNTFhMiAyIDAgMCAwLTEuNTk0IDEuNTk0bC0xLjA1MSA1LjU1OGExIDEgMCAwIDEtMS45NjYgMGwtMS4wNTEtNS41NThhMiAyIDAgMCAwLTEuNTk0LTEuNTk0bC01LjU1OC0xLjA1MWExIDEgMCAwIDEgMC0xLjk2Nmw1LjU1OC0xLjA1MWEyIDIgMCAwIDAgMS41OTQtMS41OTR6XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNMjAgMnY0XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNMjIgNGgtNFwiIC8+XG4gICAgICA8Y2lyY2xlIGN4PVwiNFwiIGN5PVwiMjBcIiByPVwiMlwiIC8+XG4gICAgPC9zdmc+XG4gICk7XG59XG5cbmZ1bmN0aW9uIE11bHRpbWVkaWFUb29sSWNvbih7IGNsYXNzTmFtZSA9ICdoLTUgdy01JyB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICBzdHJva2VXaWR0aD17Mn1cbiAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICBzdHJva2VMaW5lam9pbj1cInJvdW5kXCJcbiAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgID5cbiAgICAgIDxwYXRoIGQ9XCJNMTUgMTUuMDAzYTEgMSAwIDAgMSAxLjUxNy0uODU5bDQuOTk3IDIuOTk3YTEgMSAwIDAgMSAwIDEuNzE4bC00Ljk5NyAyLjk5N2ExIDEgMCAwIDEtMS41MTctLjg2elwiIC8+XG4gICAgICA8cGF0aCBkPVwiTTIxIDEyLjE3VjVhMiAyIDAgMCAwLTItMkg1YTIgMiAwIDAgMC0yIDJ2MTRhMiAyIDAgMCAwIDIgMmg2XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJtNiAyMSA1LTVcIiAvPlxuICAgICAgPGNpcmNsZSBjeD1cIjlcIiBjeT1cIjlcIiByPVwiMlwiIC8+XG4gICAgPC9zdmc+XG4gICk7XG59XG5cbmZ1bmN0aW9uIFZpZGVvVG9vbEljb24oeyBjbGFzc05hbWUgPSAnaC01IHctNScgfTogeyBjbGFzc05hbWU/OiBzdHJpbmcgfSkge1xuICByZXR1cm4gKFxuICAgIDxzdmdcbiAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICBmaWxsPVwibm9uZVwiXG4gICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgc3Ryb2tlV2lkdGg9ezJ9XG4gICAgICBzdHJva2VMaW5lY2FwPVwicm91bmRcIlxuICAgICAgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiXG4gICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICA+XG4gICAgICA8cGF0aCBkPVwibTE2IDEzIDUuMjIzIDMuNDgyYS41LjUgMCAwIDAgLjc3Ny0uNDE2VjcuODdhLjUuNSAwIDAgMC0uNzUyLS40MzJMMTYgMTAuNVwiIC8+XG4gICAgICA8cmVjdCB4PVwiMlwiIHk9XCI2XCIgd2lkdGg9XCIxNFwiIGhlaWdodD1cIjEyXCIgcng9XCIyXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuY29uc3QgU0hBUEVfTUVOVV9JVEVNUzogeyBrZXk6IHN0cmluZzsgbGFiZWxLZXk6IHN0cmluZzsgc2hvcnRjdXQ/OiBzdHJpbmcgfVtdID0gW1xuICB7IGtleTogJ3JlY3QnLCBsYWJlbEtleTogJ2VkaXRvcjpzaGFwZU1lbnUucmVjdCcsIHNob3J0Y3V0OiAnUicgfSxcbiAgeyBrZXk6ICdsaW5lJywgbGFiZWxLZXk6ICdlZGl0b3I6c2hhcGVNZW51LmxpbmUnLCBzaG9ydGN1dDogJ0wnIH0sXG4gIHsga2V5OiAnYXJyb3cnLCBsYWJlbEtleTogJ2VkaXRvcjpzaGFwZU1lbnUuYXJyb3cnLCBzaG9ydGN1dDogJ1NoaWZ0K0wnIH0sXG4gIHsga2V5OiAnZWxsaXBzZScsIGxhYmVsS2V5OiAnZWRpdG9yOnNoYXBlTWVudS5lbGxpcHNlJywgc2hvcnRjdXQ6ICdPJyB9LFxuICB7IGtleTogJ3BvbHlnb24nLCBsYWJlbEtleTogJ2VkaXRvcjpzaGFwZU1lbnUucG9seWdvbicgfSxcbiAgeyBrZXk6ICdzdGFyJywgbGFiZWxLZXk6ICdlZGl0b3I6c2hhcGVNZW51LnN0YXInIH0sXG4gIHsga2V5OiAnbGlicmFyeScsIGxhYmVsS2V5OiAnZWRpdG9yOnNoYXBlTWVudS5saWJyYXJ5Jywgc2hvcnRjdXQ6ICfigKYnIH0sXG5dO1xuXG5mdW5jdGlvbiBVbmRvSWNvbih7IGNsYXNzTmFtZSB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2ZyBjbGFzc05hbWU9e2NsYXNzTmFtZX0gdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIyXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiPlxuICAgICAgPHBhdGggZD1cIk05IDE0IDQgOWw1LTVcIiAvPlxuICAgICAgPHBhdGggZD1cIk00IDloMTAuNWE1LjUgNS41IDAgMCAxIDUuNSA1LjVhNS41IDUuNSAwIDAgMS01LjUgNS41SDExXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gUmVkb0ljb24oeyBjbGFzc05hbWUgfTogeyBjbGFzc05hbWU/OiBzdHJpbmcgfSkge1xuICByZXR1cm4gKFxuICAgIDxzdmcgY2xhc3NOYW1lPXtjbGFzc05hbWV9IHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMlwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIj5cbiAgICAgIDxwYXRoIGQ9XCJtMTUgMTQgNS01LTUtNVwiIC8+XG4gICAgICA8cGF0aCBkPVwiTTIwIDlIOS41QTUuNSA1LjUgMCAwIDAgNCAxNC41QTUuNSA1LjUgMCAwIDAgOS41IDIwSDEzXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFZGl0b3JBcHBQcm9wcyB7XG4gIC8qKlxuICAgKiDku4Xlr7zlh7rmqKHlvI/vvJrnvJbovpHlmajpobbmoI/jgIzlj5HluIPjgI3mjInpkq7lj5jkuLrjgIzlr7zlh7rjgI3vvIzlubbmiZPlvIDkuI3lkKvjgIznq4vljbPlj5HluIPjgI3pobXnrb7nmoRcbiAgICog5a+85Ye65a+56K+d5qGG44CC57uI56uv55So5oi377yId2ViIOerr++8ieayoeacieWPkeW4g+S9nOWTgS/lj5HluIPkuLrmqKHmnb/nmoTmnYPpmZDvvIzlj6rog73lr7zlh7rmlofku7bvvJtcbiAgICog6L+Q6JCl56uv77yIYWRtaW7vvInkuI3kvKDvvIzkv53nlZnlrozmlbTlj5HluIPog73lipvjgIJcbiAgICovXG4gIGV4cG9ydE9ubHk/OiBib29sZWFuO1xuICAvKipcbiAgICog44CM6YCA5Ye657yW6L6R44CN6KaB6L+U5Zue55qE6Lev5b6EIOKAlOKAlCDnlLEqKuWuv+S4u+azqOWFpSoq44CCXG4gICAqIOWGheaguOS4jeiDveWGmeatu++8mndlYiDnq6/mmK8gL2Rhc2hib2FyZO+8jOi/kOiQpeerryhhZG1pbinmsqHmnInor6Xot6/nlLHvvIxcbiAgICog5LiN5rOo5YWl55qE6K+d6L+Q6JCl56uv54K55LqG44CM6YCA5Ye657yW6L6R44CN5Lya6Lez5Yiw5LiN5a2Y5Zyo55qE56m66Lev55Sx44CCXG4gICAqIOe8uuecgeWAvOS/neaMgSAvZGFzaGJvYXJk77yMd2ViIOerr+ihjOS4uuS4jeWPmOOAglxuICAgKi9cbiAgZXhpdFBhdGg/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEVkaXRvckFwcCh7IGV4cG9ydE9ubHkgPSBmYWxzZSwgZXhpdFBhdGggPSAnL2Rhc2hib2FyZCcgfTogRWRpdG9yQXBwUHJvcHMgPSB7fSkge1xuICB1c2VLZXlib2FyZCgpO1xuICBjb25zdCB7IHQgfSA9IHVzZVRyYW5zbGF0aW9uKFsnY29tbW9uJywgJ2VkaXRvcicsICdlcnJvcnMnXSk7XG4gIGNvbnN0IG5hdmlnYXRlID0gdXNlTmF2aWdhdGUoKTtcblxuICBjb25zdCB0aXRsZSA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnByb2plY3QudGl0bGUpO1xuICBjb25zdCBzZXRQcm9qZWN0VGl0bGUgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5zZXRQcm9qZWN0VGl0bGUpO1xuICBjb25zdCBwcm9qZWN0ID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMucHJvamVjdCk7XG4gIGNvbnN0IGFjdGl2ZVBhZ2UgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5hY3RpdmVQYWdlKTtcbiAgY29uc3QgcHJvamVjdElkID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMucHJvamVjdElkKTtcbiAgY29uc3QgaXNEaXJ0eSA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLmlzRGlydHkpO1xuICBjb25zdCBpc1NhdmluZyA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLmlzU2F2aW5nKTtcbiAgY29uc3Qgc2V0U2F2aW5nID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMuc2V0U2F2aW5nKTtcbiAgY29uc3Qgc2V0RGlydHkgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5zZXREaXJ0eSk7XG4gIGNvbnN0IHNldFByb2plY3RJZCA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnNldFByb2plY3RJZCk7XG4gIGNvbnN0IHNldFByb2plY3RTZXR0aW5ncyA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnNldFByb2plY3RTZXR0aW5ncyk7XG4gIGNvbnN0IGFkZEVsZW1lbnQgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5hZGRFbGVtZW50KTtcbiAgY29uc3QgdW5kbyA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnVuZG8pO1xuICBjb25zdCByZWRvID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMucmVkbyk7XG4gIGNvbnN0IGNhblVuZG8gPSB1c2VDYW5VbmRvKCk7XG4gIGNvbnN0IGNhblJlZG8gPSB1c2VDYW5SZWRvKCk7XG4gIGNvbnN0IGhvc3RNZXRhID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMuaG9zdE1ldGEpO1xuXG4gIGNvbnN0IFtwcmV2aWV3T3Blbiwgc2V0UHJldmlld09wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbcHVibGlzaE9wZW4sIHNldFB1Ymxpc2hPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgLy8g5a2X5L2T5o6I5p2D5Yik5a6a57uT5p6c77ya5LuY6LS55a2X5L2T5pyq5o6I5p2DIOKGkiDpooTop4gv5pys5Zyw5YWc5bqV5a+85Ye65Y+g5Yqg5rC05Y2wXG4gIGNvbnN0IFtmb250V2F0ZXJtYXJrLCBzZXRGb250V2F0ZXJtYXJrXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3ZlcnNpb25PcGVuLCBzZXRWZXJzaW9uT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtzZXR0aW5nc09wZW4sIHNldFNldHRpbmdzT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFt0ZXh0TWVudU9wZW4sIHNldFRleHRNZW51T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtzaGFwZU1lbnVPcGVuLCBzZXRTaGFwZU1lbnVPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW2NvbXBvbmVudE1lbnVPcGVuLCBzZXRDb21wb25lbnRNZW51T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFttdWx0aW1lZGlhTWVudU9wZW4sIHNldE11bHRpbWVkaWFNZW51T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFttdXNpY01vZGFsT3Blbiwgc2V0TXVzaWNNb2RhbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCB0ZXh0TWVudVRpbWVyID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHNoYXBlTWVudVRpbWVyID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IGNvbXBvbmVudE1lbnVUaW1lciA9IHVzZVJlZjxSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGw+KG51bGwpO1xuICBjb25zdCBtdWx0aW1lZGlhTWVudVRpbWVyID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG5cbiAgLy8g5a+85Ye65Zu+54mH77ya56a75bGP5riy5p+T5b2T5YmN6aG1IC8g5YWo6YOo6aG16ZW/5Zu+5bm25oiq5Zu+5LiL6L29XG4gIGNvbnN0IFtleHBvcnRpbmcsIHNldEV4cG9ydGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IGV4cG9ydGluZ1JlZiA9IHVzZVJlZihmYWxzZSk7XG4gIGNvbnN0IGV4cG9ydFJlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudD4obnVsbCk7XG4gIC8vIOiusOW9leacrOasoeWvvOWHuuaMh+WumueahOmhteegge+8iOS+m+emu+WxjyBET00g5riy5p+T5b2T5YmN6aG15pe26K+75Y+W77yM5Yy65Yir5LqO57yW6L6R5Zmo5r+A5rS76aG1IGFjdGl2ZVBhZ2XvvIlcbiAgY29uc3QgZXhwb3J0UGFnZVJlZiA9IHVzZVJlZjxudW1iZXI+KDApO1xuICAvLyDplb/lm77mqKHlvI/kuIvmuLLmn5PjgIzlhajpg6jpobXjgI3nmoTnprvlsY/oioLngrnvvIjlm77niYflt7LlhoXogZTkuLogZGF0YVVSTCDop4Tpgb8gQ09SU++8iVxuICBjb25zdCBleHBvcnRBbGxSZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQ+KG51bGwpO1xuICBjb25zdCBbZXhwb3J0UHJvamVjdCwgc2V0RXhwb3J0UHJvamVjdF0gPSB1c2VTdGF0ZTxQcm9qZWN0IHwgbnVsbD4obnVsbCk7XG5cbiAgY29uc3QgZmlsZUlucHV0UmVmID0gdXNlUmVmPEhUTUxJbnB1dEVsZW1lbnQ+KG51bGwpO1xuICBjb25zdCBsYXN0U2F2ZUF0ID0gdXNlUmVmKDApO1xuICAvLyDpgIDlh7rnvJbovpHov5vooYzkuK3vvJrov57ngrnjgIzpgIDlh7rnvJbovpHjgI3kuI3lupTop6blj5HkuKTmrKHkv53lrZgv5Lik5qyh6Lez6L2sXG4gIGNvbnN0IGV4aXRpbmdSZWYgPSB1c2VSZWYoZmFsc2UpO1xuICAvLyDmraPlnKjpo57ooYznmoTkv53lrZjvvJrlubblj5Hop6blj5HvvIjoh6rliqjkv53lrZggLyDpgIDlh7ogLyDlr7zlh7rliY3vvInlpI3nlKjlkIzkuIDkuKogcHJvbWlzZe+8jFxuICAvLyDkvb/osIPnlKjmlrkgYXdhaXQg5Yiw55qE5rC46L+c5piv44CM6L+Z5qyh6JC95bqT55qE55yf5a6e57uT5p6c44CN77yM6ICM5LiN5piv44CM5bey5pyJ5L+d5a2Y6L+b6KGM5Lit44CN55qE56m66L+U5Zue44CCXG4gIGNvbnN0IHNhdmVJbkZsaWdodCA9IHVzZVJlZjxQcm9taXNlPGJvb2xlYW4+IHwgbnVsbD4obnVsbCk7XG5cbiAgLyoqIOS/neWtmOWksei0peaPkOekuu+8muS6pOS6kuWei+S/neWtmO+8iOaJi+WKqOS/neWtmCAvIOmAgOWHuiAvIOWvvOWHuuWJje+8ieW/hemhu+aYjuehruWRiuefpeeUqOaItyAqL1xuICBjb25zdCBub3RpZnlTYXZlRmFpbGVkID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGFsZXJ0KHQoJ2Vycm9yczplcnJvci5zYXZlRmFpbGVkJykpO1xuICB9LCBbdF0pO1xuXG4gIC8qKlxuICAgKiDkv53lrZjojYnnqL/jgIJcbiAgICog6L+U5ZueIFByb21pc2U8Ym9vbGVhbj7vvJp0cnVlID0g5pyN5Yqh56uv5bey5o6l5Y+X5YaZ5YWl77ybZmFsc2UgPSDlhpnlhaXlpLHotKXjgIJcbiAgICog5aSx6LSlKirkuI3lnKjlhoXpg6jlkJ7mjokqKu+8muS6pOeUseiwg+eUqOaWueWGs+WumuOAjOaPkOekuuW5tueVmeWcqOmhtemdouOAjei/mOaYr+OAjOe7p+e7reOAje+8jFxuICAgKiDlkKbliJnpgIDlh7rnvJbovpEgLyDmnI3liqHnq6/lr7zlh7rkvJrmiorlpLHotKXlvZPmiJDmiJDlip8g4oCU4oCUIOaUueWKqOmdmem7mOS4ouWkseOAgeWvvOWHuua4suafk+aXp+iNieeov+OAglxuICAgKi9cbiAgY29uc3Qgc2F2ZVByb2plY3QgPSB1c2VDYWxsYmFjayhcbiAgICAoc25hcHNob3QgPSBmYWxzZSk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgaWYgKHNhdmVJbkZsaWdodC5jdXJyZW50KSByZXR1cm4gc2F2ZUluRmxpZ2h0LmN1cnJlbnQ7XG4gICAgICBjb25zdCBydW4gPSAoYXN5bmMgKCk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgICBzZXRTYXZpbmcodHJ1ZSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8g6I2J56i/6Ze45Y+j77ya5L+d5a2Y5YmN5a+5IHNjaGVtYSDlgZrlronlhajmoKHpqozmtojmr5LvvIjlsIHpnaIv5aSW6ZO+L+WvjOaWh+acrO+8ie+8jFxuICAgICAgICAgIC8vIOehruS/neiQveW6k+eahCBkcmFmdFNjaGVtYSDkuI3lkKvljbHpmanlhoXlrrnvvIhYU1MgLyDmuLLmn5PltKnpmLLlvqHvvInjgIJcbiAgICAgICAgICAvLyBzYW5pdGl6ZVNjaGVtYSDov5Tlm57mt7Hmi7fotJ3vvIzkuI3kv67mlLnnvJbovpHlmajlhoUgcHJvamVjdCDnirbmgIHjgIJcbiAgICAgICAgICBjb25zdCBzYWZlU2NoZW1hID0gc2FuaXRpemVTY2hlbWEocHJvamVjdCk7XG4gICAgICAgICAgaWYgKHByb2plY3RJZCkge1xuICAgICAgICAgICAgYXdhaXQgc2VydmljZXMudXBkYXRlUHJvamVjdChwcm9qZWN0SWQsIHtcbiAgICAgICAgICAgICAgdGl0bGU6IHByb2plY3QudGl0bGUsXG4gICAgICAgICAgICAgIHNjaGVtYTogc2FmZVNjaGVtYSxcbiAgICAgICAgICAgICAgc25hcHNob3QsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgc2VydmljZXMuY3JlYXRlUHJvamVjdChwcm9qZWN0LnRpdGxlKTtcbiAgICAgICAgICAgIGF3YWl0IHNlcnZpY2VzLnVwZGF0ZVByb2plY3QocmVzLmlkLCB7IHNjaGVtYTogc2FmZVNjaGVtYSwgc25hcHNob3QgfSk7XG4gICAgICAgICAgICBzZXRQcm9qZWN0SWQoU3RyaW5nKHJlcy5pZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZXREaXJ0eShmYWxzZSk7XG4gICAgICAgICAgbGFzdFNhdmVBdC5jdXJyZW50ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignU2F2ZSBmYWlsZWQ6JywgZXJyKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcbiAgICAgICAgICBzYXZlSW5GbGlnaHQuY3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBzYXZlSW5GbGlnaHQuY3VycmVudCA9IHJ1bjtcbiAgICAgIHJldHVybiBydW47XG4gICAgfSxcbiAgICBbcHJvamVjdElkLCBwcm9qZWN0LCBzZXRTYXZpbmcsIHNldERpcnR5LCBzZXRQcm9qZWN0SWRdLFxuICApO1xuXG4gIC8qKiDlkI7lj7Doh6rliqjkv53lrZjvvJrlpLHotKXlj6rorrDml6Xlv5fvvIjpgb/lhY0gMzBzIOS4gOasoeeahOW8ueeql+mqmuaJsO+8ie+8jOmhtuagj+OAjOKXjyDmnKrkv53lrZjjgI3kvJrmjIHnu63mj5DnpLogKi9cbiAgY29uc3Qgc2F2ZUluQmFja2dyb3VuZCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICB2b2lkIHNhdmVQcm9qZWN0KCkudGhlbigob2spID0+IHtcbiAgICAgIGlmICghb2spIGNvbnNvbGUuZXJyb3IoJ1thdXRvc2F2ZV0g6I2J56i/5L+d5a2Y5aSx6LSl77yM5pS55Yqo5bCa5pyq6JC95bqTJyk7XG4gICAgfSk7XG4gIH0sIFtzYXZlUHJvamVjdF0pO1xuXG4gIC8qIOKUgOKUgCDoh6rliqjkv53lrZgg4pSA4pSAICovXG4gIGNvbnN0IGF1dG9TYXZlVGltZXIgPSB1c2VSZWY8UmV0dXJuVHlwZTx0eXBlb2Ygc2V0SW50ZXJ2YWw+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHNhdmVEZWJvdW5jZSA9IHVzZVJlZjxSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGw+KG51bGwpO1xuICAvLyDmnIDmlrDpl63ljIXnmoTlkI7lj7Dkv53lrZjvvJpzYXZlUHJvamVjdCDnmoQgaWRlbnRpdHkg6ZqP5q+P5qyh57yW6L6R6YeN5bu677yM6Iul5oqKXG4gIC8vIHNhdmVJbkJhY2tncm91bmQg55u05o6l5pS+6L+bIGludGVydmFsIOeahOS+nei1lumHjO+8jOWumuaXtuWZqOS8muiiq+WPjeWkjSBjbGVhci9yZS1jcmVhdGXvvIxcbiAgLy8gMzBzIOawuOi/nOetieS4jeWIsOinpuWPke+8iOetieS6juiHquWKqOS/neWtmOaYr+atu+eahO+8ieOAgueUqCByZWYg5oyB5pyJ5pyA5paw5Zue6LCD77yMaW50ZXJ2YWwg5Y+q5bu65LiA5qyh44CCXG4gIGNvbnN0IHNhdmVJbkJhY2tncm91bmRSZWYgPSB1c2VSZWYoc2F2ZUluQmFja2dyb3VuZCk7XG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgc2F2ZUluQmFja2dyb3VuZFJlZi5jdXJyZW50ID0gc2F2ZUluQmFja2dyb3VuZDtcbiAgfSwgW3NhdmVJbkJhY2tncm91bmRdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGF1dG9TYXZlVGltZXIuY3VycmVudCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh1c2VFZGl0b3JTdG9yZS5nZXRTdGF0ZSgpLmlzRGlydHkpIHNhdmVJbkJhY2tncm91bmRSZWYuY3VycmVudCgpO1xuICAgIH0sIDMwMDAwKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKGF1dG9TYXZlVGltZXIuY3VycmVudCkgY2xlYXJJbnRlcnZhbChhdXRvU2F2ZVRpbWVyLmN1cnJlbnQpO1xuICAgIH07XG4gIH0sIFtdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghaXNEaXJ0eSkgcmV0dXJuO1xuICAgIGlmIChzYXZlRGVib3VuY2UuY3VycmVudCkgY2xlYXJUaW1lb3V0KHNhdmVEZWJvdW5jZS5jdXJyZW50KTtcbiAgICBjb25zdCBzaW5jZUxhc3QgPSBEYXRlLm5vdygpIC0gbGFzdFNhdmVBdC5jdXJyZW50O1xuICAgIGNvbnN0IHdhaXQgPSBzaW5jZUxhc3QgPCA4MDAwID8gTWF0aC5tYXgoMCwgODAwMCAtIHNpbmNlTGFzdCkgOiAzMDAwO1xuICAgIHNhdmVEZWJvdW5jZS5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodXNlRWRpdG9yU3RvcmUuZ2V0U3RhdGUoKS5pc0RpcnR5KSBzYXZlSW5CYWNrZ3JvdW5kKCk7XG4gICAgfSwgd2FpdCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChzYXZlRGVib3VuY2UuY3VycmVudCkgY2xlYXJUaW1lb3V0KHNhdmVEZWJvdW5jZS5jdXJyZW50KTtcbiAgICB9O1xuICB9LCBbaXNEaXJ0eSwgc2F2ZUluQmFja2dyb3VuZF0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3Qgb25CbHVyID0gKCkgPT4ge1xuICAgICAgaWYgKHVzZUVkaXRvclN0b3JlLmdldFN0YXRlKCkuaXNEaXJ0eSkgc2F2ZUluQmFja2dyb3VuZCgpO1xuICAgIH07XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCBvbkJsdXIpO1xuICAgIHJldHVybiAoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignYmx1cicsIG9uQmx1cik7XG4gIH0sIFtzYXZlSW5CYWNrZ3JvdW5kXSk7XG5cbiAgLyoqXG4gICAqIOWIt+aWsOWtl+S9k+aOiOadg+eKtuaAge+8iOS7mOi0ueWtl+S9k+acquaOiOadgyDihpIg6aKE6KeIL+acrOWcsOWFnOW6leWvvOWHuuWKoOawtOWNsO+8ieOAglxuICAgKiDliKTlrprlj6PlvoTkuI7lj5HluIPjgIHmnI3liqHnq6/lr7zlh7rkuIDoh7TvvIzlnYfnlLHmnI3liqHnq6/nu5nlh7rvvIzlrqLmiLfnq6/lj6rlgZrlsZXnpLrjgIJcbiAgICovXG4gIGNvbnN0IHJlZnJlc2hGb250TGljZW5zZSA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXNlcnZpY2VzLmdldEZvbnRMaWNlbnNlIHx8ICFwcm9qZWN0SWQpIHtcbiAgICAgIHNldEZvbnRXYXRlcm1hcmsoZmFsc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgY29uc3QgciA9IGF3YWl0IHNlcnZpY2VzLmdldEZvbnRMaWNlbnNlKHByb2plY3QsIHByb2plY3RJZCk7XG4gICAgICBzZXRGb250V2F0ZXJtYXJrKCEhci53YXRlcm1hcmspO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8g5Yik5a6a5LiN5Y+v55So5pe25pS+5a6977yI5LiN6K+v5Lyk5q2j5bi455So5oi377yJ77ya5rC05Y2w5Lul5pyN5Yqh56uv5a+85Ye657uT5p6c5Li65YeGXG4gICAgICBzZXRGb250V2F0ZXJtYXJrKGZhbHNlKTtcbiAgICB9XG4gIH0sIFtwcm9qZWN0LCBwcm9qZWN0SWRdKTtcblxuICAvLyDmiZPlvIDpooTop4jml7bliLfmlrDmjojmnYPnirbmgIHvvIjpooTop4jmsLTljbDliKTmja7vvIlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocHJldmlld09wZW4pIHZvaWQgcmVmcmVzaEZvbnRMaWNlbnNlKCk7XG4gIH0sIFtwcmV2aWV3T3BlbiwgcmVmcmVzaEZvbnRMaWNlbnNlXSk7XG5cbiAgLyoqXG4gICAqIOmAgOWHuue8lui+ke+8mioq5b+F6aG7562J5L+d5a2Y55yf5q2j6JC95bqT5ZCO5YaN6Lez6L2sKirvvIzlkKbliJnmnIDlkI7kuIDmrrXnvJbovpHkvJrooqvkuKLmjonjgIJcbiAgICog5L+d5a2Y5aSx6LSl5pe255WZ5Zyo57yW6L6R5Zmo5bm25piO56Gu5oql6ZSZ77yI6aG25qCP5ZCM5pe25L+d5oyB44CM4pePIOacquS/neWtmOOAje+8ie+8jFxuICAgKiDnu53kuI3pnZnpu5jot7Povawg4oCU4oCUIOi3s+i1sOS6huWwseetieS6jui/measoeaUueWKqOaXoOWjsOa2iOWkseOAglxuICAgKi9cbiAgY29uc3QgaGFuZGxlQmFjayA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBpZiAoZXhpdGluZ1JlZi5jdXJyZW50KSByZXR1cm47XG4gICAgZXhpdGluZ1JlZi5jdXJyZW50ID0gdHJ1ZTtcbiAgICB0cnkge1xuICAgICAgLy8g5Y+W5raI5b6F6Kem5Y+R55qE6Ziy5oqW5L+d5a2Y77ya5a6D5Y+q5Lya5Zyo6Lez6L2s5LmL5ZCO5omN5YaZ5bqT77yM6L+Z6YeM5pS55Li656uL5Y2z5L+d5a2Y5bm2562J5b6F57uT5p6cXG4gICAgICBpZiAoc2F2ZURlYm91bmNlLmN1cnJlbnQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHNhdmVEZWJvdW5jZS5jdXJyZW50KTtcbiAgICAgICAgc2F2ZURlYm91bmNlLmN1cnJlbnQgPSBudWxsO1xuICAgICAgfVxuICAgICAgLy8g5pyA5aSa5Lik6L2u77ya56ys5LiA6L2u5Y+v6IO95aSN55So5q2j5Zyo6aOe6KGM55qE5L+d5a2Y77yI5a6D55So55qE5piv56iN5pep55qE5b+r54Wn77yJ77yMXG4gICAgICAvLyDoi6XnrYnlvoXmnJ/pl7Tlj4jkuqfnlJ/kuobmlrDmlLnliqjvvIhpc0RpcnR5IOWGjeasoeS4uiB0cnVl77yJ5YiZ6KGl5a2Y5LiA5qyh77yM56Gu5L+d6YCA5Ye65YmN5peg5q6L55WZ44CCXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkgKz0gMSkge1xuICAgICAgICBpZiAoIXVzZUVkaXRvclN0b3JlLmdldFN0YXRlKCkuaXNEaXJ0eSkgYnJlYWs7XG4gICAgICAgIGlmICghKGF3YWl0IHNhdmVQcm9qZWN0KCkpKSB7XG4gICAgICAgICAgbm90aWZ5U2F2ZUZhaWxlZCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbmF2aWdhdGUoZXhpdFBhdGgpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBleGl0aW5nUmVmLmN1cnJlbnQgPSBmYWxzZTtcbiAgICB9XG4gIH0sIFtzYXZlUHJvamVjdCwgbmF2aWdhdGUsIG5vdGlmeVNhdmVGYWlsZWQsIGV4aXRQYXRoXSk7XG5cbiAgLy8g5a+85Ye65Zu+54mH77yabW9kZT0nY3VycmVudCcg5oyH5a6a6aG15Y2V5Zu+77yMbW9kZT0nYWxsJyDlhajpg6jpobXnurXlkJHplb/lm77vvJtcbiAgLy8gZm9ybWF0IOWvuem9kOWPkeW4g+iuvue9ruWvueivneahhuaJgOmAieWbvueJh+agvOW8j++8iGpwZWcgLyBwbmcgLyB3ZWJw77yJ44CCXG4gIGNvbnN0IGhhbmRsZUV4cG9ydCA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChvcHRzOiBJbWFnZUV4cG9ydE9wdGlvbnMpID0+IHtcbiAgICAgIGNvbnN0IHsgbW9kZSwgZm9ybWF0LCBwYWdlIH0gPSBvcHRzO1xuICAgICAgaWYgKGV4cG9ydGluZ1JlZi5jdXJyZW50KSByZXR1cm47XG4gICAgICBleHBvcnRpbmdSZWYuY3VycmVudCA9IHRydWU7XG4gICAgICBzZXRFeHBvcnRpbmcodHJ1ZSk7XG4gICAgICAvLyDorrDlvZXmnKzmrKHlr7zlh7rnm67moIfpobXnoIHvvIzkvpvnprvlsY8gRE9NIOa4suafk+aMh+Wumumhte+8iOWMuuWIq+S6jue8lui+keWZqOa/gOa0u+mhtSBhY3RpdmVQYWdl77yJXG4gICAgICBleHBvcnRQYWdlUmVmLmN1cnJlbnQgPSBwYWdlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8g4pSA4pSA4pSAIOacjeWKoeerr+WvvOWHuu+8iOWvvOWHuuehrOmXqOanm++8jOS8mOWFiOi1sOi/meadoei3r++8ieKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICAgICAgICAvLyDkuLrku4DkuYjlv4XpobvnlKjmnI3liqHnq6/muLLmn5PvvJrlrqLmiLfnq6/otLTlm77vvIh0b0RhdGFVUkwvTWVkaWFSZWNvcmRlcu+8ieWPr+iiq+ebtOaOpeiwg+eUqOe7lei/h+S7mOi0ueagoemqjOOAglxuICAgICAgICAvLyDmnI3liqHnq6/mjIkgcHJvamVjdElkIOivu+WPluacgOaWsOeahCBkcmFmdFNjaGVtYSDmuLLmn5PvvIzliIbovqjnjofkuI7msLTljbDnlLEgQXV0aG9yaXphdGlvbiDliKTlrprvvIxcbiAgICAgICAgLy8g5a6i5oi356uv5pS55Luj56CB5Lmf5ou/5LiN5Yiw6auY5riF5peg5rC05Y2w5oiQ5ZOB77yI6K+m6KeBIGRvY3MvZm9udC1saWNlbnNpbmctZGV2LWRvYy5tZCDCp1BoYXNlIDPvvInjgIJcbiAgICAgICAgaWYgKHNlcnZpY2VzLmV4cG9ydEltYWdlICYmIHByb2plY3RJZCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDmnI3liqHnq6/mjInojYnnqL/muLLmn5PvvIzlr7zlh7rliY3lv4XpobvlhYjmiorlvZPliY3mlLnliqjokL3kuLrojYnnqL/vvJtcbiAgICAgICAgICAgIC8vIOS/neWtmOWksei0peW/hemhu+S4reatoiDigJTigJQg5ZCm5YiZ5pyN5Yqh56uv5riy5p+T55qE5piv5LiK5LiA5qyh55qE5pen6I2J56i/77yM5a+85Ye657uT5p6c5LiO55S75biD5LiN5LiA6Ie044CCXG4gICAgICAgICAgICBpZiAoaXNEaXJ0eSkge1xuICAgICAgICAgICAgICBjb25zdCBzYXZlZCA9IGF3YWl0IHNhdmVQcm9qZWN0KCk7XG4gICAgICAgICAgICAgIGlmICghc2F2ZWQpIHtcbiAgICAgICAgICAgICAgICBub3RpZnlTYXZlRmFpbGVkKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByID0gYXdhaXQgc2VydmljZXMuZXhwb3J0SW1hZ2Uoe1xuICAgICAgICAgICAgICBwcm9qZWN0SWQsXG4gICAgICAgICAgICAgIHBhZ2UsXG4gICAgICAgICAgICAgIG1vZGU6IG1vZGUgPT09ICdhbGwnID8gJ2FsbCcgOiAnY3VycmVudCcsXG4gICAgICAgICAgICAgIGZvcm1hdCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3Qgc3VmZml4ID0gbW9kZSA9PT0gJ2FsbCcgPyAnLemVv+WbvicgOiBgLSR7cGFnZSArIDF9YDtcbiAgICAgICAgICAgIGRvd25sb2FkQmxvYihyLmJsb2IsIGAke3Byb2plY3QudGl0bGUgfHwgJ2g1J30ke3N1ZmZpeH0ke2Zvcm1hdEV4dChmb3JtYXQpfWApO1xuICAgICAgICAgICAgaWYgKCFyLmxpY2Vuc2VkICYmIHIubWlzc2luZz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGFsZXJ0KFxuICAgICAgICAgICAgICAgIGDmnKzmrKHlr7zlh7rkuLrjgIzor5XnlKjniYjjgI3vvIjlkKvmsLTljbDjgIHliIbovqjnjoflt7LpmY3nuqfvvInjgIJcXG5cXG7ljp/lm6DvvJrkvb/nlKjliLDmnKrmjojmnYPku5jotLnlrZfkvZMgJHtyLm1pc3Npbmcuam9pbihcbiAgICAgICAgICAgICAgICAgICfjgIEnLFxuICAgICAgICAgICAgICAgICl944CCXFxu6LSt5Lmw5YyF5ZCr6K+l5a2X5L2T55qE5LuY6LS55qih5p2/5ZCO77yM5Y2z5Y+v5a+85Ye66auY5riF5peg5rC05Y2w54mI5pys44CCYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIC8vIOacjeWKoeerr+WvvOWHuuS4jeWPr+eUqOaXtu+8iOacqumFjee9ruaXoOWktOa1j+iniOWZqOetie+8iemZjee6p+S4uuacrOWcsOWvvOWHuu+8jOS4jemYu+aWreeUqOaIt1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbZXhwb3J0XSDmnI3liqHnq6/lr7zlh7rlpLHotKXvvIzlm57pgIDmnKzlnLDlr7zlh7rvvJonLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyDmnI3liqHnq6/lr7zlh7rkuI3lj6/nlKjml7bnmoTmnKzlnLDlhZzlupXot6/lvoTvvJrku43pobvpgbXlrojlrZfkvZPmjojmnYMg4oCU4oCUIOacquaOiOadg+aXtuWcqCBjYW52YXMg5LiKXG4gICAgICAgIC8vIOWPoOWKoOS4jumihOiniOS4gOiHtOeahOawtOWNsO+8jOmBv+WFjeOAjOacjeWKoeerr+aVhemanOOAjeaIkOS4uue7lei/h+S7mOi0ueeahOaXgei3r+OAglxuICAgICAgICBsZXQgbG9jYWxXYXRlcm1hcmsgPSBmYWxzZTtcbiAgICAgICAgaWYgKHNlcnZpY2VzLmdldEZvbnRMaWNlbnNlICYmIHByb2plY3RJZCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2NhbFdhdGVybWFyayA9ICEhKGF3YWl0IHNlcnZpY2VzLmdldEZvbnRMaWNlbnNlKHByb2plY3QsIHByb2plY3RJZCkpLndhdGVybWFyaztcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGxvY2FsV2F0ZXJtYXJrID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHdpZHRoID0gcHJvamVjdC53aWR0aCA/PyAzNzU7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHByb2plY3QuaGVpZ2h0ID8/IDY2NztcbiAgICAgICAgLy8g6aKE5Yqg6L295bm25YaF6IGU5omA5pyJ5Zu+54mH5Li6IGRhdGFVUkzvvIzop4Tpgb8gaHRtbC10by1pbWFnZSDov5znqIvmi4nlj5bnmoQgQ09SUyDmsaHmn5PvvIjmm77mlbTlsY/nqbrnmb3vvIlcbiAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIHByZWxvYWRJbWFnZXMgc3RhcnQnKTtcbiAgICAgICAgY29uc3QgaW1nTWFwID0gYXdhaXQgcHJlbG9hZEltYWdlcyhwcm9qZWN0KTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIHByZWxvYWRJbWFnZXMgZG9uZSwgbWFwIHNpemUnLCBpbWdNYXAuc2l6ZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSBjbG9uZUFuZElubGluZSBzdGFydCcpO1xuICAgICAgICBjb25zdCBpbmxpbmVQcm9qZWN0ID0gY2xvbmVBbmRJbmxpbmUocHJvamVjdCwgaW1nTWFwKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIGNsb25lQW5kSW5saW5lIGRvbmUnKTtcbiAgICAgICAgc2V0RXhwb3J0UHJvamVjdChpbmxpbmVQcm9qZWN0KTtcbiAgICAgICAgLy8g562J5b6F56a75bGPIERPTSDmj5DkuqQgKyDlm77niYfop6PnoIFcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgNjAwKSk7XG5cbiAgICAgICAgLy8g5YaF5bWM5pys6aG155So5Yiw55qE6Ieq5a6a5LmJ5a2X5L2T77yIQGZvbnQtZmFjZSArIGJhc2U2NCBkYXRhIFVSTO+8ieWQjuWGjeaIquWbvuOAglxuICAgICAgICAvLyDkuLrku4DkuYjlv4XpobvlhoXltYzvvJrmnKzlnLDlr7zlh7rmioogRE9NIOWFi+mahui/myBTVkcg55qEIDxmb3JlaWduT2JqZWN0PiDlho3lvZMqKuWbvueJhyoq5riy5p+T77yMXG4gICAgICAgIC8vIOmCo+aYr+eLrOeri+aWh+aho++8jOmhtemdoumHjOeUqCBGb250RmFjZSBBUEkg5rOo5YaM55qE5a2X5L2T5Zyo5YW25Lit5LiN5Y+v6KeBIOKGkiDmloflrZfpnZnpu5jlm57pgIDns7vnu5/lrZfkvZNcbiAgICAgICAgLy8g77yI5Y2z44CM5a+85Ye65Zu+6YeM5omA5pyJ5paH5pys6YO95Y+Y5oiQ6buY6K6k5a2X5L2T44CN77yJ44CCaHRtbC10by1pbWFnZSDnmoQgc2tpcEZvbnRzIOS8muebtOaOpeS4ouaOieWtl+S9k++8jFxuICAgICAgICAvLyDmlYXmlLnkuLrnlLEgY29yZSDnlJ/miJAgZm9udEVtYmVkQ1NTIOazqOWFpeOAguivpuingSBjb3JlIGBidWlsZEZvbnRFbWJlZENTUygpYOOAglxuICAgICAgICBjb25zdCBleHBvcnRQYWdlcyA9IChtb2RlID09PSAnYWxsJyA/IHByb2plY3QucGFnZXMgPz8gW10gOiBbcHJvamVjdC5wYWdlcz8uW3BhZ2VdXSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgICBsZXQgZm9udEVtYmVkQ1NTID0gJyc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZm9udEVtYmVkQ1NTID0gYXdhaXQgYnVpbGRGb250RW1iZWRDU1MoY29sbGVjdEZvbnRGYW1pbGllcyhleHBvcnRQYWdlcykpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1tleHBvcnRdIOWGheW1jOiHquWumuS5ieWtl+S9k+Wksei0pe+8jOWvvOWHuuaWh+Wtl+WPr+iDveWbnumAgOezu+e7n+Wtl+S9k++8micsIGVycik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIGZvbnRFbWJlZENTUyBsZW5ndGggPScsIGZvbnRFbWJlZENTUy5sZW5ndGgpO1xuXG4gICAgICAgIC8vIGpwZWcg5b+F6aG75LiN6YCP5piO5bqV6Imy77yIcG5nL3dlYnAg5rK/55So57yW6L6R5Zmo55S75biD5bqV6ImyICNmMGYyZjXvvIzkuI7pooTop4jkuIDoh7TvvIlcbiAgICAgICAgY29uc3QgYmFja2dyb3VuZENvbG9yID0gZm9ybWF0ID09PSAnanBlZycgPyAnI2ZmZmZmZicgOiAnI2YwZjJmNSc7XG5cbiAgICAgICAgaWYgKG1vZGUgPT09ICdhbGwnKSB7XG4gICAgICAgICAgY29uc3Qgbm9kZSA9IGV4cG9ydEFsbFJlZi5jdXJyZW50O1xuICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbZXhwb3J0XSBleHBvcnRBbGxSZWYgaXMgbnVsbCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIEFycmF5LmZyb20obm9kZS5xdWVyeVNlbGVjdG9yQWxsKCdpbWcnKSkubWFwKChpbWcpID0+XG4gICAgICAgICAgICAgIGltZy5kZWNvZGUoKS5jYXRjaCgoKSA9PiB1bmRlZmluZWQpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApO1xuICAgICAgICAgIGNvbnN0IGltZ1NyY3MgPSBBcnJheS5mcm9tKG5vZGUucXVlcnlTZWxlY3RvckFsbCgnaW1nJykpLm1hcCgoaW1nKSA9PiBpbWcuc3JjLnNsaWNlKDAsIDEyMCkpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSBET00gcmVhZHkgKGFsbCksIGltYWdlcz0nLCBpbWdTcmNzLmxlbmd0aCwgaW1nU3Jjcyk7XG4gICAgICAgICAgY29uc3QgcGFnZUNvdW50ID0gTWF0aC5tYXgoMSwgaW5saW5lUHJvamVjdC5wYWdlcz8ubGVuZ3RoID8/IDEpO1xuICAgICAgICAgIGNvbnN0IHRvdGFsSCA9IGhlaWdodCAqIHBhZ2VDb3VudDtcbiAgICAgICAgICAvLyBjYW52YXMg5LiK6ZmQ57qmIDE2Mzg0cHjvvIzotoXlh7rliJnkuIvosIMgcGl4ZWxSYXRpb1xuICAgICAgICAgIGxldCBwaXhlbFJhdGlvID0gMjtcbiAgICAgICAgICBpZiAodG90YWxIICogcGl4ZWxSYXRpbyA+IDE2Mzg0KSB7XG4gICAgICAgICAgICBwaXhlbFJhdGlvID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcigxNjM4NCAvIHRvdGFsSCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gdG9DYW52YXMoYWxsKSBzdGFydCcsIHsgd2lkdGgsIHRvdGFsSCwgcGl4ZWxSYXRpbywgZm9ybWF0IH0pO1xuICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IGF3YWl0IHRvQ2FudmFzKG5vZGUsIHtcbiAgICAgICAgICAgIC8vIOW3sumihOWKoOi9veW5tuWGheiBlOS4uiBkYXRhVVJM77yM5peg6ZyAIGNhY2hlQnVzdO+8m2NhY2hlQnVzdCDlj6/og73noLTlnY8gZGF0YVVSTCDlr7zoh7QgaW1nIGVycm9y44CCXG4gICAgICAgICAgICBjYWNoZUJ1c3Q6IGZhbHNlLFxuICAgICAgICAgICAgaW1hZ2VQbGFjZWhvbGRlcjogVFJBTlNQQVJFTlRfUE5HLFxuICAgICAgICAgICAgLy8g5LiN6LWwIGh0bWwtdG8taW1hZ2Ug6Ieq5bim55qE5a2X5L2T5oqT5Y+W77yI5a6D5Y+q5omrIGRvY3VtZW50LnN0eWxlU2hlZXRz77yM5omr5LiN5YiwXG4gICAgICAgICAgICAvLyBGb250RmFjZSDms6jlhoznmoTlrZfkvZPvvIzkuJTot6jln5/mi4kgQ1NTIOWksei0peS8muaVtOS9kyByZWplY3TvvInvvJvmlLnnlKjkuIrpnaLnlLEgY29yZSDnlJ/miJDnmoRcbiAgICAgICAgICAgIC8vIGZvbnRFbWJlZENTUyDigJTigJQg5ZCrIEBmb250LWZhY2UgKyBiYXNlNjQgZGF0YSBVUkzvvIzml6DpnIDku7vkvZXnvZHnu5zor7fmsYLjgIJcbiAgICAgICAgICAgIHNraXBGb250czogdHJ1ZSxcbiAgICAgICAgICAgIGZvbnRFbWJlZENTUyxcbiAgICAgICAgICAgIC8vIOS4jue8lui+keWZqOeUu+W4g+W6leiJsuS4gOiHtO+8muWNiumAj+aYjuiDjOaZr+iJsuiwg+S4jue8lui+keWZqOWujOWFqOS4gOiHtO+8jFxuICAgICAgICAgICAgLy8g6YG/5YWN5a+85Ye65ZCO5Zyo55m96Imy5p+l55yL5ZmoL+eZveiJsuW9leWItuW6leS4iuinguaEn+WBj+a1he+8jOmAoOaIkOOAjOmAj+aYjuW6puS4ouWkseOAjeeahOmUmeinieOAglxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yLFxuICAgICAgICAgICAgLy8g5Y2V5byg5Zu+54mH5Yqg6L295aSx6LSl5pe26K6w5b2VIFVSTCDlubbnlKjljaDkvY3lm77lhZzlupXvvIzpgb/lhY3mlbTlvKAgU1ZHIOWKoOi9veWksei0peOAglxuICAgICAgICAgICAgLy8g5rOo5oSP77yaaHRtbC10by1pbWFnZSDlj6rmiorov5Tlm57lgLwgcmVzb2x2Ze+8jOS4jeS8muiHquWKqOaUueWGmSBzcmPvvJvlv4XpobvmiYvliqjmioogZXZlbnQudGFyZ2V0LnNyY1xuICAgICAgICAgICAgLy8g6K6+5Li65Y2g5L2N5Zu+77yM5ZCm5YiZ5YWL6ZqG5Ye655qEIDxpbWc+IOS7jeS/neeVmeWksei0peeahCBkYXRhOnRleHQvaHRtbCDmiJbnqbogc3Jj77yM5a+85Ye65Li656m655m944CCXG4gICAgICAgICAgICBvbkltYWdlRXJyb3JIYW5kbGVyOiAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gZXZlbnQgJiYgdHlwZW9mIGV2ZW50ID09PSAnb2JqZWN0JyA/IChldmVudCBhcyBFdmVudCkudGFyZ2V0IGFzIEhUTUxJbWFnZUVsZW1lbnQgfCB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgIGNvbnN0IGZhaWxlZFNyYyA9IHRhcmdldD8uc3JjO1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tleHBvcnRdIGltYWdlIGxvYWQgZmFpbGVkLCB1c2luZyBwbGFjZWhvbGRlci4gc3JjPScsIGZhaWxlZFNyYyk7XG4gICAgICAgICAgICAgIGlmICh0YXJnZXQgJiYgZmFpbGVkU3JjICE9PSBUUkFOU1BBUkVOVF9QTkcpIHtcbiAgICAgICAgICAgICAgICB0cnkgeyB0YXJnZXQuc3JjID0gVFJBTlNQQVJFTlRfUE5HOyB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gVFJBTlNQQVJFTlRfUE5HO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBpeGVsUmF0aW8sXG4gICAgICAgICAgICB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogdG90YWxILFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IGRhdGFVcmwgPSBjYW52YXNUb0RhdGFVcmwoY2FudmFzLCBmb3JtYXQpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSB0b0NhbnZhcyhhbGwpIGRvbmUsIGxlbmd0aCcsIGRhdGFVcmwubGVuZ3RoKTtcbiAgICAgICAgICBkb3dubG9hZERhdGFVcmwoZGF0YVVybCwgYCR7cHJvamVjdC50aXRsZSB8fCAnaDUnfS3plb/lm74ke2Zvcm1hdEV4dChmb3JtYXQpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IG5vZGUgPSBleHBvcnRSZWYuY3VycmVudDtcbiAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW2V4cG9ydF0gZXhwb3J0UmVmIGlzIG51bGwnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICBBcnJheS5mcm9tKG5vZGUucXVlcnlTZWxlY3RvckFsbCgnaW1nJykpLm1hcCgoaW1nKSA9PlxuICAgICAgICAgICAgICBpbWcuZGVjb2RlKCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBpbWdTcmNzID0gQXJyYXkuZnJvbShub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJ2ltZycpKS5tYXAoKGltZykgPT4gaW1nLnNyYy5zbGljZSgwLCAxMjApKTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gRE9NIHJlYWR5IChjdXJyZW50KSwgaW1hZ2VzPScsIGltZ1NyY3MubGVuZ3RoLCBpbWdTcmNzKTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gdG9DYW52YXMoY3VycmVudCkgc3RhcnQnLCB7IHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgcGFnZTogcGFnZSArIDEgfSk7XG4gICAgICAgICAgY29uc3QgY2FudmFzID0gYXdhaXQgdG9DYW52YXMobm9kZSwge1xuICAgICAgICAgICAgY2FjaGVCdXN0OiBmYWxzZSxcbiAgICAgICAgICAgIGltYWdlUGxhY2Vob2xkZXI6IFRSQU5TUEFSRU5UX1BORyxcbiAgICAgICAgICAgIHNraXBGb250czogdHJ1ZSxcbiAgICAgICAgICAgIGZvbnRFbWJlZENTUyxcbiAgICAgICAgICAgIC8vIOS4jue8lui+keWZqOeUu+W4g+W6leiJsuS4gOiHtO+8muWNiumAj+aYjuiDjOaZr+iJsuiwg+S4jue8lui+keWZqOWujOWFqOS4gOiHtOOAglxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yLFxuICAgICAgICAgICAgb25JbWFnZUVycm9ySGFuZGxlcjogKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGV2ZW50ICYmIHR5cGVvZiBldmVudCA9PT0gJ29iamVjdCcgPyAoZXZlbnQgYXMgRXZlbnQpLnRhcmdldCBhcyBIVE1MSW1hZ2VFbGVtZW50IHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICBjb25zdCBmYWlsZWRTcmMgPSB0YXJnZXQ/LnNyYztcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbZXhwb3J0XSBpbWFnZSBsb2FkIGZhaWxlZCwgdXNpbmcgcGxhY2Vob2xkZXIuIHNyYz0nLCBmYWlsZWRTcmMpO1xuICAgICAgICAgICAgICBpZiAodGFyZ2V0ICYmIGZhaWxlZFNyYyAhPT0gVFJBTlNQQVJFTlRfUE5HKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHsgdGFyZ2V0LnNyYyA9IFRSQU5TUEFSRU5UX1BORzsgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIFRSQU5TUEFSRU5UX1BORztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwaXhlbFJhdGlvOiAyLFxuICAgICAgICAgICAgd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8g5pyq5o6I5p2D5LuY6LS55a2X5L2T77ya5pys5Zyw5YWc5bqV5a+85Ye65ZCM5qC35omT5rC05Y2w77yI5LiO5pyN5Yqh56uv5a+85Ye65Y+j5b6E5LiA6Ie077yJXG4gICAgICAgICAgaWYgKGxvY2FsV2F0ZXJtYXJrKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgICAgIGlmIChjdHgpIGRyYXdXYXRlcm1hcmsoY3R4LCB7IHdpZHRoLCBoZWlnaHQgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGRhdGFVcmwgPSBjYW52YXNUb0RhdGFVcmwoY2FudmFzLCBmb3JtYXQpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSB0b0NhbnZhcyhjdXJyZW50KSBkb25lLCBsZW5ndGgnLCBkYXRhVXJsLmxlbmd0aCk7XG4gICAgICAgICAgZG93bmxvYWREYXRhVXJsKGRhdGFVcmwsIGAke3Byb2plY3QudGl0bGUgfHwgJ2g1J30tJHtwYWdlICsgMX0ke2Zvcm1hdEV4dChmb3JtYXQpfWApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW2V4cG9ydF0gRXhwb3J0IGZhaWxlZDonLCBlcnIpO1xuICAgICAgICBsZXQgZGV0YWlsID0gJ+acquefpemUmeivryc7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikgZGV0YWlsID0gYCR7ZXJyLm5hbWV9OiAke2Vyci5tZXNzYWdlfWA7XG4gICAgICAgIGVsc2UgaWYgKGVyciAmJiB0eXBlb2YgZXJyID09PSAnb2JqZWN0JyAmJiAndHlwZScgaW4gZXJyKSBkZXRhaWwgPSBgRXZlbnQoJHsoZXJyIGFzIHsgdHlwZT86IHN0cmluZyB9KS50eXBlfSlgO1xuICAgICAgICBlbHNlIGRldGFpbCA9IFN0cmluZyhlcnIpO1xuICAgICAgICBhbGVydChgJHt0KCdlZGl0b3I6dG9vbGJhci5leHBvcnRGYWlsZWQnKX1cXG5cXG4ke2RldGFpbH1gKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGV4cG9ydGluZ1JlZi5jdXJyZW50ID0gZmFsc2U7XG4gICAgICAgIHNldEV4cG9ydGluZyhmYWxzZSk7XG4gICAgICAgIHNldEV4cG9ydFByb2plY3QobnVsbCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBbcHJvamVjdCwgdCwgcHJvamVjdElkLCBpc0RpcnR5LCBzYXZlUHJvamVjdCwgbm90aWZ5U2F2ZUZhaWxlZF0sXG4gICk7XG5cbiAgLyoqIGNhbnZhcyDihpIg55uu5qCH5qC85byPIGRhdGFVUkzvvIhqcGVnL3dlYnAg5bim5Y6L57yp6LSo6YeP77yMcG5nIOaXoOaNn++8iSAqL1xuICBmdW5jdGlvbiBjYW52YXNUb0RhdGFVcmwoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCwgZm9ybWF0OiBJbWFnZUZvcm1hdCk6IHN0cmluZyB7XG4gICAgaWYgKGZvcm1hdCA9PT0gJ2pwZWcnKSByZXR1cm4gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvanBlZycsIDAuOTIpO1xuICAgIGlmIChmb3JtYXQgPT09ICd3ZWJwJykgcmV0dXJuIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCAwLjkyKTtcbiAgICByZXR1cm4gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJyk7XG4gIH1cblxuICAvKiog5Zu+54mH5qC85byPIOKGkiDmlofku7bmianlsZXlkI0gKi9cbiAgZnVuY3Rpb24gZm9ybWF0RXh0KGZvcm1hdDogSW1hZ2VGb3JtYXQpOiBzdHJpbmcge1xuICAgIGlmIChmb3JtYXQgPT09ICdqcGVnJykgcmV0dXJuICcuanBnJztcbiAgICBpZiAoZm9ybWF0ID09PSAnd2VicCcpIHJldHVybiAnLndlYnAnO1xuICAgIHJldHVybiAnLnBuZyc7XG4gIH1cblxuICBjb25zdCBoYW5kbGVVcGxvYWQgPSB1c2VDYWxsYmFjayhcbiAgICBhc3luYyAoZTogUmVhY3QuQ2hhbmdlRXZlbnQ8SFRNTElucHV0RWxlbWVudD4pID0+IHtcbiAgICAgIGNvbnN0IGZpbGUgPSBlLnRhcmdldC5maWxlcz8uWzBdO1xuICAgICAgaWYgKCFmaWxlKSByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICAvLyDkuIrkvKDliY3lhYjlgZrnsbvlnosv5L2T56ev5qCh6aqM77yM57uZ5Ye65YW35L2T6ZSZ6K+v6ICM6Z2e56y857uf55qE44CM5LiK5Lyg5aSx6LSl44CNXG4gICAgICAgIGNvbnN0IGVycktleSA9IHZhbGlkYXRlSW1hZ2VGaWxlKGZpbGUpO1xuICAgICAgICBpZiAoZXJyS2V5KSB7XG4gICAgICAgICAgYWxlcnQodChlcnJLZXkpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8g5YmN56uv6K+75Y+W55yf5a6e5YOP57Sg5bC65a+477yM6ZqP5LiK5Lyg5o+Q5Lqk77yM5L2/5o+S5YWl57yp5pS+5LiO57Sg5p2Q6K6w5b2V5bC65a+45YeG56GuXG4gICAgICAgIGxldCBkaW1zOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkaW1zID0gYXdhaXQgcmVhZEltYWdlRGltZW5zaW9ucyhmaWxlKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgZGltcyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXNzZXQgPSBhd2FpdCBzZXJ2aWNlcy51cGxvYWRBc3NldChmaWxlLCBkaW1zID8/IHVuZGVmaW5lZCk7XG4gICAgICAgIC8vIOmAmui/hyBhZGRFbGVtZW50IOWKoOWFpe+8mmNyZWF0ZUVsZW1lbnQg5Lya6KGl6b2Q5ZSv5LiAIGlkIOS4juWFqOmDqOWfuuehgOWtl+aute+8jFxuICAgICAgICAvLyDpgb/lhY3mraTliY3nlKggYWRkRWxlbWVudERhdGEg5Lyg6KO45a+56LGh5a+86Ie0IGlkIOS4uiB1bmRlZmluZWTvvIxcbiAgICAgICAgLy8g6L+b6ICM5aSa5Liq5Zu+54mH5YWx55SoIHVuZGVmaW5lZCBpZO+8iOaLluaLvS/pgInkuK0v5o6S5bqP5Liy5Y+344CB5peg5Y+Y5o2i5qGG44CB5peg5bGe5oCn6Z2i5p2/77yJ44CCXG4gICAgICAgIC8vIOWQjOaXtuaMieeUu+W4g+WwuuWvuOe8qeaUvu+8jOmBv+WFjeWOn+Wbvui/nOi2hSAzNzUg55S75biD5a+86Ie05Y+Y5o2i5qGG5Ye655WM44CCXG4gICAgICAgIGNvbnN0IHcgPSBkaW1zPy53aWR0aCB8fCBhc3NldC53aWR0aCB8fCAyMDA7XG4gICAgICAgIGNvbnN0IGggPSBkaW1zPy5oZWlnaHQgfHwgYXNzZXQuaGVpZ2h0IHx8IDIwMDtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBNYXRoLm1pbih3ID4gMzIwID8gMzIwIC8gdyA6IDEsIGggPiA0ODAgPyA0ODAgLyBoIDogMSk7XG4gICAgICAgIGFkZEVsZW1lbnQoJ2ltYWdlJywge1xuICAgICAgICAgIHNyYzogYXNzZXQudXJsLFxuICAgICAgICAgIHdpZHRoOiBNYXRoLnJvdW5kKHcgKiBzY2FsZSksXG4gICAgICAgICAgaGVpZ2h0OiBNYXRoLnJvdW5kKGggKiBzY2FsZSksXG4gICAgICAgICAgbmF0dXJhbFdpZHRoOiBNYXRoLnJvdW5kKHcpLFxuICAgICAgICAgIG5hdHVyYWxIZWlnaHQ6IE1hdGgucm91bmQoaCksXG4gICAgICAgIH0gYXMgUGFydGlhbDxFbGVtZW50Pik7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICBhbGVydCh0KCdlcnJvcnM6ZXJyb3IudXBsb2FkRmFpbGVkJykpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKGZpbGVJbnB1dFJlZi5jdXJyZW50KSBmaWxlSW5wdXRSZWYuY3VycmVudC52YWx1ZSA9ICcnO1xuICAgICAgfVxuICAgIH0sXG4gICAgW2FkZEVsZW1lbnQsIHRdLFxuICApO1xuXG4gIGNvbnN0IGFkZFRleHRQcmVzZXQgPSB1c2VDYWxsYmFjayhcbiAgICAocHJlc2V0OiB0eXBlb2YgVEVYVF9QUkVTRVRTW251bWJlcl0pID0+IHtcbiAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5taW4oMzAwLCAzNjAgLSBwcmVzZXQuZm9udFNpemUpO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgoNDAsIHByZXNldC5mb250U2l6ZSAqIDIuMik7XG4gICAgICBhZGRFbGVtZW50KCd0ZXh0Jywge1xuICAgICAgICB0ZXh0OiB0KCdlZGl0b3I6ZGVmYXVsdHMudGV4dENvbnRlbnQnKSxcbiAgICAgICAgZm9udFNpemU6IHByZXNldC5mb250U2l6ZSxcbiAgICAgICAgZm9udFN0eWxlOiBwcmVzZXQuZm9udFdlaWdodCxcbiAgICAgICAgd2lkdGgsXG4gICAgICAgIGhlaWdodCxcbiAgICAgIH0gYXMgUGFydGlhbDxFbGVtZW50Pik7XG4gICAgfSxcbiAgICBbYWRkRWxlbWVudCwgdF0sXG4gICk7XG5cbiAgY29uc3QgaGFuZGxlVG9vbENsaWNrID0gKGtleTogc3RyaW5nKSA9PiB7XG4gICAgc3dpdGNoIChrZXkpIHtcbiAgICAgIGNhc2UgJ3RleHQnOlxuICAgICAgICBhZGRUZXh0UHJlc2V0KFRFWFRfUFJFU0VUU1swXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2hhcGUnOlxuICAgICAgICBhZGRTaGFwZSgncmVjdCcpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgIGFkZENvbXBvbmVudENvbXBvbmVudCgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ211bHRpbWVkaWEnOlxuICAgICAgICBvcGVuTXVsdGltZWRpYU1lbnUoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdlZmZlY3QnOlxuICAgICAgICBhbGVydCh0KCdlZGl0b3I6dG9vbC5jb21pbmdTb29uJykpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgb3BlblRleHRNZW51ID0gKCkgPT4ge1xuICAgIGlmICh0ZXh0TWVudVRpbWVyLmN1cnJlbnQpIGNsZWFyVGltZW91dCh0ZXh0TWVudVRpbWVyLmN1cnJlbnQpO1xuICAgIHNldFRleHRNZW51T3Blbih0cnVlKTtcbiAgfTtcblxuICBjb25zdCBjbG9zZVRleHRNZW51ID0gKCkgPT4ge1xuICAgIHRleHRNZW51VGltZXIuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc2V0VGV4dE1lbnVPcGVuKGZhbHNlKTtcbiAgICB9LCAxNTApO1xuICB9O1xuXG4gIGNvbnN0IG9wZW5TaGFwZU1lbnUgPSAoKSA9PiB7XG4gICAgaWYgKHNoYXBlTWVudVRpbWVyLmN1cnJlbnQpIGNsZWFyVGltZW91dChzaGFwZU1lbnVUaW1lci5jdXJyZW50KTtcbiAgICBzZXRTaGFwZU1lbnVPcGVuKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGNsb3NlU2hhcGVNZW51ID0gKCkgPT4ge1xuICAgIHNoYXBlTWVudVRpbWVyLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHNldFNoYXBlTWVudU9wZW4oZmFsc2UpO1xuICAgIH0sIDE1MCk7XG4gIH07XG5cbiAgY29uc3QgYWRkU2hhcGUgPSAoa2V5OiBzdHJpbmcpID0+IHtcbiAgICBpZiAoa2V5ID09PSAnbGlicmFyeScpIHtcbiAgICAgIGFsZXJ0KHQoJ2VkaXRvcjp0b29sLmNvbWluZ1Nvb24nKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkZEVsZW1lbnQoa2V5IGFzIEVsZW1lbnRUeXBlKTtcbiAgICBzZXRTaGFwZU1lbnVPcGVuKGZhbHNlKTtcbiAgfTtcblxuICBjb25zdCBvcGVuQ29tcG9uZW50TWVudSA9ICgpID0+IHtcbiAgICBpZiAoY29tcG9uZW50TWVudVRpbWVyLmN1cnJlbnQpIGNsZWFyVGltZW91dChjb21wb25lbnRNZW51VGltZXIuY3VycmVudCk7XG4gICAgc2V0Q29tcG9uZW50TWVudU9wZW4odHJ1ZSk7XG4gIH07XG5cbiAgY29uc3QgY2xvc2VDb21wb25lbnRNZW51ID0gKCkgPT4ge1xuICAgIGNvbXBvbmVudE1lbnVUaW1lci5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzZXRDb21wb25lbnRNZW51T3BlbihmYWxzZSk7XG4gICAgfSwgMTUwKTtcbiAgfTtcblxuICBjb25zdCBvcGVuTXVsdGltZWRpYU1lbnUgPSAoKSA9PiB7XG4gICAgaWYgKG11bHRpbWVkaWFNZW51VGltZXIuY3VycmVudCkgY2xlYXJUaW1lb3V0KG11bHRpbWVkaWFNZW51VGltZXIuY3VycmVudCk7XG4gICAgc2V0TXVsdGltZWRpYU1lbnVPcGVuKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGNsb3NlTXVsdGltZWRpYU1lbnU6ICgpID0+IHZvaWQgPSAoKSA9PiB7XG4gICAgbXVsdGltZWRpYU1lbnVUaW1lci5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzZXRNdWx0aW1lZGlhTWVudU9wZW4oZmFsc2UpO1xuICAgIH0sIDE1MCk7XG4gIH07XG5cbiAgY29uc3QgYWRkQ29tcG9uZW50Q29tcG9uZW50ID0gKGtleT86IENvbXBvbmVudEl0ZW1LZXkpID0+IHtcbiAgICBpZiAoIWtleSkge1xuICAgICAgLy8g6aG26YOo4oCc57uE5Lu24oCd5oyJ6ZKu6buY6K6k5omT5byA6I+c5Y2V77yM5LiN55u05o6l5re75Yqg5YWD57SgXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGl0ZW0gPSBDT01QT05FTlRfSVRFTV9NQVBba2V5XTtcbiAgICBpZiAoIWl0ZW0uZWxlbWVudFR5cGUpIHtcbiAgICAgIGFsZXJ0KHQoJ2VkaXRvcjp0b29sLmNvbWluZ1Nvb24nKSk7XG4gICAgICBzZXRDb21wb25lbnRNZW51T3BlbihmYWxzZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkZEVsZW1lbnQoaXRlbS5lbGVtZW50VHlwZSwgKGl0ZW0ucHJlc2V0ID8/IHt9KSBhcyBQYXJ0aWFsPEVsZW1lbnQ+KTtcbiAgICBzZXRDb21wb25lbnRNZW51T3BlbihmYWxzZSk7XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImVkaXRvci1jYW52YXMtd3JhcCBmbGV4IGgtc2NyZWVuIGZsZXgtY29sIG92ZXJmbG93LWhpZGRlbiBiZy13aGl0ZSB0ZXh0LWdyYXktODAwXCI+XG4gICAgICA8aW5wdXRcbiAgICAgICAgcmVmPXtmaWxlSW5wdXRSZWZ9XG4gICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgYWNjZXB0PVwiaW1hZ2UvKlwiXG4gICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVVcGxvYWR9XG4gICAgICAgIGNsYXNzTmFtZT1cImhpZGRlblwiXG4gICAgICAvPlxuXG4gICAgICB7Lyog4pSA4pSAIOmhtumDqOWKn+iDveWMuiDilIDilIAgKi99XG4gICAgICA8aGVhZGVyIGNsYXNzTmFtZT1cImZsZXggaC0xNCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGJvcmRlci1iIGJvcmRlci1ncmF5LTIwMCBiZy13aGl0ZSBweC00IHNoYWRvdy1zbVwiPlxuICAgICAgICB7Lyog5bem5L6n77yaTG9nbyArIOagh+mimO+8iOaXoOi/lOWbnuaMiemSru+8jOe7n+S4gOeUqOWPs+S4iuinkuOAjOmAgOWHuue8lui+keOAje+8iSAqL31cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImJnLWdyYWRpZW50LXRvLXIgZnJvbS1ibHVlLTUwMCB0by1jeWFuLTQwMCBiZy1jbGlwLXRleHQgdGV4dC14bCBmb250LWV4dHJhYm9sZCB0cmFja2luZy10aWdodCB0ZXh0LXRyYW5zcGFyZW50XCI+XG4gICAgICAgICAgICAgIFRBS0xJUCBINVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgey8qIOaSpOmUgCAvIOmHjeWBmiAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWwtMyBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSBib3JkZXItbCBib3JkZXItZ3JheS0yMDAgcGwtM1wiPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17dW5kb31cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17IWNhblVuZG99XG4gICAgICAgICAgICAgICAgdGl0bGU9e3QoJ2VkaXRvcjp0b29sYmFyLnVuZG8nKX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGgtOCB3LTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQgdGV4dC1ncmF5LTYwMCB0cmFuc2l0aW9uIGhvdmVyOmJnLWJsdWUtNTAgaG92ZXI6dGV4dC1ibHVlLTYwMCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6dGV4dC1ncmF5LTMwMCBkaXNhYmxlZDpob3ZlcjpiZy10cmFuc3BhcmVudFwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8VW5kb0ljb24gY2xhc3NOYW1lPVwiaC01IHctNVwiIC8+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17cmVkb31cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17IWNhblJlZG99XG4gICAgICAgICAgICAgICAgdGl0bGU9e3QoJ2VkaXRvcjp0b29sYmFyLnJlZG8nKX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGgtOCB3LTggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQgdGV4dC1ncmF5LTYwMCB0cmFuc2l0aW9uIGhvdmVyOmJnLWJsdWUtNTAgaG92ZXI6dGV4dC1ibHVlLTYwMCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6dGV4dC1ncmF5LTMwMCBkaXNhYmxlZDpob3ZlcjpiZy10cmFuc3BhcmVudFwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8UmVkb0ljb24gY2xhc3NOYW1lPVwiaC01IHctNVwiIC8+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICB7Lyog5Y6G5Y+y54mI5pys77ya56e76Iez5pKk6ZSAL+mHjeWBmuaMiemSruWPs+S+pyAqL31cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0VmVyc2lvbk9wZW4odHJ1ZSl9XG4gICAgICAgICAgICAgIHRpdGxlPXt0KCdlZGl0b3I6dmVyc2lvbi50aXRsZScpfVxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGgtOCBpdGVtcy1jZW50ZXIgZ2FwLTEgcm91bmRlZCBib3JkZXIgYm9yZGVyLWdyYXktMjAwIHB4LTIgdGV4dC1zbSB0ZXh0LWdyYXktNjAwIHRyYW5zaXRpb24gaG92ZXI6Ym9yZGVyLWJsdWUtMzAwIGhvdmVyOnRleHQtYmx1ZS02MDBcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8c3ZnIGNsYXNzTmFtZT1cImgtNCB3LTRcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2VXaWR0aD1cIjJcIiBzdHJva2VMaW5lY2FwPVwicm91bmRcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCI+XG4gICAgICAgICAgICAgICAgPHBhdGggZD1cIk0zIDN2NWg1XCIgLz5cbiAgICAgICAgICAgICAgICA8cGF0aCBkPVwiTTMuMDUgMTNBOSA5IDAgMSAwIDYgNS4zTDMgOFwiIC8+XG4gICAgICAgICAgICAgICAgPHBhdGggZD1cIk0xMiA3djVsNCAyXCIgLz5cbiAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgIDxzcGFuPnt0KCdlZGl0b3I6dmVyc2lvbi50aXRsZScpfTwvc3Bhbj5cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7Lyog5Lit5aSu5bel5YW35oyJ6ZKuICovfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAge1RPT0xTLm1hcCgodG9vbCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaXNUZXh0ID0gdG9vbC5rZXkgPT09ICd0ZXh0JztcbiAgICAgICAgICAgIGNvbnN0IGlzU2hhcGUgPSB0b29sLmtleSA9PT0gJ3NoYXBlJztcbiAgICAgICAgICAgIGNvbnN0IGlzQ29tcG9uZW50ID0gdG9vbC5rZXkgPT09ICdjb21wb25lbnQnO1xuICAgICAgICAgICAgY29uc3QgaXNNdWx0aW1lZGlhID0gdG9vbC5rZXkgPT09ICdtdWx0aW1lZGlhJztcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBrZXk9e3Rvb2wua2V5fVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInJlbGF0aXZlXCJcbiAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9e1xuICAgICAgICAgICAgICAgICAgaXNUZXh0XG4gICAgICAgICAgICAgICAgICAgID8gb3BlblRleHRNZW51XG4gICAgICAgICAgICAgICAgICAgIDogaXNTaGFwZVxuICAgICAgICAgICAgICAgICAgICAgID8gb3BlblNoYXBlTWVudVxuICAgICAgICAgICAgICAgICAgICAgIDogaXNDb21wb25lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgID8gb3BlbkNvbXBvbmVudE1lbnVcbiAgICAgICAgICAgICAgICAgICAgICAgIDogaXNNdWx0aW1lZGlhXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gb3Blbk11bHRpbWVkaWFNZW51XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17XG4gICAgICAgICAgICAgICAgICBpc1RleHRcbiAgICAgICAgICAgICAgICAgICAgPyBjbG9zZVRleHRNZW51XG4gICAgICAgICAgICAgICAgICAgIDogaXNTaGFwZVxuICAgICAgICAgICAgICAgICAgICAgID8gY2xvc2VTaGFwZU1lbnVcbiAgICAgICAgICAgICAgICAgICAgICA6IGlzQ29tcG9uZW50XG4gICAgICAgICAgICAgICAgICAgICAgICA/IGNsb3NlQ29tcG9uZW50TWVudVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBpc011bHRpbWVkaWFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyBjbG9zZU11bHRpbWVkaWFNZW51XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlVG9vbENsaWNrKHRvb2wua2V5KX1cbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQgcHgtNSBweS0xLjUgdGV4dC1ncmF5LTYwMCB0cmFuc2l0aW9uIGhvdmVyOmJnLWJsdWUtNTAgaG92ZXI6dGV4dC1ibHVlLTYwMFwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAge3Rvb2wua2V5ID09PSAnY29tcG9uZW50JyA/IChcbiAgICAgICAgICAgICAgICAgICAgPENvbXBvbmVudFRvb2xJY29uIC8+XG4gICAgICAgICAgICAgICAgICApIDogdG9vbC5rZXkgPT09ICdzaGFwZScgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxTaGFwZVRvb2xJY29uIC8+XG4gICAgICAgICAgICAgICAgICApIDogdG9vbC5rZXkgPT09ICdtdWx0aW1lZGlhJyA/IChcbiAgICAgICAgICAgICAgICAgICAgPE11bHRpbWVkaWFUb29sSWNvbiAvPlxuICAgICAgICAgICAgICAgICAgKSA6IHRvb2wua2V5ID09PSAndGV4dCcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0VG9vbEljb24gLz5cbiAgICAgICAgICAgICAgICAgICkgOiB0b29sLmtleSA9PT0gJ2VmZmVjdCcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxFZmZlY3RUb29sSWNvbiAvPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1sZyBsZWFkaW5nLW5vbmVcIj57KHRvb2wgYXMgKHR5cGVvZiBUT09MUylbbnVtYmVyXSkuaWNvbn08L3NwYW4+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwibXQtMC41IHRleHQteHNcIj57dCh0b29sLmxhYmVsS2V5KX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG5cbiAgICAgICAgICAgICAgICB7Lyog5paH5pys5bel5YW36aKE6K6+6I+c5Y2VICovfVxuICAgICAgICAgICAgICAgIHtpc1RleHQgJiYgdGV4dE1lbnVPcGVuICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYWJzb2x1dGUgbGVmdC0xLzIgdG9wLWZ1bGwgei01MCBtdC0xIHctNDQgLXRyYW5zbGF0ZS14LTEvMiByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItZ3JheS0yMDAgYmctd2hpdGUgcHktMiBzaGFkb3ctbGdcIlxuICAgICAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9e29wZW5UZXh0TWVudX1cbiAgICAgICAgICAgICAgICAgICAgb25Nb3VzZUxlYXZlPXtjbG9zZVRleHRNZW51fVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7VEVYVF9QUkVTRVRTLm1hcCgocHJlc2V0KSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtwcmVzZXQua2V5fVxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRUZXh0UHJlc2V0KHByZXNldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRleHRNZW51T3BlbihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCB3LWZ1bGwgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHB4LTQgcHktMi41IHRleHQtY2VudGVyIHRleHQtZ3JheS03MDAgdHJhbnNpdGlvbiBob3ZlcjpiZy1ibHVlLTUwIGhvdmVyOnRleHQtYmx1ZS02MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IHByZXNldC5mb250U2l6ZSwgZm9udFdlaWdodDogcHJlc2V0LmZvbnRXZWlnaHQgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPXt0KHByZXNldC5sYWJlbEtleSl9XG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAge3QocHJlc2V0LmxhYmVsS2V5KX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgey8qIOW9oueKtuW3peWFt+S4i+aLieiPnOWNlSAqL31cbiAgICAgICAgICAgICAgICB7aXNTaGFwZSAmJiBzaGFwZU1lbnVPcGVuICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYWJzb2x1dGUgbGVmdC0xLzIgdG9wLWZ1bGwgei01MCBtdC0xIHctNTYgLXRyYW5zbGF0ZS14LTEvMiByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItZ3JheS0yMDAgYmctd2hpdGUgcHktMiBzaGFkb3ctbGdcIlxuICAgICAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9e29wZW5TaGFwZU1lbnV9XG4gICAgICAgICAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17Y2xvc2VTaGFwZU1lbnV9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIHtTSEFQRV9NRU5VX0lURU1TLm1hcCgoaXRlbSkgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIGtleT17aXRlbS5rZXl9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBhZGRTaGFwZShpdGVtLmtleSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IHctZnVsbCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHB4LTQgcHktMi41IHRleHQtbGVmdCB0ZXh0LXNtIHRleHQtZ3JheS03MDAgdHJhbnNpdGlvbiBob3ZlcjpiZy1ibHVlLTUwIGhvdmVyOnRleHQtYmx1ZS02MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9e3QoaXRlbS5sYWJlbEtleSl9XG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFNoYXBlTWVudUljb24gdHlwZT17aXRlbS5rZXl9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPnt0KGl0ZW0ubGFiZWxLZXkpfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLnNob3J0Y3V0ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNDAwXCI+e2l0ZW0uc2hvcnRjdXR9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgey8qIOe7hOS7tuW6k+S4i+aLiemdouadvyAqL31cbiAgICAgICAgICAgICAgICB7aXNDb21wb25lbnQgJiYgKFxuICAgICAgICAgICAgICAgICAgPENvbXBvbmVudExpYnJhcnlNZW51XG4gICAgICAgICAgICAgICAgICAgIG9wZW49e2NvbXBvbmVudE1lbnVPcGVufVxuICAgICAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9e29wZW5Db21wb25lbnRNZW51fVxuICAgICAgICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9e2Nsb3NlQ29tcG9uZW50TWVudX1cbiAgICAgICAgICAgICAgICAgICAgb25TZWxlY3Q9eyhrZXkpID0+IGFkZENvbXBvbmVudENvbXBvbmVudChrZXkpfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgey8qIOWkmuWqkuS9k+S4i+aLieiPnOWNle+8iOWbvueJhyAvIOmfs+S5kO+8iSAqL31cbiAgICAgICAgICAgICAgICB7aXNNdWx0aW1lZGlhICYmIG11bHRpbWVkaWFNZW51T3BlbiAmJiAoXG4gICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIGxlZnQtMS8yIHRvcC1mdWxsIHotNTAgbXQtMSB3LTQ0IC10cmFuc2xhdGUteC0xLzIgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGJnLXdoaXRlIHB5LTIgc2hhZG93LWxnXCJcbiAgICAgICAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXtvcGVuTXVsdGltZWRpYU1lbnV9XG4gICAgICAgICAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17Y2xvc2VNdWx0aW1lZGlhTWVudX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge01VTFRJTUVESUFfTUVOVV9JVEVNUy5tYXAoKGl0ZW0pID0+IChcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW0ua2V5fVxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpdGVtLmtleSA9PT0gJ2ltYWdlJykgZmlsZUlucHV0UmVmLmN1cnJlbnQ/LmNsaWNrKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGl0ZW0ua2V5ID09PSAnbXVzaWMnKSBzZXRNdXNpY01vZGFsT3Blbih0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBhbGVydCh0KCdlZGl0b3I6dG9vbC5jb21pbmdTb29uJykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRNdWx0aW1lZGlhTWVudU9wZW4oZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggdy1mdWxsIGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTIuNSB0ZXh0LWxlZnQgdGV4dC1zbSB0ZXh0LWdyYXktNzAwIHRyYW5zaXRpb24gaG92ZXI6YmctYmx1ZS01MCBob3Zlcjp0ZXh0LWJsdWUtNjAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPXt0KGl0ZW0ubGFiZWxLZXkpfVxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLmtleSA9PT0gJ2ltYWdlJyA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEltYWdlVG9vbEljb24gY2xhc3NOYW1lPVwiaC01IHctNVwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogaXRlbS5rZXkgPT09ICdtdXNpYycgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxNdXNpY1Rvb2xJY29uIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFZpZGVvVG9vbEljb24gY2xhc3NOYW1lPVwiaC01IHctNVwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+e3QoaXRlbS5sYWJlbEtleSl9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIOWPs+S+p+aTjeS9nOaMiemSru+8muWuv+S4u+S/oeaBryArIOeKtuaAgeaPkOekuuOAgeWPkeW4g++8iOWQq+WvvOWHuu+8ieOAgemAgOWHuiAqL31cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgIHsvKiDlrr/kuLvms6jlhaXnmoTpobnnm67lhYPkv6Hmga/vvIjov5DokKXnq6/mmL7npLrmqKHmnb8v5L2c5ZOB5ZCNK+eJiOacrOWPt++8jHdlYiDnq6/kuLrnqbrkuI3muLLmn5PvvIkgKi99XG4gICAgICAgICAge2hvc3RNZXRhICYmIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgYm9yZGVyLWwgYm9yZGVyLWdyYXktMjAwIHBsLTNcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwibWF4LXctWzIwMHB4XSB0cnVuY2F0ZSB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ncmF5LTcwMFwiPntob3N0TWV0YS50aXRsZX08L3NwYW4+XG4gICAgICAgICAgICAgIHtob3N0TWV0YS52ZXJzaW9uICE9IG51bGwgJiYgKFxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInJvdW5kZWQgYmctYmx1ZS01MCBweC0xLjUgcHktMC41IHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1ibHVlLTYwMFwiPnZ7aG9zdE1ldGEudmVyc2lvbn08L3NwYW4+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHtob3N0TWV0YS5oYXNEcmFmdCAmJiAoXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicm91bmRlZCBiZy1hbWJlci01MCBweC0xLjUgcHktMC41IHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1hbWJlci02MDBcIj7ojYnnqL88L3NwYW4+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHtob3N0TWV0YS5hY3Rpb25zfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7aXNEaXJ0eSAmJiAoXG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtYW1iZXItNTAwXCI+4pePIHt0KCdjb21tb246c3RhdHVzLnVuc2F2ZWQnKX08L3NwYW4+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7IWlzRGlydHkgJiYgIWlzU2F2aW5nICYmIChcbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTQwMFwiPnt0KCdjb21tb246c3RhdHVzLnNhdmVkJyl9PC9zcGFuPlxuICAgICAgICAgICl9XG4gICAgICAgICAge2lzU2F2aW5nICYmIChcbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ibHVlLTUwMFwiPnt0KCdjb21tb246c3RhdHVzLnNhdmluZycpfTwvc3Bhbj5cbiAgICAgICAgICApfVxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFB1Ymxpc2hPcGVuKHRydWUpfVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZCBiZy1yZWQtNTAwIHB4LTMgcHktMS41IHRleHQtc20gdGV4dC13aGl0ZSB0cmFuc2l0aW9uIGhvdmVyOmJnLXJlZC02MDBcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtleHBvcnRPbmx5ID8gdCgnZWRpdG9yOnRvb2xiYXIuZXhwb3J0V29yaycpIDogdCgnZWRpdG9yOnRvb2xiYXIucHVibGlzaCcpfVxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUJhY2t9XG4gICAgICAgICAgICBjbGFzc05hbWU9XCJyb3VuZGVkIGJnLWdyYXktNTAwIHB4LTMgcHktMS41IHRleHQtc20gdGV4dC13aGl0ZSB0cmFuc2l0aW9uIGhvdmVyOmJnLWdyYXktNjAwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICB7dCgnZWRpdG9yOnRvb2xiYXIuZXhpdEVkaXQnKX1cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2hlYWRlcj5cblxuICAgICAgey8qIOKUgOKUgCDkuLvkvZPkuInmoI/luIPlsYAg4pSA4pSAICovfVxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IG1pbi1oLTAgZmxleC0xXCI+XG4gICAgICAgIDxQYWdlTGlzdCAvPlxuICAgICAgICA8bWFpbiBjbGFzc05hbWU9XCJtaW4tdy0wIGZsZXgtMSBvdmVyZmxvdy1hdXRvIGJnLVsjZjBmMmY1XVwiPlxuICAgICAgICAgIDxFcnJvckJvdW5kYXJ5IG5hbWU9XCLnlLvluINcIj5cbiAgICAgICAgICAgIDxFZGl0b3JDYW52YXNcbiAgICAgICAgICAgICAgb25QcmV2aWV3PXsoKSA9PiBzZXRQcmV2aWV3T3Blbih0cnVlKX1cbiAgICAgICAgICAgICAgb25TZXR0aW5ncz17KCkgPT4gc2V0U2V0dGluZ3NPcGVuKHRydWUpfVxuICAgICAgICAgICAgICBvblNhdmU9e2FzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyDmiYvliqjkv53lrZjvvJrlv4XpobvnrYnnnJ/lrp7nu5Pmnpzlho3lj43ppojvvIzlpLHotKXopoHmmI7noa7mj5DnpLrvvIjngrnkuoYg4omgIOS/neWtmOaIkOWKn++8iVxuICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVkID0gYXdhaXQgc2F2ZVByb2plY3QodHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFzYXZlZCkgbm90aWZ5U2F2ZUZhaWxlZCgpO1xuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBpc1NhdmluZz17aXNTYXZpbmd9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgICAgPC9tYWluPlxuICAgICAgICA8RXJyb3JCb3VuZGFyeSBuYW1lPVwi5bGe5oCn6Z2i5p2/XCI+XG4gICAgICAgICAgPFByb3BlcnR5UGFuZWwgLz5cbiAgICAgICAgPC9FcnJvckJvdW5kYXJ5PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIHsvKiDilIDilIAg6aKE6KeIL+WPkeW4gy/niYjmnKzmqKHmgIHmoYYg4pSA4pSAICovfVxuICAgICAgPFByZXZpZXdNb2RhbCBvcGVuPXtwcmV2aWV3T3Blbn0gb25DbG9zZT17KCkgPT4gc2V0UHJldmlld09wZW4oZmFsc2UpfSBwcm9qZWN0PXtwcm9qZWN0fSAvPlxuICAgICAgPFB1Ymxpc2hNb2RhbFxuICAgICAgICBvcGVuPXtwdWJsaXNoT3Blbn1cbiAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0UHVibGlzaE9wZW4oZmFsc2UpfVxuICAgICAgICBwcm9qZWN0SWQ9e3Byb2plY3RJZH1cbiAgICAgICAgcHJvamVjdD17cHJvamVjdH1cbiAgICAgICAgY3VycmVudFBhZ2U9e2FjdGl2ZVBhZ2V9XG4gICAgICAgIG9uRXhwb3J0PXtoYW5kbGVFeHBvcnR9XG4gICAgICAgIGV4cG9ydE9ubHk9e2V4cG9ydE9ubHl9XG4gICAgICAvPlxuICAgICAgPFZlcnNpb25IaXN0b3J5TW9kYWxcbiAgICAgICAgb3Blbj17dmVyc2lvbk9wZW59XG4gICAgICAgIG9uQ2xvc2U9eygpID0+IHNldFZlcnNpb25PcGVuKGZhbHNlKX1cbiAgICAgICAgcHJvamVjdElkPXtwcm9qZWN0SWR9XG4gICAgICAvPlxuICAgICAgPFNldHRpbmdzUGFuZWxcbiAgICAgICAgb3Blbj17c2V0dGluZ3NPcGVufVxuICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRTZXR0aW5nc09wZW4oZmFsc2UpfVxuICAgICAgICBwcm9qZWN0PXtwcm9qZWN0fVxuICAgICAgICBvblNhdmU9eyh7IHRpdGxlOiBuZXdUaXRsZSwgc2V0dGluZ3M6IG5ld1NldHRpbmdzIH0pID0+IHtcbiAgICAgICAgICBpZiAobmV3VGl0bGUgIT09IHByb2plY3QudGl0bGUpIHNldFByb2plY3RUaXRsZShuZXdUaXRsZSk7XG4gICAgICAgICAgc2V0UHJvamVjdFNldHRpbmdzKG5ld1NldHRpbmdzKTtcbiAgICAgICAgfX1cbiAgICAgIC8+XG5cbiAgICAgIDxNdXNpY01hbmFnZXJNb2RhbFxuICAgICAgICBvcGVuPXttdXNpY01vZGFsT3Blbn1cbiAgICAgICAgY3VycmVudD17cHJvamVjdC5zZXR0aW5ncz8uYmFja2dyb3VuZE11c2ljfVxuICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRNdXNpY01vZGFsT3BlbihmYWxzZSl9XG4gICAgICAgIG9uU2F2ZT17KG11c2ljKSA9PiB7XG4gICAgICAgICAgc2V0UHJvamVjdFNldHRpbmdzKHtcbiAgICAgICAgICAgIC4uLmNyZWF0ZURlZmF1bHRTZXR0aW5ncygpLFxuICAgICAgICAgICAgLi4uKHByb2plY3Quc2V0dGluZ3MgPz8ge30pLFxuICAgICAgICAgICAgYmFja2dyb3VuZE11c2ljOiBtdXNpYyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBzZXRNdXNpY01vZGFsT3BlbihmYWxzZSk7XG4gICAgICAgIH19XG4gICAgICAvPlxuXG4gICAgICB7Lyog5a+85Ye65Zu+54mH77ya56a75bGP5riy5p+T5b2T5YmN6aG1IC8g5YWo6YOo6aG16ZW/5Zu+77yM5L6bIGh0bWwtdG8taW1hZ2Ug5oiq5Y+WICovfVxuICAgICAge2V4cG9ydGluZyAmJiBleHBvcnRQcm9qZWN0ICYmIChcbiAgICAgICAgPD5cbiAgICAgICAgICB7Lyog5b2T5YmN6aG1ICovfVxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGFyaWEtaGlkZGVuXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgICAgICAgbGVmdDogLTEwMDAwLFxuICAgICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICAgIHdpZHRoOiBleHBvcnRQcm9qZWN0LndpZHRoID8/IDM3NSxcbiAgICAgICAgICAgICAgaGVpZ2h0OiBleHBvcnRQcm9qZWN0LmhlaWdodCA/PyA2NjcsXG4gICAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgICAgICAgb3BhY2l0eTogMCxcbiAgICAgICAgICAgICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxuICAgICAgICAgICAgICB6SW5kZXg6IC0xLFxuICAgICAgICAgICAgICAvLyDkuI3lvLrliLbog4zmma/oibLvvJpET01SZW5kZXJlciDnmoQgQW5pbWF0ZWRQYWdlIOS8muagueaNriBwYWdlLmJhY2tncm91bmQg5riy5p+T77yMXG4gICAgICAgICAgICAgIC8vIOWMheaLrOWNiumAj+aYjuiDjOaZr++8m+iLpSBwYWdlLmJhY2tncm91bmQg5Li656m677yMQW5pbWF0ZWRQYWdlIOW3sum7mOiupOe6r+eZveWFnOW6leOAglxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIHJlZj17ZXhwb3J0UmVmfVxuICAgICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogZXhwb3J0UHJvamVjdC53aWR0aCA/PyAzNzUsIGhlaWdodDogZXhwb3J0UHJvamVjdC5oZWlnaHQgPz8gNjY3LCBvdmVyZmxvdzogJ2hpZGRlbicgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPERPTVJlbmRlcmVyIHByb2plY3Q9e2V4cG9ydFByb2plY3R9IGN1cnJlbnRQYWdlPXtleHBvcnRQYWdlUmVmLmN1cnJlbnR9IHNjYWxlPXsxfSBhbmltYXRlZD17ZmFsc2V9IC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB7Lyog5YWo6YOo6aG157q15ZCR6ZW/5Zu+ICovfVxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGFyaWEtaGlkZGVuXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgICAgICAgbGVmdDogLTEwMDAwLFxuICAgICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICAgIHdpZHRoOiBleHBvcnRQcm9qZWN0LndpZHRoID8/IDM3NSxcbiAgICAgICAgICAgICAgaGVpZ2h0OiAoZXhwb3J0UHJvamVjdC5oZWlnaHQgPz8gNjY3KSAqIE1hdGgubWF4KDEsIGV4cG9ydFByb2plY3QucGFnZXM/Lmxlbmd0aCA/PyAxKSxcbiAgICAgICAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICAgICAgICBvcGFjaXR5OiAwLFxuICAgICAgICAgICAgICBwb2ludGVyRXZlbnRzOiAnbm9uZScsXG4gICAgICAgICAgICAgIHpJbmRleDogLTEsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgcmVmPXtleHBvcnRBbGxSZWZ9XG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgd2lkdGg6IGV4cG9ydFByb2plY3Qud2lkdGggPz8gMzc1LFxuICAgICAgICAgICAgICAgIGhlaWdodDogKGV4cG9ydFByb2plY3QuaGVpZ2h0ID8/IDY2NykgKiBNYXRoLm1heCgxLCBleHBvcnRQcm9qZWN0LnBhZ2VzPy5sZW5ndGggPz8gMSksXG4gICAgICAgICAgICAgICAgb3ZlcmZsb3c6ICdoaWRkZW4nLFxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7ZXhwb3J0UHJvamVjdC5wYWdlcz8ubWFwKChfLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAga2V5PXtpfVxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGV4cG9ydFByb2plY3Qud2lkdGggPz8gMzc1LCBoZWlnaHQ6IGV4cG9ydFByb2plY3QuaGVpZ2h0ID8/IDY2Nywgb3ZlcmZsb3c6ICdoaWRkZW4nIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPERPTVJlbmRlcmVyIHByb2plY3Q9e2V4cG9ydFByb2plY3R9IGN1cnJlbnRQYWdlPXtpfSBzY2FsZT17MX0gYW5pbWF0ZWQ9e2ZhbHNlfSAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8Lz5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG4iXSwiZmlsZSI6IkQ6L015V29ya0J1ZGR5LzIwMjYtMDgtMTAtMjItMzktNTYvcGFja2FnZXMvZWRpdG9yL3NyYy9jb21wb25lbnRzL0VkaXRvci9FZGl0b3JBcHAudHN4In0=