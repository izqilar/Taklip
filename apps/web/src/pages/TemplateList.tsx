/**
 * 模板库页（浅色主题，对标八图 H5）— 分类筛选 + 搜索 + 浅色大网格
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type TemplateListItem } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import TemplateCard from '@/components/TemplateCard';
import { ALL_TAB, TEMPLATE_CATEGORIES, categoryI18nKey, getTagPool } from '@/categories';

export default function TemplateList() {
  const { t } = useTranslation(['common', 'templates', 'errors']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [templateList, setTemplateList] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(searchParams.get('category') ?? ALL_TAB);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  // 切换一级分类时清空二级标签筛选
  const selectCategory = useCallback((slug: string) => {
    setActiveCategory(slug);
    setActiveTag(null);
  }, []);

  const fetchTemplates = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const list = await api.listTemplates(undefined, searchQuery || undefined);
        setTemplateList(list);
      } catch {
        setTemplateList([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchTemplates(search);
  }, [search, fetchTemplates]);

  const handleUseTemplate = useCallback(
    async (templateId: string) => {
      if (!isAuthenticated) {
        // 未登录：跳转到登录页，登录成功后回到模板库继续制作
        navigate('/login', { state: { from: '/templates' } });
        return;
      }
      const tpl = templateList.find((tp) => tp.id === templateId);
      try {
        // 付费模板：先下单购买（幂等，已购直接返回原订单）
        if (tpl && tpl.price > 0) {
          try {
            await api.purchaseTemplate(templateId);
            alert(t('templates:purchaseSuccess'));
          } catch {
            alert(t('errors:error.purchaseFailed'));
            return;
          }
        }
        const project = await api.useTemplate(templateId);
        navigate(`/editor/${project.id}`);
      } catch {
        alert(t('errors:error.useTemplateFailed'));
      }
    },
    [isAuthenticated, navigate, t, templateList],
  );

  const viewList = templateList.filter((tp) => {
    if (activeCategory !== ALL_TAB && tp.category !== activeCategory) return false;
    if (activeTag && !(tp.tags ?? []).includes(activeTag)) return false;
    return true;
  });

  return (
    <div className="min-h-full bg-white text-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* 标题 + 搜索 */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('templates:title')}</h1>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('templates:search')}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-72"
          />
        </div>

        {/* 分类标签（15 个一级分类平铺 + 全部） */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            key={ALL_TAB}
            onClick={() => selectCategory(ALL_TAB)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCategory === ALL_TAB
                ? 'bg-brand-500 text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600'
            }`}
          >
            {t('common:nav.allCategories')}
          </button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => selectCategory(c.slug)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeCategory === c.slug
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              <span className="mr-1">{c.icon}</span>
              {t(categoryI18nKey(c.slug))}
            </button>
          ))}
        </div>

        {/* 二级标签筛选：仅在某一级分类下展示该类标签池 */}
        {activeCategory !== ALL_TAB && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTag(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeTag === null
                  ? 'bg-gray-800 text-white'
                  : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {t('common:nav.allCategories')}
            </button>
            {getTagPool(activeCategory).map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeTag === tag
                    ? 'bg-brand-500 text-white'
                    : 'border border-gray-200 bg-white text-gray-500 hover:border-brand-300 hover:text-brand-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* 模板网格 */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">{t('common:status.loading')}</div>
        ) : templateList.length === 0 ? (
          <div className="py-20 text-center text-gray-400">{t('common:status.noTemplates')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {viewList.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} onUse={handleUseTemplate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
