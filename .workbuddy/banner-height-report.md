# 首页首屏 Banner 高度调整报告

## 目标
将首页第一屏内容（顶部导航 + Banner + 四张核心引导卡片 + 搜索区）完整收纳在一屏（100vh）内，参考目标截图的紧凑排版。

## 调整项（Home.tsx）

| 区域 | 原样式 | 调整后 | 说明 |
|------|--------|--------|------|
| Banner slide 垂直内边距 | `py-20 md:py-28` | `py-10 md:py-12` | 显著压缩高度 |
| Banner 图标 | `text-5xl md:text-6xl mb-4` | `text-4xl md:text-5xl mb-2` | 缩小并减少下方间距 |
|  eyebrow 标签 | `px-4 py-1 text-sm mb-2` | `px-3 py-0.5 text-xs mb-2` | 更精致 |
| 主标题 | `text-4xl md:text-5xl mb-2` | `text-3xl md:text-4xl mb-1` | 缩小字号与间距 |
| 副标题 | `text-lg tracking-widest` | `text-sm tracking-wider` | 更紧凑 |
| CTA 按钮区上边距 | `mt-7` | `mt-4` | 靠近标题 |
| CTA 按钮内边距 | `px-7 py-2.5` | `px-6 py-2` | 微缩 |
| 轮播指示器 | `bottom-4` | `bottom-3` | 上移一点 |
| 核心引导区容器 | `px-6 pb-8 p-5 gap-4` | `px-4 pb-4 p-3 gap-3` | 减少留白 |
| 引导卡片图标 | `h-12 w-12 text-2xl` | `h-10 w-10 text-xl` | 缩小图标 |
| 引导卡片文字 | 默认 + `text-xs` | `text-sm` 标题 + `text-[11px]` 描述 | 更紧凑 |
| 搜索区 | `px-6 pb-12 py-3.5` | `px-4 pb-6 py-3` | 减少上下间距 |
| 热门标签 | `mt-3 px-2.5 py-1` | `mt-2 px-2 py-0.5` | 更紧凑 |

## 验证
- `pnpm --filter @h5design/web typecheck`：EXIT 0 ✅
- Vite dev server：`http://localhost:5173/` 启动成功，编译无报错 ✅

## 预览
打开 `http://localhost:5173/` 即可看到首屏一屏内完整展示 Banner、四张引导卡片和搜索区的效果。
