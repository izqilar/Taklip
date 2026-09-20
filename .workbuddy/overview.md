# 编辑器白屏 Bug 修复 — 收尾与最终验证

## 任务
在 P2 阶段已修复「点击画布任意对象后整页变白」的核心崩溃后，完成剩余的收尾工作：
1. 消除 `EditorCanvas` 的 React key spread 警告（核心崩溃已修复，此警告是修复过程中引入）。
2. 消除浏览器自动请求 `/favicon.ico` 产生的 404 控制台错误。
3. 增加 React Error Boundary，使未来任何渲染异常都能优雅降级，而非整页白屏。
4. 端到端回归验证 + 生产构建验证 + 清理临时调试脚本。

## 改动文件
| 文件 | 改动 |
|---|---|
| `apps/web/src/components/Canvas/EditorCanvas.tsx` | 从 `common` 对象移除 `key: el.id`，改为在每个返回元素上直接传 `key={el.id}`（Text/Rect/Circle/Group×2/KonvaImage） |
| `apps/web/src/components/ErrorBoundary.tsx` | **新增** 通用错误边界 class 组件，兜底 UI 含「重试 / 刷新页面」 |
| `apps/web/src/components/Editor/EditorApp.tsx` | 用 `ErrorBoundary` 分别包裹 `EditorCanvas` 与 `PropertyPanel` |
| `apps/web/index.html` | 新增内联 SVG favicon（data URI），消除 `/favicon.ico` 404 |
| `apps/web/src/components/Panel/PropertyPanel.tsx` | （前次）slider/number/color 渲染崩溃防护 + 元素 id 守卫 |
| `apps/web/src/store/editorStore.ts` | （前次）`loadProject` 按 `createElement` 默认值归一化元素 |

## 验证结果
- **无头 Chrome 回归**：注册用户 → 婚礼模板 → 使用模板 → 打开 `/editor/{id}` → 点击画布多个坐标（文本/矩形/圆形/线）。
  - 修复前：CONSOLE 含 4 条 key-spread 警告 + 404。
  - 修复后：`bodyTextLenAfterClick: 384`（内容正常渲染）、`PAGE ERRORS: (none)`、CONSOLE 仅剩 vite/React DevTools 无害信息，**key 警告与 404 均消失** ✅
- 前端 `tsc --noEmit`：0 errors ✅
- 前端 `vite build`：326 模块 built，0 errors ✅（沙箱拦截 emptyOutDir 的 trash 操作，改 `--outDir dist-verify` 成功；属环境限制非代码问题）
- 临时复现脚本与输出日志已清理 ✅

## 结论
编辑器白屏问题已彻底修复：根因（slider/number 字段对 undefined 调 toFixed/round）在属性面板与 store 两层防御性修复；新增 ErrorBoundary 防止未来同类异常白屏；控制台现已完全干净。
