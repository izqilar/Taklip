# 模板库分类规范 v2（15 类 + 标签池）与落地计划

> 目标：将现有"7 类场景"扩展为 15 个一级分类；原"二级子项"作为模板的 `tags`（受控标签池）承载。
> 本文同时是**分类规范**与**开发落地计划**，供后续开发直接使用。
> 决策（已与用户确认）：① 顶部导航采用 **15 个一级分类平铺 tab**（不再做场景分组聚合）；② 文档范围 = 规范 + 完整落地计划。

---

## 0. 实施状态（截至本轮）

- **P1 已落地（代码已改）**：`categories.ts` 单一数据源、6 语言 `category.*`、ProviderStudio 分类+标签多选、TemplateList/Home 平铺 15 tab、AdminReview/orders 翻译、seed 补 8 新类、web `typecheck` 通过。
- **P2 待排期**：一键制作补 8 新类表单、后端 `tag` 过滤、标签内容安全扫描、卡片标签 chips 点击过滤。

---

## 1. 设计模型（最终）

- **一级分类 = `Template.category`（`String`，已有字段，仅扩值）**：15 个 slug。保留 7 个旧 slug（不重命名，避免已上架模板失效），新增 8 个。
- **二级子项 = `Template.tags`（`String[]`，已有字段）**：每个一级配一份"推荐标签池"（即用户给的二级列表）。设计师提交时从池中选 + 允许少量自由输入；提交时归一化并过内容安全扫描。
- **导航**：模板库 / 首页顶部 tab = `全部` + 15 个一级分类（平铺），tab 文案取自 i18n `category.*`。移除原 `SCENE_TABS`/`SCENE_MAP` 的 4 场景分组逻辑。
- **后端零枚举改动**：`category` 本就是自由字符串，无服务端白名单；`getCategories` 按 DB `distinct` 自动产出，新 slug 一旦有模板即出现。

### 1.1 15 类总表

| # | slug | 中文（tab 文案） | icon | 来自 | 推荐标签池（=原二级，作 tags） | quickMake 表单 |
|---|------|------|------|------|------|------|
| 1 | `wedding` | 婚庆嫁娶 | 💍 | 旧 | 婚礼 / 订婚茶 / 银婚 / 金婚 | 已有 |
| 2 | `birth_celebration` | 诞育庆贺 | 👶 | 新 | 满月 / 百日 / 周岁 / 割礼 / 成人礼 / 抓周 | P2 |
| 3 | `birthday` | 生日寿辰 | 🎂 | 旧 | 儿童生日 / 成人生日 / 老人寿宴 | 已有 |
| 4 | `festival` | 节庆贺卡 | 🏮 | 旧 | 春节 / 元宵 / 端午 / 中秋 / 新年 / 情人节 / 母亲节 / 父亲节 / 国庆 / 五一劳动节 / 儿童节 / 38妇女节 | 已有 |
| 5 | `housewarming` | 乔迁新居 | 🏠 | 新 | 乔迁宴 | P2 |
| 6 | `school_promotion` | 升学庆贺 | 🎓 | 新 | 小学 / 中学 / 大学 / 考研 | P2 |
| 7 | `social_gathering` | 社交聚会 | 🥳 | 新 | 同学聚会 / 同乡会 / 派对 / 个人答谢宴 | P2 |
| 8 | `memorial` | 追思悼念 | 🕯️ | 新 | 追悼会 / 纪念册 / 讣告 | P2 |
| 9 | `brand` | 商务企宣 | 🏢 | 新 | LOGO / 画册 / 折页 / 名片 / VI / CI | P2 |
| 10 | `recruitment` | 招聘招募 | 💼 | 旧 | 校招 / 社招 / 实习生 / 引进人才 | 已有 |
| 11 | `conference` | 会议会展 | 📋 | 旧 | 邀请函 / 议程 / 展板 / 胸牌 | 已有 |
| 12 | `opening` | 开业庆典 | 🎉 | 新 | 开业 / 周年 | P2 |
| 13 | `education` | 教育培训 | 📚 | 旧 | 招生 / 课程 / 讲座 | 已有 |
| 14 | `biz_social` | 商务社交 | 🤝 | 新 | 商务宴请 / 客户答谢 | P2 |
| 15 | `marketing` | 产品营销 | 🚀 | 旧(更名) | 海报 / 传单 / 易拉宝 / 线上推广 | 已有（原标签"企业宣传"→"产品营销"） |

