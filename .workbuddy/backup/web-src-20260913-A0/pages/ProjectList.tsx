/**
 * 作品列表页（用户中心）— 展示用户的所有 H5 作品与请柬模板
 *
 * 与运营端「模板管理」保持一致：把「我的作品」(Project) 与「我的模板」(Template，仅服务商)
 * 合并进同一网格，用「来源」标签区分。
 * - 作品(Project)：保留原有的 发布 / 下架 / 二维码 / 删除 等操作。
 * - 模板(Template)：提供「使用模板」操作（克隆为新作品并进入编辑器）。
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type ProjectListItem, type TemplateDetail } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useEditorStore } from '@/store/editorStore';
import { SchemaThumbnail } from '@/components/SchemaThumbnail';
import SiteFooter from '@/components/SiteFooter';
import ProviderSection from '@/components/ProviderSection';
import { buildShareUrl, generateQrDataUrl, downloadDataUrl } from '@/utils/share';

type GridItem =
  | {
      kind: 'work';
      id: string;
      title: string;
      cover: string | null;
      status: 'draft' | 'published';
      updatedAt: string;
      publishCode?: string | null;
      schema: unknown;
      viewCount: number;
    }
  | {
      kind: 'template';
      id: string;
      title: string;
      cover: string | null;
      status: string;
      updatedAt: string;
      schema: unknown;
      isOfficial: boolean;
    };

const SOURCE_CLS: Record<'work' | 'template', string> = {
  work: 'bg-blue-100 text-blue-700',
  template: 'bg-purple-100 text-purple-700',
};

export default function Dashboard() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const loadProject = useEditorStore((s) => s.loadProject);
  const newProject = useEditorStore((s) => s.newProject);
  const isProvider = useAuthStore((s) => s.isProvider);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'work' | 'template'>('all');
  // 数据看板：总览指标 + 每个作品的访问量
  const [stats, setStats] = useState<{
    totalViews: number;
    totalProjects: number;
    publishedProjects: number;
    totalTemplates: number;
  } | null>(null);
  const [viewsById, setViewsById] = useState<Record<string, number>>({});
  // A3 已发布管理：二维码弹窗状态
  const [qrFor, setQrFor] = useState<{ code: string; dataUrl: string | null } | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, overview, projStats, tpls] = await Promise.all([
        api.listProjects(),
        api.getStatsOverview().catch(() => null),
        api.getStatsProjects().catch(() => [] as { id: string; viewCount: number }[]),
        // 仅服务商才有「我的模板」；普通用户调用会 403，这里静默兜底为空数组
        isProvider
          ? api.listMyTemplates().catch(() => [] as TemplateDetail[])
          : Promise.resolve([] as TemplateDetail[]),
      ]);
      setProjects(list);
      setTemplates(tpls ?? []);
      setStats(overview);
      setViewsById(
        Object.fromEntries((projStats ?? []).map((p) => [p.id, p.viewCount])),
      );
    } catch {
      setError(t('errors:dashboard.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, isProvider]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 合并「作品」与「模板」为统一网格项，按更新时间倒序
  const merged = useMemo<GridItem[]>(() => {
    const works: GridItem[] = projects.map((p) => ({
      kind: 'work',
      id: p.id,
      title: p.title,
      cover: p.cover,
      status: p.status,
      updatedAt: p.updatedAt,
      publishCode: p.publishCode,
      schema: p.schema,
      viewCount: viewsById[p.id] ?? 0,
    }));
    const tpls: GridItem[] = templates.map((tp) => ({
      kind: 'template',
      id: tp.id,
      title: tp.name,
      cover: tp.cover,
      status: tp.status,
      updatedAt: tp.updatedAt,
      schema: tp.schema,
      isOfficial: tp.isOfficial,
    }));
    return [...works, ...tpls].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [projects, templates, viewsById]);

  const items = filter === 'all' ? merged : merged.filter((m) => m.kind === filter);

  const handleCreate = useCallback(async () => {
    try {
      const res = await api.createProject(t('common:status.untitled'));
      newProject();
      navigate(`/editor/${res.id}`);
    } catch {
      alert(t('errors:dashboard.createFailed'));
    }
  }, [navigate, newProject, t]);

  const handleBrowseTemplates = useCallback(() => {
    navigate('/templates');
  }, [navigate]);

  const handleOpen = useCallback(
    async (id: string) => {
      try {
        const detail = await api.getProject(id);
        loadProject(detail.schema as never, id);
        navigate(`/editor/${id}`);
      } catch {
        alert(t('errors:dashboard.loadFailed'));
      }
    },
    [navigate, loadProject, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(t('errors:dashboard.deleteConfirm'))) return;
      try {
        await api.deleteProject(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } catch {
        alert(t('errors:dashboard.deleteFailed'));
      }
    },
    [t],
  );

  const handlePublish = useCallback(
    async (id: string) => {
      try {
        const result = await api.publish(id);
        const fullUrl = `${window.location.origin}/p/${result.publishCode}`;
        navigator.clipboard?.writeText(fullUrl);
        alert(t('errors:dashboard.publishSuccess', { url: fullUrl }));
        fetchProjects();
      } catch {
        alert(t('errors:dashboard.publishFailed'));
      }
    },
    [fetchProjects, t],
  );

  // A3：打开二维码弹窗并生成分享码
  const handleOpenQr = useCallback(async (code: string) => {
    setQrFor({ code, dataUrl: null });
    try {
      const dataUrl = await generateQrDataUrl(buildShareUrl(code));
      setQrFor((prev) => (prev && prev.code === code ? { ...prev, dataUrl } : prev));
    } catch {
      setQrFor((prev) => (prev && prev.code === code ? { ...prev, dataUrl: null } : prev));
    }
  }, []);

  // A3：下架已发布作品（复用已有 unpublish 接口）
  const handleUnpublish = useCallback(
    async (id: string) => {
      if (!confirm(t('errors:dashboard.unpublishConfirm'))) return;
      try {
        await api.unpublish(id);
        fetchProjects();
      } catch {
        alert(t('errors:dashboard.unpublishFailed'));
      }
    },
    [fetchProjects, t],
  );

  // 使用模板：克隆为新作品并进入编辑器
  const handleUseTemplate = useCallback(
    async (id: string, title?: string) => {
      try {
        const res = await api.useTemplate(id, title);
        loadProject(res.schema as never, res.id);
        navigate(`/editor/${res.id}`);
      } catch {
        alert(t('errors:error.useTemplateFailed'));
      }
    },
    [navigate, loadProject, t],
  );

  return (
    <div className="min-h-full bg-white text-gray-900">
      {/* 内容区 */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-gray-900">{t('errors:dashboard.title')}</h2>
          <div className="flex items-center gap-3">
            {/* 来源过滤：全部 / 作品 / 模板（与运营端「模板管理」一致） */}
            <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
              {(['all', 'work', 'template'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    filter === f
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {f === 'all'
                    ? t('errors:dashboard.filterAll')
                    : f === 'work'
                      ? t('errors:dashboard.filterWorks')
                      : t('errors:dashboard.filterTemplates')}
                </button>
              ))}
            </div>
            <button
              onClick={handleCreate}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              + {t('errors:dashboard.createNew')}
            </button>
          </div>
        </div>

        {/* 数据看板：核心指标卡片 */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={t('errors:dashboard.stats.views')} value={stats?.totalViews ?? 0} accent="text-sky-500" />
          <StatCard label={t('errors:dashboard.stats.projects')} value={stats?.totalProjects ?? 0} accent="text-blue-500" />
          <StatCard label={t('errors:dashboard.stats.published')} value={stats?.publishedProjects ?? 0} accent="text-green-600" />
          <StatCard label={t('errors:dashboard.stats.templates')} value={stats?.totalTemplates ?? 0} accent="text-purple-500" />
        </div>

        {loading && (
          <div className="py-20 text-center text-gray-500">{t('common:status.loading')}</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <CreateWorkCard
              onChooseTemplate={handleBrowseTemplates}
              onCreateBlank={handleCreate}
            />
            {items.map((item) => (
              <WorkCard
                key={`${item.kind}-${item.id}`}
                item={item}
                onOpen={handleOpen}
                onUse={handleUseTemplate}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
                onDelete={handleDelete}
                onOpenQr={handleOpenQr}
              />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-20 text-center text-gray-500">{t('errors:dashboard.empty')}</div>
        )}
      </main>

      {/* 服务商专区（与首页一致） */}
      <ProviderSection />

      {/* 页脚（与首页一致） */}
      <SiteFooter />

      {/* A3 已发布作品二维码弹窗 */}
      {qrFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setQrFor(null)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-white p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-base font-bold text-gray-800">
              {t('common:published.qrTitle')}
            </div>
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded bg-gray-50 p-2">
              {qrFor.dataUrl ? (
                <img src={qrFor.dataUrl} alt="QR" className="h-full w-full" />
              ) : (
                <span className="text-xs text-gray-400">...</span>
              )}
            </div>
            <div className="mt-3 truncate text-xs text-gray-400">
              {buildShareUrl(qrFor.code)}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => qrFor.dataUrl && downloadDataUrl(qrFor.dataUrl, `qrcode-${qrFor.code}.png`)}
                disabled={!qrFor.dataUrl}
                className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {t('common:share.saveQr')}
              </button>
              <button
                onClick={() => setQrFor(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {t('common:button.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 网格卡片：作品 / 模板 共用，按 item.kind 渲染不同的来源标签、状态与操作 */
function WorkCard({
  item,
  onOpen,
  onUse,
  onPublish,
  onUnpublish,
  onDelete,
  onOpenQr,
}: {
  item: GridItem;
  onOpen: (id: string) => void;
  onUse: (id: string, title: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenQr: (code: string) => void;
}) {
  const { t } = useTranslation(['common', 'errors']);

  const TPL_STATUS: Record<string, { label: string; cls: string }> = {
    PENDING: { label: t('errors:dashboard.tplPending'), cls: 'bg-amber-100 text-amber-700' },
    APPROVED: { label: t('errors:dashboard.tplApproved'), cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: t('errors:dashboard.tplRejected'), cls: 'bg-red-100 text-red-700' },
    TAKEN_DOWN: { label: t('errors:dashboard.tplTakenDown'), cls: 'bg-red-100 text-red-700' },
  };

  const isTemplate = item.kind === 'template';

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow-md"
      onClick={() => (isTemplate ? onUse(item.id, item.title) : onOpen(item.id))}
    >
      {/* 来源标签（左上角，常驻显示） */}
      <div
        className={`absolute start-2 top-2 z-10 rounded px-1.5 py-0.5 text-xs font-medium ${
          isTemplate ? SOURCE_CLS.template : SOURCE_CLS.work
        }`}
      >
        {isTemplate ? t('errors:dashboard.kindTemplate') : t('errors:dashboard.kindWork')}
      </div>

      {/* 封面区：优先显示上传的封面，否则渲染第一页内容作为实时缩略图 */}
      <div className="relative flex aspect-[375/667] items-center justify-center overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {item.cover ? (
          <img src={item.cover} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <SchemaThumbnail schema={item.schema} />
        )}
      </div>

      {/* 信息区 */}
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-gray-800">
          {item.title || t('common:status.untitled')}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
          {isTemplate ? (
            TPL_STATUS[item.status] && (
              <span className={`rounded px-1.5 py-0.5 ${TPL_STATUS[item.status].cls}`}>
                {TPL_STATUS[item.status].label}
              </span>
            )
          ) : (
            <>
              <span title={t('errors:dashboard.stats.views')}>👁 {item.viewCount}</span>
              {item.status === 'published' && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                  {t('common:status.publishedBadge')}
                </span>
              )}
            </>
          )}
          {item.kind === 'template' && item.isOfficial && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              {t('common:badge.official')}
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮（hover 浮现） */}
      <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {isTemplate ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUse(item.id, item.title);
            }}
            className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700"
          >
            {t('common:button.useTemplate')}
          </button>
        ) : item.status === 'published' && item.publishCode ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(buildShareUrl(item.publishCode as string), '_blank');
              }}
              className="rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-700"
            >
              {t('common:published.view')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenQr(item.publishCode as string);
              }}
              className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
            >
              {t('common:published.qr')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
            >
              {t('common:button.delete')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnpublish(item.id);
              }}
              className="rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-700"
            >
              {t('common:published.unpublish')}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPublish(item.id);
              }}
              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
            >
              {t('common:button.publish')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
            >
              {t('common:button.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** 创建作品入口卡片：挑选模板 / 新建空白 */
function CreateWorkCard({
  onChooseTemplate,
  onCreateBlank,
}: {
  onChooseTemplate: () => void;
  onCreateBlank: () => void | Promise<void>;
}) {
  const { t } = useTranslation(['errors']);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white transition hover:border-brand-300 hover:shadow-md">
      <button
        type="button"
        onClick={onChooseTemplate}
        className="flex flex-1 flex-col items-center justify-center gap-2 p-4 transition hover:bg-gray-50"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gray-700 transition group-hover:text-brand-600">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
          <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" />
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="text-sm font-medium text-gray-700 transition group-hover:text-brand-600">
          {t('errors:dashboard.chooseTemplate')}
        </span>
      </button>

      <div className="mx-4 border-t border-dashed border-gray-200" />

      <button
        type="button"
        onClick={onCreateBlank}
        className="flex flex-1 flex-col items-center justify-center gap-2 p-4 transition hover:bg-gray-50"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gray-700 transition group-hover:text-brand-600">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium text-gray-700 transition group-hover:text-brand-600">
          {t('errors:dashboard.blankTemplate')}
        </span>
      </button>
    </div>
  );
}

/** 数据看板指标卡片 */
function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 shadow-sm">
      <div className="text-2xl font-bold tabular-nums text-gray-900">{value}</div>
      <div className={`mt-1 text-xs ${accent ?? 'text-gray-500'}`}>{label}</div>
    </div>
  );
}
