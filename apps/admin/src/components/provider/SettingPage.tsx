import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { T } from '../../config/theme';
import { Pill, type PillTone } from '../ui/Pill';
import { SchemaThumbnail, isProjectLike } from '@h5design/render';

/**
 * 服务商视角「详情 / 设置页」统一骨架 —— 对齐 UI_Design/index.html 的 .svcf-grid 两栏范式。
 * 左栏：表单 / 内容；右栏：实时预览卡 / 信息卡 / 流程步骤 / 时间轴。
 * 取代原先在列表页内以 Modal 弹窗呈现详情的做法（原型中这些均为独立整页）。
 */

const body: CSSProperties = {
  padding: '20px 24px 32px',
  display: 'flex',
  flexDirection: 'column',
  gap: T.gap,
  minWidth: 0,
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) 360px',
  gap: 16,
  alignItems: 'start',
};

const cardBase: CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: T.rMd,
  overflow: 'hidden',
  minWidth: 0,
};

export interface SettingPageProps {
  title: string;
  sub?: string;
  chip?: string;
  /** 返回目标路由 */
  backTo: string;
  /** 左栏主内容（表单 / 详情字段） */
  children: ReactNode;
  /** 右栏：预览卡 / 信息卡 / 流程 / 时间轴 等 */
  aside?: ReactNode;
  /** 底部操作区（保存 / 提交 等） */
  footer?: ReactNode;
  loading?: boolean;
}

export function SettingPage({ title, sub, chip, backTo, children, aside, footer, loading }: SettingPageProps) {
  const nav = useNavigate();
  return (
    <div style={body}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => nav(backTo)} style={{ color: T.ink2 }}>
          返回
        </Button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.ink1, lineHeight: 1.3 }}>{title}</div>
          {sub && <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 2 }}>{sub}</div>}
        </div>
        {chip && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 10px', borderRadius: 999, background: T.accent2Soft, color: T.accent2, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {chip}
          </span>
        )}
      </div>

      <div style={grid}>
        <div style={{ ...cardBase, padding: 20 }} className="svcf-main">
          {children}
        </div>
        {aside && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }} className="svcf-aside">
            {aside}
          </div>
        )}
      </div>

      {footer && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          {footer}
        </div>
      )}
      {loading && <div style={{ color: T.ink3, fontSize: 12 }}>加载中…</div>}
    </div>
  );
}

/** 右栏信息卡 */
export function PreviewCard({ title, hint, children, soft }: { title: string; hint?: string; children: ReactNode; soft?: boolean }) {
  return (
    <div style={{ ...cardBase, background: soft ? T.panel2 : T.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, fontWeight: 650, fontSize: 14, color: T.ink1 }}>
        {title}
        {hint && <span style={{ marginLeft: 'auto', color: T.ink3, fontWeight: 400, fontSize: 12 }}>{hint}</span>}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export interface FlowStep {
  title: string;
  desc?: string;
  state?: 'done' | 'current' | 'todo';
}

/** 右栏竖向流程步骤（合同签署流程等） */
export function FlowSteps({ steps }: { steps: FlowStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => {
        const tone: PillTone = s.state === 'done' ? 'ok' : s.state === 'current' ? 'ac' : 'mut';
        const dot = s.state === 'done' ? T.up : s.state === 'current' ? T.accent : T.ink3;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i === steps.length - 1 ? 4 : 18 }}>
            {i < steps.length - 1 && <span style={{ position: 'absolute', left: 6, top: 18, bottom: 0, width: 2, background: T.border }} />}
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: dot, border: `2px solid ${T.bg}`, boxShadow: `0 0 0 1px ${dot}`, flex: 'none', marginTop: 3, zIndex: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.state === 'todo' ? T.ink3 : T.ink1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.title}
                {s.state === 'current' && <Pill tone="ac">进行中</Pill>}
                {s.state === 'done' && <Pill tone="ok">已完成</Pill>}
              </div>
              {s.desc && <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2, lineHeight: 1.6 }}>{s.desc}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface TimelineItem {
  title: string;
  desc?: string;
  time?: string;
  tone?: PillTone;
}

/** 右栏时间轴（触达记录 / 协商记录等） */
export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <div style={{ fontSize: 12, color: T.ink3 }}>暂无记录</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i === items.length - 1 ? 4 : 14 }}>
          {i < items.length - 1 && <span style={{ position: 'absolute', left: 5, top: 16, bottom: 0, width: 1, background: T.border }} />}
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: T.accent, border: `2px solid ${T.bg}`, boxShadow: `0 0 0 1px ${T.accent}`, flex: 'none', marginTop: 3, zIndex: 1 }} />
          <div style={{ minWidth: 0, lineHeight: 1.6 }}>
            <div style={{ fontSize: 12.5, color: T.ink1, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
              {it.title}
              {it.tone && <Pill tone={it.tone}>{it.tone === 'ok' ? '成功' : it.tone === 'ac' ? '已触达' : '记录'}</Pill>}
            </div>
            {it.desc && <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{it.desc}</div>}
            {it.time && <div style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{it.time}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 右栏成员名片（我的团队） */
export function MemberCard({ name, memberNo, serviceType, teamRole, status, phone }: { name: string; memberNo: string; serviceType?: string; teamRole?: string; status?: string; phone?: string }) {
  const initial = (name || '?').slice(0, 1);
  return (
    <div style={{ ...cardBase, background: T.panel2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.avatarGrad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flex: 'none' }}>{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink1 }}>{name}</div>
          <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>工号 {memberNo}</div>
        </div>
      </div>
      <div style={{ padding: '14px 18px', display: 'grid', gap: 10, fontSize: 12.5, color: T.ink2 }}>
        <Line k="服务类型" v={serviceType || '—'} />
        <Line k="团队角色" v={teamRole || '—'} />
        <Line k="账号状态" v={status || '—'} />
        <Line k="手机号" v={phone || '—'} />
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ color: T.ink3, flex: 'none', width: 64 }}>{k}</span>
      <span style={{ color: T.ink1, fontWeight: 500 }}>{v}</span>
    </div>
  );
}

