/**
 * InvitationTemplatePicker — 「请柬模板选择」实时预览弹窗（§18.2）。
 *
 * 复用 WorkPreviewModal 的渲染内核（@h5design/render 的 SchemaRenderer + GSAP 重播），
 * 左列列出本人作品（effectiveSchema = draftSchema ?? schema，草稿也能预览），右舞台手机壳内
 * 多页实时渲染；点选作品 → 「确认」返回 {id,title,schema} 作为批量渲染的 templateId。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SchemaRenderer, SchemaThumbnail, type AnimationPlayer } from '@h5design/render';
import { normalizeSchema } from '@h5design/core';
import { api, type ProjectListItem } from '@/api/client';

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

interface InvitationTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (picked: PickedTemplate) => void;
}

const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

/**
 * 封面缩略图：封皮优先，**无封皮（或封皮失效）时用模板首页兜底**。
 *
 * ★ 背景（为什么必须兜底）：服务端 `project.cover` 默认为 null，只有少数路径会写入，
 *   实测 74 个作品里 71 个 cover 为空。旧实现只写 `cover ? CSS background : '#f2f3f5'`，
 *   于是模板选择列表整列退化成灰块 —— 即「缩略图渲染不出来」。
 * ★ 兜底复用 `ProjectList.tsx` 作品的既有范式：`<SchemaThumbnail schema={首页 schema} />`，
 *   同一套共享渲染器保证与「我的作品」卡片观感一致。
 * ★ SchemaThumbnail 根节点是 absolute inset-0，**父容器必须 position: relative + overflow: hidden**。
 * ★ 运营端 `apps/admin/src/pages/user/UserInvitationTemplatePicker.tsx` 有对应实现，
 *   改这边记得同步那边（仅 URL 归一化处理不同：web 走 vite 代理的相对路径，admin 需拼 STATIC_URL）。
 */
function CoverThumb({ cover, schema, title }: { cover?: string | null; schema?: unknown; title?: string }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const useCover = Boolean(cover) && !coverFailed;
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
          src={cover as string}
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

export function InvitationTemplatePicker({ open, onClose, onConfirm }: InvitationTemplatePickerProps) {
  const { t } = useTranslation(['common']);
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [playAnim, setPlayAnim] = useState(true);
  const [player, setPlayer] = useState<AnimationPlayer>(() => () => undefined);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    setSelectedId(null);
    setPage(0);
    api
      .listProjects()
      .then((d) => {
        if (!alive) return;
        const list = (d ?? []).filter((p) => {
          const schema = (p as any).draftSchema ?? p.schema;
          return schema && (schema as any)?.pages?.length;
        });
        setItems(list);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    let alive = true;
    import('@h5design/editor/animations')
      .then((m) => alive && setPlayer(() => m.playElementAnimation))
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

  const selected = useMemo(() => items.find((p) => p.id === selectedId) ?? null, [items, selectedId]);
  const project = useMemo(
    () => normalizeSchema((selected ? (selected as any).draftSchema ?? selected.schema : null) as any),
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
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK1 }}>
              {t('common:guest.pickTemplateTitle', { defaultValue: '选择请柬模板' })}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: INK3 }}>
              {t('common:guest.pickTemplateHint', { defaultValue: '点选作品预览，确认后将用于批量生成' })}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: INK3, fontSize: 13 }}>…</div>
            ) : error ? (
              <div style={{ padding: 16, color: '#cf1322', fontSize: 13 }}>{error}</div>
            ) : !items.length ? (
              <div style={{ padding: 24, textAlign: 'center', color: INK3, fontSize: 13 }}>
                {t('common:guest.noWorks', { defaultValue: '暂无可用作品（请先创建一个含页面的作品）' })}
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
                    <CoverThumb
                      cover={p.cover}
                      schema={(p as any).draftSchema ?? p.schema}
                      title={p.title}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: INK1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title || t('common:status.untitled', { defaultValue: '未命名作品' })}
                      </div>
                      <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>
                        {p.status === 'published'
                          ? t('common:status.publishedBadge', { defaultValue: '已发布' })
                          : t('common:status.draft', { defaultValue: '草稿' })}{' '}
                        · {dt(p.updatedAt)}
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
                  {t('common:guest.pickTemplateEmpty', { defaultValue: '请选择左侧作品预览' })}
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
                {t('common:button.prevPage', { defaultValue: '上一页' })}
              </button>
              <span style={{ minWidth: 88, textAlign: 'center', color: INK3, fontVariantNumeric: 'tabular-nums' }}>
                {t('common:button.page', { defaultValue: '第' })} {page + 1} / {pages.length} {t('common:button.pageUnit', { defaultValue: '页' })}
              </span>
              <button type="button" style={ctrlBtn} onClick={() => goPage(page + 1)} disabled={pages.length <= 1}>
                {t('common:button.nextPage', { defaultValue: '下一页' })}
              </button>
              <button type="button" style={ctrlBtn} onClick={() => setReplayKey((k) => k + 1)}>
                {t('common:button.replayAnim', { defaultValue: '重播动画' })}
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
                {t('common:button.playAnim', { defaultValue: '播放动画' })}
              </label>
            </div>
          )}

          {hasSchema && pages.length > 1 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {pages.map((p: any, i: number) => (
                <button
                  key={p.id ?? i}
                  type="button"
                  aria-label={`${t('common:button.page', { defaultValue: '第' })} ${i + 1} ${t('common:button.pageUnit', { defaultValue: '页' })}`}
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
            style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: INK2, cursor: 'pointer', fontSize: 13 }}
          >
            {t('common:button.cancel', { defaultValue: '取消' })}
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm({ id: selected.id, title: selected.title || t('common:status.untitled', { defaultValue: '未命名作品' }), schema: (selected as any).draftSchema ?? selected.schema })}
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
            {t('common:button.confirm', { defaultValue: '确认' })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvitationTemplatePicker;

const ctrlBtn: React.CSSProperties = {
  fontSize: 12.5,
  padding: '5px 12px',
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  background: '#fff',
  color: INK2,
  cursor: 'pointer',
};
