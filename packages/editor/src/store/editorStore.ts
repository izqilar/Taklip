import { create } from 'zustand';
import type React from 'react';
// ⚠️ 必须是 type-only 导入：本文件只在类型位置使用 `Konva.Stage`（见下方 stageRef）。
// 写成值导入会把整个 Konva（约 1MB）拖进所有引用 store 的模块/页面（含 web 的顶部导航、
// 作品列表等与画布无关的页面），显著拖慢首屏。
import type Konva from 'konva';
import type { Element, Project, Page } from '@h5design/core';
import {
  createProject,
  createElement,
  createDefaultSettings,
  genId,
  CANVAS_DEFAULT,
} from '@h5design/core';
import type { ElementType } from '@h5design/core';

const MAX_HISTORY = 50;

/* ───────── History helpers ───────── */

function snapshot(project: Project): Project {
  return JSON.parse(JSON.stringify(project));
}

/**
 * 把一页元素的 zIndex 压缩为连续的 0..n-1，保留原有先后顺序。
 * 这样可保证元素 zIndex 永不为负 —— 否者在 DOM 预览里，
 * 负 z-index 的子元素会被绘制到「页面背景」之后而不可见。
 * 页面背景始终视为最底层，元素层级只在 [0, n-1] 区间内调整。
 */
function normalizeZ(els: Element[]): Element[] {
  const sorted = [...els].sort((a, b) => a.zIndex - b.zIndex);
  return sorted.map((e, i) => (e.zIndex === i ? e : { ...e, zIndex: i }));
}

interface HistoryState {
  past: Project[];
  future: Project[];
}

/* ───────── Store ───────── */

interface EditorState {
  /* data */
  project: Project;
  selectedId: string | null;
  /** 当前选中的元素 ID 列表（支持多选），selectedId 为其中第一个 */
  selectedIds: string[];
  activePage: number;

  /* canvas */
  /** 当前编辑器 Konva Stage 实例，供动画面板等外部组件访问 */
  stageRef: Konva.Stage | null;
  setStageRef: (stage: Konva.Stage | null) => void;

  /* history */
  past: Project[];
  future: Project[];

  /* clipboard（支持多选：数组，单元素时也以数组承载） */
  clipboard: Element[];

  /* api state */
  projectId: string | null;
  isSaving: boolean;
  isDirty: boolean;
  isLoading: false;

  /* host meta：宿主（web/admin）注入的项目元信息，显示在编辑器顶栏右侧 */
  hostMeta: {
    title?: string;
    version?: number;
    hasDraft?: boolean;
    /** 宿主自定义操作区（如"放弃草稿"按钮），渲染在顶栏右侧 */
    actions?: React.ReactNode;
  } | null;
  setHostMeta: (meta: EditorState['hostMeta']) => void;

  /* selection */
  select: (id: string | null, options?: { toggle?: boolean; add?: boolean }) => void;
  toggleSelectedId: (id: string) => void;
  setSelection: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;

