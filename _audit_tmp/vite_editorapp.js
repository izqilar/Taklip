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
export default function EditorApp({ exportOnly = false } = {}) {
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
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (useEditorStore.getState().isDirty) saveInBackground();
    }, 3e4);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [saveInBackground]);
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
      navigate("/dashboard");
    } finally {
      exitingRef.current = false;
    }
  }, [saveProject, navigate, notifySaveFailed]);
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
        lineNumber: 864,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("header", { className: "flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent", children: "TAKLIP H5" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 877,
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
                lineNumber: 888,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 882,
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
                lineNumber: 896,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 890,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 881,
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
                  lineNumber: 906,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("path", { d: "M3.05 13A9 9 0 1 0 6 5.3L3 8" }, void 0, false, {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 907,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("path", { d: "M12 7v5l4 2" }, void 0, false, {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 908,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 905,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: t("editor:version.title") }, void 0, false, {
                fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                lineNumber: 910,
                columnNumber: 15
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 900,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 876,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 875,
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
                      lineNumber: 954,
                      columnNumber: 19
                    }, this) : tool.key === "shape" ? /* @__PURE__ */ jsxDEV(ShapeToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 956,
                      columnNumber: 19
                    }, this) : tool.key === "multimedia" ? /* @__PURE__ */ jsxDEV(MultimediaToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 958,
                      columnNumber: 19
                    }, this) : tool.key === "text" ? /* @__PURE__ */ jsxDEV(TextToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 960,
                      columnNumber: 19
                    }, this) : tool.key === "effect" ? /* @__PURE__ */ jsxDEV(EffectToolIcon, {}, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 962,
                      columnNumber: 19
                    }, this) : /* @__PURE__ */ jsxDEV("span", { className: "text-lg leading-none", children: tool.icon }, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 964,
                      columnNumber: 19
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "mt-0.5 text-xs", children: t(tool.labelKey) }, void 0, false, {
                      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                      lineNumber: 966,
                      columnNumber: 19
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                  lineNumber: 949,
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
                        lineNumber: 977,
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
                  lineNumber: 971,
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
                              lineNumber: 1008,
                              columnNumber: 27
                            }, this),
                            /* @__PURE__ */ jsxDEV("span", { children: t(item.labelKey) }, void 0, false, {
                              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                              lineNumber: 1009,
                              columnNumber: 27
                            }, this)
                          ] }, void 0, true, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1007,
                            columnNumber: 25
                          }, this),
                          item.shortcut && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: item.shortcut }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1012,
                            columnNumber: 21
                          }, this)
                        ]
                      },
                      item.key,
                      true,
                      {
                        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                        lineNumber: 1001,
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
                  lineNumber: 995,
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
                  lineNumber: 1021,
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
                            lineNumber: 1050,
                            columnNumber: 21
                          }, this) : item.key === "music" ? /* @__PURE__ */ jsxDEV(MusicToolIcon, { className: "h-5 w-5" }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1052,
                            columnNumber: 21
                          }, this) : /* @__PURE__ */ jsxDEV(VideoToolIcon, { className: "h-5 w-5" }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1054,
                            columnNumber: 21
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: t(item.labelKey) }, void 0, false, {
                            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                            lineNumber: 1056,
                            columnNumber: 25
                          }, this)
                        ]
                      },
                      item.key,
                      true,
                      {
                        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                        lineNumber: 1037,
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
                  lineNumber: 1031,
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
            lineNumber: 923,
            columnNumber: 15
          },
          this
        );
      }) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 916,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
        hostMeta && /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 border-l border-gray-200 pl-3", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "max-w-[200px] truncate text-sm font-semibold text-gray-700", children: hostMeta.title }, void 0, false, {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1071,
            columnNumber: 15
          }, this),
          hostMeta.version != null && /* @__PURE__ */ jsxDEV("span", { className: "rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600", children: [
            "v",
            hostMeta.version
          ] }, void 0, true, {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1073,
            columnNumber: 13
          }, this),
          hostMeta.hasDraft && /* @__PURE__ */ jsxDEV("span", { className: "rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600", children: "草稿" }, void 0, false, {
            fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
            lineNumber: 1076,
            columnNumber: 13
          }, this),
          hostMeta.actions
        ] }, void 0, true, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1070,
          columnNumber: 11
        }, this),
        isDirty && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-amber-500", children: [
          "● ",
          t("common:status.unsaved")
        ] }, void 0, true, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1082,
          columnNumber: 11
        }, this),
        !isDirty && !isSaving && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-gray-400", children: t("common:status.saved") }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1085,
          columnNumber: 11
        }, this),
        isSaving && /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-blue-500", children: t("common:status.saving") }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1088,
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
            lineNumber: 1090,
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
            lineNumber: 1096,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1067,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 873,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ jsxDEV(PageList, {}, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1107,
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
          lineNumber: 1110,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1109,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1108,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(ErrorBoundary, { name: "属性面板", children: /* @__PURE__ */ jsxDEV(PropertyPanel, {}, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1123,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
        lineNumber: 1122,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 1106,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(PreviewModal, { open: previewOpen, onClose: () => setPreviewOpen(false), project }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 1128,
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
        lineNumber: 1129,
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
        lineNumber: 1138,
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
        lineNumber: 1143,
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
        lineNumber: 1153,
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
                lineNumber: 1191,
                columnNumber: 15
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
              lineNumber: 1187,
              columnNumber: 13
            },
            this
          )
        },
        void 0,
        false,
        {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1171,
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
                      lineNumber: 1222,
                      columnNumber: 19
                    }, this)
                  },
                  i,
                  false,
                  {
                    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
                    lineNumber: 1218,
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
              lineNumber: 1209,
              columnNumber: 13
            },
            this
          )
        },
        void 0,
        false,
        {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
          lineNumber: 1195,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
      lineNumber: 1169,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/components/Editor/EditorApp.tsx",
    lineNumber: 863,
    columnNumber: 5
  }, this);
}
_s(EditorApp, "H91Q3FMQqTOS4ecBZS8v6aYOz4c=", false, function() {
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

//# sourceMappingURL=data:application/json;base64,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QUFFLEtBQUE2TjtBQUFBLGFBQUFwUCxJQUFBO0FBQUEsYUFBQUcsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBRSxLQUFBO0FBQUEsYUFBQUUsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBRSxLQUFBO0FBQUEsYUFBQUUsS0FBQTtBQUFBLGFBQUFFLEtBQUE7QUFBQSxhQUFBSSxLQUFBO0FBQUEsYUFBQUUsS0FBQTtBQUFBLGFBQUE2TixNQUFBIiwibmFtZXMiOlsidXNlU3RhdGUiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZVRyYW5zbGF0aW9uIiwidXNlTmF2aWdhdGUiLCJ0b0NhbnZhcyIsIlBhZ2VMaXN0IiwiUHJvcGVydHlQYW5lbCIsIkVycm9yQm91bmRhcnkiLCJFZGl0b3JDYW52YXMiLCJQcmV2aWV3TW9kYWwiLCJQdWJsaXNoTW9kYWwiLCJET01SZW5kZXJlciIsIlZlcnNpb25IaXN0b3J5TW9kYWwiLCJTZXR0aW5nc1BhbmVsIiwiTXVzaWNNYW5hZ2VyTW9kYWwiLCJDb21wb25lbnRMaWJyYXJ5TWVudSIsIkNPTVBPTkVOVF9JVEVNX01BUCIsInVzZUVkaXRvclN0b3JlIiwidXNlQ2FuVW5kbyIsInVzZUNhblJlZG8iLCJ1c2VLZXlib2FyZCIsInNlcnZpY2VzIiwidmFsaWRhdGVJbWFnZUZpbGUiLCJyZWFkSW1hZ2VEaW1lbnNpb25zIiwicHJlbG9hZEltYWdlcyIsImNsb25lQW5kSW5saW5lIiwiVFJBTlNQQVJFTlRfUE5HIiwiZG93bmxvYWREYXRhVXJsIiwiZG93bmxvYWRCbG9iIiwic2FuaXRpemVTY2hlbWEiLCJidWlsZEZvbnRFbWJlZENTUyIsImNvbGxlY3RGb250RmFtaWxpZXMiLCJjcmVhdGVEZWZhdWx0U2V0dGluZ3MiLCJkcmF3V2F0ZXJtYXJrIiwiVE9PTFMiLCJrZXkiLCJpY29uIiwibGFiZWxLZXkiLCJNVUxUSU1FRElBX01FTlVfSVRFTVMiLCJURVhUX1BSRVNFVFMiLCJmb250U2l6ZSIsImZvbnRXZWlnaHQiLCJTaGFwZU1lbnVJY29uIiwidHlwZSIsImljb25DbGFzcyIsIl9jIiwiQ29tcG9uZW50VG9vbEljb24iLCJjbGFzc05hbWUiLCJfYzIiLCJTaGFwZVRvb2xJY29uIiwiX2MzIiwiSW1hZ2VUb29sSWNvbiIsIl9jNCIsIlRleHRUb29sSWNvbiIsIl9jNSIsIk11c2ljVG9vbEljb24iLCJfYzYiLCJFZmZlY3RUb29sSWNvbiIsIl9jNyIsIk11bHRpbWVkaWFUb29sSWNvbiIsIl9jOCIsIlZpZGVvVG9vbEljb24iLCJfYzkiLCJTSEFQRV9NRU5VX0lURU1TIiwic2hvcnRjdXQiLCJVbmRvSWNvbiIsIl9jMCIsIlJlZG9JY29uIiwiX2MxIiwiRWRpdG9yQXBwIiwiZXhwb3J0T25seSIsIl9zIiwidCIsIm5hdmlnYXRlIiwidGl0bGUiLCJzIiwicHJvamVjdCIsInNldFByb2plY3RUaXRsZSIsImFjdGl2ZVBhZ2UiLCJwcm9qZWN0SWQiLCJpc0RpcnR5IiwiaXNTYXZpbmciLCJzZXRTYXZpbmciLCJzZXREaXJ0eSIsInNldFByb2plY3RJZCIsInNldFByb2plY3RTZXR0aW5ncyIsImFkZEVsZW1lbnQiLCJ1bmRvIiwicmVkbyIsImNhblVuZG8iLCJjYW5SZWRvIiwiaG9zdE1ldGEiLCJwcmV2aWV3T3BlbiIsInNldFByZXZpZXdPcGVuIiwicHVibGlzaE9wZW4iLCJzZXRQdWJsaXNoT3BlbiIsImZvbnRXYXRlcm1hcmsiLCJzZXRGb250V2F0ZXJtYXJrIiwidmVyc2lvbk9wZW4iLCJzZXRWZXJzaW9uT3BlbiIsInNldHRpbmdzT3BlbiIsInNldFNldHRpbmdzT3BlbiIsInRleHRNZW51T3BlbiIsInNldFRleHRNZW51T3BlbiIsInNoYXBlTWVudU9wZW4iLCJzZXRTaGFwZU1lbnVPcGVuIiwiY29tcG9uZW50TWVudU9wZW4iLCJzZXRDb21wb25lbnRNZW51T3BlbiIsIm11bHRpbWVkaWFNZW51T3BlbiIsInNldE11bHRpbWVkaWFNZW51T3BlbiIsIm11c2ljTW9kYWxPcGVuIiwic2V0TXVzaWNNb2RhbE9wZW4iLCJ0ZXh0TWVudVRpbWVyIiwic2hhcGVNZW51VGltZXIiLCJjb21wb25lbnRNZW51VGltZXIiLCJtdWx0aW1lZGlhTWVudVRpbWVyIiwiZXhwb3J0aW5nIiwic2V0RXhwb3J0aW5nIiwiZXhwb3J0aW5nUmVmIiwiZXhwb3J0UmVmIiwiZXhwb3J0UGFnZVJlZiIsImV4cG9ydEFsbFJlZiIsImV4cG9ydFByb2plY3QiLCJzZXRFeHBvcnRQcm9qZWN0IiwiZmlsZUlucHV0UmVmIiwibGFzdFNhdmVBdCIsImV4aXRpbmdSZWYiLCJzYXZlSW5GbGlnaHQiLCJub3RpZnlTYXZlRmFpbGVkIiwiYWxlcnQiLCJzYXZlUHJvamVjdCIsInNuYXBzaG90IiwiY3VycmVudCIsInJ1biIsInNhZmVTY2hlbWEiLCJ1cGRhdGVQcm9qZWN0Iiwic2NoZW1hIiwicmVzIiwiY3JlYXRlUHJvamVjdCIsImlkIiwiU3RyaW5nIiwiRGF0ZSIsIm5vdyIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsInNhdmVJbkJhY2tncm91bmQiLCJ0aGVuIiwib2siLCJhdXRvU2F2ZVRpbWVyIiwic2F2ZURlYm91bmNlIiwic2V0SW50ZXJ2YWwiLCJnZXRTdGF0ZSIsImNsZWFySW50ZXJ2YWwiLCJjbGVhclRpbWVvdXQiLCJzaW5jZUxhc3QiLCJ3YWl0IiwiTWF0aCIsIm1heCIsInNldFRpbWVvdXQiLCJvbkJsdXIiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInJlZnJlc2hGb250TGljZW5zZSIsImdldEZvbnRMaWNlbnNlIiwiciIsIndhdGVybWFyayIsImhhbmRsZUJhY2siLCJpIiwiaGFuZGxlRXhwb3J0Iiwib3B0cyIsIm1vZGUiLCJmb3JtYXQiLCJwYWdlIiwiZXhwb3J0SW1hZ2UiLCJzYXZlZCIsInN1ZmZpeCIsImJsb2IiLCJmb3JtYXRFeHQiLCJsaWNlbnNlZCIsIm1pc3NpbmciLCJsZW5ndGgiLCJqb2luIiwid2FybiIsImxvY2FsV2F0ZXJtYXJrIiwid2lkdGgiLCJoZWlnaHQiLCJsb2ciLCJpbWdNYXAiLCJzaXplIiwiaW5saW5lUHJvamVjdCIsIlByb21pc2UiLCJleHBvcnRQYWdlcyIsInBhZ2VzIiwiZmlsdGVyIiwiQm9vbGVhbiIsImZvbnRFbWJlZENTUyIsImJhY2tncm91bmRDb2xvciIsIm5vZGUiLCJhbGwiLCJBcnJheSIsImZyb20iLCJxdWVyeVNlbGVjdG9yQWxsIiwibWFwIiwiaW1nIiwiZGVjb2RlIiwiY2F0Y2giLCJ1bmRlZmluZWQiLCJpbWdTcmNzIiwic3JjIiwic2xpY2UiLCJwYWdlQ291bnQiLCJ0b3RhbEgiLCJwaXhlbFJhdGlvIiwiZmxvb3IiLCJjYW52YXMiLCJjYWNoZUJ1c3QiLCJpbWFnZVBsYWNlaG9sZGVyIiwic2tpcEZvbnRzIiwib25JbWFnZUVycm9ySGFuZGxlciIsImV2ZW50IiwidGFyZ2V0IiwiZmFpbGVkU3JjIiwiZGF0YVVybCIsImNhbnZhc1RvRGF0YVVybCIsImN0eCIsImdldENvbnRleHQiLCJkZXRhaWwiLCJFcnJvciIsIm5hbWUiLCJtZXNzYWdlIiwidG9EYXRhVVJMIiwiaGFuZGxlVXBsb2FkIiwiZSIsImZpbGUiLCJmaWxlcyIsImVycktleSIsImRpbXMiLCJhc3NldCIsInVwbG9hZEFzc2V0IiwidyIsImgiLCJzY2FsZSIsIm1pbiIsInVybCIsInJvdW5kIiwibmF0dXJhbFdpZHRoIiwibmF0dXJhbEhlaWdodCIsInZhbHVlIiwiYWRkVGV4dFByZXNldCIsInByZXNldCIsInRleHQiLCJmb250U3R5bGUiLCJoYW5kbGVUb29sQ2xpY2siLCJhZGRTaGFwZSIsImFkZENvbXBvbmVudENvbXBvbmVudCIsIm9wZW5NdWx0aW1lZGlhTWVudSIsIm9wZW5UZXh0TWVudSIsImNsb3NlVGV4dE1lbnUiLCJvcGVuU2hhcGVNZW51IiwiY2xvc2VTaGFwZU1lbnUiLCJvcGVuQ29tcG9uZW50TWVudSIsImNsb3NlQ29tcG9uZW50TWVudSIsImNsb3NlTXVsdGltZWRpYU1lbnUiLCJpdGVtIiwiZWxlbWVudFR5cGUiLCJ0b29sIiwiaXNUZXh0IiwiaXNTaGFwZSIsImlzQ29tcG9uZW50IiwiaXNNdWx0aW1lZGlhIiwiY2xpY2siLCJ2ZXJzaW9uIiwiaGFzRHJhZnQiLCJhY3Rpb25zIiwibmV3VGl0bGUiLCJzZXR0aW5ncyIsIm5ld1NldHRpbmdzIiwiYmFja2dyb3VuZE11c2ljIiwibXVzaWMiLCJwb3NpdGlvbiIsImxlZnQiLCJ0b3AiLCJvdmVyZmxvdyIsIm9wYWNpdHkiLCJwb2ludGVyRXZlbnRzIiwiekluZGV4IiwiXyIsIl9jMTAiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRWRpdG9yQXBwLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe8lui+keWZqOS4u+e7hOS7tiDigJQg5YWr5Zu+IEg1IOe8lui+keWZqOmjjuagvFxuICog6aG26YOo5Yqf6IO95Yy6ICsg5bem5L6n6aG16Z2iL+WbvuWxgumdouadvyArIOS4remXtOeUu+W4gyArIOWPs+S+p+WxnuaAp+mdouadv1xuICovXG5pbXBvcnQgeyB1c2VTdGF0ZSwgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlUmVmIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgdXNlVHJhbnNsYXRpb24gfSBmcm9tICdyZWFjdC1pMThuZXh0JztcbmltcG9ydCB7IHVzZU5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyB0b0NhbnZhcyB9IGZyb20gJ2h0bWwtdG8taW1hZ2UnO1xuaW1wb3J0IFBhZ2VMaXN0IGZyb20gJy4uL1BhbmVsL1BhZ2VMaXN0JztcbmltcG9ydCBQcm9wZXJ0eVBhbmVsIGZyb20gJy4uL1BhbmVsL1Byb3BlcnR5UGFuZWwnO1xuaW1wb3J0IEVycm9yQm91bmRhcnkgZnJvbSAnLi4vRXJyb3JCb3VuZGFyeSc7XG5pbXBvcnQgRWRpdG9yQ2FudmFzIGZyb20gJy4uL0NhbnZhcy9FZGl0b3JDYW52YXMnO1xuaW1wb3J0IFByZXZpZXdNb2RhbCBmcm9tICcuLi9QcmV2aWV3L1ByZXZpZXdNb2RhbCc7XG5pbXBvcnQgUHVibGlzaE1vZGFsIGZyb20gJy4uL1B1Ymxpc2gvUHVibGlzaE1vZGFsJztcbmltcG9ydCB0eXBlIHsgSW1hZ2VFeHBvcnRPcHRpb25zLCBJbWFnZUZvcm1hdCB9IGZyb20gJy4uL1B1Ymxpc2gvUHVibGlzaE1vZGFsJztcbmltcG9ydCBET01SZW5kZXJlciBmcm9tICcuLi9QcmV2aWV3L0RPTVJlbmRlcmVyJztcbmltcG9ydCBWZXJzaW9uSGlzdG9yeU1vZGFsIGZyb20gJy4vVmVyc2lvbkhpc3RvcnlNb2RhbCc7XG5pbXBvcnQgU2V0dGluZ3NQYW5lbCBmcm9tICcuL1NldHRpbmdzUGFuZWwnO1xuaW1wb3J0IE11c2ljTWFuYWdlck1vZGFsIGZyb20gJy4vTXVzaWNNYW5hZ2VyTW9kYWwnO1xuaW1wb3J0IENvbXBvbmVudExpYnJhcnlNZW51LCB7XG4gIENPTVBPTkVOVF9JVEVNX01BUCxcbiAgdHlwZSBDb21wb25lbnRJdGVtS2V5LFxufSBmcm9tICcuL0NvbXBvbmVudExpYnJhcnlNZW51JztcbmltcG9ydCB7IHVzZUVkaXRvclN0b3JlLCB1c2VDYW5VbmRvLCB1c2VDYW5SZWRvIH0gZnJvbSAnLi4vLi4vc3RvcmUvZWRpdG9yU3RvcmUnO1xuaW1wb3J0IHsgdXNlS2V5Ym9hcmQgfSBmcm9tICcuLi8uLi9ob29rcy91c2VLZXlib2FyZCc7XG5pbXBvcnQgeyBzZXJ2aWNlcyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzJztcbmltcG9ydCB7IHZhbGlkYXRlSW1hZ2VGaWxlLCByZWFkSW1hZ2VEaW1lbnNpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW1hZ2UnO1xuaW1wb3J0IHsgcHJlbG9hZEltYWdlcywgY2xvbmVBbmRJbmxpbmUsIFRSQU5TUEFSRU5UX1BORyB9IGZyb20gJy4uLy4uL3V0aWxzL2V4cG9ydFZpZGVvJztcbmltcG9ydCB7IGRvd25sb2FkRGF0YVVybCwgZG93bmxvYWRCbG9iIH0gZnJvbSAnLi4vLi4vdXRpbHMvZG93bmxvYWQnO1xuaW1wb3J0IHR5cGUgeyBFbGVtZW50LCBFbGVtZW50VHlwZSwgUHJvamVjdCB9IGZyb20gJ0BoNWRlc2lnbi9jb3JlJztcbmltcG9ydCB7IHNhbml0aXplU2NoZW1hIH0gZnJvbSAnQGg1ZGVzaWduL3JlbmRlcic7XG5pbXBvcnQgeyBidWlsZEZvbnRFbWJlZENTUywgY29sbGVjdEZvbnRGYW1pbGllcywgY3JlYXRlRGVmYXVsdFNldHRpbmdzLCBkcmF3V2F0ZXJtYXJrIH0gZnJvbSAnQGg1ZGVzaWduL2NvcmUnO1xuXG5jb25zdCBUT09MUyA9IFtcbiAgeyBrZXk6ICd0ZXh0JywgaWNvbjogJ1QnLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLnRleHQnIH0sXG4gIHsga2V5OiAnc2hhcGUnLCBpY29uOiAn4patJywgbGFiZWxLZXk6ICdlZGl0b3I6dG9vbC5zaGFwZScgfSxcbiAgeyBrZXk6ICdtdWx0aW1lZGlhJywgaWNvbjogJ/CfjqwnLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLm11bHRpbWVkaWEnIH0sXG4gIHsga2V5OiAnY29tcG9uZW50JywgaWNvbjogJ+KKnicsIGxhYmVsS2V5OiAnZWRpdG9yOnRvb2wuY29tcG9uZW50JyB9LFxuICB7IGtleTogJ2VmZmVjdCcsIGljb246ICfinKgnLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLmVmZmVjdCcgfSxcbl0gYXMgY29uc3Q7XG5cbi8qKiDlpJrlqpLkvZPkuIvmi4npobnvvJrlm77niYcgLyDpn7PkuZAgLyDop4bpopHvvIjlm77moIfmsr/nlKjpobbpg6jlt6XlhbfmoI/lr7nlupTnmoQgSW1hZ2VUb29sSWNvbiAvIE11c2ljVG9vbEljb24gLyBWaWRlb1Rvb2xJY29u77yJ44CCICovXG5jb25zdCBNVUxUSU1FRElBX01FTlVfSVRFTVM6IHsga2V5OiAnaW1hZ2UnIHwgJ211c2ljJyB8ICd2aWRlbyc7IGxhYmVsS2V5OiBzdHJpbmcgfVtdID0gW1xuICB7IGtleTogJ2ltYWdlJywgbGFiZWxLZXk6ICdlZGl0b3I6dG9vbC5pbWFnZScgfSxcbiAgeyBrZXk6ICdtdXNpYycsIGxhYmVsS2V5OiAnZWRpdG9yOnRvb2wubXVzaWMnIH0sXG4gIHsga2V5OiAndmlkZW8nLCBsYWJlbEtleTogJ2VkaXRvcjp0b29sLnZpZGVvJyB9LFxuXTtcblxuY29uc3QgVEVYVF9QUkVTRVRTID0gW1xuICB7IGtleTogJ2JvZHknLCBsYWJlbEtleTogJ2VkaXRvcjp0ZXh0UHJlc2V0LmJvZHknLCBmb250U2l6ZTogMTQsIGZvbnRXZWlnaHQ6ICdub3JtYWwnIGFzIGNvbnN0IH0sXG4gIHsga2V5OiAnc21hbGxUaXRsZScsIGxhYmVsS2V5OiAnZWRpdG9yOnRleHRQcmVzZXQuc21hbGxUaXRsZScsIGZvbnRTaXplOiAxOCwgZm9udFdlaWdodDogJ2JvbGQnIGFzIGNvbnN0IH0sXG4gIHsga2V5OiAnc3ViVGl0bGUnLCBsYWJlbEtleTogJ2VkaXRvcjp0ZXh0UHJlc2V0LnN1YlRpdGxlJywgZm9udFNpemU6IDI0LCBmb250V2VpZ2h0OiAnYm9sZCcgYXMgY29uc3QgfSxcbiAgeyBrZXk6ICd0aXRsZScsIGxhYmVsS2V5OiAnZWRpdG9yOnRleHRQcmVzZXQudGl0bGUnLCBmb250U2l6ZTogMzIsIGZvbnRXZWlnaHQ6ICdib2xkJyBhcyBjb25zdCB9LFxuICB7IGtleTogJ2JpZ1RpdGxlJywgbGFiZWxLZXk6ICdlZGl0b3I6dGV4dFByZXNldC5iaWdUaXRsZScsIGZvbnRTaXplOiA0OCwgZm9udFdlaWdodDogJ2JvbGQnIGFzIGNvbnN0IH0sXG5dO1xuXG5mdW5jdGlvbiBTaGFwZU1lbnVJY29uKHsgdHlwZSB9OiB7IHR5cGU6IHN0cmluZyB9KSB7XG4gIGNvbnN0IGljb25DbGFzcyA9ICdoLTQgdy00IHRleHQtY3VycmVudCc7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3JlY3QnOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCI+PHJlY3QgeD1cIjJcIiB5PVwiMlwiIHdpZHRoPVwiMTJcIiBoZWlnaHQ9XCIxMlwiIHJ4PVwiMlwiIC8+PC9zdmc+O1xuICAgIGNhc2UgJ2xpbmUnOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCI+PGxpbmUgeDE9XCIzXCIgeTE9XCIxM1wiIHgyPVwiMTNcIiB5Mj1cIjNcIiAvPjwvc3ZnPjtcbiAgICBjYXNlICdhcnJvdyc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8c3ZnIGNsYXNzTmFtZT17aWNvbkNsYXNzfSB2aWV3Qm94PVwiMCAwIDE2IDE2XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2VXaWR0aD1cIjEuNVwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIj5cbiAgICAgICAgICA8bGluZSB4MT1cIjNcIiB5MT1cIjEzXCIgeDI9XCIxM1wiIHkyPVwiM1wiIC8+XG4gICAgICAgICAgPHBvbHlsaW5lIHBvaW50cz1cIjYsMyAxMywzIDEzLDEwXCIgLz5cbiAgICAgICAgPC9zdmc+XG4gICAgICApO1xuICAgIGNhc2UgJ2VsbGlwc2UnOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCI+PGNpcmNsZSBjeD1cIjhcIiBjeT1cIjhcIiByPVwiNlwiIC8+PC9zdmc+O1xuICAgIGNhc2UgJ3BvbHlnb24nOlxuICAgICAgcmV0dXJuIDxzdmcgY2xhc3NOYW1lPXtpY29uQ2xhc3N9IHZpZXdCb3g9XCIwIDAgMTYgMTZcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiPjxwb2x5Z29uIHBvaW50cz1cIjgsMiAxNCwxMyAyLDEzXCIgLz48L3N2Zz47XG4gICAgY2FzZSAnc3Rhcic6XG4gICAgICByZXR1cm4gPHN2ZyBjbGFzc05hbWU9e2ljb25DbGFzc30gdmlld0JveD1cIjAgMCAxNiAxNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIxLjVcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCI+PHBvbHlnb24gcG9pbnRzPVwiOCwyIDkuNSw2IDE0LDYuNSAxMC41LDkuNSAxMS41LDE0IDgsMTEuNSA0LjUsMTQgNS41LDkuNSAyLDYuNSA2LjUsNlwiIC8+PC9zdmc+O1xuICAgIGNhc2UgJ2xpYnJhcnknOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPHN2ZyBjbGFzc05hbWU9e2ljb25DbGFzc30gdmlld0JveD1cIjAgMCAxNiAxNlwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIxLjVcIiBzdHJva2VMaW5lam9pbj1cInJvdW5kXCI+XG4gICAgICAgICAgPHJlY3QgeD1cIjJcIiB5PVwiMlwiIHdpZHRoPVwiNVwiIGhlaWdodD1cIjVcIiByeD1cIjFcIiAvPlxuICAgICAgICAgIDxyZWN0IHg9XCI5XCIgeT1cIjJcIiB3aWR0aD1cIjVcIiBoZWlnaHQ9XCI1XCIgcng9XCIxXCIgLz5cbiAgICAgICAgICA8cmVjdCB4PVwiMlwiIHk9XCI5XCIgd2lkdGg9XCI1XCIgaGVpZ2h0PVwiNVwiIHJ4PVwiMVwiIC8+XG4gICAgICAgICAgPHBvbHlnb24gcG9pbnRzPVwiMTEuNSwxNCA5LDkuNSAxNCw5LjVcIiAvPlxuICAgICAgICA8L3N2Zz5cbiAgICAgICk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIENvbXBvbmVudFRvb2xJY29uKHsgY2xhc3NOYW1lID0gJ2gtNSB3LTUnIH06IHsgY2xhc3NOYW1lPzogc3RyaW5nIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8c3ZnXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgIHN0cm9rZVdpZHRoPXsyfVxuICAgICAgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCJcbiAgICAgIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIlxuICAgICAgY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgPlxuICAgICAgPHJlY3Qgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjdcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIxXCIgLz5cbiAgICAgIDxyZWN0IHdpZHRoPVwiOVwiIGhlaWdodD1cIjdcIiB4PVwiM1wiIHk9XCIxNFwiIHJ4PVwiMVwiIC8+XG4gICAgICA8cmVjdCB3aWR0aD1cIjVcIiBoZWlnaHQ9XCI3XCIgeD1cIjE2XCIgeT1cIjE0XCIgcng9XCIxXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gU2hhcGVUb29sSWNvbih7IGNsYXNzTmFtZSA9ICdoLTUgdy01JyB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICBzdHJva2VXaWR0aD17Mn1cbiAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICBzdHJva2VMaW5lam9pbj1cInJvdW5kXCJcbiAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgID5cbiAgICAgIDxwYXRoIGQ9XCJNMTkuNSA3YTI0IDI0IDAgMCAxIDAgMTBcIiAvPlxuICAgICAgPHBhdGggZD1cIk00LjUgN2EyNCAyNCAwIDAgMCAwIDEwXCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNNyAxOS41YTI0IDI0IDAgMCAwIDEwIDBcIiAvPlxuICAgICAgPHBhdGggZD1cIk03IDQuNWEyNCAyNCAwIDAgMSAxMCAwXCIgLz5cbiAgICAgIDxyZWN0IHg9XCIxN1wiIHk9XCIxN1wiIHdpZHRoPVwiNVwiIGhlaWdodD1cIjVcIiByeD1cIjFcIiAvPlxuICAgICAgPHJlY3QgeD1cIjE3XCIgeT1cIjJcIiB3aWR0aD1cIjVcIiBoZWlnaHQ9XCI1XCIgcng9XCIxXCIgLz5cbiAgICAgIDxyZWN0IHg9XCIyXCIgeT1cIjE3XCIgd2lkdGg9XCI1XCIgaGVpZ2h0PVwiNVwiIHJ4PVwiMVwiIC8+XG4gICAgICA8cmVjdCB4PVwiMlwiIHk9XCIyXCIgd2lkdGg9XCI1XCIgaGVpZ2h0PVwiNVwiIHJ4PVwiMVwiIC8+XG4gICAgPC9zdmc+XG4gICk7XG59XG5cbmZ1bmN0aW9uIEltYWdlVG9vbEljb24oeyBjbGFzc05hbWUgPSAnaC01IHctNScgfTogeyBjbGFzc05hbWU/OiBzdHJpbmcgfSkge1xuICByZXR1cm4gKFxuICAgIDxzdmdcbiAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICBmaWxsPVwibm9uZVwiXG4gICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgc3Ryb2tlV2lkdGg9ezJ9XG4gICAgICBzdHJva2VMaW5lY2FwPVwicm91bmRcIlxuICAgICAgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiXG4gICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICA+XG4gICAgICA8cmVjdCB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB4PVwiM1wiIHk9XCIzXCIgcng9XCIyXCIgcnk9XCIyXCIgLz5cbiAgICAgIDxjaXJjbGUgY3g9XCI5XCIgY3k9XCI5XCIgcj1cIjJcIiAvPlxuICAgICAgPHBhdGggZD1cIm0yMSAxNS0zLjA4Ni0zLjA4NmEyIDIgMCAwIDAtMi44MjggMEw2IDIxXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gVGV4dFRvb2xJY29uKHsgY2xhc3NOYW1lID0gJ2gtNSB3LTUnIH06IHsgY2xhc3NOYW1lPzogc3RyaW5nIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8c3ZnXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgIHN0cm9rZVdpZHRoPXsyfVxuICAgICAgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCJcbiAgICAgIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIlxuICAgICAgY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgPlxuICAgICAgPHBhdGggZD1cIk0xMiA0djE2XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNNCA3VjVhMSAxIDAgMCAxIDEtMWgxNGExIDEgMCAwIDEgMSAxdjJcIiAvPlxuICAgICAgPHBhdGggZD1cIk05IDIwaDZcIiAvPlxuICAgIDwvc3ZnPlxuICApO1xufVxuXG5mdW5jdGlvbiBNdXNpY1Rvb2xJY29uKHsgY2xhc3NOYW1lID0gJ2gtNSB3LTUnIH06IHsgY2xhc3NOYW1lPzogc3RyaW5nIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8c3ZnXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCJcbiAgICAgIHZpZXdCb3g9XCIwIDAgMjQgMjRcIlxuICAgICAgZmlsbD1cIm5vbmVcIlxuICAgICAgc3Ryb2tlPVwiY3VycmVudENvbG9yXCJcbiAgICAgIHN0cm9rZVdpZHRoPXsyfVxuICAgICAgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCJcbiAgICAgIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIlxuICAgICAgY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgPlxuICAgICAgPHBhdGggZD1cIk05IDE4VjVsMTItMnYxM1wiIC8+XG4gICAgICA8Y2lyY2xlIGN4PVwiNlwiIGN5PVwiMThcIiByPVwiM1wiIC8+XG4gICAgICA8Y2lyY2xlIGN4PVwiMThcIiBjeT1cIjE2XCIgcj1cIjNcIiAvPlxuICAgIDwvc3ZnPlxuICApO1xufVxuXG5mdW5jdGlvbiBFZmZlY3RUb29sSWNvbih7IGNsYXNzTmFtZSA9ICdoLTUgdy01JyB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICBzdHJva2VXaWR0aD17Mn1cbiAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICBzdHJva2VMaW5lam9pbj1cInJvdW5kXCJcbiAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgID5cbiAgICAgIDxwYXRoIGQ9XCJNMTEuMDE3IDIuODE0YTEgMSAwIDAgMSAxLjk2NiAwbDEuMDUxIDUuNTU4YTIgMiAwIDAgMCAxLjU5NCAxLjU5NGw1LjU1OCAxLjA1MWExIDEgMCAwIDEgMCAxLjk2NmwtNS41NTggMS4wNTFhMiAyIDAgMCAwLTEuNTk0IDEuNTk0bC0xLjA1MSA1LjU1OGExIDEgMCAwIDEtMS45NjYgMGwtMS4wNTEtNS41NThhMiAyIDAgMCAwLTEuNTk0LTEuNTk0bC01LjU1OC0xLjA1MWExIDEgMCAwIDEgMC0xLjk2Nmw1LjU1OC0xLjA1MWEyIDIgMCAwIDAgMS41OTQtMS41OTR6XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNMjAgMnY0XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJNMjIgNGgtNFwiIC8+XG4gICAgICA8Y2lyY2xlIGN4PVwiNFwiIGN5PVwiMjBcIiByPVwiMlwiIC8+XG4gICAgPC9zdmc+XG4gICk7XG59XG5cbmZ1bmN0aW9uIE11bHRpbWVkaWFUb29sSWNvbih7IGNsYXNzTmFtZSA9ICdoLTUgdy01JyB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiXG4gICAgICB2aWV3Qm94PVwiMCAwIDI0IDI0XCJcbiAgICAgIGZpbGw9XCJub25lXCJcbiAgICAgIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiXG4gICAgICBzdHJva2VXaWR0aD17Mn1cbiAgICAgIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICBzdHJva2VMaW5lam9pbj1cInJvdW5kXCJcbiAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgID5cbiAgICAgIDxwYXRoIGQ9XCJNMTUgMTUuMDAzYTEgMSAwIDAgMSAxLjUxNy0uODU5bDQuOTk3IDIuOTk3YTEgMSAwIDAgMSAwIDEuNzE4bC00Ljk5NyAyLjk5N2ExIDEgMCAwIDEtMS41MTctLjg2elwiIC8+XG4gICAgICA8cGF0aCBkPVwiTTIxIDEyLjE3VjVhMiAyIDAgMCAwLTItMkg1YTIgMiAwIDAgMC0yIDJ2MTRhMiAyIDAgMCAwIDIgMmg2XCIgLz5cbiAgICAgIDxwYXRoIGQ9XCJtNiAyMSA1LTVcIiAvPlxuICAgICAgPGNpcmNsZSBjeD1cIjlcIiBjeT1cIjlcIiByPVwiMlwiIC8+XG4gICAgPC9zdmc+XG4gICk7XG59XG5cbmZ1bmN0aW9uIFZpZGVvVG9vbEljb24oeyBjbGFzc05hbWUgPSAnaC01IHctNScgfTogeyBjbGFzc05hbWU/OiBzdHJpbmcgfSkge1xuICByZXR1cm4gKFxuICAgIDxzdmdcbiAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIlxuICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICBmaWxsPVwibm9uZVwiXG4gICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgc3Ryb2tlV2lkdGg9ezJ9XG4gICAgICBzdHJva2VMaW5lY2FwPVwicm91bmRcIlxuICAgICAgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiXG4gICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICA+XG4gICAgICA8cGF0aCBkPVwibTE2IDEzIDUuMjIzIDMuNDgyYS41LjUgMCAwIDAgLjc3Ny0uNDE2VjcuODdhLjUuNSAwIDAgMC0uNzUyLS40MzJMMTYgMTAuNVwiIC8+XG4gICAgICA8cmVjdCB4PVwiMlwiIHk9XCI2XCIgd2lkdGg9XCIxNFwiIGhlaWdodD1cIjEyXCIgcng9XCIyXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuY29uc3QgU0hBUEVfTUVOVV9JVEVNUzogeyBrZXk6IHN0cmluZzsgbGFiZWxLZXk6IHN0cmluZzsgc2hvcnRjdXQ/OiBzdHJpbmcgfVtdID0gW1xuICB7IGtleTogJ3JlY3QnLCBsYWJlbEtleTogJ2VkaXRvcjpzaGFwZU1lbnUucmVjdCcsIHNob3J0Y3V0OiAnUicgfSxcbiAgeyBrZXk6ICdsaW5lJywgbGFiZWxLZXk6ICdlZGl0b3I6c2hhcGVNZW51LmxpbmUnLCBzaG9ydGN1dDogJ0wnIH0sXG4gIHsga2V5OiAnYXJyb3cnLCBsYWJlbEtleTogJ2VkaXRvcjpzaGFwZU1lbnUuYXJyb3cnLCBzaG9ydGN1dDogJ1NoaWZ0K0wnIH0sXG4gIHsga2V5OiAnZWxsaXBzZScsIGxhYmVsS2V5OiAnZWRpdG9yOnNoYXBlTWVudS5lbGxpcHNlJywgc2hvcnRjdXQ6ICdPJyB9LFxuICB7IGtleTogJ3BvbHlnb24nLCBsYWJlbEtleTogJ2VkaXRvcjpzaGFwZU1lbnUucG9seWdvbicgfSxcbiAgeyBrZXk6ICdzdGFyJywgbGFiZWxLZXk6ICdlZGl0b3I6c2hhcGVNZW51LnN0YXInIH0sXG4gIHsga2V5OiAnbGlicmFyeScsIGxhYmVsS2V5OiAnZWRpdG9yOnNoYXBlTWVudS5saWJyYXJ5Jywgc2hvcnRjdXQ6ICfigKYnIH0sXG5dO1xuXG5mdW5jdGlvbiBVbmRvSWNvbih7IGNsYXNzTmFtZSB9OiB7IGNsYXNzTmFtZT86IHN0cmluZyB9KSB7XG4gIHJldHVybiAoXG4gICAgPHN2ZyBjbGFzc05hbWU9e2NsYXNzTmFtZX0gdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIyXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiPlxuICAgICAgPHBhdGggZD1cIk05IDE0IDQgOWw1LTVcIiAvPlxuICAgICAgPHBhdGggZD1cIk00IDloMTAuNWE1LjUgNS41IDAgMCAxIDUuNSA1LjVhNS41IDUuNSAwIDAgMS01LjUgNS41SDExXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gUmVkb0ljb24oeyBjbGFzc05hbWUgfTogeyBjbGFzc05hbWU/OiBzdHJpbmcgfSkge1xuICByZXR1cm4gKFxuICAgIDxzdmcgY2xhc3NOYW1lPXtjbGFzc05hbWV9IHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMlwiIHN0cm9rZUxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZUxpbmVqb2luPVwicm91bmRcIj5cbiAgICAgIDxwYXRoIGQ9XCJtMTUgMTQgNS01LTUtNVwiIC8+XG4gICAgICA8cGF0aCBkPVwiTTIwIDlIOS41QTUuNSA1LjUgMCAwIDAgNCAxNC41QTUuNSA1LjUgMCAwIDAgOS41IDIwSDEzXCIgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFZGl0b3JBcHBQcm9wcyB7XG4gIC8qKlxuICAgKiDku4Xlr7zlh7rmqKHlvI/vvJrnvJbovpHlmajpobbmoI/jgIzlj5HluIPjgI3mjInpkq7lj5jkuLrjgIzlr7zlh7rjgI3vvIzlubbmiZPlvIDkuI3lkKvjgIznq4vljbPlj5HluIPjgI3pobXnrb7nmoRcbiAgICog5a+85Ye65a+56K+d5qGG44CC57uI56uv55So5oi377yId2ViIOerr++8ieayoeacieWPkeW4g+S9nOWTgS/lj5HluIPkuLrmqKHmnb/nmoTmnYPpmZDvvIzlj6rog73lr7zlh7rmlofku7bvvJtcbiAgICog6L+Q6JCl56uv77yIYWRtaW7vvInkuI3kvKDvvIzkv53nlZnlrozmlbTlj5HluIPog73lipvjgIJcbiAgICovXG4gIGV4cG9ydE9ubHk/OiBib29sZWFuO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBFZGl0b3JBcHAoeyBleHBvcnRPbmx5ID0gZmFsc2UgfTogRWRpdG9yQXBwUHJvcHMgPSB7fSkge1xuICB1c2VLZXlib2FyZCgpO1xuICBjb25zdCB7IHQgfSA9IHVzZVRyYW5zbGF0aW9uKFsnY29tbW9uJywgJ2VkaXRvcicsICdlcnJvcnMnXSk7XG4gIGNvbnN0IG5hdmlnYXRlID0gdXNlTmF2aWdhdGUoKTtcblxuICBjb25zdCB0aXRsZSA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnByb2plY3QudGl0bGUpO1xuICBjb25zdCBzZXRQcm9qZWN0VGl0bGUgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5zZXRQcm9qZWN0VGl0bGUpO1xuICBjb25zdCBwcm9qZWN0ID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMucHJvamVjdCk7XG4gIGNvbnN0IGFjdGl2ZVBhZ2UgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5hY3RpdmVQYWdlKTtcbiAgY29uc3QgcHJvamVjdElkID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMucHJvamVjdElkKTtcbiAgY29uc3QgaXNEaXJ0eSA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLmlzRGlydHkpO1xuICBjb25zdCBpc1NhdmluZyA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLmlzU2F2aW5nKTtcbiAgY29uc3Qgc2V0U2F2aW5nID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMuc2V0U2F2aW5nKTtcbiAgY29uc3Qgc2V0RGlydHkgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5zZXREaXJ0eSk7XG4gIGNvbnN0IHNldFByb2plY3RJZCA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnNldFByb2plY3RJZCk7XG4gIGNvbnN0IHNldFByb2plY3RTZXR0aW5ncyA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnNldFByb2plY3RTZXR0aW5ncyk7XG4gIGNvbnN0IGFkZEVsZW1lbnQgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5hZGRFbGVtZW50KTtcbiAgY29uc3QgdW5kbyA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLnVuZG8pO1xuICBjb25zdCByZWRvID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMucmVkbyk7XG4gIGNvbnN0IGNhblVuZG8gPSB1c2VDYW5VbmRvKCk7XG4gIGNvbnN0IGNhblJlZG8gPSB1c2VDYW5SZWRvKCk7XG4gIGNvbnN0IGhvc3RNZXRhID0gdXNlRWRpdG9yU3RvcmUoKHMpID0+IHMuaG9zdE1ldGEpO1xuXG4gIGNvbnN0IFtwcmV2aWV3T3Blbiwgc2V0UHJldmlld09wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbcHVibGlzaE9wZW4sIHNldFB1Ymxpc2hPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgLy8g5a2X5L2T5o6I5p2D5Yik5a6a57uT5p6c77ya5LuY6LS55a2X5L2T5pyq5o6I5p2DIOKGkiDpooTop4gv5pys5Zyw5YWc5bqV5a+85Ye65Y+g5Yqg5rC05Y2wXG4gIGNvbnN0IFtmb250V2F0ZXJtYXJrLCBzZXRGb250V2F0ZXJtYXJrXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3ZlcnNpb25PcGVuLCBzZXRWZXJzaW9uT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtzZXR0aW5nc09wZW4sIHNldFNldHRpbmdzT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFt0ZXh0TWVudU9wZW4sIHNldFRleHRNZW51T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtzaGFwZU1lbnVPcGVuLCBzZXRTaGFwZU1lbnVPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW2NvbXBvbmVudE1lbnVPcGVuLCBzZXRDb21wb25lbnRNZW51T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFttdWx0aW1lZGlhTWVudU9wZW4sIHNldE11bHRpbWVkaWFNZW51T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFttdXNpY01vZGFsT3Blbiwgc2V0TXVzaWNNb2RhbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCB0ZXh0TWVudVRpbWVyID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHNoYXBlTWVudVRpbWVyID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IGNvbXBvbmVudE1lbnVUaW1lciA9IHVzZVJlZjxSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGw+KG51bGwpO1xuICBjb25zdCBtdWx0aW1lZGlhTWVudVRpbWVyID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG5cbiAgLy8g5a+85Ye65Zu+54mH77ya56a75bGP5riy5p+T5b2T5YmN6aG1IC8g5YWo6YOo6aG16ZW/5Zu+5bm25oiq5Zu+5LiL6L29XG4gIGNvbnN0IFtleHBvcnRpbmcsIHNldEV4cG9ydGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IGV4cG9ydGluZ1JlZiA9IHVzZVJlZihmYWxzZSk7XG4gIGNvbnN0IGV4cG9ydFJlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudD4obnVsbCk7XG4gIC8vIOiusOW9leacrOasoeWvvOWHuuaMh+WumueahOmhteegge+8iOS+m+emu+WxjyBET00g5riy5p+T5b2T5YmN6aG15pe26K+75Y+W77yM5Yy65Yir5LqO57yW6L6R5Zmo5r+A5rS76aG1IGFjdGl2ZVBhZ2XvvIlcbiAgY29uc3QgZXhwb3J0UGFnZVJlZiA9IHVzZVJlZjxudW1iZXI+KDApO1xuICAvLyDplb/lm77mqKHlvI/kuIvmuLLmn5PjgIzlhajpg6jpobXjgI3nmoTnprvlsY/oioLngrnvvIjlm77niYflt7LlhoXogZTkuLogZGF0YVVSTCDop4Tpgb8gQ09SU++8iVxuICBjb25zdCBleHBvcnRBbGxSZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQ+KG51bGwpO1xuICBjb25zdCBbZXhwb3J0UHJvamVjdCwgc2V0RXhwb3J0UHJvamVjdF0gPSB1c2VTdGF0ZTxQcm9qZWN0IHwgbnVsbD4obnVsbCk7XG5cbiAgY29uc3QgZmlsZUlucHV0UmVmID0gdXNlUmVmPEhUTUxJbnB1dEVsZW1lbnQ+KG51bGwpO1xuICBjb25zdCBsYXN0U2F2ZUF0ID0gdXNlUmVmKDApO1xuICAvLyDpgIDlh7rnvJbovpHov5vooYzkuK3vvJrov57ngrnjgIzpgIDlh7rnvJbovpHjgI3kuI3lupTop6blj5HkuKTmrKHkv53lrZgv5Lik5qyh6Lez6L2sXG4gIGNvbnN0IGV4aXRpbmdSZWYgPSB1c2VSZWYoZmFsc2UpO1xuICAvLyDmraPlnKjpo57ooYznmoTkv53lrZjvvJrlubblj5Hop6blj5HvvIjoh6rliqjkv53lrZggLyDpgIDlh7ogLyDlr7zlh7rliY3vvInlpI3nlKjlkIzkuIDkuKogcHJvbWlzZe+8jFxuICAvLyDkvb/osIPnlKjmlrkgYXdhaXQg5Yiw55qE5rC46L+c5piv44CM6L+Z5qyh6JC95bqT55qE55yf5a6e57uT5p6c44CN77yM6ICM5LiN5piv44CM5bey5pyJ5L+d5a2Y6L+b6KGM5Lit44CN55qE56m66L+U5Zue44CCXG4gIGNvbnN0IHNhdmVJbkZsaWdodCA9IHVzZVJlZjxQcm9taXNlPGJvb2xlYW4+IHwgbnVsbD4obnVsbCk7XG5cbiAgLyoqIOS/neWtmOWksei0peaPkOekuu+8muS6pOS6kuWei+S/neWtmO+8iOaJi+WKqOS/neWtmCAvIOmAgOWHuiAvIOWvvOWHuuWJje+8ieW/hemhu+aYjuehruWRiuefpeeUqOaItyAqL1xuICBjb25zdCBub3RpZnlTYXZlRmFpbGVkID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGFsZXJ0KHQoJ2Vycm9yczplcnJvci5zYXZlRmFpbGVkJykpO1xuICB9LCBbdF0pO1xuXG4gIC8qKlxuICAgKiDkv53lrZjojYnnqL/jgIJcbiAgICog6L+U5ZueIFByb21pc2U8Ym9vbGVhbj7vvJp0cnVlID0g5pyN5Yqh56uv5bey5o6l5Y+X5YaZ5YWl77ybZmFsc2UgPSDlhpnlhaXlpLHotKXjgIJcbiAgICog5aSx6LSlKirkuI3lnKjlhoXpg6jlkJ7mjokqKu+8muS6pOeUseiwg+eUqOaWueWGs+WumuOAjOaPkOekuuW5tueVmeWcqOmhtemdouOAjei/mOaYr+OAjOe7p+e7reOAje+8jFxuICAgKiDlkKbliJnpgIDlh7rnvJbovpEgLyDmnI3liqHnq6/lr7zlh7rkvJrmiorlpLHotKXlvZPmiJDmiJDlip8g4oCU4oCUIOaUueWKqOmdmem7mOS4ouWkseOAgeWvvOWHuua4suafk+aXp+iNieeov+OAglxuICAgKi9cbiAgY29uc3Qgc2F2ZVByb2plY3QgPSB1c2VDYWxsYmFjayhcbiAgICAoc25hcHNob3QgPSBmYWxzZSk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgaWYgKHNhdmVJbkZsaWdodC5jdXJyZW50KSByZXR1cm4gc2F2ZUluRmxpZ2h0LmN1cnJlbnQ7XG4gICAgICBjb25zdCBydW4gPSAoYXN5bmMgKCk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgICBzZXRTYXZpbmcodHJ1ZSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8g6I2J56i/6Ze45Y+j77ya5L+d5a2Y5YmN5a+5IHNjaGVtYSDlgZrlronlhajmoKHpqozmtojmr5LvvIjlsIHpnaIv5aSW6ZO+L+WvjOaWh+acrO+8ie+8jFxuICAgICAgICAgIC8vIOehruS/neiQveW6k+eahCBkcmFmdFNjaGVtYSDkuI3lkKvljbHpmanlhoXlrrnvvIhYU1MgLyDmuLLmn5PltKnpmLLlvqHvvInjgIJcbiAgICAgICAgICAvLyBzYW5pdGl6ZVNjaGVtYSDov5Tlm57mt7Hmi7fotJ3vvIzkuI3kv67mlLnnvJbovpHlmajlhoUgcHJvamVjdCDnirbmgIHjgIJcbiAgICAgICAgICBjb25zdCBzYWZlU2NoZW1hID0gc2FuaXRpemVTY2hlbWEocHJvamVjdCk7XG4gICAgICAgICAgaWYgKHByb2plY3RJZCkge1xuICAgICAgICAgICAgYXdhaXQgc2VydmljZXMudXBkYXRlUHJvamVjdChwcm9qZWN0SWQsIHtcbiAgICAgICAgICAgICAgdGl0bGU6IHByb2plY3QudGl0bGUsXG4gICAgICAgICAgICAgIHNjaGVtYTogc2FmZVNjaGVtYSxcbiAgICAgICAgICAgICAgc25hcHNob3QsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgc2VydmljZXMuY3JlYXRlUHJvamVjdChwcm9qZWN0LnRpdGxlKTtcbiAgICAgICAgICAgIGF3YWl0IHNlcnZpY2VzLnVwZGF0ZVByb2plY3QocmVzLmlkLCB7IHNjaGVtYTogc2FmZVNjaGVtYSwgc25hcHNob3QgfSk7XG4gICAgICAgICAgICBzZXRQcm9qZWN0SWQoU3RyaW5nKHJlcy5pZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZXREaXJ0eShmYWxzZSk7XG4gICAgICAgICAgbGFzdFNhdmVBdC5jdXJyZW50ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignU2F2ZSBmYWlsZWQ6JywgZXJyKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgc2V0U2F2aW5nKGZhbHNlKTtcbiAgICAgICAgICBzYXZlSW5GbGlnaHQuY3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBzYXZlSW5GbGlnaHQuY3VycmVudCA9IHJ1bjtcbiAgICAgIHJldHVybiBydW47XG4gICAgfSxcbiAgICBbcHJvamVjdElkLCBwcm9qZWN0LCBzZXRTYXZpbmcsIHNldERpcnR5LCBzZXRQcm9qZWN0SWRdLFxuICApO1xuXG4gIC8qKiDlkI7lj7Doh6rliqjkv53lrZjvvJrlpLHotKXlj6rorrDml6Xlv5fvvIjpgb/lhY0gMzBzIOS4gOasoeeahOW8ueeql+mqmuaJsO+8ie+8jOmhtuagj+OAjOKXjyDmnKrkv53lrZjjgI3kvJrmjIHnu63mj5DnpLogKi9cbiAgY29uc3Qgc2F2ZUluQmFja2dyb3VuZCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICB2b2lkIHNhdmVQcm9qZWN0KCkudGhlbigob2spID0+IHtcbiAgICAgIGlmICghb2spIGNvbnNvbGUuZXJyb3IoJ1thdXRvc2F2ZV0g6I2J56i/5L+d5a2Y5aSx6LSl77yM5pS55Yqo5bCa5pyq6JC95bqTJyk7XG4gICAgfSk7XG4gIH0sIFtzYXZlUHJvamVjdF0pO1xuXG4gIC8qIOKUgOKUgCDoh6rliqjkv53lrZgg4pSA4pSAICovXG4gIGNvbnN0IGF1dG9TYXZlVGltZXIgPSB1c2VSZWY8UmV0dXJuVHlwZTx0eXBlb2Ygc2V0SW50ZXJ2YWw+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHNhdmVEZWJvdW5jZSA9IHVzZVJlZjxSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGw+KG51bGwpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXV0b1NhdmVUaW1lci5jdXJyZW50ID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHVzZUVkaXRvclN0b3JlLmdldFN0YXRlKCkuaXNEaXJ0eSkgc2F2ZUluQmFja2dyb3VuZCgpO1xuICAgIH0sIDMwMDAwKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKGF1dG9TYXZlVGltZXIuY3VycmVudCkgY2xlYXJJbnRlcnZhbChhdXRvU2F2ZVRpbWVyLmN1cnJlbnQpO1xuICAgIH07XG4gIH0sIFtzYXZlSW5CYWNrZ3JvdW5kXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWlzRGlydHkpIHJldHVybjtcbiAgICBpZiAoc2F2ZURlYm91bmNlLmN1cnJlbnQpIGNsZWFyVGltZW91dChzYXZlRGVib3VuY2UuY3VycmVudCk7XG4gICAgY29uc3Qgc2luY2VMYXN0ID0gRGF0ZS5ub3coKSAtIGxhc3RTYXZlQXQuY3VycmVudDtcbiAgICBjb25zdCB3YWl0ID0gc2luY2VMYXN0IDwgODAwMCA/IE1hdGgubWF4KDAsIDgwMDAgLSBzaW5jZUxhc3QpIDogMzAwMDtcbiAgICBzYXZlRGVib3VuY2UuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHVzZUVkaXRvclN0b3JlLmdldFN0YXRlKCkuaXNEaXJ0eSkgc2F2ZUluQmFja2dyb3VuZCgpO1xuICAgIH0sIHdhaXQpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAoc2F2ZURlYm91bmNlLmN1cnJlbnQpIGNsZWFyVGltZW91dChzYXZlRGVib3VuY2UuY3VycmVudCk7XG4gICAgfTtcbiAgfSwgW2lzRGlydHksIHNhdmVJbkJhY2tncm91bmRdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IG9uQmx1ciA9ICgpID0+IHtcbiAgICAgIGlmICh1c2VFZGl0b3JTdG9yZS5nZXRTdGF0ZSgpLmlzRGlydHkpIHNhdmVJbkJhY2tncm91bmQoKTtcbiAgICB9O1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgb25CbHVyKTtcbiAgICByZXR1cm4gKCkgPT4gd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2JsdXInLCBvbkJsdXIpO1xuICB9LCBbc2F2ZUluQmFja2dyb3VuZF0pO1xuXG4gIC8qKlxuICAgKiDliLfmlrDlrZfkvZPmjojmnYPnirbmgIHvvIjku5jotLnlrZfkvZPmnKrmjojmnYMg4oaSIOmihOiniC/mnKzlnLDlhZzlupXlr7zlh7rliqDmsLTljbDvvInjgIJcbiAgICog5Yik5a6a5Y+j5b6E5LiO5Y+R5biD44CB5pyN5Yqh56uv5a+85Ye65LiA6Ie077yM5Z2H55Sx5pyN5Yqh56uv57uZ5Ye677yM5a6i5oi356uv5Y+q5YGa5bGV56S644CCXG4gICAqL1xuICBjb25zdCByZWZyZXNoRm9udExpY2Vuc2UgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgaWYgKCFzZXJ2aWNlcy5nZXRGb250TGljZW5zZSB8fCAhcHJvamVjdElkKSB7XG4gICAgICBzZXRGb250V2F0ZXJtYXJrKGZhbHNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHIgPSBhd2FpdCBzZXJ2aWNlcy5nZXRGb250TGljZW5zZShwcm9qZWN0LCBwcm9qZWN0SWQpO1xuICAgICAgc2V0Rm9udFdhdGVybWFyayghIXIud2F0ZXJtYXJrKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIOWIpOWumuS4jeWPr+eUqOaXtuaUvuWuve+8iOS4jeivr+S8pOato+W4uOeUqOaIt++8ie+8muawtOWNsOS7peacjeWKoeerr+WvvOWHuue7k+aenOS4uuWHhlxuICAgICAgc2V0Rm9udFdhdGVybWFyayhmYWxzZSk7XG4gICAgfVxuICB9LCBbcHJvamVjdCwgcHJvamVjdElkXSk7XG5cbiAgLy8g5omT5byA6aKE6KeI5pe25Yi35paw5o6I5p2D54q25oCB77yI6aKE6KeI5rC05Y2w5Yik5o2u77yJXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHByZXZpZXdPcGVuKSB2b2lkIHJlZnJlc2hGb250TGljZW5zZSgpO1xuICB9LCBbcHJldmlld09wZW4sIHJlZnJlc2hGb250TGljZW5zZV0pO1xuXG4gIC8qKlxuICAgKiDpgIDlh7rnvJbovpHvvJoqKuW/hemhu+etieS/neWtmOecn+ato+iQveW6k+WQjuWGjei3s+i9rCoq77yM5ZCm5YiZ5pyA5ZCO5LiA5q6157yW6L6R5Lya6KKr5Lii5o6J44CCXG4gICAqIOS/neWtmOWksei0peaXtueVmeWcqOe8lui+keWZqOW5tuaYjuehruaKpemUme+8iOmhtuagj+WQjOaXtuS/neaMgeOAjOKXjyDmnKrkv53lrZjjgI3vvInvvIxcbiAgICog57ud5LiN6Z2Z6buY6Lez6L2sIOKAlOKAlCDot7PotbDkuoblsLHnrYnkuo7ov5nmrKHmlLnliqjml6Dlo7DmtojlpLHjgIJcbiAgICovXG4gIGNvbnN0IGhhbmRsZUJhY2sgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgaWYgKGV4aXRpbmdSZWYuY3VycmVudCkgcmV0dXJuO1xuICAgIGV4aXRpbmdSZWYuY3VycmVudCA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOWPlua2iOW+heinpuWPkeeahOmYsuaKluS/neWtmO+8muWug+WPquS8muWcqOi3s+i9rOS5i+WQjuaJjeWGmeW6k++8jOi/memHjOaUueS4uueri+WNs+S/neWtmOW5tuetieW+hee7k+aenFxuICAgICAgaWYgKHNhdmVEZWJvdW5jZS5jdXJyZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dChzYXZlRGVib3VuY2UuY3VycmVudCk7XG4gICAgICAgIHNhdmVEZWJvdW5jZS5jdXJyZW50ID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIOacgOWkmuS4pOi9ru+8muesrOS4gOi9ruWPr+iDveWkjeeUqOato+WcqOmjnuihjOeahOS/neWtmO+8iOWug+eUqOeahOaYr+eojeaXqeeahOW/q+eFp++8ie+8jFxuICAgICAgLy8g6Iul562J5b6F5pyf6Ze05Y+I5Lqn55Sf5LqG5paw5pS55Yqo77yIaXNEaXJ0eSDlho3mrKHkuLogdHJ1Ze+8ieWImeihpeWtmOS4gOasoe+8jOehruS/nemAgOWHuuWJjeaXoOaui+eVmeOAglxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpICs9IDEpIHtcbiAgICAgICAgaWYgKCF1c2VFZGl0b3JTdG9yZS5nZXRTdGF0ZSgpLmlzRGlydHkpIGJyZWFrO1xuICAgICAgICBpZiAoIShhd2FpdCBzYXZlUHJvamVjdCgpKSkge1xuICAgICAgICAgIG5vdGlmeVNhdmVGYWlsZWQoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG5hdmlnYXRlKCcvZGFzaGJvYXJkJyk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGV4aXRpbmdSZWYuY3VycmVudCA9IGZhbHNlO1xuICAgIH1cbiAgfSwgW3NhdmVQcm9qZWN0LCBuYXZpZ2F0ZSwgbm90aWZ5U2F2ZUZhaWxlZF0pO1xuXG4gIC8vIOWvvOWHuuWbvueJh++8mm1vZGU9J2N1cnJlbnQnIOaMh+WumumhteWNleWbvu+8jG1vZGU9J2FsbCcg5YWo6YOo6aG157q15ZCR6ZW/5Zu+77ybXG4gIC8vIGZvcm1hdCDlr7npvZDlj5HluIPorr7nva7lr7nor53moYbmiYDpgInlm77niYfmoLzlvI/vvIhqcGVnIC8gcG5nIC8gd2VicO+8ieOAglxuICBjb25zdCBoYW5kbGVFeHBvcnQgPSB1c2VDYWxsYmFjayhcbiAgICBhc3luYyAob3B0czogSW1hZ2VFeHBvcnRPcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCB7IG1vZGUsIGZvcm1hdCwgcGFnZSB9ID0gb3B0cztcbiAgICAgIGlmIChleHBvcnRpbmdSZWYuY3VycmVudCkgcmV0dXJuO1xuICAgICAgZXhwb3J0aW5nUmVmLmN1cnJlbnQgPSB0cnVlO1xuICAgICAgc2V0RXhwb3J0aW5nKHRydWUpO1xuICAgICAgLy8g6K6w5b2V5pys5qyh5a+85Ye655uu5qCH6aG156CB77yM5L6b56a75bGPIERPTSDmuLLmn5PmjIflrprpobXvvIjljLrliKvkuo7nvJbovpHlmajmv4DmtLvpobUgYWN0aXZlUGFnZe+8iVxuICAgICAgZXhwb3J0UGFnZVJlZi5jdXJyZW50ID0gcGFnZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIOKUgOKUgOKUgCDmnI3liqHnq6/lr7zlh7rvvIjlr7zlh7rnoazpl6jmp5vvvIzkvJjlhYjotbDov5nmnaHot6/vvInilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgICAgICAgLy8g5Li65LuA5LmI5b+F6aG755So5pyN5Yqh56uv5riy5p+T77ya5a6i5oi356uv6LS05Zu+77yIdG9EYXRhVVJML01lZGlhUmVjb3JkZXLvvInlj6/ooqvnm7TmjqXosIPnlKjnu5Xov4fku5jotLnmoKHpqozjgIJcbiAgICAgICAgLy8g5pyN5Yqh56uv5oyJIHByb2plY3RJZCDor7vlj5bmnIDmlrDnmoQgZHJhZnRTY2hlbWEg5riy5p+T77yM5YiG6L6o546H5LiO5rC05Y2w55SxIEF1dGhvcml6YXRpb24g5Yik5a6a77yMXG4gICAgICAgIC8vIOWuouaIt+err+aUueS7o+eggeS5n+aLv+S4jeWIsOmrmOa4heaXoOawtOWNsOaIkOWTge+8iOivpuingSBkb2NzL2ZvbnQtbGljZW5zaW5nLWRldi1kb2MubWQgwqdQaGFzZSAz77yJ44CCXG4gICAgICAgIGlmIChzZXJ2aWNlcy5leHBvcnRJbWFnZSAmJiBwcm9qZWN0SWQpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8g5pyN5Yqh56uv5oyJ6I2J56i/5riy5p+T77yM5a+85Ye65YmN5b+F6aG75YWI5oqK5b2T5YmN5pS55Yqo6JC95Li66I2J56i/77ybXG4gICAgICAgICAgICAvLyDkv53lrZjlpLHotKXlv4XpobvkuK3mraIg4oCU4oCUIOWQpuWImeacjeWKoeerr+a4suafk+eahOaYr+S4iuS4gOasoeeahOaXp+iNieeov++8jOWvvOWHuue7k+aenOS4jueUu+W4g+S4jeS4gOiHtOOAglxuICAgICAgICAgICAgaWYgKGlzRGlydHkpIHtcbiAgICAgICAgICAgICAgY29uc3Qgc2F2ZWQgPSBhd2FpdCBzYXZlUHJvamVjdCgpO1xuICAgICAgICAgICAgICBpZiAoIXNhdmVkKSB7XG4gICAgICAgICAgICAgICAgbm90aWZ5U2F2ZUZhaWxlZCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgciA9IGF3YWl0IHNlcnZpY2VzLmV4cG9ydEltYWdlKHtcbiAgICAgICAgICAgICAgcHJvamVjdElkLFxuICAgICAgICAgICAgICBwYWdlLFxuICAgICAgICAgICAgICBtb2RlOiBtb2RlID09PSAnYWxsJyA/ICdhbGwnIDogJ2N1cnJlbnQnLFxuICAgICAgICAgICAgICBmb3JtYXQsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IG1vZGUgPT09ICdhbGwnID8gJy3plb/lm74nIDogYC0ke3BhZ2UgKyAxfWA7XG4gICAgICAgICAgICBkb3dubG9hZEJsb2Ioci5ibG9iLCBgJHtwcm9qZWN0LnRpdGxlIHx8ICdoNSd9JHtzdWZmaXh9JHtmb3JtYXRFeHQoZm9ybWF0KX1gKTtcbiAgICAgICAgICAgIGlmICghci5saWNlbnNlZCAmJiByLm1pc3Npbmc/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICBhbGVydChcbiAgICAgICAgICAgICAgICBg5pys5qyh5a+85Ye65Li644CM6K+V55So54mI44CN77yI5ZCr5rC05Y2w44CB5YiG6L6o546H5bey6ZmN57qn77yJ44CCXFxuXFxu5Y6f5Zug77ya5L2/55So5Yiw5pyq5o6I5p2D5LuY6LS55a2X5L2TICR7ci5taXNzaW5nLmpvaW4oXG4gICAgICAgICAgICAgICAgICAn44CBJyxcbiAgICAgICAgICAgICAgICApfeOAglxcbui0reS5sOWMheWQq+ivpeWtl+S9k+eahOS7mOi0ueaooeadv+WQju+8jOWNs+WPr+WvvOWHuumrmOa4heaXoOawtOWNsOeJiOacrOOAgmAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAvLyDmnI3liqHnq6/lr7zlh7rkuI3lj6/nlKjml7bvvIjmnKrphY3nva7ml6DlpLTmtY/op4jlmajnrYnvvInpmY3nuqfkuLrmnKzlnLDlr7zlh7rvvIzkuI3pmLvmlq3nlKjmiLdcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW2V4cG9ydF0g5pyN5Yqh56uv5a+85Ye65aSx6LSl77yM5Zue6YCA5pys5Zyw5a+85Ye677yaJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8g5pyN5Yqh56uv5a+85Ye65LiN5Y+v55So5pe255qE5pys5Zyw5YWc5bqV6Lev5b6E77ya5LuN6aG76YG15a6I5a2X5L2T5o6I5p2DIOKAlOKAlCDmnKrmjojmnYPml7blnKggY2FudmFzIOS4ilxuICAgICAgICAvLyDlj6DliqDkuI7pooTop4jkuIDoh7TnmoTmsLTljbDvvIzpgb/lhY3jgIzmnI3liqHnq6/mlYXpmpzjgI3miJDkuLrnu5Xov4fku5jotLnnmoTml4Hot6/jgIJcbiAgICAgICAgbGV0IGxvY2FsV2F0ZXJtYXJrID0gZmFsc2U7XG4gICAgICAgIGlmIChzZXJ2aWNlcy5nZXRGb250TGljZW5zZSAmJiBwcm9qZWN0SWQpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgbG9jYWxXYXRlcm1hcmsgPSAhIShhd2FpdCBzZXJ2aWNlcy5nZXRGb250TGljZW5zZShwcm9qZWN0LCBwcm9qZWN0SWQpKS53YXRlcm1hcms7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBsb2NhbFdhdGVybWFyayA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3aWR0aCA9IHByb2plY3Qud2lkdGggPz8gMzc1O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBwcm9qZWN0LmhlaWdodCA/PyA2Njc7XG4gICAgICAgIC8vIOmihOWKoOi9veW5tuWGheiBlOaJgOacieWbvueJh+S4uiBkYXRhVVJM77yM6KeE6YG/IGh0bWwtdG8taW1hZ2Ug6L+c56iL5ouJ5Y+W55qEIENPUlMg5rGh5p+T77yI5pu+5pW05bGP56m655m977yJXG4gICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSBwcmVsb2FkSW1hZ2VzIHN0YXJ0Jyk7XG4gICAgICAgIGNvbnN0IGltZ01hcCA9IGF3YWl0IHByZWxvYWRJbWFnZXMocHJvamVjdCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSBwcmVsb2FkSW1hZ2VzIGRvbmUsIG1hcCBzaXplJywgaW1nTWFwLnNpemUpO1xuICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gY2xvbmVBbmRJbmxpbmUgc3RhcnQnKTtcbiAgICAgICAgY29uc3QgaW5saW5lUHJvamVjdCA9IGNsb25lQW5kSW5saW5lKHByb2plY3QsIGltZ01hcCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSBjbG9uZUFuZElubGluZSBkb25lJyk7XG4gICAgICAgIHNldEV4cG9ydFByb2plY3QoaW5saW5lUHJvamVjdCk7XG4gICAgICAgIC8vIOetieW+heemu+WxjyBET00g5o+Q5LqkICsg5Zu+54mH6Kej56CBXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIDYwMCkpO1xuXG4gICAgICAgIC8vIOWGheW1jOacrOmhteeUqOWIsOeahOiHquWumuS5ieWtl+S9k++8iEBmb250LWZhY2UgKyBiYXNlNjQgZGF0YSBVUkzvvInlkI7lho3miKrlm77jgIJcbiAgICAgICAgLy8g5Li65LuA5LmI5b+F6aG75YaF5bWM77ya5pys5Zyw5a+85Ye65oqKIERPTSDlhYvpmobov5sgU1ZHIOeahCA8Zm9yZWlnbk9iamVjdD4g5YaN5b2TKirlm77niYcqKua4suafk++8jFxuICAgICAgICAvLyDpgqPmmK/ni6znq4vmlofmoaPvvIzpobXpnaLph4znlKggRm9udEZhY2UgQVBJIOazqOWGjOeahOWtl+S9k+WcqOWFtuS4reS4jeWPr+ingSDihpIg5paH5a2X6Z2Z6buY5Zue6YCA57O757uf5a2X5L2TXG4gICAgICAgIC8vIO+8iOWNs+OAjOWvvOWHuuWbvumHjOaJgOacieaWh+acrOmDveWPmOaIkOm7mOiupOWtl+S9k+OAje+8ieOAgmh0bWwtdG8taW1hZ2Ug55qEIHNraXBGb250cyDkvJrnm7TmjqXkuKLmjonlrZfkvZPvvIxcbiAgICAgICAgLy8g5pWF5pS55Li655SxIGNvcmUg55Sf5oiQIGZvbnRFbWJlZENTUyDms6jlhaXjgILor6bop4EgY29yZSBgYnVpbGRGb250RW1iZWRDU1MoKWDjgIJcbiAgICAgICAgY29uc3QgZXhwb3J0UGFnZXMgPSAobW9kZSA9PT0gJ2FsbCcgPyBwcm9qZWN0LnBhZ2VzID8/IFtdIDogW3Byb2plY3QucGFnZXM/LltwYWdlXV0pLmZpbHRlcihCb29sZWFuKTtcbiAgICAgICAgbGV0IGZvbnRFbWJlZENTUyA9ICcnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZvbnRFbWJlZENTUyA9IGF3YWl0IGJ1aWxkRm9udEVtYmVkQ1NTKGNvbGxlY3RGb250RmFtaWxpZXMoZXhwb3J0UGFnZXMpKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdbZXhwb3J0XSDlhoXltYzoh6rlrprkuYnlrZfkvZPlpLHotKXvvIzlr7zlh7rmloflrZflj6/og73lm57pgIDns7vnu5/lrZfkvZPvvJonLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdbZXhwb3J0XSBmb250RW1iZWRDU1MgbGVuZ3RoID0nLCBmb250RW1iZWRDU1MubGVuZ3RoKTtcblxuICAgICAgICAvLyBqcGVnIOW/hemhu+S4jemAj+aYjuW6leiJsu+8iHBuZy93ZWJwIOayv+eUqOe8lui+keWZqOeUu+W4g+W6leiJsiAjZjBmMmY177yM5LiO6aKE6KeI5LiA6Ie077yJXG4gICAgICAgIGNvbnN0IGJhY2tncm91bmRDb2xvciA9IGZvcm1hdCA9PT0gJ2pwZWcnID8gJyNmZmZmZmYnIDogJyNmMGYyZjUnO1xuXG4gICAgICAgIGlmIChtb2RlID09PSAnYWxsJykge1xuICAgICAgICAgIGNvbnN0IG5vZGUgPSBleHBvcnRBbGxSZWYuY3VycmVudDtcbiAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW2V4cG9ydF0gZXhwb3J0QWxsUmVmIGlzIG51bGwnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICBBcnJheS5mcm9tKG5vZGUucXVlcnlTZWxlY3RvckFsbCgnaW1nJykpLm1hcCgoaW1nKSA9PlxuICAgICAgICAgICAgICBpbWcuZGVjb2RlKCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBpbWdTcmNzID0gQXJyYXkuZnJvbShub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJ2ltZycpKS5tYXAoKGltZykgPT4gaW1nLnNyYy5zbGljZSgwLCAxMjApKTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gRE9NIHJlYWR5IChhbGwpLCBpbWFnZXM9JywgaW1nU3Jjcy5sZW5ndGgsIGltZ1NyY3MpO1xuICAgICAgICAgIGNvbnN0IHBhZ2VDb3VudCA9IE1hdGgubWF4KDEsIGlubGluZVByb2plY3QucGFnZXM/Lmxlbmd0aCA/PyAxKTtcbiAgICAgICAgICBjb25zdCB0b3RhbEggPSBoZWlnaHQgKiBwYWdlQ291bnQ7XG4gICAgICAgICAgLy8gY2FudmFzIOS4iumZkOe6piAxNjM4NHB477yM6LaF5Ye65YiZ5LiL6LCDIHBpeGVsUmF0aW9cbiAgICAgICAgICBsZXQgcGl4ZWxSYXRpbyA9IDI7XG4gICAgICAgICAgaWYgKHRvdGFsSCAqIHBpeGVsUmF0aW8gPiAxNjM4NCkge1xuICAgICAgICAgICAgcGl4ZWxSYXRpbyA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IoMTYzODQgLyB0b3RhbEgpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIHRvQ2FudmFzKGFsbCkgc3RhcnQnLCB7IHdpZHRoLCB0b3RhbEgsIHBpeGVsUmF0aW8sIGZvcm1hdCB9KTtcbiAgICAgICAgICBjb25zdCBjYW52YXMgPSBhd2FpdCB0b0NhbnZhcyhub2RlLCB7XG4gICAgICAgICAgICAvLyDlt7LpooTliqDovb3lubblhoXogZTkuLogZGF0YVVSTO+8jOaXoOmcgCBjYWNoZUJ1c3TvvJtjYWNoZUJ1c3Qg5Y+v6IO956C05Z2PIGRhdGFVUkwg5a+86Ie0IGltZyBlcnJvcuOAglxuICAgICAgICAgICAgY2FjaGVCdXN0OiBmYWxzZSxcbiAgICAgICAgICAgIGltYWdlUGxhY2Vob2xkZXI6IFRSQU5TUEFSRU5UX1BORyxcbiAgICAgICAgICAgIC8vIOS4jei1sCBodG1sLXRvLWltYWdlIOiHquW4pueahOWtl+S9k+aKk+WPlu+8iOWug+WPquaJqyBkb2N1bWVudC5zdHlsZVNoZWV0c++8jOaJq+S4jeWIsFxuICAgICAgICAgICAgLy8gRm9udEZhY2Ug5rOo5YaM55qE5a2X5L2T77yM5LiU6Leo5Z+f5ouJIENTUyDlpLHotKXkvJrmlbTkvZMgcmVqZWN077yJ77yb5pS555So5LiK6Z2i55SxIGNvcmUg55Sf5oiQ55qEXG4gICAgICAgICAgICAvLyBmb250RW1iZWRDU1Mg4oCU4oCUIOWQqyBAZm9udC1mYWNlICsgYmFzZTY0IGRhdGEgVVJM77yM5peg6ZyA5Lu75L2V572R57uc6K+35rGC44CCXG4gICAgICAgICAgICBza2lwRm9udHM6IHRydWUsXG4gICAgICAgICAgICBmb250RW1iZWRDU1MsXG4gICAgICAgICAgICAvLyDkuI7nvJbovpHlmajnlLvluIPlupXoibLkuIDoh7TvvJrljYrpgI/mmI7og4zmma/oibLosIPkuI7nvJbovpHlmajlrozlhajkuIDoh7TvvIxcbiAgICAgICAgICAgIC8vIOmBv+WFjeWvvOWHuuWQjuWcqOeZveiJsuafpeeci+WZqC/nmb3oibLlvZXliLblupXkuIrop4LmhJ/lgY/mtYXvvIzpgKDmiJDjgIzpgI/mmI7luqbkuKLlpLHjgI3nmoTplJnop4njgIJcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcixcbiAgICAgICAgICAgIC8vIOWNleW8oOWbvueJh+WKoOi9veWksei0peaXtuiusOW9lSBVUkwg5bm255So5Y2g5L2N5Zu+5YWc5bqV77yM6YG/5YWN5pW05bygIFNWRyDliqDovb3lpLHotKXjgIJcbiAgICAgICAgICAgIC8vIOazqOaEj++8mmh0bWwtdG8taW1hZ2Ug5Y+q5oqK6L+U5Zue5YC8IHJlc29sdmXvvIzkuI3kvJroh6rliqjmlLnlhpkgc3Jj77yb5b+F6aG75omL5Yqo5oqKIGV2ZW50LnRhcmdldC5zcmNcbiAgICAgICAgICAgIC8vIOiuvuS4uuWNoOS9jeWbvu+8jOWQpuWImeWFi+mahuWHuueahCA8aW1nPiDku43kv53nlZnlpLHotKXnmoQgZGF0YTp0ZXh0L2h0bWwg5oiW56m6IHNyY++8jOWvvOWHuuS4uuepuueZveOAglxuICAgICAgICAgICAgb25JbWFnZUVycm9ySGFuZGxlcjogKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGV2ZW50ICYmIHR5cGVvZiBldmVudCA9PT0gJ29iamVjdCcgPyAoZXZlbnQgYXMgRXZlbnQpLnRhcmdldCBhcyBIVE1MSW1hZ2VFbGVtZW50IHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICBjb25zdCBmYWlsZWRTcmMgPSB0YXJnZXQ/LnNyYztcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbZXhwb3J0XSBpbWFnZSBsb2FkIGZhaWxlZCwgdXNpbmcgcGxhY2Vob2xkZXIuIHNyYz0nLCBmYWlsZWRTcmMpO1xuICAgICAgICAgICAgICBpZiAodGFyZ2V0ICYmIGZhaWxlZFNyYyAhPT0gVFJBTlNQQVJFTlRfUE5HKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHsgdGFyZ2V0LnNyYyA9IFRSQU5TUEFSRU5UX1BORzsgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIFRSQU5TUEFSRU5UX1BORztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwaXhlbFJhdGlvLFxuICAgICAgICAgICAgd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHRvdGFsSCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25zdCBkYXRhVXJsID0gY2FudmFzVG9EYXRhVXJsKGNhbnZhcywgZm9ybWF0KTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gdG9DYW52YXMoYWxsKSBkb25lLCBsZW5ndGgnLCBkYXRhVXJsLmxlbmd0aCk7XG4gICAgICAgICAgZG93bmxvYWREYXRhVXJsKGRhdGFVcmwsIGAke3Byb2plY3QudGl0bGUgfHwgJ2g1J30t6ZW/5Zu+JHtmb3JtYXRFeHQoZm9ybWF0KX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBub2RlID0gZXhwb3J0UmVmLmN1cnJlbnQ7XG4gICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tleHBvcnRdIGV4cG9ydFJlZiBpcyBudWxsJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgQXJyYXkuZnJvbShub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJ2ltZycpKS5tYXAoKGltZykgPT5cbiAgICAgICAgICAgICAgaW1nLmRlY29kZSgpLmNhdGNoKCgpID0+IHVuZGVmaW5lZCksXG4gICAgICAgICAgICApLFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgaW1nU3JjcyA9IEFycmF5LmZyb20obm9kZS5xdWVyeVNlbGVjdG9yQWxsKCdpbWcnKSkubWFwKChpbWcpID0+IGltZy5zcmMuc2xpY2UoMCwgMTIwKSk7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIERPTSByZWFkeSAoY3VycmVudCksIGltYWdlcz0nLCBpbWdTcmNzLmxlbmd0aCwgaW1nU3Jjcyk7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tleHBvcnRdIHRvQ2FudmFzKGN1cnJlbnQpIHN0YXJ0JywgeyB3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIHBhZ2U6IHBhZ2UgKyAxIH0pO1xuICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IGF3YWl0IHRvQ2FudmFzKG5vZGUsIHtcbiAgICAgICAgICAgIGNhY2hlQnVzdDogZmFsc2UsXG4gICAgICAgICAgICBpbWFnZVBsYWNlaG9sZGVyOiBUUkFOU1BBUkVOVF9QTkcsXG4gICAgICAgICAgICBza2lwRm9udHM6IHRydWUsXG4gICAgICAgICAgICBmb250RW1iZWRDU1MsXG4gICAgICAgICAgICAvLyDkuI7nvJbovpHlmajnlLvluIPlupXoibLkuIDoh7TvvJrljYrpgI/mmI7og4zmma/oibLosIPkuI7nvJbovpHlmajlrozlhajkuIDoh7TjgIJcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcixcbiAgICAgICAgICAgIG9uSW1hZ2VFcnJvckhhbmRsZXI6IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBldmVudCAmJiB0eXBlb2YgZXZlbnQgPT09ICdvYmplY3QnID8gKGV2ZW50IGFzIEV2ZW50KS50YXJnZXQgYXMgSFRNTEltYWdlRWxlbWVudCB8IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgY29uc3QgZmFpbGVkU3JjID0gdGFyZ2V0Py5zcmM7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2V4cG9ydF0gaW1hZ2UgbG9hZCBmYWlsZWQsIHVzaW5nIHBsYWNlaG9sZGVyLiBzcmM9JywgZmFpbGVkU3JjKTtcbiAgICAgICAgICAgICAgaWYgKHRhcmdldCAmJiBmYWlsZWRTcmMgIT09IFRSQU5TUEFSRU5UX1BORykge1xuICAgICAgICAgICAgICAgIHRyeSB7IHRhcmdldC5zcmMgPSBUUkFOU1BBUkVOVF9QTkc7IH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBUUkFOU1BBUkVOVF9QTkc7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGl4ZWxSYXRpbzogMixcbiAgICAgICAgICAgIHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIOacquaOiOadg+S7mOi0ueWtl+S9k++8muacrOWcsOWFnOW6leWvvOWHuuWQjOagt+aJk+awtOWNsO+8iOS4juacjeWKoeerr+WvvOWHuuWPo+W+hOS4gOiHtO+8iVxuICAgICAgICAgIGlmIChsb2NhbFdhdGVybWFyaykge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgICAgICBpZiAoY3R4KSBkcmF3V2F0ZXJtYXJrKGN0eCwgeyB3aWR0aCwgaGVpZ2h0IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBkYXRhVXJsID0gY2FudmFzVG9EYXRhVXJsKGNhbnZhcywgZm9ybWF0KTtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW2V4cG9ydF0gdG9DYW52YXMoY3VycmVudCkgZG9uZSwgbGVuZ3RoJywgZGF0YVVybC5sZW5ndGgpO1xuICAgICAgICAgIGRvd25sb2FkRGF0YVVybChkYXRhVXJsLCBgJHtwcm9qZWN0LnRpdGxlIHx8ICdoNSd9LSR7cGFnZSArIDF9JHtmb3JtYXRFeHQoZm9ybWF0KX1gKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tleHBvcnRdIEV4cG9ydCBmYWlsZWQ6JywgZXJyKTtcbiAgICAgICAgbGV0IGRldGFpbCA9ICfmnKrnn6XplJnor68nO1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIGRldGFpbCA9IGAke2Vyci5uYW1lfTogJHtlcnIubWVzc2FnZX1gO1xuICAgICAgICBlbHNlIGlmIChlcnIgJiYgdHlwZW9mIGVyciA9PT0gJ29iamVjdCcgJiYgJ3R5cGUnIGluIGVycikgZGV0YWlsID0gYEV2ZW50KCR7KGVyciBhcyB7IHR5cGU/OiBzdHJpbmcgfSkudHlwZX0pYDtcbiAgICAgICAgZWxzZSBkZXRhaWwgPSBTdHJpbmcoZXJyKTtcbiAgICAgICAgYWxlcnQoYCR7dCgnZWRpdG9yOnRvb2xiYXIuZXhwb3J0RmFpbGVkJyl9XFxuXFxuJHtkZXRhaWx9YCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBleHBvcnRpbmdSZWYuY3VycmVudCA9IGZhbHNlO1xuICAgICAgICBzZXRFeHBvcnRpbmcoZmFsc2UpO1xuICAgICAgICBzZXRFeHBvcnRQcm9qZWN0KG51bGwpO1xuICAgICAgfVxuICAgIH0sXG4gICAgW3Byb2plY3QsIHQsIHByb2plY3RJZCwgaXNEaXJ0eSwgc2F2ZVByb2plY3QsIG5vdGlmeVNhdmVGYWlsZWRdLFxuICApO1xuXG4gIC8qKiBjYW52YXMg4oaSIOebruagh+agvOW8jyBkYXRhVVJM77yIanBlZy93ZWJwIOW4puWOi+e8qei0qOmHj++8jHBuZyDml6DmjZ/vvIkgKi9cbiAgZnVuY3Rpb24gY2FudmFzVG9EYXRhVXJsKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQsIGZvcm1hdDogSW1hZ2VGb3JtYXQpOiBzdHJpbmcge1xuICAgIGlmIChmb3JtYXQgPT09ICdqcGVnJykgcmV0dXJuIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL2pwZWcnLCAwLjkyKTtcbiAgICBpZiAoZm9ybWF0ID09PSAnd2VicCcpIHJldHVybiBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS93ZWJwJywgMC45Mik7XG4gICAgcmV0dXJuIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpO1xuICB9XG5cbiAgLyoqIOWbvueJh+agvOW8jyDihpIg5paH5Lu25omp5bGV5ZCNICovXG4gIGZ1bmN0aW9uIGZvcm1hdEV4dChmb3JtYXQ6IEltYWdlRm9ybWF0KTogc3RyaW5nIHtcbiAgICBpZiAoZm9ybWF0ID09PSAnanBlZycpIHJldHVybiAnLmpwZyc7XG4gICAgaWYgKGZvcm1hdCA9PT0gJ3dlYnAnKSByZXR1cm4gJy53ZWJwJztcbiAgICByZXR1cm4gJy5wbmcnO1xuICB9XG5cbiAgY29uc3QgaGFuZGxlVXBsb2FkID0gdXNlQ2FsbGJhY2soXG4gICAgYXN5bmMgKGU6IFJlYWN0LkNoYW5nZUV2ZW50PEhUTUxJbnB1dEVsZW1lbnQ+KSA9PiB7XG4gICAgICBjb25zdCBmaWxlID0gZS50YXJnZXQuZmlsZXM/LlswXTtcbiAgICAgIGlmICghZmlsZSkgcmV0dXJuO1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8g5LiK5Lyg5YmN5YWI5YGa57G75Z6LL+S9k+enr+agoemqjO+8jOe7meWHuuWFt+S9k+mUmeivr+iAjOmdnuesvOe7n+eahOOAjOS4iuS8oOWksei0peOAjVxuICAgICAgICBjb25zdCBlcnJLZXkgPSB2YWxpZGF0ZUltYWdlRmlsZShmaWxlKTtcbiAgICAgICAgaWYgKGVycktleSkge1xuICAgICAgICAgIGFsZXJ0KHQoZXJyS2V5KSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIOWJjeerr+ivu+WPluecn+WunuWDj+e0oOWwuuWvuO+8jOmaj+S4iuS8oOaPkOS6pO+8jOS9v+aPkuWFpee8qeaUvuS4jue0oOadkOiusOW9leWwuuWvuOWHhuehrlxuICAgICAgICBsZXQgZGltczogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHwgbnVsbCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZGltcyA9IGF3YWl0IHJlYWRJbWFnZURpbWVuc2lvbnMoZmlsZSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIGRpbXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFzc2V0ID0gYXdhaXQgc2VydmljZXMudXBsb2FkQXNzZXQoZmlsZSwgZGltcyA/PyB1bmRlZmluZWQpO1xuICAgICAgICAvLyDpgJrov4cgYWRkRWxlbWVudCDliqDlhaXvvJpjcmVhdGVFbGVtZW50IOS8muihpem9kOWUr+S4gCBpZCDkuI7lhajpg6jln7rnoYDlrZfmrrXvvIxcbiAgICAgICAgLy8g6YG/5YWN5q2k5YmN55SoIGFkZEVsZW1lbnREYXRhIOS8oOijuOWvueixoeWvvOiHtCBpZCDkuLogdW5kZWZpbmVk77yMXG4gICAgICAgIC8vIOi/m+iAjOWkmuS4quWbvueJh+WFseeUqCB1bmRlZmluZWQgaWTvvIjmi5bmi70v6YCJ5LitL+aOkuW6j+S4suWPt+OAgeaXoOWPmOaNouahhuOAgeaXoOWxnuaAp+mdouadv++8ieOAglxuICAgICAgICAvLyDlkIzml7bmjInnlLvluIPlsLrlr7jnvKnmlL7vvIzpgb/lhY3ljp/lm77ov5zotoUgMzc1IOeUu+W4g+WvvOiHtOWPmOaNouahhuWHuueVjOOAglxuICAgICAgICBjb25zdCB3ID0gZGltcz8ud2lkdGggfHwgYXNzZXQud2lkdGggfHwgMjAwO1xuICAgICAgICBjb25zdCBoID0gZGltcz8uaGVpZ2h0IHx8IGFzc2V0LmhlaWdodCB8fCAyMDA7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gTWF0aC5taW4odyA+IDMyMCA/IDMyMCAvIHcgOiAxLCBoID4gNDgwID8gNDgwIC8gaCA6IDEpO1xuICAgICAgICBhZGRFbGVtZW50KCdpbWFnZScsIHtcbiAgICAgICAgICBzcmM6IGFzc2V0LnVybCxcbiAgICAgICAgICB3aWR0aDogTWF0aC5yb3VuZCh3ICogc2NhbGUpLFxuICAgICAgICAgIGhlaWdodDogTWF0aC5yb3VuZChoICogc2NhbGUpLFxuICAgICAgICAgIG5hdHVyYWxXaWR0aDogTWF0aC5yb3VuZCh3KSxcbiAgICAgICAgICBuYXR1cmFsSGVpZ2h0OiBNYXRoLnJvdW5kKGgpLFxuICAgICAgICB9IGFzIFBhcnRpYWw8RWxlbWVudD4pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgYWxlcnQodCgnZXJyb3JzOmVycm9yLnVwbG9hZEZhaWxlZCcpKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmIChmaWxlSW5wdXRSZWYuY3VycmVudCkgZmlsZUlucHV0UmVmLmN1cnJlbnQudmFsdWUgPSAnJztcbiAgICAgIH1cbiAgICB9LFxuICAgIFthZGRFbGVtZW50LCB0XSxcbiAgKTtcblxuICBjb25zdCBhZGRUZXh0UHJlc2V0ID0gdXNlQ2FsbGJhY2soXG4gICAgKHByZXNldDogdHlwZW9mIFRFWFRfUFJFU0VUU1tudW1iZXJdKSA9PiB7XG4gICAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKDMwMCwgMzYwIC0gcHJlc2V0LmZvbnRTaXplKTtcbiAgICAgIGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KDQwLCBwcmVzZXQuZm9udFNpemUgKiAyLjIpO1xuICAgICAgYWRkRWxlbWVudCgndGV4dCcsIHtcbiAgICAgICAgdGV4dDogdCgnZWRpdG9yOmRlZmF1bHRzLnRleHRDb250ZW50JyksXG4gICAgICAgIGZvbnRTaXplOiBwcmVzZXQuZm9udFNpemUsXG4gICAgICAgIGZvbnRTdHlsZTogcHJlc2V0LmZvbnRXZWlnaHQsXG4gICAgICAgIHdpZHRoLFxuICAgICAgICBoZWlnaHQsXG4gICAgICB9IGFzIFBhcnRpYWw8RWxlbWVudD4pO1xuICAgIH0sXG4gICAgW2FkZEVsZW1lbnQsIHRdLFxuICApO1xuXG4gIGNvbnN0IGhhbmRsZVRvb2xDbGljayA9IChrZXk6IHN0cmluZykgPT4ge1xuICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICBjYXNlICd0ZXh0JzpcbiAgICAgICAgYWRkVGV4dFByZXNldChURVhUX1BSRVNFVFNbMF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NoYXBlJzpcbiAgICAgICAgYWRkU2hhcGUoJ3JlY3QnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjb21wb25lbnQnOlxuICAgICAgICBhZGRDb21wb25lbnRDb21wb25lbnQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtdWx0aW1lZGlhJzpcbiAgICAgICAgb3Blbk11bHRpbWVkaWFNZW51KCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZWZmZWN0JzpcbiAgICAgICAgYWxlcnQodCgnZWRpdG9yOnRvb2wuY29taW5nU29vbicpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IG9wZW5UZXh0TWVudSA9ICgpID0+IHtcbiAgICBpZiAodGV4dE1lbnVUaW1lci5jdXJyZW50KSBjbGVhclRpbWVvdXQodGV4dE1lbnVUaW1lci5jdXJyZW50KTtcbiAgICBzZXRUZXh0TWVudU9wZW4odHJ1ZSk7XG4gIH07XG5cbiAgY29uc3QgY2xvc2VUZXh0TWVudSA9ICgpID0+IHtcbiAgICB0ZXh0TWVudVRpbWVyLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHNldFRleHRNZW51T3BlbihmYWxzZSk7XG4gICAgfSwgMTUwKTtcbiAgfTtcblxuICBjb25zdCBvcGVuU2hhcGVNZW51ID0gKCkgPT4ge1xuICAgIGlmIChzaGFwZU1lbnVUaW1lci5jdXJyZW50KSBjbGVhclRpbWVvdXQoc2hhcGVNZW51VGltZXIuY3VycmVudCk7XG4gICAgc2V0U2hhcGVNZW51T3Blbih0cnVlKTtcbiAgfTtcblxuICBjb25zdCBjbG9zZVNoYXBlTWVudSA9ICgpID0+IHtcbiAgICBzaGFwZU1lbnVUaW1lci5jdXJyZW50ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzZXRTaGFwZU1lbnVPcGVuKGZhbHNlKTtcbiAgICB9LCAxNTApO1xuICB9O1xuXG4gIGNvbnN0IGFkZFNoYXBlID0gKGtleTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKGtleSA9PT0gJ2xpYnJhcnknKSB7XG4gICAgICBhbGVydCh0KCdlZGl0b3I6dG9vbC5jb21pbmdTb29uJykpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhZGRFbGVtZW50KGtleSBhcyBFbGVtZW50VHlwZSk7XG4gICAgc2V0U2hhcGVNZW51T3BlbihmYWxzZSk7XG4gIH07XG5cbiAgY29uc3Qgb3BlbkNvbXBvbmVudE1lbnUgPSAoKSA9PiB7XG4gICAgaWYgKGNvbXBvbmVudE1lbnVUaW1lci5jdXJyZW50KSBjbGVhclRpbWVvdXQoY29tcG9uZW50TWVudVRpbWVyLmN1cnJlbnQpO1xuICAgIHNldENvbXBvbmVudE1lbnVPcGVuKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGNsb3NlQ29tcG9uZW50TWVudSA9ICgpID0+IHtcbiAgICBjb21wb25lbnRNZW51VGltZXIuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc2V0Q29tcG9uZW50TWVudU9wZW4oZmFsc2UpO1xuICAgIH0sIDE1MCk7XG4gIH07XG5cbiAgY29uc3Qgb3Blbk11bHRpbWVkaWFNZW51ID0gKCkgPT4ge1xuICAgIGlmIChtdWx0aW1lZGlhTWVudVRpbWVyLmN1cnJlbnQpIGNsZWFyVGltZW91dChtdWx0aW1lZGlhTWVudVRpbWVyLmN1cnJlbnQpO1xuICAgIHNldE11bHRpbWVkaWFNZW51T3Blbih0cnVlKTtcbiAgfTtcblxuICBjb25zdCBjbG9zZU11bHRpbWVkaWFNZW51OiAoKSA9PiB2b2lkID0gKCkgPT4ge1xuICAgIG11bHRpbWVkaWFNZW51VGltZXIuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc2V0TXVsdGltZWRpYU1lbnVPcGVuKGZhbHNlKTtcbiAgICB9LCAxNTApO1xuICB9O1xuXG4gIGNvbnN0IGFkZENvbXBvbmVudENvbXBvbmVudCA9IChrZXk/OiBDb21wb25lbnRJdGVtS2V5KSA9PiB7XG4gICAgaWYgKCFrZXkpIHtcbiAgICAgIC8vIOmhtumDqOKAnOe7hOS7tuKAneaMiemSrum7mOiupOaJk+W8gOiPnOWNle+8jOS4jeebtOaOpea3u+WKoOWFg+e0oFxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBpdGVtID0gQ09NUE9ORU5UX0lURU1fTUFQW2tleV07XG4gICAgaWYgKCFpdGVtLmVsZW1lbnRUeXBlKSB7XG4gICAgICBhbGVydCh0KCdlZGl0b3I6dG9vbC5jb21pbmdTb29uJykpO1xuICAgICAgc2V0Q29tcG9uZW50TWVudU9wZW4oZmFsc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhZGRFbGVtZW50KGl0ZW0uZWxlbWVudFR5cGUsIChpdGVtLnByZXNldCA/PyB7fSkgYXMgUGFydGlhbDxFbGVtZW50Pik7XG4gICAgc2V0Q29tcG9uZW50TWVudU9wZW4oZmFsc2UpO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJlZGl0b3ItY2FudmFzLXdyYXAgZmxleCBoLXNjcmVlbiBmbGV4LWNvbCBvdmVyZmxvdy1oaWRkZW4gYmctd2hpdGUgdGV4dC1ncmF5LTgwMFwiPlxuICAgICAgPGlucHV0XG4gICAgICAgIHJlZj17ZmlsZUlucHV0UmVmfVxuICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgIGFjY2VwdD1cImltYWdlLypcIlxuICAgICAgICBvbkNoYW5nZT17aGFuZGxlVXBsb2FkfVxuICAgICAgICBjbGFzc05hbWU9XCJoaWRkZW5cIlxuICAgICAgLz5cblxuICAgICAgey8qIOKUgOKUgCDpobbpg6jlip/og73ljLog4pSA4pSAICovfVxuICAgICAgPGhlYWRlciBjbGFzc05hbWU9XCJmbGV4IGgtMTQgc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBib3JkZXItYiBib3JkZXItZ3JheS0yMDAgYmctd2hpdGUgcHgtNCBzaGFkb3ctc21cIj5cbiAgICAgICAgey8qIOW3puS+p++8mkxvZ28gKyDmoIfpopjvvIjml6Dov5Tlm57mjInpkq7vvIznu5/kuIDnlKjlj7PkuIrop5LjgIzpgIDlh7rnvJbovpHjgI3vvIkgKi99XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJiZy1ncmFkaWVudC10by1yIGZyb20tYmx1ZS01MDAgdG8tY3lhbi00MDAgYmctY2xpcC10ZXh0IHRleHQteGwgZm9udC1leHRyYWJvbGQgdHJhY2tpbmctdGlnaHQgdGV4dC10cmFuc3BhcmVudFwiPlxuICAgICAgICAgICAgICBUQUtMSVAgSDVcbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIHsvKiDmkqTplIAgLyDph43lgZogKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1sLTMgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgYm9yZGVyLWwgYm9yZGVyLWdyYXktMjAwIHBsLTNcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3VuZG99XG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFjYW5VbmRvfVxuICAgICAgICAgICAgICAgIHRpdGxlPXt0KCdlZGl0b3I6dG9vbGJhci51bmRvJyl9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBoLTggdy04IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkIHRleHQtZ3JheS02MDAgdHJhbnNpdGlvbiBob3ZlcjpiZy1ibHVlLTUwIGhvdmVyOnRleHQtYmx1ZS02MDAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOnRleHQtZ3JheS0zMDAgZGlzYWJsZWQ6aG92ZXI6YmctdHJhbnNwYXJlbnRcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFVuZG9JY29uIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3JlZG99XG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFjYW5SZWRvfVxuICAgICAgICAgICAgICAgIHRpdGxlPXt0KCdlZGl0b3I6dG9vbGJhci5yZWRvJyl9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBoLTggdy04IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkIHRleHQtZ3JheS02MDAgdHJhbnNpdGlvbiBob3ZlcjpiZy1ibHVlLTUwIGhvdmVyOnRleHQtYmx1ZS02MDAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOnRleHQtZ3JheS0zMDAgZGlzYWJsZWQ6aG92ZXI6YmctdHJhbnNwYXJlbnRcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFJlZG9JY29uIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgey8qIOWOhuWPsueJiOacrO+8muenu+iHs+aSpOmUgC/ph43lgZrmjInpkq7lj7PkvqcgKi99XG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFZlcnNpb25PcGVuKHRydWUpfVxuICAgICAgICAgICAgICB0aXRsZT17dCgnZWRpdG9yOnZlcnNpb24udGl0bGUnKX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBoLTggaXRlbXMtY2VudGVyIGdhcC0xIHJvdW5kZWQgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCBweC0yIHRleHQtc20gdGV4dC1ncmF5LTYwMCB0cmFuc2l0aW9uIGhvdmVyOmJvcmRlci1ibHVlLTMwMCBob3Zlcjp0ZXh0LWJsdWUtNjAwXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHN2ZyBjbGFzc05hbWU9XCJoLTQgdy00XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIyXCIgc3Ryb2tlTGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlTGluZWpvaW49XCJyb3VuZFwiPlxuICAgICAgICAgICAgICAgIDxwYXRoIGQ9XCJNMyAzdjVoNVwiIC8+XG4gICAgICAgICAgICAgICAgPHBhdGggZD1cIk0zLjA1IDEzQTkgOSAwIDEgMCA2IDUuM0wzIDhcIiAvPlxuICAgICAgICAgICAgICAgIDxwYXRoIGQ9XCJNMTIgN3Y1bDQgMlwiIC8+XG4gICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICA8c3Bhbj57dCgnZWRpdG9yOnZlcnNpb24udGl0bGUnKX08L3NwYW4+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgey8qIOS4reWkruW3peWFt+aMiemSriAqL31cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxuICAgICAgICAgIHtUT09MUy5tYXAoKHRvb2wpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGlzVGV4dCA9IHRvb2wua2V5ID09PSAndGV4dCc7XG4gICAgICAgICAgICBjb25zdCBpc1NoYXBlID0gdG9vbC5rZXkgPT09ICdzaGFwZSc7XG4gICAgICAgICAgICBjb25zdCBpc0NvbXBvbmVudCA9IHRvb2wua2V5ID09PSAnY29tcG9uZW50JztcbiAgICAgICAgICAgIGNvbnN0IGlzTXVsdGltZWRpYSA9IHRvb2wua2V5ID09PSAnbXVsdGltZWRpYSc7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAga2V5PXt0b29sLmtleX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyZWxhdGl2ZVwiXG4gICAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXtcbiAgICAgICAgICAgICAgICAgIGlzVGV4dFxuICAgICAgICAgICAgICAgICAgICA/IG9wZW5UZXh0TWVudVxuICAgICAgICAgICAgICAgICAgICA6IGlzU2hhcGVcbiAgICAgICAgICAgICAgICAgICAgICA/IG9wZW5TaGFwZU1lbnVcbiAgICAgICAgICAgICAgICAgICAgICA6IGlzQ29tcG9uZW50XG4gICAgICAgICAgICAgICAgICAgICAgICA/IG9wZW5Db21wb25lbnRNZW51XG4gICAgICAgICAgICAgICAgICAgICAgICA6IGlzTXVsdGltZWRpYVxuICAgICAgICAgICAgICAgICAgICAgICAgICA/IG9wZW5NdWx0aW1lZGlhTWVudVxuICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9e1xuICAgICAgICAgICAgICAgICAgaXNUZXh0XG4gICAgICAgICAgICAgICAgICAgID8gY2xvc2VUZXh0TWVudVxuICAgICAgICAgICAgICAgICAgICA6IGlzU2hhcGVcbiAgICAgICAgICAgICAgICAgICAgICA/IGNsb3NlU2hhcGVNZW51XG4gICAgICAgICAgICAgICAgICAgICAgOiBpc0NvbXBvbmVudFxuICAgICAgICAgICAgICAgICAgICAgICAgPyBjbG9zZUNvbXBvbmVudE1lbnVcbiAgICAgICAgICAgICAgICAgICAgICAgIDogaXNNdWx0aW1lZGlhXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gY2xvc2VNdWx0aW1lZGlhTWVudVxuICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGhhbmRsZVRvb2xDbGljayh0b29sLmtleSl9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkIHB4LTUgcHktMS41IHRleHQtZ3JheS02MDAgdHJhbnNpdGlvbiBob3ZlcjpiZy1ibHVlLTUwIGhvdmVyOnRleHQtYmx1ZS02MDBcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHt0b29sLmtleSA9PT0gJ2NvbXBvbmVudCcgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxDb21wb25lbnRUb29sSWNvbiAvPlxuICAgICAgICAgICAgICAgICAgKSA6IHRvb2wua2V5ID09PSAnc2hhcGUnID8gKFxuICAgICAgICAgICAgICAgICAgICA8U2hhcGVUb29sSWNvbiAvPlxuICAgICAgICAgICAgICAgICAgKSA6IHRvb2wua2V5ID09PSAnbXVsdGltZWRpYScgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxNdWx0aW1lZGlhVG9vbEljb24gLz5cbiAgICAgICAgICAgICAgICAgICkgOiB0b29sLmtleSA9PT0gJ3RleHQnID8gKFxuICAgICAgICAgICAgICAgICAgICA8VGV4dFRvb2xJY29uIC8+XG4gICAgICAgICAgICAgICAgICApIDogdG9vbC5rZXkgPT09ICdlZmZlY3QnID8gKFxuICAgICAgICAgICAgICAgICAgICA8RWZmZWN0VG9vbEljb24gLz5cbiAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtbGcgbGVhZGluZy1ub25lXCI+eyh0b29sIGFzICh0eXBlb2YgVE9PTFMpW251bWJlcl0pLmljb259PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIm10LTAuNSB0ZXh0LXhzXCI+e3QodG9vbC5sYWJlbEtleSl9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuXG4gICAgICAgICAgICAgICAgey8qIOaWh+acrOW3peWFt+mihOiuvuiPnOWNlSAqL31cbiAgICAgICAgICAgICAgICB7aXNUZXh0ICYmIHRleHRNZW51T3BlbiAmJiAoXG4gICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIGxlZnQtMS8yIHRvcC1mdWxsIHotNTAgbXQtMSB3LTQ0IC10cmFuc2xhdGUteC0xLzIgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGJnLXdoaXRlIHB5LTIgc2hhZG93LWxnXCJcbiAgICAgICAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXtvcGVuVGV4dE1lbnV9XG4gICAgICAgICAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17Y2xvc2VUZXh0TWVudX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge1RFWFRfUFJFU0VUUy5tYXAoKHByZXNldCkgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIGtleT17cHJlc2V0LmtleX1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkVGV4dFByZXNldChwcmVzZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRUZXh0TWVudU9wZW4oZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggdy1mdWxsIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBweC00IHB5LTIuNSB0ZXh0LWNlbnRlciB0ZXh0LWdyYXktNzAwIHRyYW5zaXRpb24gaG92ZXI6YmctYmx1ZS01MCBob3Zlcjp0ZXh0LWJsdWUtNjAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGZvbnRTaXplOiBwcmVzZXQuZm9udFNpemUsIGZvbnRXZWlnaHQ6IHByZXNldC5mb250V2VpZ2h0IH19XG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT17dChwcmVzZXQubGFiZWxLZXkpfVxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIHt0KHByZXNldC5sYWJlbEtleSl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgIHsvKiDlvaLnirblt6XlhbfkuIvmi4noj5zljZUgKi99XG4gICAgICAgICAgICAgICAge2lzU2hhcGUgJiYgc2hhcGVNZW51T3BlbiAmJiAoXG4gICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIGxlZnQtMS8yIHRvcC1mdWxsIHotNTAgbXQtMSB3LTU2IC10cmFuc2xhdGUteC0xLzIgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGJnLXdoaXRlIHB5LTIgc2hhZG93LWxnXCJcbiAgICAgICAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXtvcGVuU2hhcGVNZW51fVxuICAgICAgICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9e2Nsb3NlU2hhcGVNZW51fVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7U0hBUEVfTUVOVV9JVEVNUy5tYXAoKGl0ZW0pID0+IChcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW0ua2V5fVxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gYWRkU2hhcGUoaXRlbS5rZXkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCB3LWZ1bGwgaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBweC00IHB5LTIuNSB0ZXh0LWxlZnQgdGV4dC1zbSB0ZXh0LWdyYXktNzAwIHRyYW5zaXRpb24gaG92ZXI6YmctYmx1ZS01MCBob3Zlcjp0ZXh0LWJsdWUtNjAwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPXt0KGl0ZW0ubGFiZWxLZXkpfVxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxTaGFwZU1lbnVJY29uIHR5cGU9e2l0ZW0ua2V5fSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57dChpdGVtLmxhYmVsS2V5KX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5zaG9ydGN1dCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmF5LTQwMFwiPntpdGVtLnNob3J0Y3V0fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgIHsvKiDnu4Tku7blupPkuIvmi4npnaLmnb8gKi99XG4gICAgICAgICAgICAgICAge2lzQ29tcG9uZW50ICYmIChcbiAgICAgICAgICAgICAgICAgIDxDb21wb25lbnRMaWJyYXJ5TWVudVxuICAgICAgICAgICAgICAgICAgICBvcGVuPXtjb21wb25lbnRNZW51T3Blbn1cbiAgICAgICAgICAgICAgICAgICAgb25Nb3VzZUVudGVyPXtvcGVuQ29tcG9uZW50TWVudX1cbiAgICAgICAgICAgICAgICAgICAgb25Nb3VzZUxlYXZlPXtjbG9zZUNvbXBvbmVudE1lbnV9XG4gICAgICAgICAgICAgICAgICAgIG9uU2VsZWN0PXsoa2V5KSA9PiBhZGRDb21wb25lbnRDb21wb25lbnQoa2V5KX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgIHsvKiDlpJrlqpLkvZPkuIvmi4noj5zljZXvvIjlm77niYcgLyDpn7PkuZDvvIkgKi99XG4gICAgICAgICAgICAgICAge2lzTXVsdGltZWRpYSAmJiBtdWx0aW1lZGlhTWVudU9wZW4gJiYgKFxuICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJhYnNvbHV0ZSBsZWZ0LTEvMiB0b3AtZnVsbCB6LTUwIG10LTEgdy00NCAtdHJhbnNsYXRlLXgtMS8yIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCBiZy13aGl0ZSBweS0yIHNoYWRvdy1sZ1wiXG4gICAgICAgICAgICAgICAgICAgIG9uTW91c2VFbnRlcj17b3Blbk11bHRpbWVkaWFNZW51fVxuICAgICAgICAgICAgICAgICAgICBvbk1vdXNlTGVhdmU9e2Nsb3NlTXVsdGltZWRpYU1lbnV9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIHtNVUxUSU1FRElBX01FTlVfSVRFTVMubWFwKChpdGVtKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtpdGVtLmtleX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbS5rZXkgPT09ICdpbWFnZScpIGZpbGVJbnB1dFJlZi5jdXJyZW50Py5jbGljaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChpdGVtLmtleSA9PT0gJ211c2ljJykgc2V0TXVzaWNNb2RhbE9wZW4odHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgYWxlcnQodCgnZWRpdG9yOnRvb2wuY29taW5nU29vbicpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0TXVsdGltZWRpYU1lbnVPcGVuKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IHctZnVsbCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtNCBweS0yLjUgdGV4dC1sZWZ0IHRleHQtc20gdGV4dC1ncmF5LTcwMCB0cmFuc2l0aW9uIGhvdmVyOmJnLWJsdWUtNTAgaG92ZXI6dGV4dC1ibHVlLTYwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT17dChpdGVtLmxhYmVsS2V5KX1cbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5rZXkgPT09ICdpbWFnZScgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxJbWFnZVRvb2xJY29uIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6IGl0ZW0ua2V5ID09PSAnbXVzaWMnID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8TXVzaWNUb29sSWNvbiBjbGFzc05hbWU9XCJoLTUgdy01XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxWaWRlb1Rvb2xJY29uIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPnt0KGl0ZW0ubGFiZWxLZXkpfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiDlj7Pkvqfmk43kvZzmjInpkq7vvJrlrr/kuLvkv6Hmga8gKyDnirbmgIHmj5DnpLrjgIHlj5HluIPvvIjlkKvlr7zlh7rvvInjgIHpgIDlh7ogKi99XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICB7Lyog5a6/5Li75rOo5YWl55qE6aG555uu5YWD5L+h5oGv77yI6L+Q6JCl56uv5pi+56S65qih5p2/L+S9nOWTgeWQjSvniYjmnKzlj7fvvIx3ZWIg56uv5Li656m65LiN5riy5p+T77yJICovfVxuICAgICAgICAgIHtob3N0TWV0YSAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIGJvcmRlci1sIGJvcmRlci1ncmF5LTIwMCBwbC0zXCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIm1heC13LVsyMDBweF0gdHJ1bmNhdGUgdGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtZ3JheS03MDBcIj57aG9zdE1ldGEudGl0bGV9PC9zcGFuPlxuICAgICAgICAgICAgICB7aG9zdE1ldGEudmVyc2lvbiAhPSBudWxsICYmIChcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJyb3VuZGVkIGJnLWJsdWUtNTAgcHgtMS41IHB5LTAuNSB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtYmx1ZS02MDBcIj52e2hvc3RNZXRhLnZlcnNpb259PC9zcGFuPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7aG9zdE1ldGEuaGFzRHJhZnQgJiYgKFxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInJvdW5kZWQgYmctYW1iZXItNTAgcHgtMS41IHB5LTAuNSB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtYW1iZXItNjAwXCI+6I2J56i/PC9zcGFuPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7aG9zdE1ldGEuYWN0aW9uc31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgICAge2lzRGlydHkgJiYgKFxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWFtYmVyLTUwMFwiPuKXjyB7dCgnY29tbW9uOnN0YXR1cy51bnNhdmVkJyl9PC9zcGFuPlxuICAgICAgICAgICl9XG4gICAgICAgICAgeyFpc0RpcnR5ICYmICFpc1NhdmluZyAmJiAoXG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtZ3JheS00MDBcIj57dCgnY29tbW9uOnN0YXR1cy5zYXZlZCcpfTwvc3Bhbj5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtpc1NhdmluZyAmJiAoXG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtYmx1ZS01MDBcIj57dCgnY29tbW9uOnN0YXR1cy5zYXZpbmcnKX08L3NwYW4+XG4gICAgICAgICAgKX1cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRQdWJsaXNoT3Blbih0cnVlKX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQgYmctcmVkLTUwMCBweC0zIHB5LTEuNSB0ZXh0LXNtIHRleHQtd2hpdGUgdHJhbnNpdGlvbiBob3ZlcjpiZy1yZWQtNjAwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICB7ZXhwb3J0T25seSA/IHQoJ2VkaXRvcjp0b29sYmFyLmV4cG9ydFdvcmsnKSA6IHQoJ2VkaXRvcjp0b29sYmFyLnB1Ymxpc2gnKX1cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVCYWNrfVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZCBiZy1ncmF5LTUwMCBweC0zIHB5LTEuNSB0ZXh0LXNtIHRleHQtd2hpdGUgdHJhbnNpdGlvbiBob3ZlcjpiZy1ncmF5LTYwMFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAge3QoJ2VkaXRvcjp0b29sYmFyLmV4aXRFZGl0Jyl9XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9oZWFkZXI+XG5cbiAgICAgIHsvKiDilIDilIAg5Li75L2T5LiJ5qCP5biD5bGAIOKUgOKUgCAqL31cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBtaW4taC0wIGZsZXgtMVwiPlxuICAgICAgICA8UGFnZUxpc3QgLz5cbiAgICAgICAgPG1haW4gY2xhc3NOYW1lPVwibWluLXctMCBmbGV4LTEgb3ZlcmZsb3ctYXV0byBiZy1bI2YwZjJmNV1cIj5cbiAgICAgICAgICA8RXJyb3JCb3VuZGFyeSBuYW1lPVwi55S75biDXCI+XG4gICAgICAgICAgICA8RWRpdG9yQ2FudmFzXG4gICAgICAgICAgICAgIG9uUHJldmlldz17KCkgPT4gc2V0UHJldmlld09wZW4odHJ1ZSl9XG4gICAgICAgICAgICAgIG9uU2V0dGluZ3M9eygpID0+IHNldFNldHRpbmdzT3Blbih0cnVlKX1cbiAgICAgICAgICAgICAgb25TYXZlPXthc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8g5omL5Yqo5L+d5a2Y77ya5b+F6aG7562J55yf5a6e57uT5p6c5YaN5Y+N6aaI77yM5aSx6LSl6KaB5piO56Gu5o+Q56S677yI54K55LqGIOKJoCDkv53lrZjmiJDlip/vvIlcbiAgICAgICAgICAgICAgICBjb25zdCBzYXZlZCA9IGF3YWl0IHNhdmVQcm9qZWN0KHRydWUpO1xuICAgICAgICAgICAgICAgIGlmICghc2F2ZWQpIG5vdGlmeVNhdmVGYWlsZWQoKTtcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgaXNTYXZpbmc9e2lzU2F2aW5nfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0Vycm9yQm91bmRhcnk+XG4gICAgICAgIDwvbWFpbj5cbiAgICAgICAgPEVycm9yQm91bmRhcnkgbmFtZT1cIuWxnuaAp+mdouadv1wiPlxuICAgICAgICAgIDxQcm9wZXJ0eVBhbmVsIC8+XG4gICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7Lyog4pSA4pSAIOmihOiniC/lj5HluIMv54mI5pys5qih5oCB5qGGIOKUgOKUgCAqL31cbiAgICAgIDxQcmV2aWV3TW9kYWwgb3Blbj17cHJldmlld09wZW59IG9uQ2xvc2U9eygpID0+IHNldFByZXZpZXdPcGVuKGZhbHNlKX0gcHJvamVjdD17cHJvamVjdH0gLz5cbiAgICAgIDxQdWJsaXNoTW9kYWxcbiAgICAgICAgb3Blbj17cHVibGlzaE9wZW59XG4gICAgICAgIG9uQ2xvc2U9eygpID0+IHNldFB1Ymxpc2hPcGVuKGZhbHNlKX1cbiAgICAgICAgcHJvamVjdElkPXtwcm9qZWN0SWR9XG4gICAgICAgIHByb2plY3Q9e3Byb2plY3R9XG4gICAgICAgIGN1cnJlbnRQYWdlPXthY3RpdmVQYWdlfVxuICAgICAgICBvbkV4cG9ydD17aGFuZGxlRXhwb3J0fVxuICAgICAgICBleHBvcnRPbmx5PXtleHBvcnRPbmx5fVxuICAgICAgLz5cbiAgICAgIDxWZXJzaW9uSGlzdG9yeU1vZGFsXG4gICAgICAgIG9wZW49e3ZlcnNpb25PcGVufVxuICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRWZXJzaW9uT3BlbihmYWxzZSl9XG4gICAgICAgIHByb2plY3RJZD17cHJvamVjdElkfVxuICAgICAgLz5cbiAgICAgIDxTZXR0aW5nc1BhbmVsXG4gICAgICAgIG9wZW49e3NldHRpbmdzT3Blbn1cbiAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0U2V0dGluZ3NPcGVuKGZhbHNlKX1cbiAgICAgICAgcHJvamVjdD17cHJvamVjdH1cbiAgICAgICAgb25TYXZlPXsoeyB0aXRsZTogbmV3VGl0bGUsIHNldHRpbmdzOiBuZXdTZXR0aW5ncyB9KSA9PiB7XG4gICAgICAgICAgaWYgKG5ld1RpdGxlICE9PSBwcm9qZWN0LnRpdGxlKSBzZXRQcm9qZWN0VGl0bGUobmV3VGl0bGUpO1xuICAgICAgICAgIHNldFByb2plY3RTZXR0aW5ncyhuZXdTZXR0aW5ncyk7XG4gICAgICAgIH19XG4gICAgICAvPlxuXG4gICAgICA8TXVzaWNNYW5hZ2VyTW9kYWxcbiAgICAgICAgb3Blbj17bXVzaWNNb2RhbE9wZW59XG4gICAgICAgIGN1cnJlbnQ9e3Byb2plY3Quc2V0dGluZ3M/LmJhY2tncm91bmRNdXNpY31cbiAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0TXVzaWNNb2RhbE9wZW4oZmFsc2UpfVxuICAgICAgICBvblNhdmU9eyhtdXNpYykgPT4ge1xuICAgICAgICAgIHNldFByb2plY3RTZXR0aW5ncyh7XG4gICAgICAgICAgICAuLi5jcmVhdGVEZWZhdWx0U2V0dGluZ3MoKSxcbiAgICAgICAgICAgIC4uLihwcm9qZWN0LnNldHRpbmdzID8/IHt9KSxcbiAgICAgICAgICAgIGJhY2tncm91bmRNdXNpYzogbXVzaWMsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2V0TXVzaWNNb2RhbE9wZW4oZmFsc2UpO1xuICAgICAgICB9fVxuICAgICAgLz5cblxuICAgICAgey8qIOWvvOWHuuWbvueJh++8muemu+Wxj+a4suafk+W9k+WJjemhtSAvIOWFqOmDqOmhtemVv+Wbvu+8jOS+myBodG1sLXRvLWltYWdlIOaIquWPliAqL31cbiAgICAgIHtleHBvcnRpbmcgJiYgZXhwb3J0UHJvamVjdCAmJiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgey8qIOW9k+WJjemhtSAqL31cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBhcmlhLWhpZGRlblxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgICAgIGxlZnQ6IC0xMDAwMCxcbiAgICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgICB3aWR0aDogZXhwb3J0UHJvamVjdC53aWR0aCA/PyAzNzUsXG4gICAgICAgICAgICAgIGhlaWdodDogZXhwb3J0UHJvamVjdC5oZWlnaHQgPz8gNjY3LFxuICAgICAgICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgICAgICAgIG9wYWNpdHk6IDAsXG4gICAgICAgICAgICAgIHBvaW50ZXJFdmVudHM6ICdub25lJyxcbiAgICAgICAgICAgICAgekluZGV4OiAtMSxcbiAgICAgICAgICAgICAgLy8g5LiN5by65Yi26IOM5pmv6Imy77yaRE9NUmVuZGVyZXIg55qEIEFuaW1hdGVkUGFnZSDkvJrmoLnmja4gcGFnZS5iYWNrZ3JvdW5kIOa4suafk++8jFxuICAgICAgICAgICAgICAvLyDljIXmi6zljYrpgI/mmI7og4zmma/vvJvoi6UgcGFnZS5iYWNrZ3JvdW5kIOS4uuepuu+8jEFuaW1hdGVkUGFnZSDlt7Lpu5jorqTnuq/nmb3lhZzlupXjgIJcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICByZWY9e2V4cG9ydFJlZn1cbiAgICAgICAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGV4cG9ydFByb2plY3Qud2lkdGggPz8gMzc1LCBoZWlnaHQ6IGV4cG9ydFByb2plY3QuaGVpZ2h0ID8/IDY2Nywgb3ZlcmZsb3c6ICdoaWRkZW4nIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxET01SZW5kZXJlciBwcm9qZWN0PXtleHBvcnRQcm9qZWN0fSBjdXJyZW50UGFnZT17ZXhwb3J0UGFnZVJlZi5jdXJyZW50fSBzY2FsZT17MX0gYW5pbWF0ZWQ9e2ZhbHNlfSAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgey8qIOWFqOmDqOmhtee6teWQkemVv+WbviAqL31cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBhcmlhLWhpZGRlblxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgICAgIGxlZnQ6IC0xMDAwMCxcbiAgICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgICB3aWR0aDogZXhwb3J0UHJvamVjdC53aWR0aCA/PyAzNzUsXG4gICAgICAgICAgICAgIGhlaWdodDogKGV4cG9ydFByb2plY3QuaGVpZ2h0ID8/IDY2NykgKiBNYXRoLm1heCgxLCBleHBvcnRQcm9qZWN0LnBhZ2VzPy5sZW5ndGggPz8gMSksXG4gICAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgICAgICAgb3BhY2l0eTogMCxcbiAgICAgICAgICAgICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxuICAgICAgICAgICAgICB6SW5kZXg6IC0xLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIHJlZj17ZXhwb3J0QWxsUmVmfVxuICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgIHdpZHRoOiBleHBvcnRQcm9qZWN0LndpZHRoID8/IDM3NSxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IChleHBvcnRQcm9qZWN0LmhlaWdodCA/PyA2NjcpICogTWF0aC5tYXgoMSwgZXhwb3J0UHJvamVjdC5wYWdlcz8ubGVuZ3RoID8/IDEpLFxuICAgICAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge2V4cG9ydFByb2plY3QucGFnZXM/Lm1hcCgoXywgaSkgPT4gKFxuICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgIGtleT17aX1cbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiBleHBvcnRQcm9qZWN0LndpZHRoID8/IDM3NSwgaGVpZ2h0OiBleHBvcnRQcm9qZWN0LmhlaWdodCA/PyA2NjcsIG92ZXJmbG93OiAnaGlkZGVuJyB9fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxET01SZW5kZXJlciBwcm9qZWN0PXtleHBvcnRQcm9qZWN0fSBjdXJyZW50UGFnZT17aX0gc2NhbGU9ezF9IGFuaW1hdGVkPXtmYWxzZX0gLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC8+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuIl0sImZpbGUiOiJEOi9NeVdvcmtCdWRkeS8yMDI2LTA4LTEwLTIyLTM5LTU2L3BhY2thZ2VzL2VkaXRvci9zcmMvY29tcG9uZW50cy9FZGl0b3IvRWRpdG9yQXBwLnRzeCJ9