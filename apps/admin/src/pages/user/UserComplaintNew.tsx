import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Select, Upload, message } from 'antd';
import { PageHead } from '../../components/ui/PageHead';
import { Panel } from '../../components/ui/Panel';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';
import { useLayer } from '../../providers/layerContext';
import { API_URL, authHeaders } from '../../utility';

/** 反馈类型（原型 pg-fbnew）：售后 / 建议 / 咨询 / 投诉 / 其他 → 工单枚举 */
const FB_TYPES = [
  { label: 'pages.status.tkTypeAftersale', value: 'AFTERSALE' },
  { label: 'pages.fb.suggestion', value: 'SUGGESTION' },
  { label: 'pages.col.consult', value: 'CONSULT' },
  { label: 'pages.fb.complaint', value: 'COMPLAINT' },
  { label: 'pages.fb.other', value: 'OTHER' },
];
/** 展示值 → 工单枚举（路由映射，非展示文案，无需 i18n） */
const FB_TYPE_MAP: Record<string, string> = {
  AFTERSALE: 'COMPLAINT',
  SUGGESTION: 'SUGGESTION',
  CONSULT: 'CONSULT',
  COMPLAINT: 'COMPLAINT',
  OTHER: 'CONSULT',
};

/** 反馈部门（原型：处理层次自下而上） */
const FB_DEPTS = [
  { label: 'pages.fb.deptProvider', value: '服务商负责人' },
  { label: 'pages.col.agent', value: '代理商' },
  { label: 'pages.fb.deptPlatform', value: '平台' },
];

/**
 * 新增反馈页（原型 #pg-fbnew）。
 * 必填：主题 / 类型 / 部门 / 对象 / 内容；附件选填（JPG / PNG ≤ 5MB）。
 * 按钮：保存草稿（写回列表）/ 提交反馈（进入处理流程）。
 */
export const UserComplaintNew = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { objectScope } = useLayer();
  const uid = objectScope?.id;

  const [title, setTitle] = useState('');
  const [type, setType] = useState('CONSULT');
  const [dept, setDept] = useState('服务商负责人');
  const [target, setTarget] = useState('平台');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim()) return message.warning('请填写反馈主题');
    if (!content.trim()) return message.warning('请填写反馈内容');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          title: title.trim(),
          type: FB_TYPE_MAP[type] ?? 'CONSULT',
          dept,
          content: content.trim(),
          ...(uid ? { userId: uid } : {}),
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as any)?.message ?? '提交失败');
      message.success('反馈已提交，进入处理流程');
      navigate('/user/complaints');
    } catch (e: any) {
      message.error(e?.message ?? '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHead
        title="新增反馈"
        sub="提交后进入反馈处理流程 · 可随时在详情页补充消息"
        extra={
          <Button onClick={() => navigate('/user/complaints')}>← 返回我的反馈</Button>
        }
      />

      <Panel title="反馈信息" hint="处理层次自下而上：服务商负责人 → 代理商 → 平台">
        <div
          style={{
            padding: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
        >
          <label style={{ gridColumn: '1/-1', display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            <span>
              反馈主题<span style={{ color: T.down, marginLeft: 2 }}>*</span>
            </span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话描述你的反馈，如：服务与描述不符"
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            <span>
              反馈类型<span style={{ color: T.down, marginLeft: 2 }}>*</span>
            </span>
            <Select value={type} onChange={setType} options={FB_TYPES.map((o) => ({ ...o, label: t(o.label) }))} />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            <span>
              反馈部门<span style={{ color: T.down, marginLeft: 2 }}>*</span>
            </span>
            <Select value={dept} onChange={setDept} options={FB_DEPTS.map((o) => ({ ...o, label: t(o.label) }))} />
            <span style={{ color: T.ink3, fontSize: 11.5, fontWeight: 400 }}>
              处理层次自下而上：服务商负责人 → 代理商 → 平台
            </span>
          </label>

          <label style={{ gridColumn: '1/-1', display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            <span>
              反馈对象<span style={{ color: T.down, marginLeft: 2 }}>*</span>
            </span>
            <Select
              value={target}
              onChange={setTarget}
              options={[
                { label: '平台', value: '平台' },
                { label: params.get('provider') ?? '服务商', value: '服务商' },
                { label: '其他', value: '其他' },
              ]}
            />
          </label>

          <label style={{ gridColumn: '1/-1', display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            <span>
              反馈内容<span style={{ color: T.down, marginLeft: 2 }}>*</span>
            </span>
            <Input.TextArea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="详细描述问题发生的时间、经过与期望的处理方式…"
            />
          </label>

          <div style={{ gridColumn: '1/-1', display: 'grid', gap: 6, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            附件
            <Upload
              beforeUpload={(file) => {
                if (file.size > 5 * 1024 * 1024) {
                  message.warning('单文件需 ≤ 5MB');
                  return Upload.LIST_IGNORE;
                }
                message.info('附件上传即将上线，本次提交暂不携带附件');
                return Upload.LIST_IGNORE;
              }}
              accept=".jpg,.jpeg,.png"
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
                <div style={{ fontSize: 20 }}>📎</div>
                <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>
                  点击上传图片 / 截图等凭证（选填）
                </div>
                <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>
                  支持 JPG / PNG · 单文件 ≤ 5MB
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
          <Button onClick={() => navigate('/user/complaints')} disabled={loading}>
            返回列表
          </Button>
          <Button
            onClick={() => {
              if (!title.trim() || !content.trim()) {
                message.warning('请填写反馈主题与内容后再保存草稿');
                return;
              }
              message.info('草稿保存即将上线，请直接提交反馈');
            }}
          >
            保存草稿
          </Button>
          <Button type="primary" onClick={submit} loading={loading}>
            提交反馈
          </Button>
        </div>
      </Panel>
    </>
  );
};

export default UserComplaintNew;