  /* history actions */
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  /* element actions */
  /**
   * 添加元素。overrides 用于由视图层注入本地化占位内容（如文本默认文案），
   * store 层不持有任何语言文案。
   */
  addElement: (type: ElementType, overrides?: Partial<Element>) => void;
  addElementData: (el: Element) => void;
  updateElement: (id: string, patch: Partial<Element>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  /** 按「从上到下」（front→back）的视觉顺序重排当前页图层，并重新分配 zIndex */
  reorderElements: (orderedIds: string[]) => void;

  /* alignment / distribution / mirror */
  alignLeft: (toPage?: boolean) => void;
  alignCenterX: (toPage?: boolean) => void;
  alignRight: (toPage?: boolean) => void;
  alignTop: (toPage?: boolean) => void;
  alignCenterY: (toPage?: boolean) => void;
  alignBottom: (toPage?: boolean) => void;
  distributeHorizontal: () => void;
  distributeVertical: () => void;
  mirrorHorizontal: (toPage?: boolean) => void;
  mirrorVertical: (toPage?: boolean) => void;

  /* clipboard（支持多选复制/剪切/粘贴） */
  copyElement: (ids: string | string[]) => void;
  cutElement: (ids: string | string[]) => void;
  removeElements: (ids: string[]) => void;
  pasteElement: () => void;

  /* page actions */
  addPage: () => void;
  deletePage: (index: number) => void;
  switchPage: (index: number) => void;
  renamePage: (index: number, name: string) => void;
  reorderPages: (from: number, to: number) => void;
  setPageBackground: (color: string) => void;
  setPageHeight: (height: number) => void;
  setProjectWidth: (width: number) => void;
  setPageLongPage: (longPage: boolean) => void;
  setPageBackgroundImage: (src: string) => void;
  setPageBackgroundImageOpacity: (opacity: number) => void;
  setPageBackgroundSize: (size: string) => void;
  setPageBackgroundRepeat: (repeat: string) => void;
  syncPageBackgroundToAll: () => void;

  /* project */
  setProjectTitle: (title: string) => void;
  setProjectSettings: (settings: Project['settings']) => void;
  loadProject: (project: Project, projectId?: string) => void;
  newProject: () => void;

  /* api */
  setProjectId: (id: string | null) => void;
  setSaving: (saving: boolean) => void;
  setDirty: (dirty: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createProject(),
  selectedId: null,
  selectedIds: [],
  activePage: 0,

  stageRef: null,
  setStageRef: (stage) => set({ stageRef: stage }),

  past: [],
  future: [],

  clipboard: [],

  projectId: null,
  isSaving: false,
  isDirty: false,
  isLoading: false,

  /* host meta */
  hostMeta: null,
  setHostMeta: (meta) => set({ hostMeta: meta }),

  /* ── selection ── */
  select: (id, options) =>
    set((state) => {
      if (id == null) {
        return { selectedId: null, selectedIds: [] };
      }
      if (options?.toggle) {
        const setIds = new Set(state.selectedIds);
        if (setIds.has(id)) setIds.delete(id);
        else setIds.add(id);
        const arr = Array.from(setIds);
        return { selectedId: arr[0] ?? null, selectedIds: arr };
      }
      if (options?.add) {
        const setIds = new Set([...state.selectedIds, id]);
        const arr = Array.from(setIds);
        return { selectedId: arr[0] ?? null, selectedIds: arr };
      }
      return { selectedId: id, selectedIds: [id] };
    }),
  toggleSelectedId: (id) =>
    set((state) => {
      const setIds = new Set(state.selectedIds);
      if (setIds.has(id)) setIds.delete(id);
      else setIds.add(id);
      const arr = Array.from(setIds);
      return { selectedId: arr[0] ?? null, selectedIds: arr };
    }),
  setSelection: (ids, additive) =>
    set((state) => {
      const arr = additive ? Array.from(new Set([...state.selectedIds, ...ids])) : ids;
      return { selectedId: arr[0] ?? null, selectedIds: arr };
    }),
  clearSelection: () => set({ selectedId: null, selectedIds: [] }),

  /* ── history ── */
  pushHistory: () =>
    set((state) => {
      const past = [...state.past, snapshot(state.project)];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, future: [] };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      const future = [snapshot(state.project), ...state.future];
      return {
        project: previous,
        past,
        future,
        selectedId: null,
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      const past = [...state.past, snapshot(state.project)];
      return {
        project: next,
        past,
        future,
        selectedId: null,
        isDirty: true,
      };
    }),

  /* ── element actions ── */
  addElement: (type, overrides) => {
    get().pushHistory();
    const el = createElement(type, {
      x: 60 + Math.random() * 40,
      y: 100 + Math.random() * 40,
      ...overrides,
    });
    set((state) => {
      const page = state.project.pages[state.activePage];
      const maxZ = page.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const newEl = { ...el, zIndex: maxZ + 1 };
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: [...p.elements, newEl] }
          : p,
      );
      return {
        project: { ...state.project, pages },
        selectedId: newEl.id,
        isDirty: true,
      };
    });
  },

