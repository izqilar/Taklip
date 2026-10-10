import { useCallback } from 'react';
import { TemplateFieldDesign, type GuestFieldDef } from '@h5design/ui';
import { authHeaders, API_URL } from '../utility';
import { GUEST_FIELD_DEFS } from '@h5design/core';

/**
 * 运营端「模板字段设计」（§16.4 触发 B：服务商侧栏「请柬营销」分组）。
 * 共用 @h5design/ui 的 TemplateFieldDesign，与用户端 web 完全一致；
 * 仅通过 loadFields/saveFields 注入 admin 的绝对 API_URL + Bearer 鉴权。
 *
 * 作用域：运营端自营名单走 `ORG`（组织级设计），故字段设计读写统一带 `ownerType=ORG`，
 * 与 SPInvitationLists 自营路径的模板下载作用域一致，确保设计正确作用于模板生成。
 *
 * 注意：必须用绝对 `API_URL`（admin 的 Vite 不代理 `/api`）。
 */
export default function AdminTemplateFieldDesign() {
  const loadFields = useCallback(async (): Promise<GuestFieldDef[]> => {
    const res = await fetch(`${API_URL}/guest-lists/field-design?ownerType=ORG`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return (d.fields ?? []) as GuestFieldDef[];
  }, []);

  const saveFields = useCallback(async (defs: GuestFieldDef[]): Promise<GuestFieldDef[]> => {
    const res = await fetch(`${API_URL}/guest-lists/field-design?ownerType=ORG`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ fields: defs }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const e = await res.json();
        msg = e?.message || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const d = await res.json();
    return (d.fields ?? []) as GuestFieldDef[];
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <TemplateFieldDesign
        loadFields={loadFields}
        saveFields={saveFields}
        defaultFields={GUEST_FIELD_DEFS as unknown as GuestFieldDef[]}
      />
    </div>
  );
}