/**
 * 通用预览舞台：真实渲染 schema 首屏（与前端同款渲染器，像素一致），无可用 schema 时
 * 回退封面图，最后回退占位。
 *
 * ⚠️ 判定顺序必须是「schema 优先于 cover」：列表卡片（TemplateCard）一律用
 * SchemaThumbnail 实时渲染，从不使用 cover；若详情页反过来优先铺一张静态封面图，
 * 同一个作品/模板在「列表」与「详情右栏」就会呈现两套画面（封面图是历史导出，
 * 不会随草稿更新）。SchemaThumbnail 自带 isProjectLike 守卫 + 错误边界 + 等比缩放
 * + 视口懒渲染，schema 畸形时仅回退 H5 占位、不会白屏。
 */
function PreviewStage({
  name, cover, schema, fallbackColor, fallbackTitle, fallbackTitleColor,
}: {
  name: string; cover?: string; schema?: unknown;
  fallbackColor?: string; fallbackTitle?: string; fallbackTitleColor?: string;
}) {
  const renderable = isProjectLike(schema);
  // 「封面底色 / 标题色 / 封面标题」设置即时可见：在预览舞台上方渲染一条封面标题色条
  // （catalog 卡片封面范式）。这样在详情页调节颜色/标题即可立刻看到效果，而非「只占位无作用」。
  const hasCoverMeta = !!(fallbackColor || fallbackTitle);
  return (
    <div>
      {hasCoverMeta && (
        <div
          style={{
            padding: '8px 12px',
            background: fallbackColor || '#1f2937',
            color: fallbackTitleColor || '#fff',
            fontSize: 13, fontWeight: 700, textAlign: 'center', lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {fallbackTitle || name}
        </div>
      )}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '375 / 667',
          overflow: 'hidden',
          background: fallbackColor || 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {renderable ? (
          <SchemaThumbnail schema={schema} />
        ) : cover ? (
          <img src={cover} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : fallbackTitle ? (
          <div style={{ color: fallbackTitleColor || '#222', fontSize: 18, fontWeight: 700, textAlign: 'center', padding: 16, lineHeight: 1.4 }}>
            {fallbackTitle}
          </div>
        ) : (
          <span style={{ fontSize: 30, fontWeight: 700, color: '#d1d5db' }}>{name.slice(0, 1)}</span>
        )}
      </div>
    </div>
  );
}

/** 右栏服务预览卡（服务管理 / 模板发布，对标原型 svcp-card） */
export function ServicePreviewCard({ name, category, price, tags, intro, status, cover, schema }: { name: string; category?: string; price?: number; tags?: string[]; intro?: string; status?: string; cover?: string; schema?: unknown }) {
  return (
    <div style={{ ...cardBase, boxShadow: '0 2px 10px rgba(20,24,40,.06)' }}>
      <div style={{ background: T.panel2, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '服务名称'}</div>
        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {category && <span>{category}</span>}
          {status && <Pill tone="mut">{status}</Pill>}
        </div>
      </div>
      <PreviewStage name={name} cover={cover} schema={schema} />
      {intro && (
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: T.ink2, lineHeight: 1.6 }}>{intro}</div>
      )}
      {tags && tags.length > 0 && (
        <div style={{ padding: '0 16px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{ fontSize: 11, color: T.ink2, background: T.panel2, border: `1px solid ${T.border}`, padding: '2px 9px', borderRadius: 999 }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, marginTop: 8, borderTop: `1px solid ${T.border}` }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: T.accent, whiteSpace: 'nowrap' }}>
          {typeof price === 'number' ? `¥${price.toFixed(2)}` : '¥0.00'}
          <small style={{ fontSize: 11, color: T.ink3, fontWeight: 400 }}> 起</small>
        </span>
        <span style={{ fontSize: 12.5, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.ink2 }}>咨询预约</span>
      </div>
    </div>
  );
}

/** 右栏模板预览卡（模板发布 pg-tplcfg，对齐 ServicePreviewCard 的整卡范式：表头 + 全宽预览舞台 + 简介/标签 + 价格条） */
export function TemplatePreviewCard({ name, category, price, tags, intro, status, isOfficial, useCount, cover, coverTitle, coverColor, titleColor, schema }: { name: string; category?: string; price?: number; tags?: string[]; intro?: string; status?: string; isOfficial?: boolean; useCount?: number; cover?: string; coverTitle?: string; coverColor?: string; titleColor?: string; schema?: unknown }) {
  const statusLabel = status === 'APPROVED' ? '已发布' : status === 'TAKEN_DOWN' ? '已下架' : status === 'PENDING' ? '草稿' : status || '';
  return (
    <div style={{ ...cardBase, boxShadow: '0 2px 10px rgba(20,24,40,.06)' }}>
      <div style={{ background: T.panel2, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '模板名称'}</div>
        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {category && <span>{category}</span>}
          {isOfficial && <span style={{ flex: 'none', fontSize: 10, background: T.accent, color: '#fff', padding: '2px 6px', borderRadius: 4 }}>官方</span>}
          {statusLabel && <Pill tone="mut">{statusLabel}</Pill>}
        </div>
      </div>
      <PreviewStage name={name} cover={cover} schema={schema} fallbackColor={coverColor} fallbackTitle={coverTitle} fallbackTitleColor={titleColor} />
      {intro && (
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: T.ink2, lineHeight: 1.6 }}>{intro}</div>
      )}
      {tags && tags.length > 0 && (
        <div style={{ padding: '0 16px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{ fontSize: 11, color: T.ink2, background: T.panel2, border: `1px solid ${T.border}`, padding: '2px 9px', borderRadius: 999 }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, marginTop: 8, borderTop: `1px solid ${T.border}` }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: T.accent, whiteSpace: 'nowrap' }}>
          {typeof price === 'number' && price > 0 ? `¥${price.toFixed(2)}` : '免费'}
          <small style={{ fontSize: 11, color: T.ink3, fontWeight: 400 }}> 起</small>
        </span>
        {useCount != null && (
          <span style={{ fontSize: 12.5, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.ink2 }}>已用 {useCount} 次</span>
        )}
      </div>
    </div>
  );
}

/** 右栏作品预览卡（前端「我的作品」只读预览，pg-workcfg 对标模板预览整卡范式） */
export function WorkPreviewCard({ name, status, cover, schema, viewCount, publishCode }: { name: string; status?: string; cover?: string; schema?: unknown; viewCount?: number | null; publishCode?: string | null }) {
  const statusLabel = status === 'published' ? '已发布' : status === 'draft' ? '草稿' : status || '';
  return (
    <div style={{ ...cardBase, boxShadow: '0 2px 10px rgba(20,24,40,.06)' }}>
      <div style={{ background: T.panel2, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '作品名称'}</div>
        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ flex: 'none', fontSize: 10, background: T.accent, color: '#fff', padding: '2px 6px', borderRadius: 4 }}>作品</span>
          {statusLabel && <Pill tone="mut">{statusLabel}</Pill>}
          {publishCode && <span>发布码 {publishCode}</span>}
        </div>
      </div>
      <PreviewStage name={name} cover={cover} schema={schema} />
      {viewCount != null && (
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: T.ink2 }}>浏览 {viewCount} 次</div>
      )}
    </div>
  );
}