  addElementData: (el) => {
    get().pushHistory();
    set((state) => {
      const page = state.project.pages[state.activePage];
      const maxZ = page.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      // 兜底：调用方未传 id（如顶部图片上传直接传裸对象）时生成唯一 id，
      // 否则多个元素会共用 undefined id，导致拖拽/选中/排序串号
      // （updateElement(undefined) 会命中全部元素）、无变换框、无属性面板。
      const newEl = { ...el, id: el.id || genId(), zIndex: maxZ + 1 };
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: [...p.elements, newEl] }
          : p,
      );
      return {
        project: { ...state.project, pages },
        selectedId: newEl.id,
        isDirty: true,
      };
    });
  },

  updateElement: (id, patch) =>
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? {
              ...p,
              elements: p.elements.map((e) =>
                e.id === id ? ({ ...e, ...patch } as Element) : e,
              ),
            }
          : p,
      );
      return {
        project: { ...state.project, pages },
        isDirty: true,
      };
    }),

  removeElement: (id) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.filter((e) => e.id !== id) }
          : p,
      );
      return {
        project: { ...state.project, pages },
        selectedId: state.selectedId === id ? null : state.selectedId,
        isDirty: true,
      };
    });
  },

  removeElements: (ids) => {
    if (!ids.length) return;
    get().pushHistory();
    set((state) => {
      const idSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.filter((e) => !idSet.has(e.id)) }
          : p,
      );
      // 同步收敛当前选择：移除已被删除的 id
      const remaining = state.selectedIds.filter((id) => !idSet.has(id));
      return {
        project: { ...state.project, pages },
        selectedId: remaining[0] ?? null,
        selectedIds: remaining,
        isDirty: true,
      };
    });
  },

  duplicateElement: (id) => {
    get().pushHistory();
    set((state) => {
      const page = state.project.pages[state.activePage];
      const el = page.elements.find((e) => e.id === id);
      if (!el) return state;
      const maxZ = page.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const copy: Element = {
        ...(JSON.parse(JSON.stringify(el)) as Element),
        id: genId(),
        // 严格原位复制（Figma 行为）：副本精确叠在原元素之上，由用户拖出
        x: el.x,
        y: el.y,
        zIndex: maxZ + 1,
      };
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: [...p.elements, copy] }
          : p,
      );
      return {
        project: { ...state.project, pages },
        selectedId: copy.id,
        isDirty: true,
      };
    });
  },

  bringToFront: (id) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) => {
        if (i !== state.activePage) return p;
        const maxZ = p.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
        return {
          ...p,
          elements: normalizeZ(
            p.elements.map((e) =>
              e.id === id ? { ...e, zIndex: maxZ + 1 } : e,
            ),
          ),
        };
      });
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  sendToBack: (id) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) => {
        if (i !== state.activePage) return p;
        const minZ = p.elements.reduce(
          (m, e) => Math.min(m, e.zIndex),
          0,
        );
        return {
          ...p,
          // 先置到最小层级之下，再整体归一化为 0..n-1，
          // 保证该元素成为 0（最底层元素），但始终在页面背景之前。
          elements: normalizeZ(
            p.elements.map((e) =>
              e.id === id ? { ...e, zIndex: minZ - 1 } : e,
            ),
          ),
        };
      });
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  bringForward: (id) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) => {
        if (i !== state.activePage) return p;
        const sorted = [...p.elements].sort((a, b) => a.zIndex - b.zIndex);
        const idx = sorted.findIndex((e) => e.id === id);
        if (idx === -1 || idx >= sorted.length - 1) return p;
        const current = sorted[idx];
        const above = sorted[idx + 1];
        return {
          ...p,
          elements: normalizeZ(
            p.elements.map((e) => {
              if (e.id === id) return { ...e, zIndex: above.zIndex };
              if (e.id === above.id) return { ...e, zIndex: current.zIndex };
              return e;
            }),
          ),
        };
      });
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  sendBackward: (id) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) => {
        if (i !== state.activePage) return p;
        const sorted = [...p.elements].sort((a, b) => a.zIndex - b.zIndex);
        const idx = sorted.findIndex((e) => e.id === id);
        if (idx <= 0) return p;
        const current = sorted[idx];
        const below = sorted[idx - 1];
        return {
          ...p,
          elements: normalizeZ(
            p.elements.map((e) => {
              if (e.id === id) return { ...e, zIndex: below.zIndex };
              if (e.id === below.id) return { ...e, zIndex: current.zIndex };
              return e;
            }),
          ),
        };
      });
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  reorderElements: (orderedIds) => {
    if (orderedIds.length === 0) return;
    get().pushHistory();
    set((state) => {
      const page = state.project.pages[state.activePage];
      const map = new Map(page.elements.map((e) => [e.id, e]));
      const n = orderedIds.length;
      const reordered = orderedIds
        .map((id, i) => {
          const el = map.get(id);
          return el ? ({ ...el, zIndex: n - 1 - i } as Element) : null;
        })
        .filter((e): e is Element => e !== null);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, elements: reordered } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  /* ── alignment / distribution / mirror ── */
  alignLeft: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const targetX = toPage ? 0 : Math.min(...selected.map((e) => e.x));
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, x: targetX } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  alignCenterX: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const targetCenter = toPage ? state.project.width / 2 : (Math.min(...selected.map((e) => e.x)) + Math.max(...selected.map((e) => e.x + e.width))) / 2;
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, x: targetCenter - e.width / 2 } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  alignRight: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const targetRight = toPage ? state.project.width : Math.max(...selected.map((e) => e.x + e.width));
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, x: targetRight - e.width } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  alignTop: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const targetY = toPage ? 0 : Math.min(...selected.map((e) => e.y));
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, y: targetY } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  alignCenterY: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const targetCenter = toPage ? (page.height ?? state.project.height) / 2 : (Math.min(...selected.map((e) => e.y)) + Math.max(...selected.map((e) => e.y + e.height))) / 2;
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, y: targetCenter - e.height / 2 } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  alignBottom: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const targetBottom = toPage ? (page.height ?? state.project.height) : Math.max(...selected.map((e) => e.y + e.height));
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, y: targetBottom - e.height } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  distributeHorizontal: () => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length < 3) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id)).sort((a, b) => a.x - b.x);
    const left = selected[0].x;
    const right = selected[selected.length - 1].x + selected[selected.length - 1].width;
    const totalWidth = selected.reduce((sum, e) => sum + e.width, 0);
    const gap = (right - left - totalWidth) / (selected.length - 1);
    const positions = new Map<string, number>();
    let currentX = left;
    for (const e of selected) {
      positions.set(e.id, currentX);
      currentX += e.width + gap;
    }
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, x: positions.get(e.id)! } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  distributeVertical: () => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length < 3) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id)).sort((a, b) => a.y - b.y);
    const top = selected[0].y;
    const bottom = selected[selected.length - 1].y + selected[selected.length - 1].height;
    const totalHeight = selected.reduce((sum, e) => sum + e.height, 0);
    const gap = (bottom - top - totalHeight) / (selected.length - 1);
    const positions = new Map<string, number>();
    let currentY = top;
    for (const e of selected) {
      positions.set(e.id, currentY);
      currentY += e.height + gap;
    }
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, y: positions.get(e.id)! } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  mirrorHorizontal: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const centerX = toPage
      ? state.project.width / 2
      : (Math.min(...selected.map((e) => e.x)) + Math.max(...selected.map((e) => e.x + e.width))) / 2;
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, x: 2 * centerX - e.x - e.width } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },
  mirrorVertical: (toPage = false) => {
    const state = get();
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
    if (ids.length === 0) return;
    const page = state.project.pages[state.activePage];
    const selected = page.elements.filter((e) => ids.includes(e.id));
    const centerY = toPage
      ? (page.height ?? state.project.height) / 2
      : (Math.min(...selected.map((e) => e.y)) + Math.max(...selected.map((e) => e.y + e.height))) / 2;
    get().pushHistory();
    set((state) => {
      const idsSet = new Set(ids);
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: p.elements.map((e) => (idsSet.has(e.id) ? ({ ...e, y: 2 * centerY - e.y - e.height } as Element) : e)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  /* ── clipboard（多选复制/剪切/粘贴） ── */
  copyElement: (ids) =>
    set((state) => {
      const list = Array.isArray(ids) ? ids : [ids];
      const page = state.project.pages[state.activePage];
      const found = page.elements.filter((e) => list.includes(e.id));
      // 仅深拷贝被选中的元素（保持原相对顺序）
      return { clipboard: found.map((e) => JSON.parse(JSON.stringify(e)) as Element) };
    }),

  cutElement: (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    // 先复制到剪贴板，再从画布移除（剪切 = 移动）
    get().copyElement(list);
    get().removeElements(list);
  },

  pasteElement: () => {
    const clipboard = get().clipboard;
    if (!clipboard.length) return;
    get().pushHistory();
    set((state) => {
      const page = state.project.pages[state.activePage];
      const maxZ = page.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      const newIds: string[] = [];
      const clones: Element[] = clipboard.map((src, i) => {
        const copy: Element = {
          ...(JSON.parse(JSON.stringify(src)) as Element),
          id: genId(),
          // 与原位偏移 +24/+24，使粘贴结果立即可见（与单元素粘贴约定一致）
          x: src.x + 24,
          y: src.y + 24,
          zIndex: maxZ + i + 1,
        };
        newIds.push(copy.id);
        return copy;
      });
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, elements: [...p.elements, ...clones] }
          : p,
      );
      return {
        project: { ...state.project, pages },
        selectedId: newIds[0] ?? null,
        selectedIds: newIds,
        isDirty: true,
      };
    });
  },

  /* ── page actions ── */
  addPage: () => {
    get().pushHistory();
    set((state) => {
      // name 留空 → 视图层用 t('editor:page.defaultName', { index }) 兜底显示
      const newPage: Page = {
        id: genId('page'),
        name: '',
        elements: [],
        background: '#ffffff',
        height: CANVAS_DEFAULT.height,
        longPage: false,
        backgroundImage: '',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      };
      return {
        project: {
          ...state.project,
          pages: [...state.project.pages, newPage],
        },
        activePage: state.project.pages.length,
        selectedId: null,
        isDirty: true,
      };
    });
  },

  deletePage: (index) => {
    const state = get();
    if (state.project.pages.length <= 1) return;
    get().pushHistory();
    set((s) => {
      const pages = s.project.pages.filter((_, i) => i !== index);
      const newActive = Math.min(s.activePage, pages.length - 1);
      return {
        project: { ...s.project, pages },
        activePage: newActive,
        selectedId: null,
        isDirty: true,
      };
    });
  },

  switchPage: (index) =>
    set({ activePage: index, selectedId: null }),

  renamePage: (index, name) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === index ? { ...p, name } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  reorderPages: (from, to) => {
    if (from === to) return;
    get().pushHistory();
    set((state) => {
      const pages = [...state.project.pages];
      const [moved] = pages.splice(from, 1);
      pages.splice(to, 0, moved);
      return {
        project: { ...state.project, pages },
        activePage: to,
        isDirty: true,
      };
    });
  },

  setPageBackground: (color) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, background: color } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  setPageHeight: (height) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, height } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  setProjectWidth: (width) => {
    get().pushHistory();
    set((state) => ({
      project: { ...state.project, width },
      isDirty: true,
    }));
  },

  setPageLongPage: (longPage) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, longPage } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  setPageBackgroundImage: (src) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, backgroundImage: src } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  setPageBackgroundImageOpacity: (opacity) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage
          ? { ...p, backgroundImageOpacity: Math.max(0, Math.min(1, opacity)) }
          : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  setPageBackgroundSize: (size) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, backgroundSize: size } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  setPageBackgroundRepeat: (repeat) => {
    get().pushHistory();
    set((state) => {
      const pages = state.project.pages.map((p, i) =>
        i === state.activePage ? { ...p, backgroundRepeat: repeat } : p,
      );
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  syncPageBackgroundToAll: () => {
    get().pushHistory();
    set((state) => {
      const current = state.project.pages[state.activePage];
      const pages = state.project.pages.map((p) => ({
        ...p,
        background: current.background,
        backgroundImage: current.backgroundImage,
        backgroundSize: current.backgroundSize,
        backgroundRepeat: current.backgroundRepeat,
        backgroundImageOpacity: current.backgroundImageOpacity,
      }));
      return { project: { ...state.project, pages }, isDirty: true };
    });
  },

  /* ── project ── */
  setProjectTitle: (title) =>
    set((state) => ({
      project: { ...state.project, title },
      isDirty: true,
    })),

  setProjectSettings: (settings) =>
    set((state) => ({
      project: { ...state.project, settings },
      isDirty: true,
    })),

  loadProject: (project, projectId) =>
    set(() => {
      // 兼容旧作品/模板：补齐元素缺失的默认属性（opacity/rotation/fill 等），
      // 避免属性面板 slider 在 undefined 上调用 toFixed 而整页白屏。
      // 若 pages 为空（坏数据模板），自动补一页默认画布，防止 PageSettingsPanel crash。
      const rawPages = (project.pages ?? []) as any[];
      const safePages: any[] = rawPages.length > 0 ? rawPages : [{ elements: [] as any[] }];
      const normalized: Project = {
        ...project,
        width: project.width ?? CANVAS_DEFAULT.width,
        height: project.height ?? CANVAS_DEFAULT.height,
        settings: { ...createDefaultSettings(), ...(project.settings ?? {}) },
        pages: safePages.map((p: any) => ({
          id: p.id ?? `page-${Math.random().toString(36).slice(2, 9)}`,
          name: p.name ?? 'Page 1',
          background: p.background ?? '#ffffff',
          height: p.height ?? CANVAS_DEFAULT.height,
          longPage: p.longPage ?? false,
          backgroundImage: p.backgroundImage ?? '',
          backgroundSize: p.backgroundSize ?? 'cover',
          backgroundRepeat: p.backgroundRepeat ?? 'no-repeat',
          // 必须显式透传：loadProject 只挑字段，未列出的字段重载后会丢失
          backgroundImageOpacity: p.backgroundImageOpacity,
          elements: (p.elements ?? []).map((el: any) => ({
            ...createElement((el.type ?? 'text') as ElementType),
            ...el,
            id: el.id,
            type: (el.type ?? 'text') as ElementType,
          } as Element)),
        })),
      };
      return {
        project: normalized,
        projectId: projectId ?? null,
        selectedId: null,
        selectedIds: [],
        activePage: 0,
        past: [],
        future: [],
        isDirty: false,
        isLoading: false,
      };
    }),

  newProject: () =>
    set({
      project: createProject(),
      projectId: null,
      selectedId: null,
      selectedIds: [],
      activePage: 0,
      past: [],
      future: [],
      isDirty: false,
      clipboard: [],
    }),

  /* ── api state ── */
  setProjectId: (id) => set({ projectId: id }),
  setSaving: (saving) => set({ isSaving: saving }),
  setDirty: (dirty) => set({ isDirty: dirty }),
}));

/* ── Selectors ── */

/** 获取当前选中元素 */
export function useSelectedElement(): Element | null {
  return useEditorStore((s) => {
    const page = s.project.pages[s.activePage];
    if (!s.selectedId) return null;
    return page.elements.find((e) => e.id === s.selectedId) ?? null;
  });
}

/** 是否可撤销 */
export function useCanUndo() {
  return useEditorStore((s) => s.past.length > 0);
}

/** 是否可重做 */
export function useCanRedo() {
  return useEditorStore((s) => s.future.length > 0);
}
