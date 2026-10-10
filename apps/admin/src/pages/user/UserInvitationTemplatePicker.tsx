import { useEffect, useMemo, useState } from 'react';
import { SchemaRenderer, SchemaThumbnail, type AnimationPlayer } from '@h5design/render';
import { normalizeSchema } from '@h5design/core';
import { apiGet, useSubjectScope, absAssetUrl, type WorkItem } from './invitationShared';

/**
 * 「选择请柬模板」弹窗（用户视角）
 *
 * 唯一基准 = web 端 `apps/web/src/user/InvitationTemplatePicker.tsx`：
 *  - 左列本人作品（封面缩略 + 标题 + 草稿/已发布 · 更新时间），点选高亮（品牌红描边 + 淡红底）；
 *  - 右舞台手机壳内 `@h5design/render` SchemaRenderer 多页实时渲染；
 *  - 底部控件：上一页 / 第 N / M 页 / 下一页 / 重播动画 / 播放动画（勾选）；
 *  - 多页时下方圆点指示；底栏「取消 / 确认」，确认返回 { id, title, schema }。
 *
 * 作用域：用户视角 = ADMIN 监督窗口，`subject` 透传（作品列表按被视察用户取）。
 */

const DESIGN_W = 375;
const DESIGN_H = 667;
const FRAME_W = 300;
const BEZEL = 10;
const SCALE = FRAME_W / DESIGN_W;

const INK1 = '#1f2329';
const INK2 = '#4e5969';
const INK3 = '#86909c';
const BORDER = '#e5e6eb';
const BRAND = '#D24830';
const ACCENT = '#c81e42';

export interface PickedTemplate {
  id: string;
  title: string;
  schema: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (picked: PickedTemplate) => void;
}

