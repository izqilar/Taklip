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
  /** 当前登录账号的真实角色（用于区分「ADMIN 视察他人」与「真实角色自有工作台」） */
  role: string | undefined;
  /**
   * 当前视角是否为「登录账号自身的工作台」。
   * - ADMIN 登录：仅 console 视图是自身（其余 agent/provider/user 为视察他人，需选 subject）。
   * - 真实 SERVICE_PROVIDER / AGENT / USER 登录：其 view 即等于自身角色，
   *   此时不是「视察」，而是他们自己的运营工作台，应直接展示自身数据、绝不强制选 subject。
   */
  isOwnView: boolean;
  /** 只读模式（文档 §4.3）：黄条 + 操作禁用 + 后端 403 */
  readonly: boolean;
  setReadonly: (b: boolean) => void;
  /**
   * 当前视角的对象选中项（整页联动到该对象名下）。
   * 注意：objectScope 是「按视角隔离」的 —— 每个视角（console/agent/provider/user）
   * 各自记忆自己选中的被视察对象，切换视角不会把 A 视角的选中账号带进 B 视角的
   * 检索框 / 数据边界（防止越权数据穿插）。取数时永远返回「当前 view」对应的槽位。
   */
  objectScope: ObjectScope | null;
  setObjectScope: (o: ObjectScope | null) => void;
  /** 四态预览：data=真实数据，其余为原型演示态 */
  preview: PreviewState;
  setPreview: (s: PreviewState) => void;
}

const LayerCtx = createContext<LayerState | null>(null);

/** 登录即定层：按 JWT role 决定初始视角（文档 §4.1） */
export function viewOfRole(role?: string | null): LayerKey {
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
  // 按视角隔离的视察对象：每个视角各自记忆自己选中的被视察对象，互不串扰。
  // 取数时只读「当前 view」对应的槽位（objectScope 派生值）。
  const [scopesByView, setScopesByView] = useState<Record<LayerKey, ObjectScope | null>>({
    console: null,
    agent: null,
    provider: null,
    user: null,
  });
  // 当前视角的对象选中项（派生，随 view 切换自动指向对应槽位）。
  const objectScope = scopesByView[view] ?? null;
  const [preview, setPreview] = useState<PreviewState>('data');

  const { data: identity } = useGetIdentity<{ role?: string }>();
  const role = identity?.role ?? getStoredUser<{ role?: string }>()?.role;
  // 当前视角是否登录账号自身的工作台（核心：区分 ADMIN 视察他人 vs 真实角色自有工作台）
  const isOwnView = view === viewOfRole(role);
  // 注意：本 Provider 包在 <BrowserRouter> 之外（见 App.tsx），故此处【不能】调用
  // 任何依赖 Router 上下文的 refine hooks（如 useInvalidate，其内部走 useLocation），
  // 否则整页崩溃。subject 变化后的 query 失效重取由 Router 内的
  // ObjectScopeInvalidationBridge（App.tsx）订阅 objectScope 完成。

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
    // 角色更换（重新登录 / 切换账号）时清空 subject，避免沿用上一会话残留的视察对象。
    setSubject(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <LayerCtx.Provider
      value={{
        view,
        role,
        isOwnView,
        setView: (v: LayerKey) => {
          persistView(v);
          // 切换视角时：把 dataProvider 的 subject 同步切到「目标视角」自己槽位的对象，
          // 避免新视角发出的请求仍携带旧视角的 subject（越权数据穿插）。
          // 同步执行（非 effect）：确保新视角菜单页挂载时 module 变量已是目标视角的 subject。
          setSubject(scopesByView[v]?.id ?? null);
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
          // 写入「当前视角」自己的槽位（按视角隔离，不污染其它视角）。
          setScopesByView((prev) => ({ ...prev, [view]: o }));
          // 同步视察窗口 subject 到 scopeStore，供 dataProvider 注入 ?subject=
          // （query 失效重取见 App.tsx 的 ObjectScopeInvalidationBridge）
          setSubject(o?.id ?? null);
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
