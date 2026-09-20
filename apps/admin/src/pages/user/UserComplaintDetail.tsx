import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, message, Spin } from 'antd';
import { useCustom } from '@refinedev/core';
import { PageHead } from '../../components/ui/PageHead';
import { Panel } from '../../components/ui/Panel';
import { Pill } from '../../components/ui/Pill';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';
import { TICKET_STATUS } from '../../config/status';

const TICKET_TYPE: Record<string, string> = {
  COMPLAINT: 'pages.fb.complaint',
  PRAISE: 'pages.status.tkTypePraise',
  SUGGESTION: 'pages.fb.suggestion',
  CONSULT: 'pages.col.consult',
  APPEAL: 'pages.status.tkTypeAppeal',
};


/** 处理流程痕迹（原型 fbTrace）：用户视角为服务商 → 代理商 → 平台逐层升级 */
const TRACE_STEPS: [string, string][] = [
  ['提交反馈', '已提交至反馈处理中心'],
  ['服务商负责人受理', '服务商核对并响应处理'],
  ['代理商介入', '服务商无法解决时升级至代理商'],
  ['平台升级', '仍未解决时最终升级至平台'],
];

const kv = (label: string, value: any) => (
  <div
    key={label}
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: `1px dashed ${T.border}`,
      fontSize: 13,
      gap: 12,
    }}
  >
    <span style={{ color: T.ink3, flex: 'none' }}>{label}</span>
    <span style={{ color: T.ink1, textAlign: 'right', wordBreak: 'break-all' }}>{value ?? '—'}</span>
  </div>
);

/**
 * 反馈详情页（原型 #pg-fbdetail）。
 * 左：基本信息；右：处理流程；下：「意见与回复」日志表（最新在上）；底部发送消息区。
 */
export const UserComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<any>({
    url: `user/complaints/${id}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const [text, setText] = useState('');

  const rec = data?.data as any;
  const st = TICKET_STATUS[rec?.status] ?? { key: rec?.status ?? '—', tone: 'mut' as const };

  if (isLoading) {
    return (
      <Panel>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      </Panel>
    );
  }

  if (!t) {
    return (
      <>
        <PageHead title="反馈详情" sub="反馈不存在或无访问权限" />
        <Panel>
          <div style={{ padding: 40, textAlign: 'center', color: T.ink3 }}>
            未找到该反馈记录
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => navigate('/user/complaints')}>← 返回我的反馈</Button>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="反馈详情"
        sub="反馈处理全程留痕 · 可继续补充消息"
        extra={<Button onClick={() => navigate('/user/complaints')}>← 返回我的反馈</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* 左：基本信息 */}
        <Panel title="基本信息" hint={`编号 ${rec.id?.slice(-8) ?? '—'}`}>
          <div style={{ padding: '12px 20px 16px' }}>
            {kv('编号', rec.code ?? rec.id?.slice(-8) ?? '—')}
            {kv('主题', rec.title)}
            {kv('类型', t(TICKET_TYPE[rec.type] ?? rec.type))}
            {kv('对象', rec.target?.nickname ?? '平台')}
            {kv('提交时间', rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—')}
            {kv('当前状态', <Pill tone={st.tone}>{t(st.key)}</Pill>)}
            {kv('处理部门', '服务商负责人')}
          </div>
        </Panel>

        {/* 右：处理流程 */}
        <Panel title="处理流程" hint="逐层升级">
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TRACE_STEPS.map(([name, desc], i) => {
              const done = i === 0;
              return (
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
              );
            })}
          </div>
        </Panel>
      </div>

      {/* 意见与回复 */}
      <Panel title="意见与回复" hint="最新在上">
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.panel2, color: T.ink3, textAlign: 'left' }}>
                <th style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, width: 140 }}>操作人</th>
                <th style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, width: 130 }}>处理时间</th>
                <th style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}` }}>回复内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, color: T.ink2 }}>我</td>
                <td style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, color: T.ink3 }}>
                  {rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
                </td>
                <td
                  style={{
                    padding: '8px 16px',
                    borderBottom: `1px solid ${T.border}`,
                    lineHeight: 1.6,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    color: T.ink1,
                  }}
                >
                  {rec.content}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', color: T.ink3, fontSize: 12 }}>
          暂无处理方回复 · 平台反馈回复流即将上线
        </div>
      </Panel>

      {/* 发送消息 */}
      <Panel title="补充消息" hint="提交后插入回复表顶部">
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input.TextArea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="补充描述、上传凭证说明或追问处理进度…"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              onClick={() => {
                if (!text.trim()) {
                  message.warning('请输入补充内容');
                  return;
                }
                message.info('反馈补充消息功能即将上线');
              }}
            >
              发送消息
            </Button>
          </div>
        </div>
      </Panel>
    </>
  );
};

export default UserComplaintDetail;
