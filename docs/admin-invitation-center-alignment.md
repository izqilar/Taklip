# 运营端「请柬事务中心」对齐清单与要点（以 web 端为基准）

> 基准真值：`apps/web/src/user/shared.tsx` 的 `USER_CENTER_NAV`（L338-359）
> 运营端菜单真值：`apps/admin/src/config/resources.tsx`（`MenuGroupKey.invitationcenter`）
> 对齐校验：`scripts/verify_invitation_menu_alignment.mjs`（25/25 PASS）、`scripts/verify_invitation_center_alignment.mjs`（37/37 PASS，已修正 3 处陈旧锚点）

---

## 一、结论总览（2026-10-12 落地后）

| 维度 | 状态 |
|------|------|
| 菜单结构（子菜单项与顺序） | ✅ 已完全一致（menu 脚本 25/25 PASS） |
| UI 界面 / 功能模块 | ✅ 已 1:1 对齐（center 脚本 37/37 PASS） |

**本轮（2026-10-12）实际落地的对齐项只有两处真正的偏差**：
1. **C 模块缺「购买数量」入口**（web 有，admin 无）→ 已补齐按钮+弹窗+端点调用+配额标签。
2. **A 模块 `canEdit` 过严**（admin 为 `!isSystem`，web 为 `!isSystem || isAdmin`）→ 已放宽。

**调研推翻的原误判（非缺口，勿再当作 gap）**：
- ❌ 「任务进度双选项卡」：web 端 `InvitationJobs.tsx` 注释声称双 Tab 但**代码是单面板**；admin 已与 web 一致，无需新增。
- ❌ 「编辑宾客字段取数口径分裂」：web 本身就是——批量生成页用 `r.fields`、名单编辑器用 `columnDefs→/field-design→完整 GUEST_FIELD_DEFS`；admin 两边与 web **同构**，属正确对齐，不是偏差。
- ❌ 「admin 缺『重新生成』」：web 已统一为「生成」按钮（走 `RERENDER`）；admin 已对齐。校验脚本 C2 旧锚点找字面「重新生成」是错的，已修正。

---

## 二、运营端需对齐的子菜单清单（3 项，均已对齐）

| # | 子菜单 | web 路由 / 页面 | 运营端路由 / 页面 | 状态 |
|---|--------|----------------|------------------|------|
| A | 模板字段设计 | `/user/invitations/fields` → `TemplateFieldDesignPage.tsx` | `/user/invitations/fields` → `UserTemplateFieldDesign.tsx` | ✅ 已对齐 |
| B | 诚邀名单制作 | `/user/invitations/lists` + `/lists/:listId` → `GuestLists.tsx`+`GuestListEditor.tsx` | `/user/invitations/lists` + `/lists/:id` → `UserGuestLists.tsx`+`UserGuestListEditor.tsx` | ✅ 已对齐 |
| C | 请柬批量生成 | `/user/invitations/jobs` → `InvitationJobs.tsx` | `/user/invitations/jobs` → `UserInvitationCenter.tsx` | ✅ 已对齐 |

---

## 三、逐项对齐要点

### A. 模板字段设计（`UserTemplateFieldDesign.tsx`）
- 四态（list/view/edit/new）、系统模板只读、复用 `@h5design/ui` 的 `TemplateFieldDesign`（`lockFirstField=false`/`lockedKeys=[]`/`saveFields` 必填）—— 与 web 一致。
- **★本轮修正**：`canEdit` 由 `!tpl.isSystem` 改为 `!tpl.isSystem || isAdmin`（`isAdmin = role === 'ADMIN'`，取自 `useLayer()`），与 web 的 `useAuthStore.isAdmin` 语义对齐；系统模板 tooltip 文案与删除确认文案改为 web 默认值。
- 保留 admin 特有的 `canWrite` 监督态闸门（web 无对应概念，属监督窗口必要机制，不是偏差）。

### B. 诚邀名单制作（`UserGuestLists.tsx` + `UserGuestListEditor.tsx`）
- 列表四列/行操作/新建/导入/下载/模板下拉 testid、编辑器动态列/记录保留不变量/「保存并返回」自动存盘/名称独立 GET 回填——与 web 同构。
- 字段来源：`columnDefs`→`GET /guest-lists/field-design`→**完整** `GUEST_FIELD_DEFS`（与 web 编辑器一致；非 `slice(0,5)`）。
- 保留 admin 特有的 `subject` 透传、`canWrite` 闸门、删除二次确认（安全加固，非功能偏差；若需像素级一致可移除，见第五节）。

### C. 请柬批量生成（`UserInvitationCenter.tsx`）★本轮主要补齐
- 向导 ①→②→③→④、任务进度单面板、编辑闸门（永久锁 `editedRecordIds` + 10% `editLimit`）、生成/重渲（统一「生成」按钮→`RERENDER`）、编辑弹窗取 `r.fields`——与 web 一致。
- **★本轮修正**：补齐 web 端「购买数量」入口——
  - 向导按钮组新增「购买数量」按钮（`ml-auto` 最右、`disabled={!picked}`），紧接实时配额标签 `生成总数/已使用/剩余`（无数据显示 `—`）；按钮顺序已与 web 终态一致（④ → 购买数量 → 配额标签）。
  - 新增「购买渲染人次」弹窗（antd Modal）：提示文案 `免费赠样 X 人 + 已购 Y = 可渲染 Z 人，剩余 W 人`、整数人次输入、确认购买。
  - `confirmBuy` → `apiPost('/invitations/purchase', { projectId, headcount, ...subjBody })`（路径不包 `q()`，subject 走 body；服务端端点已支持）；成功后回写配额、刷新行、绿色成功横幅。
  - `BatchProjectView` 类型补全（`freeSampleCap/purchasedHeadcount/totalRenderable/...`）以承载配额。

---

## 四、对齐校验结果

- `node scripts/verify_invitation_menu_alignment.mjs` → **25/25 PASS**
- `node scripts/verify_invitation_center_alignment.mjs` → **37/37 PASS**（C2/C10/C11 三处陈旧锚点已修正为真实 web 行为）
- `pnpm --filter @h5design/admin run typecheck` → **0 错误**

---

## 五、运营端有意保留的 admin 专属差异（非对齐偏差，供决策）

| 项 | 说明 | 是否需改 |
|----|------|----------|
| `subject` 监督透传 + `canWrite` 只读闸门 | admin 监督窗口必须靠 `subject` 切换被视察用户 SELF 作用域；web 无此概念 | 保留（机制必需） |
| API 调用风格（A/B 用裸 `fetch`，C 用 `apiGet/apiPost`） | admin Vite 不代理 `/api`，统一走绝对 `API_URL`+Bearer；功能与 web 等价 | 保留（环境差异，非功能偏差） |
| B 列表删除二次确认 `window.confirm` | web 无确认；admin 属破坏性操作安全加固 | 可选：若要求完全 1:1 可移除 |
| C 模块注释「双选项卡」 | 注释与 web 同款陈旧，实际均为单面板 | 仅注释，可清理不影响功能 |

---

## 六、跨轮累积与提交

- 本轮 + 前序（需求五、按钮互换、401/锁）改动均**未 git commit**，待用户统一审阅后提交/推送。
- 改动文件：`UserInvitationCenter.tsx`、`invitationShared.tsx`、`UserTemplateFieldDesign.tsx`、`scripts/verify_invitation_center_alignment.mjs`。
