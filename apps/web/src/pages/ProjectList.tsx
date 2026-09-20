/**
 * 作品列表页（用户中心）— 展示用户的所有 H5 作品与请柬模板
 *
 * 与运营端「模板管理」保持一致：把「我的作品」(Project) 与「我的模板」(Template，仅服务商)
 * 合并进同一网格，用「来源」标签区分。
 * - 作品(Project)：保留原有的 发布 / 下架 / 二维码 / 删除 等操作。
 * - 模板(Template)：提供「使用模板」操作（克隆为新作品并进入编辑器）。
 */
import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, buildAdminUrl, type ProjectListItem, type TemplateDetail } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
// 只取 store（轻量），避免把整个编辑器内核（Konva/GSAP）拖进作品列表首屏
import {useEditorStore} from '@h5design/editor/store';
import { SchemaThumbnail } from '@/components/SchemaThumbnail';
import { WorkDetailModal, type WorkDetailItem } from '@/components/WorkDetailModal';
import { WorkPreviewModal } from '@/components/WorkPreviewModal';
import { DesignGalleryCard, type DesignActionCaps } from '@h5design/ui';
import { buildShareUrl, generateQrDataUrl, downloadDataUrl } from '@/utils/share';
import { KpiCard } from '@/user/shared';
// 导出对话框：与编辑器顶栏「导出」共用同一个内核弹窗（内含 Konva/GSAP，必须懒加载，
// 不能静态 import 进作品列表首屏 chunk）
const ExportWorkDialog = lazy(() => import('@/components/ExportWorkDialog'));

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

  // 作品只读详情弹窗（web 端 hover「详情」打开，完全只读；编辑需前往运营端）
  const [detailFor, setDetailFor] = useState<WorkDetailItem | null>(null);
  // 多页渲染 + 动画重播预览弹窗（web 端 hover「预览」打开）
  const [previewFor, setPreviewFor] = useState<{ id: string; title: string; schema: unknown } | null>(
    null,
  );
  // 角色分流：普通用户(USER)在 web 端编辑器内编辑；服务商/代理商/管理员跳运营端编辑器
  const role = useAuthStore((s) => s.user?.role);
  const editInAdmin =
    role === 'SERVICE_PROVIDER' || role === 'AGENT' || role === 'ADMIN';

  const handleEdit = useCallback(
    async (item: { id: string; schema?: unknown }) => {
      if (editInAdmin) {
        // 跨端打开运营端编辑器，携带一次性票据免二次登录（不再明文传 JWT）
        const url = await buildAdminUrl(`/sp/works/${item.id}/editor`);
        window.open(url, '_blank', 'noopener');
      } else {
        // 普通用户在 web 端编辑器内直接编辑（与「详情」打开后的编辑一致）
        loadProject(item.schema as never, item.id);
        navigate(`/editor/${item.id}`);
      }
    },
    [editInAdmin, loadProject, navigate],
  );

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 关键网格数据：作品 + （服务商）模板。先到先渲染，不让非关键的看板统计阻塞首屏。
      const [list, tpls] = await Promise.all([
        api.listProjects(),
        // 仅服务商才有「我的模板」；普通用户调用会 403，这里静默兜底为空数组
        isProvider
          ? api.listMyTemplates().catch(() => [] as TemplateDetail[])
          : Promise.resolve([] as TemplateDetail[]),
      ]);
      setProjects(list);
      setTemplates(tpls ?? []);
    } catch {
      setError(t('errors:dashboard.fetchFailed'));
      setLoading(false);
      return;
    }
    // 关键数据已就绪，先让「我的作品 / 模板」网格首屏渲染（这是用户最关心的部分）
    setLoading(false);

    // 非关键看板数据（总览指标 + 每个作品访问量）延迟加载：
    // 它们只填充顶部 4 张指标卡，若后端聚合较慢不应拖慢网格首屏。
    api.getStatsOverview().then(setStats).catch(() => {});
    api
      .getStatsProjects()
      .then((projStats) =>
        setViewsById(Object.fromEntries((projStats ?? []).map((p) => [p.id, p.viewCount]))),
      )
      .catch(() => {});
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

  // 导出：终端用户没有发布权限，卡片 hover 的主操作改为「导出」，
  // 打开与编辑器顶栏「导出」完全相同的对话框（图片 / 视频 / GIF 动图）。
  const [exportFor, setExportFor] = useState<{ id: string; title: string; schema: unknown } | null>(
    null,
  );
  const handleExport = useCallback(
    (item: { id: string; title: string; schema: unknown }) => {
      setExportFor(item);
    },
    [],
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

  // 删除模板（仅服务商本人可删自己的模板）
  const handleDeleteTemplate = useCallback(
    async (id: string) => {
      if (!confirm(t('errors:dashboard.deleteTemplateConfirm'))) return;
      try {
        await api.deleteTemplate(id);
        setTemplates((prev) => prev.filter((tp) => tp.id !== id));
      } catch {
        alert(t('errors:dashboard.deleteFailed'));
      }
    },
    [t],
  );

  // 阶段 D：把「个人作品」提交为「服务商模板」（进入运营端审核队列），仅服务商可见
  const [submitFor, setSubmitFor] = useState<{ id: string; title: string } | null>(null);
  const [submitName, setSubmitName] = useState('');
  const [submitCategory, setSubmitCategory] = useState('');
  const [submitTags, setSubmitTags] = useState('');
  const [submitPrice, setSubmitPrice] = useState('');
  const [submitIntro, setSubmitIntro] = useState('');

  const handleOpenSubmit = useCallback(
    (id: string, title: string) => {
      setSubmitFor({ id, title });
      setSubmitName(title || t('common:status.untitled'));
      setSubmitCategory('');
      setSubmitTags('');
      setSubmitPrice('');
      setSubmitIntro('');
    },
    [t],
  );

  const handleSubmitTemplate = useCallback(async () => {
    if (!submitFor) return;
    try {
      const tags = submitTags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const price = submitPrice ? Number(submitPrice) : 0;
      await api.submitAsTemplate(submitFor.id, {
        name: submitName.trim() || submitFor.title,
        category: submitCategory.trim() || '其他',
        tags,
        price,
        intro: submitIntro.trim(),
      });
      setSubmitFor(null);
      setSubmitTags('');
      setSubmitPrice('');
      setSubmitIntro('');
      alert(t('errors:dashboard.submitTplSuccess'));
      fetchProjects();
    } catch {
      alert(t('errors:dashboard.submitTplFailed'));
    }
  }, [submitFor, submitName, submitCategory, submitTags, submitPrice, submitIntro, t, fetchProjects]);

  return (
    <div className="pb-10">
      {/* 内容区：与个人中心其他菜单项一致（PageHead 风格 + 胶囊筛选 + 朱砂新建） */}
      <div className="space-y-5">
        {/* 页面头 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-[#2a2118]">{t('common:userCenter.menu.works')}</h2>
            <p className="mt-0.5 text-[13px] text-[#6e5f4a]">{t('common:userCenter.menu.worksSubtitle')}</p>
          </div>
        </div>

        {/* 操作栏：来源筛选（胶囊）+ 新建（朱砂） */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 来源过滤：全部 / 作品 / 模板（与运营端「模板管理」一致） */}
          <div className="flex items-center gap-1">
            {(['all', 'work', 'template'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-[13.5px] transition ${
                  filter === f
                    ? 'bg-[rgba(194,75,46,0.10)] font-semibold text-[#c24b2e]'
                    : 'bg-[#f5f2ec] text-[#4c4236] hover:bg-[#ece5d8]'
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
            className="rounded-[8px] bg-[#c24b2e] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#a93a20]"
          >
            + {t('errors:dashboard.createNew')}
          </button>
        </div>

        {/* 数据看板：核心指标卡片（镜像运营端 KpiCard 四联，间距 14px） */}
        <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
          <KpiCard label={t('errors:dashboard.stats.views')} value={stats?.totalViews ?? 0} />
          <KpiCard label={t('errors:dashboard.stats.projects')} value={stats?.totalProjects ?? 0} />
          <KpiCard label={t('errors:dashboard.stats.published')} value={stats?.publishedProjects ?? 0} />
          <KpiCard label={t('errors:dashboard.stats.templates')} value={stats?.totalTemplates ?? 0} />
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
                onUse={handleUseTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onExport={handleExport}
                onDelete={handleDelete}
                onSubmitTemplate={handleOpenSubmit}
                onDetail={() => setDetailFor(item as WorkDetailItem)}
                onEdit={handleEdit}
                onPreview={(it) => setPreviewFor({ id: it.id, title: it.title, schema: it.schema })}
                canSubmit={isProvider}
              />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-20 text-center text-gray-500">{t('errors:dashboard.empty')}</div>
        )}
      </div>

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
            <div className="mb-3 text-[14.5px] font-bold text-gray-800">
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

      {/* 阶段 D：提交为模板弹窗（作品 → Template(PENDING)，进入运营端审核队列） */}
      {submitFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setSubmitFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-[14.5px] font-bold text-gray-800">
              {t('errors:dashboard.submitTplTitle')}
            </div>
            <label className="mb-1 block text-xs text-gray-600">{t('errors:dashboard.submitTplName')}</label>
            <input
              value={submitName}
              onChange={(e) => setSubmitName(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <label className="mb-1 block text-xs text-gray-600">{t('errors:dashboard.submitTplCategory')}</label>
            <input
              value={submitCategory}
              onChange={(e) => setSubmitCategory(e.target.value)}
              placeholder={t('errors:dashboard.submitTplCategoryPh')}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <label className="mb-1 block text-xs text-gray-600">标签（逗号分隔，如：中式,喜庆）</label>
            <input
              value={submitTags}
              onChange={(e) => setSubmitTags(e.target.value)}
              placeholder="可选"
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <label className="mb-1 block text-xs text-gray-600">价格（元，0 = 免费）</label>
            <input
              value={submitPrice}
              onChange={(e) => setSubmitPrice(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <label className="mb-1 block text-xs text-gray-600">简介</label>
            <textarea
              value={submitIntro}
              onChange={(e) => setSubmitIntro(e.target.value)}
              placeholder="一句话介绍模板亮点（可选）"
              rows={2}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitTemplate}
                className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
              >
                {t('errors:dashboard.submitTplConfirm')}
              </button>
              <button
                onClick={() => setSubmitFor(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {t('common:button.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 作品只读详情弹窗（web 端 hover「详情」打开，完全只读；编辑需前往运营端） */}
      {detailFor && (
        <WorkDetailModal
          item={detailFor}
          onClose={() => setDetailFor(null)}
          onEdit={handleEdit}
          editIsExternal={editInAdmin}
        />
      )}

      {/* 导出对话框：与编辑器顶栏「导出」同一个内核弹窗（图片 / 视频 / GIF 动图） */}
      {exportFor && (
        <Suspense fallback={null}>
          <ExportWorkDialog target={exportFor} onClose={() => setExportFor(null)} />
        </Suspense>
      )}

      {/* 多页渲染 + 动画重播预览弹窗（web 端 hover「预览」打开） */}
      {previewFor && (
        <WorkPreviewModal
          work={previewFor}
          onClose={() => setPreviewFor(null)}
        />
      )}
    </div>
  );
}

/** 网格卡片：作品 / 模板 共用，统一 hover 外壳（@h5design/ui 的 DesignGalleryCard）。
 * 顶栏（详情 / 导出 / 删除）· 中心（预览 / 编辑）· 底部（作品→提交为模板 / 模板→使用模板），
 * 权限门控外置（capabilities），触屏 tap 兜底由外壳处理。 */
function WorkCard({
  item,
  onUse,
  onDeleteTemplate,
  onExport,
  onDelete,
  onSubmitTemplate,
  onDetail,
  onEdit,
  onPreview,
  canSubmit,
}: {
  item: GridItem;
  onUse: (id: string, title: string) => void;
  onDeleteTemplate?: (id: string) => void;
  onExport: (item: { id: string; title: string; schema: unknown }) => void;
  onDelete: (id: string) => void;
  onSubmitTemplate: (id: string, title: string) => void;
  onDetail: () => void;
  onEdit: (item: GridItem) => void;
  onPreview: (item: GridItem) => void;
  canSubmit?: boolean;
}) {
  const { t } = useTranslation(['common', 'errors']);
  const isTemplate = item.kind === 'template';

  const TPL_STATUS: Record<string, { label: string }> = {
    DRAFT: { label: t('errors:dashboard.tplDraft', { defaultValue: '草稿' }) },
    PENDING: { label: t('errors:dashboard.tplPending') },
    APPROVED: { label: t('errors:dashboard.tplApproved') },
    REJECTED: { label: t('errors:dashboard.tplRejected') },
    TAKEN_DOWN: { label: t('errors:dashboard.tplTakenDown') },
  };

  const statusLabel = isTemplate
    ? TPL_STATUS[item.status]?.label ?? item.status ?? '—'
    : item.status === 'published'
      ? t('common:status.publishedBadge')
      : t('common:status.draft');

  const coverNode = item.cover ? (
    <img src={item.cover} alt={item.title} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
  ) : (
    <SchemaThumbnail schema={item.schema} />
  );

  const capabilities: DesignActionCaps = isTemplate
    ? { preview: true, use: true, delete: !!onDeleteTemplate }
    : { detail: true, preview: true, edit: true, export: true, delete: true, submitAsTemplate: canSubmit };

  const labels: Record<string, string> = {
    detail: t('common:button.detail'),
    preview: t('common:button.preview'),
    edit: t('common:button.edit'),
    export: t('common:button.export'),
    delete: t('common:button.delete'),
    submitAsTemplate: t('errors:dashboard.submitAsTemplate'),
    use: t('common:button.useTemplate'),
  };

  const on: Partial<Record<keyof DesignActionCaps, (it: GridItem) => void>> = isTemplate
    ? {
        preview: (it) => onPreview(it),
        use: (it) => onUse(it.id, it.title),
        delete: (it) => onDeleteTemplate?.(it.id),
      }
    : {
        detail: () => onDetail(),
        preview: (it) => onPreview(it),
        edit: (it) => onEdit(it),
        export: (it) => onExport({ id: it.id, title: it.title, schema: it.schema }),
        delete: (it) => onDelete(it.id),
        submitAsTemplate: (it) => onSubmitTemplate(it.id, it.title),
      };

  return (
    <div className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <DesignGalleryCard
        kind={isTemplate ? 'template' : 'work'}
        badgeLabel={statusLabel}
        capabilities={capabilities}
        labels={labels}
        item={item}
        coverNode={coverNode}
        on={on}
        aspectRatio="375 / 667"
      />

      {/* 信息区 */}
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-gray-800">
          {item.title || t('common:status.untitled')}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
          <span className={`rounded px-1.5 py-0.5 ${isTemplate ? SOURCE_CLS.template : SOURCE_CLS.work}`}>
            {isTemplate ? t('errors:dashboard.kindTemplate') : t('errors:dashboard.kindWork')}
          </span>
          {!isTemplate && <span title={t('errors:dashboard.stats.views')}>👁 {item.viewCount}</span>}
          {item.kind === 'template' && item.isOfficial && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              {t('common:badge.official')}
            </span>
          )}
        </div>
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

/** 数据看板指标卡片已统一复用共享 KpiCard（见上方渲染处），此处不再单独定义。 */
