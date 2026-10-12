/**
 * 运营端（服务商）· 请柬批量生成
 *
 * 退化为「ORG/CLIENT 作用域选择器 + <UserInvitationCenter> 薄壳」：
 *  - 仅保留 SP 专属的「自营样板（ORG）/ 代客（CLIENT）」下拉选择器；
 *  - 模板选择 / 宾客名单 / 字段配对 / 批量生成 / 任务进度 / 续跑失败项 等全部功能
 *    复用 admin 已有的 `UserInvitationCenter`（与 web 端已对齐）；
 *  - 所有 API 调用经 `UserInvitationCenter` 内部的 `useSpScope()` 拼 subject + ownerType + clientId，
 *    修复旧 SP 页硬编码 ownerType 却不带 subject 导致的 HTTP 400（FORBIDDEN_OWNER_TYPE）根因。
 */
import { useState } from 'react';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { Select, Input } from 'antd';
import UserInvitationCenter from './user/UserInvitationCenter';

export function SPInvitationBatch() {
  // ── 作用域（ORG 自营 / CLIENT 代客）──
  const [ownerType, setOwnerType] = useState<'ORG' | 'CLIENT'>('ORG');
  const [clientId, setClientId] = useState('');

  return (
    <>
      <PageHead title="请柬批量生成" chip="批量请柬" />
      <Panel>
        {/* 作用域选择器（SP 专属组件） */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, flexWrap: 'wrap' }}>
          <Select
            value={ownerType}
            onChange={(v) => setOwnerType(v)}
            style={{ width: 180 }}
            options={[
              { value: 'ORG', label: '自营样板（ORG）' },
              { value: 'CLIENT', label: '代客（CLIENT）' },
            ]}
          />
          {ownerType === 'CLIENT' && (
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="客户 id"
              style={{ width: 240 }}
            />
          )}
        </div>

        <UserInvitationCenter ownerType={ownerType} clientId={clientId} />
      </Panel>
    </>
  );
}

export default SPInvitationBatch;
