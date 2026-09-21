import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Checkbox, DatePicker, Upload, message } from 'antd';
import { useCustom } from '@refinedev/core';
import { PageHead } from '../../components/ui/PageHead';
import { Panel } from '../../components/ui/Panel';
import { RegionCascader } from '../../components/RegionCascader';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';
import { serviceRoleOptions } from '../../config/labels';
import { useLayer } from '../../providers/layerContext';
import { API_URL, authHeaders } from '../../utility';

/** 业务范围字典（平台真实服务子角色）通过 serviceRoleOptions() 在渲染时解析，避免模块加载期固化语言 */

/** 资质类型卡片（原型 #ffTypes） */
const CERT_TYPES = [
  { ic: '📋', nm: '营业执照', ds: '企业/个体' },
  { ic: '📜', nm: '经营许可证', ds: '行业许可' },
  { ic: '🪪', nm: '居民身份证', ds: '个人身份' },
  { ic: '🎭', nm: '演出许可', ds: '演出资质' },
  { ic: '🏅', nm: '资质证书', ds: '技能认证' },
  { ic: '📁', nm: '其他', ds: '证明材料' },
];

/** 审核进度（原型 pg-fill 右列） */
const PROGRESS: [string, string, boolean][] = [
  ['资格初审', '已通过', true],
  ['完善资料', '当前步骤 · 填写详细资料', false],
  ['终审', '管理总台审核', false],
  ['签约开通', '签订合同后开通', false],
];

const KIND_LABEL: Record<string, string> = {
  agent: 'pages.col.agent',
  provider: 'pages.col.provider',
  upgrade: 'pages.status.kindUpgrade',
};

/** 表单字段（原型 .flabel）：标签 + 必填星号 + 控件 + 弱提示 */
const field = (label: string, required: boolean, node: React.ReactNode, hint?: string) => (
  <label
    style={{
      display: 'grid',
      gap: 6,
      fontSize: 12.5,
      color: T.ink2,
      fontWeight: 600,
      minWidth: 0,
    }}
  >
    <span>
      {label}
      {required ? <span style={{ color: T.down, marginLeft: 2 }}>*</span> : null}
    </span>
    {node}
    {hint ? <span style={{ color: T.ink3, fontSize: 11.5, fontWeight: 400 }}>{hint}</span> : null}
  </label>
);

/**
 * 填写资料页（原型 #pg-fill）。
 * 由「通知公告 → 资格通知（初审通过）→ 填写资料」进入；
 * 申请方类型按初审通过时的资格类型固定，不可更改。
 */