> 旧 7：wedding / birthday / festival / recruitment / conference / education / marketing。
> 新 8：birth_celebration / housewarming / school_promotion / social_gathering / memorial / brand / opening / biz_social。

### 1.2 本轮相对最初草案的优化（已落实）

- "商量茶" → **订婚茶**（澄清用词）。
- 开业庆典去掉"新址开业（商务乔迁）"，消除与乔迁新居的重叠。
- 节庆贺卡**扁平化**，去掉"分组一/分组二"隐式第三层。
- 二级子项改作 `tags`，消解原树状结构下的"轴不统一 / 兜底桶 / 单子节点一级 / 隐式三层"等问题（tag 扁平、可多维、允许重叠）。
- `category` 一律用**英文 slug** 而非中文，配合 P3 的 4 种 RTL 语言 i18n（slug 语言中立）。

### 1.3 标签治理规则（governance）

1. 每类一份推荐标签白名单（即上表"推荐标签池"），提交表单以 chips 形式建议。
2. 设计师可自由加标签，但：trim + 去重 + 小写归一；长度 ≤ 12 字；数量 ≤ 6。
3. 标签提交时经 `ContentSafetyService`（现有敏感词扫描，已扫 name + schema 文本）顺带扫描，命中即拦截/标红。
4. `tags` 不参与"互斥"，同一模板可同时带多个标签（如 诞育庆贺 模板可带 满月 + 抓周）。

### 1.4 边界与产品决策备注

- **银婚/金婚**：属结婚纪念日，作为 婚庆嫁娶 下的 tags 合理（不必单开类）。
- **诞育庆贺 割礼/成人礼/抓周**：作为 tags 即可，不与 周岁 互斥；抓周可视为 周岁 场景的子标签，无需强制层级。
- **商务企宣（LOGO/VI/CI/画册/折页/名片）vs 产品营销（海报/传单/易拉宝/线上推广）**：前者偏品牌识别/印刷交付物，后者偏促销传播。当前编辑器能力偏 H5 事件向——是否做"品牌识别类"专用脚手架属**产品范围决策**，不阻塞分类本身；建议先以普通模板承载，P3 再深化。
- **标签是否可筛选**：当前 `findAll(category, search)` 仅按 `category`+名称搜索，`tags` 只返回不过滤。建议 **P2** 加 `?tag=` 过滤（见 §3）。

---

## 2. 代码改动点（全部文件清单）

