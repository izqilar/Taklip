import { useEffect, useState } from 'react';
import { Modal, Input, Button, Checkbox, message } from 'antd';
import { T } from '../../config/theme';
import { RegionCascader } from '../RegionCascader';
import { serviceRoleOptions } from '../../config/labels';
import { useLayer } from '../../providers/layerContext';
import { API_URL, authHeaders } from '../../utility';

/** 服务类型字典（平台真实服务子角色）通过 serviceRoleOptions() 在渲染时解析，避免模块加载期固化语言 */

/** 申请角色 → 弹窗文案（原型 openUpModal） */
const INFO = {
  provider: {
    title: '申请成为服务商',
    desc: '提交入驻申请后，由辖区代理商初审、管理总台终审。审核通过后开通服务商后台，可发布服务并接单履约。',
    kv: [
      ['申请角色', '服务商'],
      ['审核流程', '辖区初审 → 总台终审'],
      ['开通权限', '服务发布 / 接单履约 / 财务中心'],
    ],
  },
  agent: {
    title: '申请成为代理商',
    desc: '提交入驻申请后，由管理总台审核。审核通过后开通代理商后台，获得辖区经营与招商权限。',
    kv: [
      ['申请角色', '代理商'],
      ['审核流程', '总台初审 → 总台终审'],
      ['开通权限', '辖区经营 / 招商拓展 / 财务分佣'],
    ],
  },
} as const;

type UpRole = 'agent' | 'provider';

/**
 * 顶部升格入口（原型 #topActs）。
 * - 用户视角渲染「成为代理商」「成为服务商」；
 * - 服务商视角渲染「成为代理商」；
 * - 提交后按钮置灰，文案变「已提交 · 审核中」。
 */
export const UpgradeActions = () => {
  const { view, readonly, objectScope } = useLayer();
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<UpRole | null>(null);
  const [reason, setReason] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [regionId, setRegionId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const acts: UpRole[] =
    view === 'user' ? ['agent', 'provider'] : view === 'provider' ? ['agent'] : [];

  // 已提交状态跟随监督对象切换而重置
  useEffect(() => {
    setSubmitted({});
  }, [objectScope?.id, view]);

  if (!acts.length) return null;

  const close = () => {
    setRole(null);
    setReason('');
    setScopes([]);
    setRegionId('');
  };

  const open = (r: UpRole) => {
    if (readonly) {
      message.warning('当前为运维管理员（只读）视角，操作已锁定；如需代操作请切换为超级管理员。');
      return;
    }
    setRole(r);
  };

  const submit = async () => {
    if (!role) return;
    if (!reason.trim()) {
      message.warning('请填写申请理由');
      return;
    }
    if (!regionId) {
      message.warning(
        role === 'provider' ? '请完整选择开展服务区域（省 / 市 / 区县）' : '请完整选择计划代理区域（省 / 市 / 区县）',
      );
      return;
    }
    if (role === 'provider' && !scopes.length) {
      message.warning('请至少选择一项服务类型');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/qualifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          kind: role,
          reason: reason.trim(),
          serviceScopes: role === 'provider' ? scopes : [],
          regionPath: regionId,
          userId: objectScope?.id || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message ?? '提交失败');
      }
      setSubmitted((s) => ({ ...s, [role]: true }));
      message.success(
        `入驻申请已提交（${role === 'provider' ? '服务商' : '代理商'}），可在「消息中心」关注审核进度`,
      );
      close();
    } catch (e: any) {
      message.error(e?.message ?? '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <span style={{ display: 'inline-flex', gap: 8, flex: 'none' }}>
        {acts.map((r) => {
          const done = !!submitted[r];
          return (
            <button
              key={r}
              type="button"
              disabled={done || readonly}
              onClick={() => open(r)}
              style={{
                padding: '6px 13px',
                fontSize: 13,
                color: done || readonly ? T.ink3 : T.accent,
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: T.rSm,
                cursor: done || readonly ? 'not-allowed' : 'pointer',
                opacity: done ? 0.7 : 1,
                minHeight: 0,
                lineHeight: 1.6,
                whiteSpace: 'nowrap',
              }}
            >
              {done ? '已提交 · 审核中' : r === 'agent' ? '成为代理商' : '成为服务商'}
            </button>
          );
        })}
      </span>

      <Modal
        open={!!role}
        onCancel={close}
        width={560}
        footer={null}
        closable={false}
        destroyOnHidden
        styles={{ body: { padding: 20 } }}
      >
        {role && (
          <>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: T.ink1,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: T.accentSoft,
                  color: T.accent,
                  fontWeight: 600,
                }}
              >
                入驻
              </span>
              {INFO[role].title}
              <span
                onClick={close}
                style={{ marginLeft: 'auto', color: T.ink3, cursor: 'pointer', fontSize: 14 }}
                role="button"
                aria-label="关闭"
              >
                ✕
              </span>
            </h3>

            <div style={{ fontSize: 13, lineHeight: 1.7, color: T.ink2, marginTop: 12 }}>
              {INFO[role].desc}
            </div>

            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                申请理由<span style={{ color: T.down, marginLeft: 2 }}>*</span>
              </label>
              <Input.TextArea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="简要说明入驻理由与自身条件（如从业经验、团队规模、服务区域、资源优势等）…"
              />
            </div>

            {role === 'provider' && (
              <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                  服务类型<span style={{ color: T.down, marginLeft: 2 }}>*</span>
                  <span style={{ fontWeight: 400, color: T.ink3, fontSize: 11.5 }}>（可多选）</span>
                </label>
                <Checkbox.Group
                  options={serviceRoleOptions()}
                  value={scopes}
                  onChange={(v) => setScopes(v as string[])}
                />
              </div>
            )}

            <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
              <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                {role === 'provider' ? '开展服务区域' : '计划代理区域'}
                <span style={{ color: T.down, marginLeft: 2 }}>*</span>
                <span style={{ fontWeight: 400, color: T.ink3, fontSize: 11.5 }}>（三级联动选择）</span>
              </label>
              <RegionCascader
                value={regionId || undefined}
                onChange={setRegionId}
                placeholder="选择省 / 市 / 区县"
              />
            </div>

            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '86px 1fr',
                gap: '6px 12px',
                fontSize: 13,
                marginTop: 14,
              }}
            >
              {INFO[role].kv.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt style={{ color: T.ink3, margin: 0 }}>{k}</dt>
                  <dd style={{ color: T.ink1, fontWeight: 600, margin: 0 }}>{v}</dd>
                </div>
              ))}
            </dl>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <Button onClick={close} disabled={loading}>
                取消
              </Button>
              <Button type="primary" onClick={submit} loading={loading}>
                提交申请
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

export default UpgradeActions;
