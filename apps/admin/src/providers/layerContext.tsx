import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useGetIdentity } from '@refinedev/core';
import type { LayerKey } from '../config/permGroups';
import { getStoredUser } from '../utility';
import { setSubject } from './scopeStore';

/** 对象视角选中结果（文档 §4 / §6.1，后端 view-scope 聚合在 M3 接入） */
export interface ObjectScope {
  type: LayerKey; // agent | provider | user
  id: string;
  label: string;
}

/** 内容区四态预览（原型顶栏「空状态 / 加载态 / 异常态」按钮） */
export type PreviewState = 'data' | 'empty' | 'loading' | 'error';

interface LayerState {
  /** 当前视角（总台/代理商/服务商/用户） */
  view: LayerKey;
  setView: (v: LayerKey) => void;
  /** 只读模式（文档 §4.3）：黄条 + 操作禁用 + 后端 403 */
  readonly: boolean;
  setReadonly: (b: boolean) => void;
  /** 对象视角选中项，整页联动到该对象名下 */
  objectScope: ObjectScope | null;
  setObjectScope: (o: ObjectScope | null) => void;
  /** 四态预览：data=真实数据，其余为原型演示态 */
  preview: PreviewState;
  setPreview: (s: PreviewState) => void;
}

const LayerCtx = createContext<LayerState | null>(null);

/** 登录即定层：按 JWT role 决定初始视角（文档 §4.1） */
function viewOfRole(role?: string | null): LayerKey {
  switch (role) {
    case 'AGENT':
      return 'agent';
    case 'SERVICE_PROVIDER':
      return 'provider';
    case 'USER':
      return 'user';
    default:
      return 'console';
  }
}

/** 各角色可切换的视角（与服务端 @Roles 对齐，见 LayerHeader.VIEW_VISIBLE） */
const VIEWS_OF_ROLE: Record<string, LayerKey[]> = {
  ADMIN: ['console', 'agent', 'provider', 'user'],
  AGENT: ['agent', 'user'],
  SERVICE_PROVIDER: ['provider'],
  USER: ['user'],
};

const VIEW_STORAGE_KEY = 'layer.view';

/**
 * 读回上次视角：刷新 / 直接访问 /user/* 这类深链时，
 * 若只按角色定层会掉回总台视角，侧栏与顶栏升格入口就与路由错位，
 * 故把视角持久化并在角色校验后复用。
 */
function restoreView(role?: string | null): LayerKey {
  const fallback = viewOfRole(role);
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY) as LayerKey | null;
    if (!saved) return fallback;
    // 刷新首帧角色尚未解析（getStoredUser 为异步读取）→ 先沿用上次视角，
    // 待 identity 回来后再按角色校验（见下方 useEffect），避免掉回总台视角。
    if (!role) return saved;
    const allowed = VIEWS_OF_ROLE[role] ?? [fallback];
    return allowed.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function persistView(v: LayerKey) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  } catch {
    /* 隐私模式下写入失败时静默忽略 */
  }
}

/**
 * LayerProvider 必须挂在 <Refine> 内部 —— 只有那样才能用 useGetIdentity 感知登录态变化。
 *
 * 背景（曾踩过的坑）：挂在 Refine 外面时，登录页挂载即固化 initialView()='console'，
 * 登录后 Provider 不重挂载，代理商/服务商会一直停留在「管理总台」视角：
 * 侧栏渲染成总台菜单、面包屑显示「管理总台」、账号面板的快捷入口也给成总台的。
 * 故这里显式跟随 identity.role 变化重新定层。
 */
export const LayerProvider = ({ children }: { children: ReactNode }) => {
  const [view, setView] = useState<LayerKey>(() =>
    restoreView(getStoredUser<{ role?: string }>()?.role),
  );
  // 手动只读开关（总台「权限模式」预览）；用户视角由下方独立的 userReadonly 派生。
  const [manualReadonly, setManualReadonly] = useState(false);
  // 用户视角独立只读开关：默认只读（观测镜头口径），但「权限模式」可切到
  // 「超级管理员」解除只读 —— 与代理商/服务商视角的双模式切换行为对齐（§4.3）。
  const [userReadonly, setUserReadonly] = useState(true);
  const readonly = view === 'user' ? userReadonly : manualReadonly;
  const [objectScope, setObjectScope] = useState<ObjectScope | null>(null);
  const [preview, setPreview] = useState<PreviewState>('data');

  const { data: identity } = useGetIdentity<{ role?: string }>();
  const role = identity?.role ?? getStoredUser<{ role?: string }>()?.role;

  // 仅在「角色真的变了」时重新定层：登录(undefined→AGENT)会触发，
  // 而管理员手动切视角不会（identity 没变），避免把用户的选择冲掉。
  const syncedRole = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!role || role === syncedRole.current) return;
    const first = syncedRole.current === undefined;
    syncedRole.current = role;
    // 首次解析时：若当前视角对该角色仍合法（刷新后沿用了上次的视角）就保留，
    // 否则才按角色重新定层 —— 否则刷新后会被硬拉回总台视角，与路由 /user/* 错位。
    if (first) {
      const allowed = VIEWS_OF_ROLE[role] ?? [viewOfRole(role)];
      if (allowed.includes(view)) return;
      setView(viewOfRole(role));
      return;
    }
    setView(viewOfRole(role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <LayerCtx.Provider
      value={{
        view,
        setView: (v: LayerKey) => {
          persistView(v);
          setView(v);
        },
        readonly,
        setReadonly: (b: boolean) => {
          // 用户视角与其他视角各自记忆模式，互不串扰：
          // 在用户视角切换「权限模式」只影响 userReadonly，其他视角仍走 manualReadonly。
          if (view === 'user') setUserReadonly(b);
          else setManualReadonly(b);
        },
        objectScope,
        setObjectScope: (o: ObjectScope | null) => {
          // 同步视察窗口 subject 到 scopeStore，供 dataProvider 注入 ?subject=
          setSubject(o?.id ?? null);
          setObjectScope(o);
        },
        preview,
        setPreview,
      }}
    >
      {children}
    </LayerCtx.Provider>
  );
};

export function useLayer(): LayerState {
  const c = useContext(LayerCtx);
  if (!c) throw new Error('useLayer 必须在 LayerProvider 内使用');
  return c;
}