export const UserNoticeFill = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { objectScope } = useLayer();
  const uid = objectScope?.id;
  const kind = params.get('kind') ?? 'provider';
  const appId = params.get('id') ?? '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [regionId, setRegionId] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [certType, setCertType] = useState('营业执照');
  const [certNo, setCertNo] = useState('');
  const [expire, setExpire] = useState<string>('');
  const [longTerm, setLongTerm] = useState(false);
  const [issuer, setIssuer] = useState('');
  const [loading, setLoading] = useState(false);

  // 回填初审通过时申请的区域与服务类型（原型：所属区域预选为申请时的辖区）
  const { data: appData } = useCustom<any[]>({
    url: `user/qualifications${uid ? `?userId=${uid}` : ''}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const app = Array.isArray(appData?.data)
    ? (appData?.data as any[]).find((a) => a.id === appId)
    : undefined;
  useEffect(() => {
    if (!app) return;
    setRegionId((v) => v || app.regionPath || '');
    setScopes((s) => (s.length ? s : app.serviceScopes ?? []));
  }, [app]);

  const submit = async () => {
    if (!appId) return message.warning('缺少申请记录，请从通知公告进入');
    if (!name.trim()) return message.warning('请填写申请方名称');
    if (!/^\d{11}$/.test(phone)) return message.warning('请填写 11 位手机号');
    if (!regionId) return message.warning('请选择所属区域（省 / 市 / 区县）');
    if (!certNo.trim()) return message.warning('请填写证件编号');
    if (!longTerm && !expire) return message.warning('请选择有效期或勾选长期有效');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/qualifications/${appId}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          applicantName: name.trim(),
          phone,
          certType,
          certNo: certNo.trim(),
          certExpire: longTerm ? null : expire,
          certLongTerm: longTerm,
          issuer: issuer.trim() || null,
          serviceScopes: scopes,
          regionPath: regionId,
          ...(uid ? { userId: uid } : {}),
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as any)?.message ?? '提交失败');
      message.success('资料已提交，进入管理总台终审');
      navigate('/user/notices');
    } catch (e: any) {
      message.error(e?.message ?? '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHead
        title={`${t(KIND_LABEL[kind] ?? 'pages.col.provider')}入驻资料填写`}
        sub="初审已通过 · 补充完整资料后进入管理总台终审"
        extra={<Button onClick={() => navigate('/user/notices')}>← 返回通知公告</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]" style={{ gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* 申请主体信息 */}
          <Panel title="申请主体信息" hint="初审已通过 · 请补充完整资料">
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ padding: 16, gap: 14 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                <span>
                  申请方类型<span style={{ color: T.down, marginLeft: 2 }}>*</span>
                </span>
                <Input value={t(KIND_LABEL[kind] ?? 'pages.col.provider')} readOnly style={{ background: T.panel2, color: T.ink3 }} />
                <span style={{ color: T.ink3, fontSize: 11.5, fontWeight: 400 }}>
                  按初审通过时申请的资格类型固定 · 不可更改
                </span>
              </label>

              {field(
                '申请方名称',
                true,
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="企业全称或个人姓名" />,
                '企业填营业执照全称，个人填真实姓名',
              )}

              {field(
                '手机号',
                true,
                <Input
                  value={phone}
                  maxLength={11}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="11 位手机号"
                />,
                '用于接收审核进度通知',
              )}

              {field(
                '所属区域',
                true,
                <RegionCascader value={regionId || undefined} onChange={setRegionId} placeholder="选择省 / 市 / 区县" />,
              )}

              <label
                style={{
                  gridColumn: '1/-1',
                  display: 'grid',
                  gap: 6,
                  fontSize: 12.5,
                  color: T.ink2,
                  fontWeight: 600,
                }}
              >
                业务范围（可多选）
                <Checkbox.Group options={serviceRoleOptions()} value={scopes} onChange={(v) => setScopes(v as string[])} />
              </label>
            </div>
          </Panel>

          {/* 资质信息 */}
          <Panel title="资质信息" hint="按申请类型上传对应资质">
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                  资质类型<span style={{ color: T.down }}>*</span>
                </span>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  style={{
                    gap: 10,
                  }}
                >
                  {CERT_TYPES.map((c) => {
                    const on = certType === c.nm;
                    return (
                      <div
                        key={c.nm}
                        onClick={() => setCertType(c.nm)}
                        style={{
                          border: `1px solid ${on ? T.accent : T.border}`,
                          background: on ? T.accentSoft : T.bg,
                          borderRadius: T.rSm,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{c.ic}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink1 }}>{c.nm}</span>
                        <span style={{ fontSize: 11.5, color: T.ink3 }}>{c.ds}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 14, marginBottom: 14 }}>
                {field(
                  '证件编号',
                  true,
                  <Input value={certNo} onChange={(e) => setCertNo(e.target.value)} placeholder="与证件完全一致" />,
                )}
                <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                  <span>
                    有效期至<span style={{ color: T.down, marginLeft: 2 }}>*</span>
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <DatePicker
                      style={{ flex: 1 }}
                      disabled={longTerm}
                      value={expire as any}
                      onChange={(_, s) => setExpire(String(s ?? ''))}
                    />
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 400,
                        color: T.ink2,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      <Checkbox checked={longTerm} onChange={(e) => setLongTerm(e.target.checked)} />
                      长期有效
                    </label>
                  </span>
                </label>
              </div>

              {field(
                '发证机关',
                false,
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="选填，如：乌鲁木齐市市场监督管理局" />,
              )}

              <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                <span style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>资质附件</span>
                <Upload
                  beforeUpload={(file) => {
                    if (file.size > 10 * 1024 * 1024) {
                      message.warning('单文件需 ≤ 10MB');
                      return Upload.LIST_IGNORE;
                    }
                    message.info('资质附件上传即将上线，本次提交暂不携带附件');
                    return Upload.LIST_IGNORE;
                  }}
                  accept=".jpg,.jpeg,.png,.pdf"
                  fileList={[]}
                >
                  <div
                    style={{
                      border: `1px dashed ${T.border}`,
                      borderRadius: T.rSm,
                      padding: '18px 16px',
                      textAlign: 'center',
                      background: T.panel2,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📤</div>
                    <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>点击或拖拽文件到此处上传</div>
                    <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>
                      支持 JPG / PNG / PDF · 单文件 ≤ 10MB
                    </div>
                  </div>
                </Upload>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                padding: '12px 16px',
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <Button onClick={() => navigate('/user/notices')} disabled={loading}>
                返回列表
              </Button>
              <Button
                onClick={() => message.info('草稿保存即将上线，请直接提交资料')}
                disabled={loading}
              >
                保存草稿
              </Button>
              <Button type="primary" onClick={submit} loading={loading}>
                提交资料
              </Button>
            </div>
          </Panel>
        </div>

        {/* 右列：审核进度 + 提示 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Panel title="审核进度">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {PROGRESS.map(([name, desc, done], i) => (
                <div key={name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      flex: 'none',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      background: done ? T.upBg : T.panel2,
                      color: done ? T.upInk : T.ink3,
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink1 }}>{name}</div>
                    <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              background: T.accent2Soft,
              border: `1px solid ${T.border}`,
              borderRadius: T.rMd,
              padding: '12px 14px',
              fontSize: 12.5,
              color: T.ink2,
              lineHeight: 1.7,
            }}
          >
            <span>ℹ️</span>
            <span>资料提交后进入终审，可在「通知公告」关注审核结果</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserNoticeFill;
