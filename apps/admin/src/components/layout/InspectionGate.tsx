import type { ReactNode } from 'react';
import { useLayer } from '../../providers/layerContext';
import { T } from '../../config/theme';
import { SearchOutlined } from '@ant-design/icons';

/**
 * 视察门控：管理后台「按角色分层查看」的数据边界。
 *
 * 核心概念澄清（2026-09-23 修正）：「视察（选 subject 看他人）」是【总台 ADMIN 专属】
 * 的能力。真实 SERVICE_PROVIDER / AGENT / USER 用各自账号登录运营端时，其当前视角就等于
 * 自身角色，这是他们【自己的运营工作台】，必须直接展示自身数据，绝不能被当成「视察」、
 * 强制要求选 subject（那是一个低级业务逻辑错误：把超级管理员的视察模式套到了真实账号自身）。
 *
 * 规则：
 *  1. 当前视角 == 登录账号自身视角（isOwnView）：
 *     - ADMIN + console → 展示自身（超级管理员自查）；
 *     - 真实 SERVICE_PROVIDER/AGENT/USER → 展示各自的工作台（数据走自身 JWT 身份）。
 *     一律直接渲染，不需要、也不应当出现「未选定视察对象」。
 *  2. 非自身视角（仅 ADMIN 能进入，即 ADMIN 在 agent/provider/user 视察他人）：
 *     - 未选定被视察对象（objectScope 为空）→ 统一空状态，防止越权数据泄漏；
 *     - 已选定 → 正常渲染，数据由 dataProvider 的 ?subject= + 失效重取映射到该对象名下。
 *
 * 该门控包裹在 <Outlet /> 之外、<AdminLayout> 的内容区之内，
 * 侧栏与顶栏（含对象检索条）始终可见，故即便空状态也能继续检索。
 */
const VIEW_NAME: Record<string, string> = {
  agent: '代理商',
  provider: '服务商',
  user: '终端用户',
};

export const InspectionGate = ({ children }: { children: ReactNode }) => {
  const { view, objectScope, isOwnView } = useLayer();

  // ① 自身视角（含 ADMIN 总台自查 + 真实角色自有工作台）：始终展示自身数据。
  if (isOwnView) return <>{children}</>;

  // ② ADMIN 视察他人视角：未选定被视察对象 → 统一空状态，不展示任何菜单页内容。
  if (!objectScope?.id) {
    const who = VIEW_NAME[view] ?? '对象';
    return (
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: 14,
          minHeight: 360,
          textAlign: 'center',
          color: T.ink3,
        }}
      >
        <SearchOutlined style={{ fontSize: 44, color: T.ink3, opacity: 0.45 }} />
        <div>
          <div style={{ fontSize: 14, color: T.ink2, marginBottom: 6, fontWeight: 600 }}>
            未选定视察对象
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 360 }}>
            请在顶部检索框选择要视察的具体{who}后，
            <br />
            再查看其对应的菜单详情（账户详情 / 看板 / 订单 / 消息等）。
          </div>
        </div>
      </div>
    );
  }

  // ③ ADMIN 已选定被视察对象 → 正常渲染（数据按 ?subject= 映射）。
  return <>{children}</>;
};
