/**
 * 组织内员工（我的团队）共享片段 —— 供「角色与权限」页复用。
 *
 * 背景（2026-09-22 收口）：三层员工管理已统一收口到「角色与权限」页
 * （总台 `/admin/roles`、代理商 `/agent/roles`、服务商 `/sp/roles`），
 * 原「我的团队」独立页面与路由已全部删除。本文件只保留被该页复用的片段：
 *  - `StaffAuditTimeline`：员工操作时间线（P3 可视化）
 *  - `statusPill` / `permKeysOf` / `roleOptionsOf` / `dutyOptionsOf`：列表与表单复用
 *  - `PermCheckGroupWrap`：PermCheckGroup 与 Form.Item 的桥接
 *
 * ⚠️ 岗位（staffRole）在表单里用 **AutoComplete**：选项来自岗位池，同时允许自填。
 *    原因是存量数据已是自由文本，严格 Select 会让旧值显示为空（文档 §2.2 冲突 2）。
 *
 * 关联文档：`docs/平台角色边界规范化.md`
 */
import type { ReactNode } from 'react';
import { PermCheckGroup } from '../components/detail/PermCheckGroup';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { TEAM_STATUS } from '../config/providerConstants';
import {
  teamRolesOf,
  teamDutiesOf,
  staffRoleMetaOf,
  staffPermOptions,
  STAFF_ROLE_POOLS,
  TEAM_PERM_KEYS,
  type OrgType,
} from '../config/staffRoles';
import type { LayerKey } from '../config/permGroups';

/** 组织层 → 前端视角键（PermCheckGroup 按视角过滤权限域，单一真值源） */
export const ORG_LAYER: Record<OrgType, LayerKey> = {
  PROVIDER: 'provider',
  AGENT: 'agent',
  CONSOLE: 'console',
};

/* ════════════════ P3 审计可视化：员工操作时间线 ══════════════════ */

/** 审计动作 → 展示标签 + 主色（数据层见 staff.service.listAudit / AuditLog.action） */
const STAFF_ACTION_META: Record<string, { label: string; color: string }> = {
  STAFF_CREATE: { label: '新建成员', color: T.accent2 },
  STAFF_UPDATE: { label: '编辑成员', color: T.accent },
  STAFF_REMOVE: { label: '移除成员', color: '#c0392b' },
  STAFF_BIND: { label: '绑定账号', color: '#8e44ad' },
};
const staffActionMeta = (a?: string) =>
  a ? STAFF_ACTION_META[a] ?? { label: a, color: T.ink1 } : { label: '—', color: T.ink3 };

const fmtVal = (v: any) =>
  v == null ? '—' : Array.isArray(v) ? (v.length ? v.join('、') : '—') : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** 取 before/after 的差异行（字段: 旧 → 新） */
function diffLines(before: any, after: any): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: string[] = [];
  for (const k of keys) {
    const b = (before ?? {})[k];
    const a = (after ?? {})[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) out.push(`${k}：${fmtVal(b)} → ${fmtVal(a)}`);
  }
  return out;
}

/** 员工操作时间线（只读展示；仅 team:manage 可见，无权限时静默降级） */
export function StaffAuditTimeline({ items, denied }: { items: any[]; denied?: boolean }) {
  if (denied) {
    return <div style={{ color: T.ink3, fontSize: 13 }}>{t('pages.team.auditDenied', '仅团队管理员可查看操作时间线')}</div>;
  }
  if (!items?.length) {
    return <div style={{ color: T.ink3, fontSize: 13 }}>{t('pages.team.auditEmpty', '暂无操作记录')}</div>;
  }
  return (
    <div style={{ marginTop: 4 }}>
      {items.map((it: any, idx: number) => {
        const meta = staffActionMeta(it.action);
        const lines = diffLines(it.before, it.after);
        return (
          <div key={it.id ?? idx} style={{ display: 'flex', gap: 12, paddingBottom: idx === items.length - 1 ? 0 : 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: meta.color, marginTop: 4 }} />
              {idx !== items.length - 1 && <span style={{ flex: 1, width: 2, background: T.border, marginTop: 4 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: meta.color, fontWeight: 600, fontSize: 13.5 }}>{meta.label}</span>
                {it.actorRole && (
                  <span style={{ fontSize: 11.5, padding: '1px 7px', borderRadius: 999, background: T.accent2Soft, color: T.accent2 }}>
                    {it.actorRole}
                  </span>
                )}
                <span style={{ color: T.ink3, fontSize: 12, fontFamily: T.fontNum }}>
                  {it.createdAt ? new Date(it.createdAt).toLocaleString('zh-CN', { hour12: false }) : ''}
                </span>
              </div>
              {lines.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {lines.map((l: string, i: number) => (
                    <span key={i} style={{ color: T.ink2, fontSize: 12.5, fontFamily: T.fontNum }}>
                      {l}
                    </span>
                  ))}
                </div>
              )}
              {it.reason && <div style={{ marginTop: 4, color: T.ink2, fontSize: 12.5 }}>理由：{it.reason}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 岗位池：服务商随服务类型联动，其余层为静态池 */
export function roleOptionsOf(org: OrgType, serviceType?: string): string[] {
  return org === 'PROVIDER' ? teamRolesOf(serviceType) : STAFF_ROLE_POOLS[org];
}

/** 职责池：服务商随服务类型联动，其余层取岗位自带职责 */
export function dutyOptionsOf(org: OrgType, serviceType?: string, role?: string): string[] {
  if (org === 'PROVIDER') return teamDutiesOf(serviceType);
  return staffRoleMetaOf(org, role)?.duties ?? [];
}

/** 权限池：服务商=原型 8 项；其余=该层可见域全集（已裁红线） */
export function permKeysOf(org: OrgType): string[] {
  return org === 'PROVIDER' ? [...TEAM_PERM_KEYS] : staffPermOptions(org);
}

/** 账号状态胶囊（ACTIVE 正常 / PENDING 待激活 / DISABLED 停用） */
export function statusPill(v: string): ReactNode {
  const m = TEAM_STATUS[v];
  const tone = m?.tone ?? 'warn';
  const color = tone === 'ok' ? '#1a7f37' : tone === 'bad' ? '#c0392b' : '#b77a16';
  return <span style={{ color, fontWeight: 600, fontSize: 12.5 }}>{m ? t(m.key) : v || '—'}</span>;
}

/**
 * PermCheckGroup 与 Form.Item 的桥接：
 * PermCheckGroup 用 checkedKeys + onChange（非 value/onChange 语义），
 * 需手动接 Form.Item 注入的 value / onChange。
 */
export function PermCheckGroupWrap({
  layer,
  keys,
  value,
  onChange,
  disabled,
}: {
  layer: LayerKey;
  keys: string[];
  value?: string[];
  onChange?: (v: string[]) => void;
  disabled?: boolean;
}) {
  return <PermCheckGroup layer={layer} keys={keys} checkedKeys={value ?? []} disabled={disabled} onChange={onChange} />;
}