| 文件 | 改动 |
|---|------|
| `apps/web/src/categories.ts`（**新建，单一数据源**） | `TEMPLATE_CATEGORIES: {slug, icon}[]`（15 项）、`CATEGORY_TAG_POOLS: Record<slug,string[]>`（15 份标签池）、`ALL_TAB = 'all'`、`CATEGORY_I18N_NS = 'category'`、`getTagPool(slug)`、`categoryI18nKey(slug)`、`isKnownCategory(slug)`。供下方所有 UI 复用，消除硬编码漂移。 |
| `apps/web/src/i18n/locales/zh-CN/common.json` | 新增 `category.*`（15 条 slug→中文）；`scene.*` 中 `marketing` 标签 企业宣传→产品营销；`quickMake.types.*` 同改。 |
| `apps/web/src/i18n/locales/en/common.json` | 同上加 `category.*`（15）；`marketing` 更名。 |
| `apps/web/src/i18n/locales/{ug,kk-CN,ky-CN,uz-CN}/common.json` | 加 `category.*`（15，7 个共享 slug 复用各自 `scene.*` 母语文案，8 个新 slug 用英语兜底）；**补齐整个 `quickMake` 子树**（目前 4 个少数民族语言缺 `quickMake.types/fields`）。 |
| `apps/web/src/i18n/locales/{zh-CN,en}/templates.json` | 新增 `tagLabel`（标签（可多选）/ Tags (multi-select)）。 |
| `apps/web/src/pages/ProviderStudio.tsx` | 提交 `<select>`（原硬编码 7 项）→ 改 map `TEMPLATE_CATEGORIES`（显示 `icon + 标签`）；切换分类时清空已选标签；新增标签多选 chips（来自 `getTagPool(category)`）→ 提交 `tags`（当前恒为 `[]`，已改）。 |
| `apps/web/src/pages/TemplateList.tsx` | `SCENE_TABS`/`SCENE_MAP`（原场景分组）→ 平铺 `全部` + 15 tab（来自 `TEMPLATE_CATEGORIES`）；点击按 `category` 精确过滤；`listTemplates` 传 slug。 |
| `apps/web/src/pages/Home.tsx` | 同样的 `SCENE_TABS`/`SCENE_MAP` 改为平铺 15 tab。 |
| `apps/web/src/pages/AdminReview.tsx` | 原始 slug → `t('common:category.${slug}', slug)`（未知 slug 回退显示原文）。 |
| `apps/admin/src/pages/orders.tsx` | 原始 slug → 本地 `CATEGORY_LABELS` 中文映射（管理后台为独立应用，无 web i18n，故本地维护一份，与 categories.ts 保持一致）。 |
| `apps/web/src/wizard/quickMakeConfig.ts` + `QuickMakeWizard.tsx` | **P2**：为 8 个新类补 `QUICK_MAKE_TYPES` 条目（含 `fields` 与 `bind` 键），确保种子模板含对应 `bind` 元素。P1 暂只展示已有 7 类表单。 |
| `apps/server/src/template/template.service.ts` | **P2（可选）**：`findAll` 增 `tag?` 参数 → `where.tags = { has: tag }`；`createByDesigner` 提交时把 `tags` 接入 `ContentSafetyService` 扫描。 |
| `apps/server/src/template/template.controller.ts` | **P2（可选）**：`findAll` 增加 `@Query('tag')` 并透传。 |
| `apps/server/prisma/seed-templates.ts` | 为新 8 个 slug 各加 ≥1 条演示模板（含 `tags`），使 `getCategories` 与浏览有内容。原 7 类保留。 |
| `apps/web/src/api/client.ts` | `CreateTemplateRequest.tags` 已存在；确认提交时携带 tags（ProviderStudio 改后）。`listTemplates` 可增 `tag?` 参数（P2）。 |

> 注：经探查，**无 TS 分类联合类型**、**后端无 category 枚举白名单**，故扩展不需要改 schema / 类型定义，仅 UI + i18n + seed +（P2）后端 tag 过滤。

---

## 3. 分阶段实施

- **P1（规范落地 + 浏览/提交）— 已实施**
  1. 新建 `apps/web/src/categories.ts`（15 类 + 标签池 + 图标）。
  2. 6 个 locale 加 `category.*`；zh-CN/en 改 `marketing` 标签；4 少数民族语言补齐 `quickMake` 子树。
  3. `ProviderStudio.tsx`：分类下拉改 dataSource；加标签多选并提交 `tags`。
  4. `TemplateList.tsx` / `Home.tsx`：平铺 15 tab（含"全部"），移除场景分组。
  5. `seed-templates.ts`：补 8 新类演示模板（带 tags）。
  6. `AdminReview.tsx` / `orders.tsx`：slug→中文标签。
  7. `pnpm --filter @h5design/web typecheck` 通过。

- **P2（一键制作 + 标签筛选 + 后台标签安全）**
  1. `quickMakeConfig.ts` / `QuickMakeWizard.tsx`：为 8 新类补表单与 `bind` 键种子模板。
  2. 后端 `findAll` + controller 加 `tag` 过滤；`createByDesigner` 用 `ContentSafetyService` 扫 tags。
  3. `TemplateList` 卡片标签 chips 可点击 → 按 `tag` 过滤。

---

## 4. 验收

- 模板库/首页顶部出现 15 个一级分类 tab + 全部；点击即按 `category` 过滤。
- 提交模板时可选 15 类之一，并可勾选该类标签池中的 tags（或自定义），提交后 `tags` 非空且可被 `getCategories`/详情读取。
- 6 语言下 15 类均有正确中文/对应语言标签；管理后台显示中文而非 slug。
- `typecheck` 通过；seed 后 `getCategories` 返回 15 个 slug。

---

## 5. 交付物

本规范即为交付文档：`docs/template-category-v2-spec.md`。P1 已据此实施；P2 按需排期。
