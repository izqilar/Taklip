/**
 * 首页（对标 PC mockup 布局）— 首屏：全屏宽横幅 + 引导 + 搜索；二屏：场景模板；服务商专区；多列页脚
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type TemplateListItem } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import TemplateCard from '@/components/TemplateCard';
import SiteFooter from '@/components/SiteFooter';
import ProviderSection from '@/components/ProviderSection';
import { ALL_TAB, TEMPLATE_CATEGORIES, categoryI18nKey } from '@/categories';

const HOT_TAGS = ['企业招聘h5', '邀请函', '婚礼邀请函h5', '会议邀请函h5', '生日邀请函h5', '乔迁之喜'];

const SLIDES = [
  {
    eyebrow: '婚礼季',
    title: '精选婚礼邀请函',
    sub: 'YOU MUST MARRY ME TODAY',
    icon: '💒',
  },
  {
    eyebrow: '企业宣传',
    title: '品牌活动轻松发布',
    sub: 'PROFESSIONAL H5 MARKETING',
    icon: '🏢',
  },
  {
    eyebrow: '会议邀请',
    title: '高效会议邀约工具',
    sub: 'SMART EVENT INVITATION',
    icon: '📅',
  },
];

const GUIDE_CARDS = [
  { key: 'guide1', icon: '🎯' },
  { key: 'guide2', icon: '📱' },
  { key: 'guide3', icon: '⚡' },
  { key: 'guide4', icon: '🎁' },
];

export default function Home() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_TAB);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.listTemplates().then((list) => {
      setTemplates(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 自动轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleUseTemplate = useCallback(
    async (templateId: string) => {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      try {
        const project = await api.useTemplate(templateId);
        navigate(`/editor/${project.id}`);
      } catch {
        alert(t('errors:error.useTemplateFailed'));
      }
    },
    [isAuthenticated, navigate, t],
  );

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (activeCategory !== ALL_TAB) {
      list = list.filter((tp) => tp.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((tp) => tp.name.toLowerCase().includes(q) || tp.category.toLowerCase().includes(q));
    }
    return list;
  }, [templates, activeCategory, search]);

  return (
    <div className="min-h-full bg-white text-gray-900">
      {/* 首屏：红色背景包裹导航 + 全屏宽横幅 + 引导 + 搜索 */}
      <div className="relative bg-gradient-to-b from-[#c81e42] via-[#d32f4f] to-[#e75d6f]">
        {/* 装饰背景 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-yellow-300 blur-3xl" />
          <div className="absolute right-10 top-20 h-48 w-48 rounded-full bg-orange-300 blur-3xl" />
          <div className="absolute bottom-40 left-1/3 h-56 w-56 rounded-full bg-red-300 blur-3xl" />
        </div>

        {/* 全屏宽横幅（Banner）：突破 max-w 容器，铺满视口宽度；高度压缩以完整展示首屏 */}
        <section className="relative w-full">
          <div className="relative overflow-hidden bg-black/10 shadow-2xl">
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {SLIDES.map((slide) => (
                <div
                  key={slide.eyebrow}
                  className="relative flex w-full flex-shrink-0 flex-col items-center justify-center bg-gradient-to-r from-[#b91c3c] to-[#e11d48] px-6 py-32 text-center text-white md:py-34"
                >
                  <div className="mb-4 text-4xl md:text-5xl">{slide.icon}</div>
                  <div className="mb-4 rounded-full border border-white/30 bg-white/10 px-3 py-0.5 text-xs font-medium backdrop-blur">
                    {slide.eyebrow}
                  </div>
                  <h1 className="mb-1 text-3xl font-extrabold tracking-wide md:text-4xl">{slide.title}</h1>
                  <p className="text-sm tracking-wider text-white/80">{slide.sub}</p>
                  {/* CTA（参照 PC mockup 双按钮） */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/templates"
                      className="rounded-full bg-white px-6 py-2 text-sm font-bold text-[#c81e42] shadow-lg transition hover:bg-gray-100"
                    >
                      {t('common:button.browseTemplates')}
                    </Link>
                    <Link
                      to="/find-services"
                      className="rounded-full border border-white/50 bg-white/10 px-6 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      {t('common:nav.findServices')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* 左右切换箭头 */}
            <button
              type="button"
              onClick={() => setCurrentSlide((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label={t('common:button.back')}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCurrentSlide((i) => (i + 1) % SLIDES.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label={t('common:button.close')}
            >
              ›
            </button>

            {/* 指示器 */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/40'
                  }`}
                  aria-label={`slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 核心引导区 */}
        <section className="relative mx-auto max-w-7xl px-4 pb-4">
          <div className="grid gap-3 rounded-xl bg-white p-3 shadow-lg sm:grid-cols-2 lg:grid-cols-4">
            {GUIDE_CARDS.map((card) => (
              <div key={card.key} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-50">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">
                  {card.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{t(`common:home.${card.key}Title`)}</h3>
                  <p className="text-[11px] text-gray-500">{t(`common:home.${card.key}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 内容搜索区 */}
        <section className="relative mx-auto max-w-3xl px-4 pb-6">
          <div className="flex overflow-hidden rounded-full bg-white shadow-lg">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/templates?search=${encodeURIComponent(search)}`)}
              placeholder={t('common:home.searchPlaceholder')}
              className="flex-1 px-5 py-3 text-sm text-gray-700 outline-none"
            />
            <button
              type="button"
              onClick={() => navigate(`/templates?search=${encodeURIComponent(search)}`)}
              className="bg-emerald-500 px-7 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              {t('common:home.searchButton')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span>{t('common:home.hotSearch')}：</span>
            {HOT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => navigate(`/templates?search=${encodeURIComponent(tag)}`)}
                className="rounded-full border border-white/30 px-2 py-0.5 transition hover:bg-white/10"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 第二屏：模板展示内容（场景标签 + 模板网格） */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {/* 分类标签（15 个一级分类平铺 + 全部） */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-gray-100 pb-4">
          <button
            key={ALL_TAB}
            onClick={() => setActiveCategory(ALL_TAB)}
            className={`rounded-sm px-5 py-2 text-sm font-medium transition ${
              activeCategory === ALL_TAB
                ? 'bg-emerald-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t('common:nav.allCategories')}
          </button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setActiveCategory(c.slug)}
              className={`rounded-sm px-5 py-2 text-sm font-medium transition ${
                activeCategory === c.slug
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-1">{c.icon}</span>
              {t(categoryI18nKey(c.slug))}
            </button>
          ))}
        </div>

        {/* 模板网格 */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">{t('common:status.loading')}</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-20 text-center text-gray-400">{t('common:status.noTemplates')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredTemplates.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} onUse={handleUseTemplate} />
            ))}
          </div>
        )}
      </section>

      {/* 服务商专区（复用组件） */}
      <ProviderSection />

      {/* 页脚（多列结构，参照 PC mockup，沿用红色主题） */}
      <SiteFooter />
    </div>
  );
}