const dt = (v?: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

/**
 * 封面缩略图：封皮优先，**无封皮（或封皮失效）时用模板首页兜底**。
 *
 * ★ 背景（为什么必须兜底）：服务端 `project.cover` 默认为 null，只有少数路径会写入，
 *   实测 74 个作品里 71 个 cover 为空。旧实现只写 `cover ? CSS background : '#f2f3f5'`，
 *   于是模板选择列表整列退化成灰块 —— 即「缩略图渲染不出来」。
 * ★ 兜底复用 web 端 `InvitationTemplatePicker` / `ProjectList` 的既有范式
 *   `<SchemaThumbnail schema={首页 schema} />`（同属 @h5design/render，保证三端观感一致）。
 * ★ SchemaThumbnail 根节点是 absolute inset-0，**父容器必须 position: relative + overflow: hidden**。
 * ★ cover 的相对路径须过 `absAssetUrl` 补 `STATIC_URL`（admin Vite 不代理 /uploads）。
 * ★ 改这里记得同步 web 端 `apps/web/src/user/InvitationTemplatePicker.tsx` 的 CoverThumb。
 */
function CoverThumb({ cover, schema, title }: { cover?: string | null; schema?: unknown; title?: string }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const src = absAssetUrl(cover);
  const useCover = Boolean(src) && !coverFailed;
  const pages = (schema as { pages?: unknown[] } | null | undefined)?.pages;
  const mode = useCover ? 'cover' : Array.isArray(pages) && pages.length > 0 ? 'first-page' : 'placeholder';
  return (
    <div
      data-testid="cover-thumb"
      data-mode={mode}
      style={{
        position: 'relative',
        width: 40,
        height: 56,
        borderRadius: 6,
        flexShrink: 0,
        overflow: 'hidden',
        background: '#f2f3f5',
        border: `1px solid ${BORDER}`,
      }}
    >
      {useCover ? (
        <img
          src={src}
          alt={title ?? ''}
          onError={() => setCoverFailed(true)}
          style={{ display: 'block', height: '100%', width: '100%', objectFit: 'cover' }}
        />
      ) : (
        <SchemaThumbnail schema={schema} />
      )}
    </div>
  );
}

export function UserInvitationTemplatePicker({ open, onClose, onConfirm }: Props) {
  const { q } = useSubjectScope();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [playAnim, setPlayAnim] = useState(true);
  const [player, setPlayer] = useState<AnimationPlayer>(() => () => undefined);
  /** 列表项缺 schema 时，按需补拉详情 */
  const [detail, setDetail] = useState<WorkItem | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    setSelectedId(null);
    setDetail(null);
    setPage(0);
    apiGet<WorkItem[]>(q('/projects'))
      .then((d) => {
        if (!alive) return;
        const list = (d ?? []).filter((p) => {
          const schema = p.draftSchema ?? p.schema;
          // 列表未带 schema 的作品保留（选中后按需补拉详情），带 schema 的须含页
          return schema ? Boolean(schema?.pages?.length) : true;
        });
        setItems(list);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    let alive = true;
    import('@h5design/editor/animations')
      .then((m) => {
        if (alive) setPlayer(() => m.playElementAnimation);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /** 选中项缺 schema 时补拉详情（admin `/projects` 列表可能不含 schema） */
  useEffect(() => {
    if (!selectedId) return;
    const base = items.find((p) => p.id === selectedId);
    const hasSchema = Boolean((base?.draftSchema ?? base?.schema)?.pages?.length);
    if (hasSchema) return;
    let alive = true;
    apiGet<WorkItem>(q(`/projects/${selectedId}`))
      .then((full) => {
        if (alive) setDetail(full);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items]);

  const selected = useMemo(() => {
    const base = items.find((p) => p.id === selectedId) ?? null;
    if (!base) return null;
    return detail && detail.id === base.id ? { ...base, ...detail } : base;
  }, [items, selectedId, detail]);

  const project = useMemo(
    () => normalizeSchema((selected ? selected.draftSchema ?? selected.schema : null) as any),
    [selected],
  );
  const pages = (project as any)?.pages ?? [];
  const hasSchema = pages.length > 0;

  const goPage = (i: number) => {
    if (!pages.length) return;
    setPage((i + pages.length) % pages.length);
    setReplayKey((k) => k + 1);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          maxHeight: '92vh',
          width: '100%',
          maxWidth: 880,
          overflow: 'hidden',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左：作品列表 */}
        <div
          style={{
            flex: '1 1 320px',
            borderRight: `1px solid ${BORDER}`,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${BORDER}` }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK1 }}>选择请柬模板</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: INK3 }}>点选作品预览，确认后将用于批量生成</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: INK3, fontSize: 13 }}>…</div>
            ) : error ? (
              <div style={{ padding: 16, color: '#cf1322', fontSize: 13 }}>{error}</div>
            ) : !items.length ? (
              <div style={{ padding: 24, textAlign: 'center', color: INK3, fontSize: 13 }}>
                暂无可用作品（请先创建一个含页面的作品）
              </div>
            ) : (
              items.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setDetail(null);
                      setPage(0);
                      setReplayKey((k) => k + 1);
                    }}
                    style={{
                      display: 'flex',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      alignItems: 'center',
                      padding: 8,
                      marginBottom: 6,
                      borderRadius: 8,
                      border: `1px solid ${active ? BRAND : BORDER}`,
                      background: active ? 'rgba(210,72,48,0.06)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <CoverThumb cover={p.cover} schema={p.draftSchema ?? p.schema} title={p.title} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: INK1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.title || '未命名作品'}
                      </div>
                      <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>
                        {p.status === 'published' ? '已发布' : '草稿'} · {dt(p.updatedAt)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右：手机预览舞台 */}
        <div
          style={{
            flex: '1 1 420px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#f9fafb',
            minHeight: 480,
          }}
        >
          <div
            style={{
              position: 'relative',
              borderRadius: 32,
              background: '#111827',
              padding: BEZEL,
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              width: FRAME_W + BEZEL * 2,
              height: DESIGN_H * SCALE + BEZEL * 2,
            }}
          >
            <div
              style={{
                position: 'relative',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                borderRadius: 22,
                background: '#fff',
              }}
            >
              {hasSchema ? (
                <SchemaRenderer
                  key={replayKey}
                  project={project as any}
                  currentPage={page}
                  scale={SCALE}
                  animated={playAnim}
                  animationPlayer={player}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    height: '100%',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    color: '#9ca3af',
                    padding: 16,
                    textAlign: 'center',
                  }}
                >
                  {selectedId ? '该作品暂无可预览页面' : '请选择左侧作品预览'}
                </div>
              )}
            </div>
          </div>

          {hasSchema && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                fontSize: 12.5,
              }}
            >
              <button type="button" style={ctrlBtn} onClick={() => goPage(page - 1)} disabled={pages.length <= 1}>
                上一页
              </button>
              <span style={{ minWidth: 88, textAlign: 'center', color: INK3, fontVariantNumeric: 'tabular-nums' }}>
                第 {page + 1} / {pages.length} 页
              </span>
              <button type="button" style={ctrlBtn} onClick={() => goPage(page + 1)} disabled={pages.length <= 1}>
                下一页
              </button>
              <button type="button" style={ctrlBtn} onClick={() => setReplayKey((k) => k + 1)}>
                重播动画
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: INK2, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={playAnim}
                  onChange={(e) => {
                    setPlayAnim(e.target.checked);
                    if (e.target.checked) setReplayKey((k) => k + 1);
                  }}
                />
                播放动画
              </label>
            </div>
          )}

          {hasSchema && pages.length > 1 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {pages.map((p: any, i: number) => (
                <button
                  key={p.id ?? i}
                  type="button"
                  aria-label={`第 ${i + 1} 页`}
                  onClick={() => goPage(i)}
                  style={{
                    height: 8,
                    width: i === page ? 24 : 8,
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: i === page ? BRAND : '#d1d5db',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部工具条 */}
        <div
          style={{
            flex: '1 1 100%',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '12px 16px',
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: '#fff',
              color: INK2,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() =>
              selected &&
              onConfirm({
                id: selected.id,
                title: selected.title || '未命名作品',
                schema: selected.draftSchema ?? selected.schema,
              })
            }
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: selected ? ACCENT : '#e5e7eb',
              color: selected ? '#fff' : INK3,
              cursor: selected ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  fontSize: 12.5,
  padding: '5px 12px',
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  background: '#fff',
  color: INK2,
  cursor: 'pointer',
};

export default UserInvitationTemplatePicker;
