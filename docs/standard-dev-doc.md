# H5 在线设计平台 — 标准化开发文档

> **文档版本**：v1.0.0  
> **最后更新**：2026-08-10  
> **状态**：已评审  
> **参考产品**：zhizuoh5.com

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术方案](#2-技术方案)
- [3. 页面设计说明](#3-页面设计说明)
- [4. 组件规范](#4-组件规范)
- [5. 数据接口定义](#5-数据接口定义)
- [6. 开发流程及里程碑](#6-开发流程及里程碑)
- [7. 多语种国际化方案](#7-多语种国际化方案)
- [8. 附录](#8-附录)

---

## 1. 项目概述

### 1.1 项目背景

H5 页面在邀请函、企业宣传、招聘、活动营销等场景中需求旺盛。传统制作方式依赖专业设计与开发团队，周期长、成本高。本项目旨在构建一个**零代码、可视化、模板驱动的 H5 在线设计平台**，让非技术用户也能在浏览器中完成 H5 页面的设计、预览与发布。

### 1.2 产品定位

| 维度 | 说明 |
|------|------|
| 产品类型 | SaaS 在线设计工具 |
| 核心用户 | 中小企业运营/HR、活动策划、个人用户 |
| 核心价值 | 选模板 → 拖拽编辑 → 一键发布，全流程 10 分钟内完成 |
| 商业模式 | 免费模板 + 付费高级模板 + 会员订阅 |

### 1.3 目标用户画像

- **企业用户**：HR 招聘海报、企业宣传、会议邀请函、产品发布
- **活动策划**：婚礼/生日/聚会邀请函、活动报名页
- **教育机构**：招生宣传、家长会通知、校园活动
- **个人用户**：电子请柬、节日贺卡、早安问候、个人作品展示

### 1.4 核心功能总览

| 编号 | 功能模块 | 功能描述 | 优先级 |
|------|---------|---------|--------|
| F-01 | 可视化拖拽编辑器 | 文本、图片、形状、动画等元素的自由排版 | P0 |
| F-02 | 模板库 | 分类浏览、关键词搜索、预览、一键使用 | P0 |
| F-03 | 实时预览 | 编辑态实时预览 + 多端尺寸切换 | P1 |
| F-04 | H5 发布 | 静态化打包、CDN 分发、生成访问链接与二维码 | P1 |
| F-05 | 用户系统 | 注册、登录（手机号/微信）、个人中心 | P0 |
| F-06 | 作品管理 | 保存、编辑、复制、删除、版本历史 | P1 |
| F-07 | 素材管理 | 图片上传、裁剪、压缩、素材库 | P2 |
| F-08 | 多语种支持 | 中文、英文、维吾尔文、哈萨克文、柯尔克孜文、乌兹别克文 | P1 |
| F-09 | 多端适配预览 | 手机 / 平板 / PC 预览 | P1 |
| F-10 | 动画系统 | 入场动画、循环动画、翻页过渡 | P2 |

---

## 2. 技术方案

### 2.1 技术栈选型总览

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| 前端框架 | React | 18.x | 生态成熟，Hooks 模型适合复杂交互 |
| 开发语言 | TypeScript | 5.x | 全栈类型安全 |
| 构建工具 | Vite | 5.x | HMR 快，ESM 原生支持 |
| 画布渲染 | Konva.js + react-konva | 9.x | 图层管理、变换控制、命中检测完善 |
| 拖拽交互 | dnd-kit | 6.x | 轻量、可定制、无障碍支持好 |
| 状态管理 | Zustand + immer | 4.x / 10.x | 轻量无样板代码，immer 支持不可变更新 |
| 样式方案 | Tailwind CSS | 3.x | 原子化，开发效率高 |
| 动画引擎 | GSAP + Animate.css | 3.x / 4.x | GSAP 时间轴动画 + Animate.css 预设效果 |
| 国际化 | react-i18next + i18next | 23.x / 23.x | React 生态标准方案，命名空间支持 |
| 后端框架 | NestJS | 10.x | 模块化、装饰器 + DI，前后端同构 TS |
| ORM | Prisma | 5.x | 类型安全，迁移管理规范 |
| 数据库 | PostgreSQL | 15.x | JSONB 存作品 Schema，GIN 索引支持检索 |
| 缓存 | Redis | 7.x | 会话、限流、模板缓存 |
| 对象存储 | 腾讯云 COS | — | 图片素材、H5 静态包存储 |
| CDN | COS 内置 CDN | — | H5 发布页加速 |
| 认证 | JWT + 刷新令牌 | — | 无状态认证 |
| 部署 | Docker + Nginx | — | 前端静态化 + 后端容器化 |

### 2.2 系统架构设计

系统采用三层架构：

```
┌─────────────────────────────────────────────────────────┐
│                    客户端 / Browser                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ 可视化   │  │ 模板商城 │  │ 用户中心 │               │
│  │ 编辑器   │  │          │  │          │               │
│  │ React +  │  │ 分类浏览 │  │ 作品管理 │               │
│  │ Konva    │  │ 预览     │  │ 账户设置 │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / WebSocket
┌───────────────────────▼─────────────────────────────────┐
│              后端服务 / NestJS + TypeScript               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ API    │ │ 认证   │ │ 作品   │ │ 模板   │ │ 素材   │ │
│  │ 网关   │ │ 服务   │ │ 服务   │ │ 服务   │ │ 服务   │ │
│  │路由鉴权│ │JWT/微信│ │CRUD/   │ │分类/   │ │上传/   │ │
│  │限流    │ │手机号  │ │版本    │ │检索    │ │压缩    │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │              渲染发布服务                           │ │
│  │  SSR 静态化 · html-to-image 截图 · COS 上传 · CDN  │ │
│  └────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   数据与存储层                            │
│  ┌────────────┐  ┌────────┐  ┌──────────────┐           │
│  │ PostgreSQL │  │ Redis  │  │ 对象存储 COS │           │
│  │ 用户/作品/ │  │ 缓存/  │  │ 图片/H5包    │           │
│  │ 模板       │  │ 会话   │  │              │           │
│  └────────────┘  └────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 2.3 画布渲染双引擎方案

这是整个平台的技术核心，采用**编辑态与发布态分离的双渲染器**策略：

#### 2.3.1 编辑态 — Konva Canvas

- 画布舞台固定尺寸（默认 375×667，模拟手机屏幕），通过 `Stage + Layer` 渲染
- 每个元素映射为 Konva 节点：`Konva.Text` / `Konva.Image` / `Konva.Rect` / `Konva.Shape` / `Konva.Group`
- 选中、缩放、旋转通过 `Konva.Transformer` 实现
- 优势：变换流畅、命中检测精确、天然支持图层 z-index 管理

#### 2.3.2 发布态 — DOM + CSS

- 发布时将 JSON Schema 转译为绝对定位的 DOM 结构 + 内联 CSS
- 每个 Element 渲染为一个 `<div>`，使用 `transform: translate() rotate() scale()` 定位
- 动画通过 CSS `@keyframes` 或 GSAP 实现
- 优势：移动端性能优、微信预览图可正常抓取、SEO 友好

#### 2.3.3 数据桥梁 — 统一 JSON Schema

编辑器只操作一份 JSON 数据，两个渲染器共同消费它，保证**编辑所见即发布所得**：

```
Project (作品)
  └── Page[] (页面)
        └── Element[] (元素)
              ├── 基础属性: id, type, x, y, width, height, rotation, opacity, zIndex
              ├── 通用扩展: visible, locked, name
              ├── 动画属性: enterAnim, exitAnim, loopAnim
              └── 类型扩展: text{...} / image{...} / shape{...}
```

### 2.4 编辑器数据模型

#### 2.4.1 Project 结构

```typescript
interface Project {
  id: string;
  title: string;
  width: number;          // 画布宽度，默认 375
  height: number;         // 画布高度，默认 667
  pages: Page[];
  cover: string;          // 封面图 URL
  status: 'draft' | 'published';
  userId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

#### 2.4.2 Page 结构

```typescript
interface Page {
  id: string;
  name: string;
  background: {
    type: 'color' | 'image' | 'gradient';
    value: string;         // 颜色值 / 图片URL / 渐变CSS
  };
  elements: Element[];
  transition: 'slide' | 'fade' | 'flip' | 'none';  // 翻页动画
  order: number;
  locked: boolean;
}
```

#### 2.4.3 Element 结构（统一基类 + 类型扩展）

```typescript
interface ElementBase {
  id: string;
  type: 'text' | 'image' | 'shape' | 'video' | 'button' | 'group';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;        // 角度，0-360
  opacity: number;         // 0-1
  zIndex: number;
  visible: boolean;
  locked: boolean;
  animations: {
    enter?: AnimationConfig;
    exit?: AnimationConfig;
    loop?: AnimationConfig;
  };
}

interface TextElement extends ElementBase {
  type: 'text';
  props: {
    content: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
    fontWeight: number;
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline' | 'line-through';
    letterSpacing: number;
  };
}

interface ImageElement extends ElementBase {
  type: 'image';
  props: {
    src: string;
    fit: 'cover' | 'contain' | 'fill' | 'none';
    borderRadius: number;
    filter: 'none' | 'grayscale' | 'sepia' | 'brightness';
  };
}

interface ShapeElement extends ElementBase {
  type: 'shape';
  props: {
    shape: 'rect' | 'circle' | 'triangle' | 'line' | 'star' | 'polygon';
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius: number;    // rect 专用
    points: number[];        // polygon/line 专用
  };
}

interface AnimationConfig {
  type: 'fadeIn' | 'slideIn' | 'zoomIn' | 'bounceIn' | 'rotateIn' | 'flipIn';
  duration: number;          // 毫秒
  delay: number;             // 毫秒
  easing: 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';
}
```

### 2.5 多语种国际化方案

详见 [第 7 章 — 多语种国际化方案](#7-多语种国际化方案)。

### 2.6 部署架构

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  反向代理    │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
     │  前端静态   │ │  后端 API │ │  预览/发布  │
     │  (COS+CDN)  │ │ (Docker)  │ │  (COS+CDN)  │
     └─────────────┘ └─────┬─────┘ └─────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼────┐ ┌─────▼──────┐
       │ PostgreSQL │ │ Redis  │ │  COS 对象  │
       │   (主从)   │ │ (哨兵) │ │    存储    │
       └────────────┘ └────────┘ └────────────┘
```

---

## 3. 页面设计说明

### 3.1 页面清单与路由

| 路由路径 | 页面名称 | 功能描述 | 访问权限 |
|---------|---------|---------|---------|
| `/` | 首页 | 产品介绍、模板推荐、场景入口 | 公开 |
| `/templates` | 模板商城 | 模板分类浏览、搜索、预览 | 公开 |
| `/templates/:id` | 模板详情 | 模板预览、立即使用 | 公开 |
| `/editor/:projectId` | 编辑器 | 可视化拖拽编辑 | 需登录 |
| `/dashboard` | 用户中心 | 作品列表、账户设置 | 需登录 |
| `/preview/:projectId` | 预览页 | 多端预览 | 需登录 |
| `/p/:publishCode` | H5 发布页 | 已发布 H5 的访问页 | 公开 |
| `/login` | 登录页 | 手机号/微信登录 | 公开 |
| `/register` | 注册页 | 手机号注册 | 公开 |

### 3.2 首页设计

#### 3.2.1 页面结构

```
┌─────────────────────────────────────────────┐
│  Logo  |  模板  作品  定价   [登录] [注册]  │  顶部导航
├─────────────────────────────────────────────┤
│                                             │
│          做H5，就这么简单                    │  Hero 区域
│      零代码 · 模板化 · 一键发布              │
│          [立即制作]  [浏览模板]              │
│                                             │
├─────────────────────────────────────────────┤
│  场景分类                                    │  场景入口
│  [婚礼] [招聘] [会议] [营销] [生日] [更多]   │
├─────────────────────────────────────────────┤
│  热门模板推荐                    [查看更多]  │  模板推荐
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │ T1 │ │ T2 │ │ T3 │ │ T4 │               │
│  └────┘ └────┘ └────┘ └────┘               │
├─────────────────────────────────────────────┤
│  产品优势                                    │  功能亮点
│  · 1000+ 精选模板  · 拖拽编辑  · 多端适配    │
├─────────────────────────────────────────────┤
│  Copyright © 2026  |  关于我们  帮助中心     │  页脚
└─────────────────────────────────────────────┘
```

#### 3.2.2 交互说明

- 顶部导航固定，滚动时添加背景模糊效果
- 语言切换器位于导航栏右侧，下拉选择语言
- 场景分类点击跳转至模板商城并自动筛选对应分类
- 模板卡片 hover 时显示「预览」与「立即制作」按钮

### 3.3 编辑器页面

#### 3.3.1 页面布局

```
┌──────┬───────────────────────┬──────────────┐
│ 顶部工具栏 (保存/预览/发布/撤销/重做)         │
├──────┼───────────────────────┼──────────────┤
│      │                       │              │
│ 左侧 │                       │   右侧       │
│ 面板 │      画布区域         │   属性       │
│      │   (Konva Stage)       │   面板       │
│ 元素 │   ┌─────────────┐     │              │
│ 库   │   │             │     │  · 位置 X/Y  │
│      │   │   375×667   │     │  · 尺寸 W/H  │
│ 模板 │   │   手机画布   │     │  · 旋转角度  │
│      │   │             │     │  · 透明度    │
│ 图层 │   │             │     │  · 字体/颜色 │
│ 管理 │   └─────────────┘     │  · 动画设置  │
│      │                       │              │
│      │  [手机] [平板] [PC]   │              │
├──────┴───────────────────────┴──────────────┤
│ 底部页面管理栏 (页面缩略图/添加页/排序)       │
└─────────────────────────────────────────────┘
```

#### 3.3.2 左侧面板

| 面板标签 | 功能 |
|---------|------|
| 元素 | 文本、图片、形状、按钮等元素拖入画布 |
| 模板 | 内嵌模板快速插入（单页模板/组件模板） |
| 图层 | 当前页面所有元素的层级列表，支持拖拽排序、显隐切换、锁定 |
| 背景 | 设置当前页面背景（纯色/图片/渐变） |

#### 3.3.3 右侧属性面板

属性面板根据选中元素类型动态渲染：

| 元素类型 | 可配置属性 |
|---------|-----------|
| 通用 | 位置 X/Y、尺寸 W/H、旋转、透明度、显隐、锁定、层级 |
| 文本 | 内容、字体、字号、颜色、对齐、行高、字重、斜体、下划线、字间距 |
| 图片 | 来源、裁剪方式、圆角、滤镜 |
| 形状 | 形状类型、填充色、描边色、描边宽度、圆角 |
| 动画 | 入场动画、循环动画、退场动画、时长、延迟、缓动 |

#### 3.3.4 编辑器交互流程

```
用户操作                    系统响应
────────                    ────────
从元素库拖入文本  ──────→  dnd-kit 监听 drop 事件
                        ├── 计算画布坐标（屏幕坐标→画布坐标）
                        ├── 创建 TextElement 推入 Zustand Store
                        ├── Konva 渲染新节点
                        └── 推入历史栈（undo 快照）

点击元素          ──────→  Konva 选中事件
                        ├── 绑定 Transformer
                        ├── 右侧面板渲染对应属性
                        └── 左侧图层高亮

拖拽变换元素      ──────→  Transformer transformend 事件
                        ├── 回写 x/y/w/h/rotation 到 Store
                        └── 推入历史栈

修改属性面板      ──────→  Store 更新
                        ├── Konva 节点响应式更新
                        └── 推入历史栈

Ctrl+Z           ──────→  弹出历史栈顶
                        └── 恢复到上一个快照状态

自动保存 (30s)    ──────→  PATCH /api/projects/:id
                        └── status: saving → saved
```

### 3.4 用户中心

#### 3.4.1 页面结构

```
┌─────────────────────────────────────────────┐
│  Logo  |  模板  作品  定价   [用户名 ▾]     │
├──────────┬──────────────────────────────────┤
│          │  我的作品              [+新建]    │
│  侧边栏  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│          │  │ W1 │ │ W2 │ │ W3 │ │ W4 │   │
│  我的作品│  └────┘ └────┘ └────┘ └────┘   │
│  我的模板│                                   │
│  素材库  │  账户设置                         │
│  账户设置│  手机号：138****8888              │
│  退出    │  会员状态：免费用户               │
│          │  语言偏好：简体中文 [▾]           │
└──────────┴──────────────────────────────────┘
```

#### 3.4.2 作品卡片操作

| 操作 | 说明 |
|------|------|
| 编辑 | 进入编辑器 |
| 预览 | 打开预览页 |
| 复制 | 深拷贝创建新作品 |
| 重命名 | 弹窗修改标题 |
| 删除 | 二次确认后软删除 |
| 发布 | 进入发布流程 |

### 3.5 H5 预览与发布页

#### 3.5.1 预览模式

- 编辑器内切换「编辑/预览」模式
- 预览模式隐藏所有编辑 UI（选中框、辅助线、属性面板）
- 使用发布渲染器（DOM 版）渲染当前 JSON，真实还原发布效果
- 底部提供设备切换：手机（375）/ 平板（768）/ PC（缩放适配）

#### 3.5.2 发布流程

```
1. 用户点击「发布」
   ↓
2. 前端校验 JSON Schema 完整性
   ↓
3. POST /api/publish/:projectId
   ├── 后端生成 H5 静态 HTML（注入 Schema JSON + runtime 渲染脚本）
   ├── Puppeteer 服务端截图生成封面图
   ├── 打包上传至 COS → 获得 CDN URL
   ├── 生成二维码（指向 CDN URL）
   └── 更新作品 status = published, 记录 publishCode
   ↓
4. 返回发布结果
   ├── H5 访问链接
   ├── 二维码图片
   └── 嵌入代码 (iframe)
```

#### 3.5.3 H5 发布页（`/p/:publishCode`）

- 独立的轻量运行时页面，仅包含渲染脚本 + Schema JSON
- 移动端全屏展示，PC 端居中 + 两侧装饰背景
- 支持微信分享（自定义标题、描述、缩略图）
- 翻页交互：上下滑动 / 左右滑动切换页面

---

## 4. 组件规范

### 4.1 组件命名规范

| 规则 | 说明 | 示例 |
|------|------|------|
| 组件文件名 | PascalCase | `TextElement.tsx` |
| 组件目录名 | kebab-case | `text-element/` |
| Props 接口 | 组件名 + Props | `TextElementProps` |
| 事件处理 | on + 事件名 | `onDragEnd`, `onTransformEnd` |
| 状态枚举 | 全大写下划线 | `ELEMENT_TYPE_TEXT` |
| CSS 类名 | kebab-case + BEM | `element-panel__item--active` |

### 4.2 编辑器核心组件

#### 4.2.1 组件树

```
<Editor>
  ├── <EditorToolbar />              顶部工具栏
  ├── <EditorLayout>
  │   ├── <LeftPanel />              左侧面板
  │   │   ├── <ElementLibrary />     元素库
  │   │   ├── <TemplatePanel />      模板面板
  │   │   ├── <LayerPanel />         图层管理
  │   │   └── <BackgroundPanel />    背景设置
  │   ├── <CanvasStage />            画布舞台（核心）
  │   │   ├── <CanvasRenderer />     Konva 渲染器
  │   │   │   ├── <TextElementNode />
  │   │   │   ├── <ImageElementNode />
  │   │   │   ├── <ShapeElementNode />
  │   │   │   └── <TransformerWrapper />
  │   │   ├── <AlignmentGuides />    对齐辅助线
  │   │   └── <DeviceFrame />        设备外框
  │   ├── <RightPanel />             右侧属性面板
  │   │   ├── <BasePropertyPanel />  通用属性
  │   │   ├── <TextPropertyPanel />  文本属性
  │   │   ├── <ImagePropertyPanel /> 图片属性
  │   │   ├── <ShapePropertyPanel /> 形状属性
  │   │   └── <AnimationPanel />     动画属性
  │   └── <PageBar />                底部页面管理
  ├── <PreviewModal />               预览弹窗
  └── <PublishModal />               发布弹窗
```

#### 4.2.2 CanvasStage 组件规范

```typescript
interface CanvasStageProps {
  projectId: string;
  width: number;            // 画布逻辑宽度
  height: number;           // 画布逻辑高度
  scale: number;            // 缩放比例
  device: 'mobile' | 'tablet' | 'desktop';  // 设备类型
  readOnly?: boolean;       // 预览模式
}
```

**职责：**
- 管理 Konva.Stage 实例
- 响应 scale 变化调整画布显示尺寸
- 处理画布点击空白处取消选中
- 渲染对齐辅助线

#### 4.2.3 元素组件注册表

所有元素类型通过注册表统一管理，新增元素类型只需注册组件 + 属性配置：

```typescript
// src/editor/elements/registry.ts

interface ElementDefinition {
  type: string;
  label: string;              // i18n key
  icon: ReactNode;
  defaultSize: { width: number; height: number };
  defaultProps: Record<string, any>;
  CanvasComponent: React.FC<ElementCanvasProps>;   // Konva 渲染组件
  PropertyComponent: React.FC<ElementPropertyProps>; // 属性面板组件
  ExportComponent: React.FC<ElementExportProps>;     // DOM 发布渲染组件
}

const elementRegistry = new Map<string, ElementDefinition>();

export function registerElement(def: ElementDefinition) {
  elementRegistry.set(def.type, def);
}

export function getElementDefinition(type: string) {
  return elementRegistry.get(type);
}
```

### 4.3 通用 UI 组件

| 组件名 | 功能 | Props 摘要 |
|--------|------|-----------|
| `Button` | 按钮 | variant, size, loading, disabled |
| `Modal` | 弹窗 | open, onClose, title, children |
| `Dropdown` | 下拉菜单 | options, value, onChange |
| `ColorPicker` | 颜色选择器 | value, onChange, presetColors |
| `Slider` | 滑块 | min, max, step, value, onChange |
| `InputNumber` | 数字输入 | value, min, max, step, onChange |
| `Tabs` | 标签页 | items, activeKey, onChange |
| `Thumbnail` | 缩略图卡片 | src, title, actions |
| `Empty` | 空状态 | description, action |
| `Toast` | 轻提示 | type, message, duration |
| `LanguageSwitcher` | 语言切换器 | 当前语言 + 下拉列表 |

### 4.4 组件设计原则

1. **单一职责**：每个组件只做一件事，属性面板与渲染器分离
2. **数据驱动**：组件通过 Store 数据渲染，不持有本地状态（表单类除外）
3. **可组合**：通过组合而非继承扩展功能
4. **类型安全**：所有 Props 定义 TypeScript 接口
5. **无障碍**：关键交互组件支持键盘操作和 ARIA 标签

---

## 5. 数据接口定义

### 5.1 接口规范

#### 5.1.1 通用约定

| 项目 | 规范 |
|------|------|
| 基础路径 | `/api/v1` |
| 请求格式 | `application/json`（文件上传为 `multipart/form-data`） |
| 认证方式 | `Authorization: Bearer <accessToken>` |
| 分页参数 | `page`（从 1 开始）、`pageSize`（默认 20） |
| 时间格式 | ISO 8601（`2026-08-10T12:00:00Z`） |

#### 5.1.2 统一响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  code: 0;
  message: string;
  data: T;
}

// 分页响应
interface PaginatedResponse<T> {
  code: 0;
  message: string;
  data: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// 错误响应
interface ErrorResponse {
  code: number;        // 非 0
  message: string;
  errors?: Array<{ field: string; message: string }>;
}
```

#### 5.1.3 错误码定义

| 错误码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1001 | 参数校验失败 |
| 1002 | 未认证 |
| 1003 | 无权限 |
| 1004 | 资源不存在 |
| 2001 | 用户已存在 |
| 2002 | 密码错误 |
| 2003 | 验证码错误/过期 |
| 3001 | 作品不存在 |
| 3002 | 作品 schema 格式错误 |
| 4001 | 模板不存在 |
| 5001 | 发布失败 |
| 5002 | 文件上传失败 |
| 9001 | 服务器内部错误 |

### 5.2 认证接口

#### 5.2.1 发送验证码

```
POST /api/v1/auth/sms/send
```

**请求参数：**

```json
{
  "phone": "13800138000",
  "scene": "register"    // register | login | reset
}
```

**响应：**

```json
{
  "code": 0,
  "message": "验证码已发送",
  "data": { "expireIn": 300 }
}
```

#### 5.2.2 手机号注册

```
POST /api/v1/auth/register
```

```json
{
  "phone": "13800138000",
  "code": "123456",
  "password": "encrypted_password",
  "nickname": "用户昵称"
}
```

#### 5.2.3 手机号登录

```
POST /api/v1/auth/login
```

```json
{
  "phone": "13800138000",
  "code": "123456"        // 验证码登录
}
// 或
{
  "phone": "13800138000",
  "password": "encrypted_password"  // 密码登录
}
```

**响应：**

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": 7200,
    "user": {
      "id": "usr_xxx",
      "phone": "138****8888",
      "nickname": "用户昵称",
      "avatar": "https://...",
      "vipLevel": 0,
      "locale": "zh-CN"
    }
  }
}
```

#### 5.2.4 刷新令牌

```
POST /api/v1/auth/refresh
```

```json
{ "refreshToken": "eyJhbGci..." }
```

#### 5.2.5 微信登录

```
POST /api/v1/auth/wechat
```

```json
{ "code": "wx_auth_code" }
```

### 5.3 作品接口

#### 5.3.1 获取作品列表

```
GET /api/v1/projects?page=1&pageSize=20&status=draft
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "prj_xxx",
        "title": "婚礼邀请函",
        "cover": "https://...",
        "status": "draft",
        "updatedAt": "2026-08-10T12:00:00Z",
        "pageCount": 3
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 5.3.2 获取作品详情

```
GET /api/v1/projects/:id
```

**响应：** 完整 Project JSON Schema（见 2.4.1）

#### 5.3.3 创建作品

```
POST /api/v1/projects
```

```json
{
  "title": "未命名作品",
  "templateId": "tpl_xxx"    // 可选，从模板创建时传入
}
```

#### 5.3.4 保存作品

```
PUT /api/v1/projects/:id
```

```json
{
  "title": "婚礼邀请函",
  "schema": { ... }    // 完整 Project JSON
}
```

#### 5.3.5 自动保存

```
PATCH /api/v1/projects/:id/autosave
```

```json
{
  "schema": { ... }
}
```

#### 5.3.6 删除作品

```
DELETE /api/v1/projects/:id
```

#### 5.3.7 复制作品

```
POST /api/v1/projects/:id/duplicate
```

#### 5.3.8 获取版本历史

```
GET /api/v1/projects/:id/versions?page=1&pageSize=10
```

#### 5.3.9 回滚到指定版本

```
POST /api/v1/projects/:id/versions/:versionId/rollback
```

### 5.4 模板接口

#### 5.4.1 获取模板列表

```
GET /api/v1/templates?category=wedding&tags=chinese&page=1&pageSize=20
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "tpl_xxx",
        "name": "中式婚礼邀请函",
        "cover": "https://...",
        "category": "wedding",
        "tags": ["chinese", "red", "elegant"],
        "useCount": 1234,
        "isFree": true,
        "previewUrl": "https://..."
      }
    ],
    "total": 56,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 5.4.2 获取模板详情

```
GET /api/v1/templates/:id
```

**响应：** 完整模板 JSON Schema

#### 5.4.3 获取模板分类

```
GET /api/v1/templates/categories
```

```json
{
  "code": 0,
  "data": [
    { "key": "wedding", "name": "婚礼请柬", "icon": "..." },
    { "key": "recruitment", "name": "企业招聘", "icon": "..." },
    { "key": "conference", "name": "会议邀请", "icon": "..." },
    { "key": "marketing", "name": "企业宣传", "icon": "..." },
    { "key": "birthday", "name": "生日祝福", "icon": "..." },
    { "key": "education", "name": "教育培训", "icon": "..." },
    { "key": "festival", "name": "节日贺卡", "icon": "..." }
  ]
}
```

### 5.5 素材接口

#### 5.5.1 上传图片

```
POST /api/v1/assets/upload
Content-Type: multipart/form-data
```

**请求参数：**

| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | 图片文件 |
| type | string | image / 资源类型 |

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "ast_xxx",
    "url": "https://cdn...",
    "width": 800,
    "height": 600,
    "size": 102400,
    "format": "webp"
  }
}
```

#### 5.5.2 获取素材列表

```
GET /api/v1/assets?page=1&pageSize=20&type=image
```

#### 5.5.3 删除素材

```
DELETE /api/v1/assets/:id
```

### 5.6 发布接口

#### 5.6.1 发布作品

```
POST /api/v1/publish/:projectId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "publishCode": "abc123xy",
    "url": "https://p.example.com/p/abc123xy",
    "qrcodeUrl": "https://cdn.../qrcode.png",
    "embedCode": "<iframe src=\"https://p.example.com/p/abc123xy\" ...></iframe>"
  }
}
```

#### 5.6.2 获取发布信息

```
GET /api/v1/publish/:projectId/info
```

### 5.7 数据库模型

```sql
-- 用户表
CREATE TABLE users (
  id          VARCHAR(36) PRIMARY KEY,
  phone       VARCHAR(20) UNIQUE,
  password    VARCHAR(255),
  wx_openid   VARCHAR(64) UNIQUE,
  nickname    VARCHAR(50),
  avatar      TEXT,
  vip_level   SMALLINT DEFAULT 0,
  vip_expire  TIMESTAMP,
  locale      VARCHAR(10) DEFAULT 'zh-CN',   -- 用户语言偏好
  status      SMALLINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- 作品表
CREATE TABLE projects (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) REFERENCES users(id),
  title       VARCHAR(100) DEFAULT '未命名作品',
  cover       TEXT,
  schema      JSONB,                         -- 完整作品 JSON Schema
  status      VARCHAR(20) DEFAULT 'draft',   -- draft | published
  publish_code VARCHAR(20) UNIQUE,
  version     INT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_schema ON projects USING GIN(schema);

-- 作品版本历史表
CREATE TABLE project_versions (
  id          VARCHAR(36) PRIMARY KEY,
  project_id  VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
  schema      JSONB,
  version     INT,
  created_by  VARCHAR(36),
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_versions_project_id ON project_versions(project_id);

-- 模板表
CREATE TABLE templates (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(100),
  cover       TEXT,
  schema      JSONB,                         -- 模板 JSON Schema
  category    VARCHAR(50),                   -- 分类
  tags        TEXT[],                        -- 标签数组
  is_official BOOLEAN DEFAULT true,
  is_free     BOOLEAN DEFAULT true,
  use_count   INT DEFAULT 0,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);

-- 素材表
CREATE TABLE assets (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) REFERENCES users(id),
  url         TEXT,
  type        VARCHAR(20),                   -- image / video / audio
  size        BIGINT,
  width       INT,
  height      INT,
  format      VARCHAR(10),
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_assets_user_id ON assets(user_id);

-- 发布记录表
CREATE TABLE publishes (
  id           VARCHAR(36) PRIMARY KEY,
  project_id   VARCHAR(36) REFERENCES projects(id),
  publish_code VARCHAR(20) UNIQUE,
  url          TEXT,
  qrcode_url   TEXT,
  view_count   INT DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 6. 开发流程及里程碑

### 6.1 开发阶段划分

| 阶段 | 名称 | 周期 | 核心目标 |
|------|------|------|---------|
| P0 | 核心引擎 | 第 1-3 周 | 画布双渲染引擎 + 元素 CRUD + 拖拽 + 属性面板 |
| P1 | 业务闭环 | 第 4-6 周 | 用户系统 + 作品保存/加载 + 自动保存 |
| P2 | 模板与发布 | 第 7-9 周 | 模板库 + 预览 + 发布静态化 + 多端预览 |
| P3 | 功能完善 | 第 10-12 周 | 动画系统 + 版本历史 + 多语种国际化 |
| P4 | 优化上线 | 第 13-14 周 | 素材管理 + 性能优化 + 压力测试 + 上线 |

### 6.2 里程碑与交付物

#### 里程碑 M1 — 编辑器原型（第 3 周末）

**交付物：**
- [x] Konva 画布渲染引擎搭建完成
- [x] DOM 发布渲染器搭建完成
- [x] 文本/图片/形状三种元素的编辑态渲染
- [x] 拖拽添加元素（dnd-kit 集成）
- [x] 元素变换（选中/缩放/旋转/移动）
- [x] 基础属性面板（位置/尺寸/旋转/透明度）
- [x] 图层管理面板
- [x] Undo/Redo 历史栈
- [x] 快捷键支持（复制/粘贴/删除/撤销）

**验收标准：** 能在画布上添加、编辑、删除元素，并导出为 DOM HTML 预览。

#### 里程碑 M2 — 业务闭环（第 6 周末）

**交付物：**
- [x] 用户注册/登录（手机号验证码 + 密码）
- [x] JWT 认证中间件
- [x] 作品 CRUD API
- [x] 作品保存/加载（JSONB Schema）
- [x] 自动保存（30s 间隔 + 失焦触发）
- [x] 用户中心页面（作品列表）
- [x] 作品复制/删除/重命名

**验收标准：** 用户可注册登录，创建作品并编辑，自动保存，重新打开后数据完整。

#### 里程碑 M3 — 模板与发布（第 9 周末）

**交付物：**
- [x] 模板商城页面（分类/搜索/预览）
- [x] 模板管理后台（CRUD）
- [x] 从模板创建作品流程
- [x] 预览模式（编辑器内实时预览）
- [x] 多端预览（手机/平板/PC 尺寸切换）
- [x] H5 发布流程（静态化 + COS + CDN）
- [x] 发布页运行时（`/p/:publishCode`）
- [x] 微信分享配置

**验收标准：** 用户可浏览模板，从模板创建作品，编辑后发布为可访问的 H5 链接。

#### 里程碑 M4 — 功能完善（第 12 周末）

**交付物：**
- [x] 动画系统（入场/循环/退场动画）
- [x] 翻页过渡动画
- [x] 版本历史与回滚
- [x] 多语种国际化（中/英/维吾尔/哈萨克/柯尔克孜/乌兹别克）
- [x] RTL 布局支持（维吾尔文）
- [x] 语言切换器组件
- [x] 对齐辅助线与吸附

**验收标准：** 支持动画效果，6 种语言 UI 完整切换，维吾尔文 RTL 布局正确。

#### 里程碑 M5 — 优化上线（第 14 周末）

**交付物：**
- [x] 素材管理（上传/裁剪/压缩）
- [x] 性能优化（大画布渲染、防抖节流）
- [x] 压力测试（1000 并发）
- [x] 安全审计（XSS/CSRF/SQL 注入防护）
- [x] 监控告警（Sentry + 日志收集）
- [x] 生产环境部署
- [x] 上线 Checklist

**验收标准：** 系统通过安全审计，压测达标，生产环境稳定运行。

### 6.3 代码规范

#### 6.3.1 目录结构

```
h5-design-platform/
├── packages/
│   ├── frontend/              # 前端应用
│   │   ├── src/
│   │   │   ├── components/    # 通用组件
│   │   │   ├── editor/        # 编辑器模块
│   │   │   │   ├── components/
│   │   │   │   ├── elements/  # 元素组件注册表
│   │   │   │   ├── store/     # Zustand 状态管理
│   │   │   │   ├── renderers/ # 渲染器（Konva + DOM）
│   │   │   │   ├── hooks/     # 编辑器 hooks
│   │   │   │   └── utils/     # 工具函数
│   │   │   ├── pages/         # 页面组件
│   │   │   ├── services/      # API 调用层
│   │   │   ├── i18n/          # 国际化资源
│   │   │   │   ├── locales/   # 各语言翻译文件
│   │   │   │   ├── config.ts  # i18n 配置
│   │   │   │   └── hooks.ts   # useTranslation 封装
│   │   │   ├── styles/        # 全局样式
│   │   │   ├── types/         # TypeScript 类型定义
│   │   │   └── App.tsx
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── backend/               # 后端应用
│   │   ├── src/
│   │   │   ├── modules/       # 业务模块
│   │   │   │   ├── auth/      # 认证模块
│   │   │   │   ├── project/   # 作品模块
│   │   │   │   ├── template/  # 模板模块
│   │   │   │   ├── asset/     # 素材模块
│   │   │   │   └── publish/   # 发布模块
│   │   │   ├── common/        # 公共模块（守卫/拦截器/过滤器）
│   │   │   ├── prisma/        # Prisma schema & migrations
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── shared/                # 前后端共享类型
│       ├── types/             # 共享 TypeScript 类型
│       └── constants/         # 共享常量
│
├── docker-compose.yml
└── package.json
```

#### 6.3.2 Git 分支规范

| 分支 | 用途 | 命名 |
|------|------|------|
| `main` | 生产环境 | main |
| `develop` | 开发主干 | develop |
| `feature/*` | 功能开发 | feature/editor-transformer |
| `fix/*` | Bug 修复 | fix/autosave-race-condition |
| `release/*` | 发布分支 | release/v1.0.0 |

#### 6.3.3 Commit 规范

```
<type>(<scope>): <subject>

type:   feat | fix | docs | style | refactor | test | chore
scope:  editor | auth | project | template | publish | i18n | etc.
```

示例：`feat(editor): add alignment guides and snap-to-edge`

### 6.4 测试策略

| 测试类型 | 工具 | 覆盖范围 |
|---------|------|---------|
| 单元测试 | Vitest | 工具函数、Store 逻辑、API 处理器 |
| 组件测试 | Vitest + Testing Library | 通用组件、属性面板 |
| E2E 测试 | Playwright | 编辑器核心流程、发布流程 |
| 接口测试 | Supertest | 所有 API 端点 |
| 性能测试 | k6 | 1000 并发压测 |
| 视觉回归 | Playwright + 截图对比 | 关键页面视觉一致性 |

---

## 7. 多语种国际化方案

### 7.1 支持语言清单

| 语言 | locale 编码 | 文字系统 | 书写方向 | 说明 |
|------|------------|---------|---------|------|
| 简体中文 | `zh-CN` | 汉字 | LTR | 默认语言 |
| English | `en` | 拉丁字母 | LTR | 国际通用 |
| 维吾尔文 | `ug` | 阿拉伯字母（察合台文变体） | **RTL** | 需 RTL 布局支持 |
| 哈萨克文 | `kk-CN` | 阿拉伯字母（中国哈萨克文） | **RTL** | 中国境内常用阿拉伯字母变体 |
| 柯尔克孜文 | `ky-CN` | 阿拉伯字母（中国哈萨克柯尔克孜文） | **RTL** | 中国境内常用阿拉伯字母变体 |
| 乌兹别克文 | `uz-CN` | 阿拉伯字母（中国乌兹别克文） | **RTL** | 中国境内常用阿拉伯字母变体 |

> **关键注意**：维吾尔文、哈萨克文、柯尔克孜文、乌兹别克文在中国境内均使用基于阿拉伯字母的文字系统，书写方向为**从右向左（RTL）**。这是本平台国际化方案的核心挑战。

### 7.2 技术方案

#### 7.2.1 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| i18n 框架 | `react-i18next` + `i18next` | React 生态标准方案 |
| 语言检测 | `i18next-browser-languagedetector` | 自动检测浏览器语言 |
| 后端语言 | `i18next-http-middleware` | NestJS 后端国际化 |
| 日期/数字 | `Intl.DateTimeFormat` / `Intl.NumberFormat` | 浏览器原生 API |
| 字体方案 | 按语言动态加载 Web Font | 见 7.2.5 |

#### 7.2.2 翻译文件结构

采用命名空间（namespace）组织翻译文件，按功能模块拆分：

```
src/i18n/locales/
├── zh-CN/
│   ├── common.json          # 通用文案（按钮/提示/导航）
│   ├── editor.json          # 编辑器文案
│   ├── templates.json       # 模板相关文案
│   ├── publish.json         # 发布相关文案
│   └── errors.json          # 错误信息
├── en/
│   ├── common.json
│   ├── editor.json
│   ├── templates.json
│   ├── publish.json
│   └── errors.json
├── ug/
│   ├── common.json
│   ├── editor.json
│   ├── templates.json
│   ├── publish.json
│   └── errors.json
├── kk-CN/
│   └── ...
├── ky-CN/
│   └── ...
└── uz-CN/
    └── ...
```

**翻译文件示例（`zh-CN/common.json`）：**

```json
{
  "app": {
    "name": "H5设计平台",
    "slogan": "做H5，就这么简单"
  },
  "nav": {
    "templates": "模板",
    "dashboard": "作品",
    "pricing": "定价",
    "login": "登录",
    "register": "注册"
  },
  "button": {
    "create": "立即制作",
    "preview": "预览",
    "publish": "发布",
    "save": "保存",
    "cancel": "取消",
    "confirm": "确认",
    "delete": "删除",
    "duplicate": "复制"
  },
  "status": {
    "saving": "保存中...",
    "saved": "已保存",
    "publishing": "发布中...",
    "published": "已发布"
  }
}
```

**翻译文件示例（`en/common.json`）：**

```json
{
  "app": {
    "name": "H5 Design",
    "slogan": "Design H5, simplified"
  },
  "nav": {
    "templates": "Templates",
    "dashboard": "My Works",
    "pricing": "Pricing",
    "login": "Log in",
    "register": "Sign up"
  },
  "button": {
    "create": "Start Designing",
    "preview": "Preview",
    "publish": "Publish",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "duplicate": "Duplicate"
  },
  "status": {
    "saving": "Saving...",
    "saved": "Saved",
    "publishing": "Publishing...",
    "published": "Published"
  }
}
```

#### 7.2.3 i18n 配置

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 支持的语言配置
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文', dir: 'ltr', font: 'system' },
  { code: 'en',    name: 'English',  dir: 'ltr', font: 'system' },
  { code: 'ug',    name: 'ئۇيغۇرچە',  dir: 'rtl', font: 'ug-font' },
  { code: 'kk-CN', name: 'قازاقشا',   dir: 'rtl', font: 'kk-font' },
  { code: 'ky-CN', name: 'قىرعىزچا',  dir: 'rtl', font: 'ky-font' },
  { code: 'uz-CN', name: 'ئۆزبېكچە',  dir: 'rtl', font: 'uz-font' },
] as const;

export const DEFAULT_LANGUAGE = 'zh-CN';
export const FALLBACK_LANGUAGE = 'zh-CN';

// RTL 语言列表
export const RTL_LANGUAGES = ['ug', 'kk-CN', 'ky-CN', 'uz-CN'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { common: require('./locales/zh-CN/common.json'), ... },
      'en':    { common: require('./locales/en/common.json'), ... },
      'ug':    { common: require('./locales/ug/common.json'), ... },
      // ...其他语言
    },
    fallbackLng: FALLBACK_LANGUAGE,
    defaultNS: 'common',
    ns: ['common', 'editor', 'templates', 'publish', 'errors'],
    interpolation: {
      escapeValue: false,  // React 已做 XSS 防护
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
```

#### 7.2.4 RTL 布局方案

**核心原则：使用 CSS 逻辑属性替代物理属性。**

| 物理属性（禁用） | 逻辑属性（使用） | 说明 |
|-----------------|-----------------|------|
| `margin-left` | `margin-inline-start` | LTR 下等于 left，RTL 下等于 right |
| `margin-right` | `margin-inline-end` | 同上 |
| `padding-left` | `padding-inline-start` | |
| `padding-right` | `padding-inline-end` | |
| `text-align: left` | `text-align: start` | |
| `text-align: right` | `text-align: end` | |
| `left: 0` | `inset-inline-start: 0` | 定位场景 |
| `right: 0` | `inset-inline-end: 0` | |
| `border-left` | `border-inline-start` | |

**方向切换实现：**

```typescript
// src/i18n/hooks.ts
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RTL_LANGUAGES } from '../config';

export function useLanguageDirection() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  const isRTL = RTL_LANGUAGES.includes(currentLang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = currentLang;
    html.dir = isRTL ? 'rtl' : 'ltr';
  }, [currentLang, isRTL]);

  return { isRTL, currentLang };
}
```

**Tailwind CSS RTL 支持：**

使用 Tailwind 的逻辑属性变体（`rtl:` / `ltr:`）配合 `dir` 属性：

```html
<!-- 自动适配方向 -->
<div class="ps-4 pe-2 text-start">
  <!-- ps = padding-inline-start, pe = padding-inline-end -->
  <!-- text-start 自动适配方向 -->
</div>
```

Tailwind 配置需添加逻辑属性插件或使用 `@tailwindcss/rtl`：

```javascript
// tailwind.config.js
module.exports = {
  // ...其他配置
  plugins: [
    // 使用 Tailwind 3.x 内置逻辑属性支持
    // ps-* pe-* ms-* me* start-* end-* 已内置
  ],
};
```

#### 7.2.5 字体方案

不同文字系统需要专用字体，按语言动态加载：

```css
/* src/styles/fonts.css */

/* 默认字体（中文/英文） */
:root {
  --font-default: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
}

/* 维吾尔文字体 */
:lang(ug) {
  --font-default: 'UKIJ Tuz Tom', 'Alp Ekran', 'MS Mincho', sans-serif;
}

/* 哈萨克文字体 */
:lang(kk-CN) {
  --font-default: 'Kazakh Unicode', 'Alp Ekran', sans-serif;
}

/* 柯尔克孜文字体 */
:lang(ky-CN) {
  --font-default: 'Kyrgyz Unicode', 'Alp Ekran', sans-serif;
}

/* 乌兹别克文字体 */
:lang(uz-CN) {
  --font-default: 'Uzbek Unicode', 'Alp Ekran', sans-serif;
}

body {
  font-family: var(--font-default);
}
```

Web Font 按需加载（避免首屏加载所有语言字体）：

```typescript
// src/i18n/fontLoader.ts
const FONT_MAP: Record<string, string> = {
  'ug':    '/fonts/ukij-tuz-tom.woff2',
  'kk-CN': '/fonts/kazakh-unicode.woff2',
  'ky-CN': '/fonts/kyrgyz-unicode.woff2',
  'uz-CN': '/fonts/uzbek-unicode.woff2',
};

export async function loadLanguageFont(lang: string) {
  const fontUrl = FONT_MAP[lang];
  if (!fontUrl) return;

  const fontFace = new FontFace(lang, `url(${fontUrl})`);
  await fontFace.load();
  document.fonts.add(fontFace);
}
```

#### 7.2.6 语言切换器组件

```typescript
// src/components/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n/config';
import { loadLanguageFont } from '../i18n/fontLoader';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await loadLanguageFont(lang);
  };

  return (
    <Dropdown
      value={i18n.language}
      onChange={handleChange}
      options={SUPPORTED_LANGUAGES.map(lang => ({
        value: lang.code,
        label: lang.name,
      }))}
    />
  );
}
```

#### 7.2.7 编辑器内文本元素的多语种处理

编辑器中的文本元素内容本身也需要支持多语种。采用 **Schema 内嵌多语种字段** 方案：

```typescript
interface TextElement extends ElementBase {
  type: 'text';
  props: {
    // 多语种内容：按 locale 存储，缺失时回退到 default
    content: string;                          // 默认内容（回退）
    i18nContent?: Record<string, string>;     // { "ug": "...", "en": "..." }
    fontSize: number;
    fontFamily: string;
    // ...其他属性
  };
}
```

发布时根据访问者语言偏好选择对应内容：

```typescript
function getLocalizedContent(element: TextElement, locale: string): string {
  return element.props.i18nContent?.[locale]
    ?? element.props.i18nContent?.['zh-CN']
    ?? element.props.content;
}
```

#### 7.2.8 后端国际化

NestJS 后端同样需要国际化，主要用于错误消息和邮件/短信模板：

```typescript
// backend/src/i18n/i18n.module.ts
import i18next from 'i18next';
import middleware from 'i18next-http-middleware';

i18next.use(middleware.LanguageDetector).init({
  preload: ['zh-CN', 'en', 'ug', 'kk-CN', 'ky-CN', 'uz-CN'],
  fallbackLng: 'zh-CN',
  resources: {
    'zh-CN': { translation: require('./locales/zh-CN.json') },
    'en':    { translation: require('./locales/en.json') },
    'ug':    { translation: require('./locales/ug.json') },
    // ...
  },
});

// 在 main.ts 中注册中间件
app.use(middleware.handle(i18next));

// 在控制器中使用
@Get()
findAll(@Req() req: Request) {
  const t = req.t;  // i18next 翻译函数
  throw new BadRequestException(t('errors.validation_failed'));
}
```

#### 7.2.9 RTL 布局测试要点

| 测试项 | 验证内容 |
|--------|---------|
| 导航栏 | 菜单项顺序镜像，Logo 位于右侧 |
| 编辑器面板 | 左侧面板与右侧面板位置互换 |
| 属性面板 | 标签与输入框对齐方向正确 |
| 文本对齐 | 默认右对齐，icon 位置正确 |
| 模板卡片 | 操作按钮位置镜像 |
| 弹窗 | 关闭按钮位于左上角 |
| 数字输入 | 仍保持 LTR（数字始终从左到右） |
| 翻页方向 | 翻页手势/动画方向镜像 |

#### 7.2.10 国际化回退策略

```
用户选择语言 → 查找翻译 → 有 → 使用
                         → 无 → 回退到 zh-CN
                              → zh-CN 也无 → 回退到 en
                              → en 也无 → 使用 key 本身
```

```typescript
i18n.init({
  fallbackLng: 'zh-CN',
  // 部分翻译缺失时回退
  partialBundledLanguages: true,
  // 命名空间回退
  ns: ['common', 'editor', 'templates', 'publish', 'errors'],
  defaultNS: 'common',
});
```

---

## 8. 附录

### 8.1 术语表

| 术语 | 说明 |
|------|------|
| Schema | 作品/页面的 JSON 数据结构，描述所有元素及其属性 |
| Stage | Konva 的画布舞台，承载所有图层 |
| Layer | Konva 的图层，用于分组管理元素 |
| Transformer | Konva 的变换控制器，处理选中/缩放/旋转 |
| Element | 画布上的元素（文本/图片/形状等） |
| Page | H5 中的一个页面，包含多个元素 |
| Project | 一个完整的 H5 作品，包含多个页面 |
| Template | 预制的 Project Schema，用户可基于模板创建作品 |
| 双渲染器 | 编辑态使用 Konva Canvas，发布态使用 DOM + CSS |
| RTL | Right-to-Left，从右向左书写方向 |
| LTR | Left-to-Right，从左向右书写方向 |
| 逻辑属性 | CSS 中不依赖物理方向的属性（如 `margin-inline-start`） |
| 发布码 | 发布后生成的唯一短码，用于访问 H5 页面 |

### 8.2 元素类型扩展指南

新增一种元素类型的完整步骤：

1. **定义类型接口**：在 `shared/types/elements.ts` 中定义新的 Element 接口
2. **注册元素**：在 `editor/elements/registry.ts` 中注册 CanvasComponent、PropertyComponent、ExportComponent
3. **实现 Canvas 组件**：编写 Konva 渲染组件
4. **实现属性面板**：编写对应的属性配置面板
5. **实现发布组件**：编写 DOM 导出渲染组件
6. **添加到元素库**：在左侧元素库面板中添加拖拽入口
7. **补充翻译**：在各语言的 `editor.json` 中添加元素名称翻译

### 8.3 多语种翻译文件清单

| 文件 | 内容 | 状态 |
|------|------|------|
| `locales/zh-CN/*.json` | 简体中文翻译 | 待编写 |
| `locales/en/*.json` | 英文翻译 | 待编写 |
| `locales/ug/*.json` | 维吾尔文翻译 | 待编写 |
| `locales/kk-CN/*.json` | 哈萨克文翻译 | 待编写 |
| `locales/ky-CN/*.json` | 柯尔克孜文翻译 | 待编写 |
| `locales/uz-CN/*.json` | 乌兹别克文翻译 | 待编写 |

### 8.4 参考资源

| 资源 | 链接 |
|------|------|
| Konva 文档 | https://konvajs.org/ |
| dnd-kit 文档 | https://docs.dndkit.com/ |
| react-i18next 文档 | https://react.i18next.com/ |
| NestJS 文档 | https://docs.nestjs.com/ |
| Prisma 文档 | https://www.prisma.io/docs/ |
| Tailwind CSS 逻辑属性 | https://tailwindcss.com/docs/customizing-colors |
| RTL 布局指南 | https://rtlstyling.com/ |
| 参考产品 | https://www.zhizuoh5.com/ |

---

> **文档维护说明**：本文档随项目迭代持续更新，每次里程碑交付后同步修订。所有变更需通过 PR 评审后合并。
