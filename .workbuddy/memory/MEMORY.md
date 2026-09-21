# 项目长期记忆 — 庆柬云 / TAKLIP Cloud

## 0 架构/角色
apps/server(:3000 NestJS+Prisma+PG+Redis) / admin(:5174 Refine+antd) / web(:5173 React18+Vite+Konva9+GSAP+i18n 6语言含RTL)。包：@h5design/core(dist构建,改后必重建)/editor(Konva+GSAP)/render(纯DOM)。主题朱砂 #c24b2e；顶栏/登录红 #c81e42（两套勿混）。未实现功能统一「该功能即将上线」。
角色 USER/SERVICE_PROVIDER/AGENT/ADMIN；权限真相源=DataScopeInterceptor(ALL/REGION/SELF)；金额以分存。四层视角 localStorage `layer.view`；ADMIN 视察代操作经 `?subject=`（dataProviders 的 `withSubject(path,method)` 统一注入：GET=provider|wallet|export+messages，写=provider|export；服务端 `subjectId(req,subject)` 仅认 `req.user.role==='ADMIN'`）。

## 0.5 版本控制（★2026-09-21 纠正：仓库确实受 git 托管）
- 工作区是 git 仓库，分支 `main`，remote= `github.com/izqilar/Taklip`（已 push 过，本地曾领先 25+ 提交）。**此前误判"非 git 仓库"是错误的，勿再据此拒绝提交。**
- 沙箱无 GitHub 凭据、无 SSH 密钥（~/.ssh 空、22 端口关闭），HTTPS push 必须靠用户提供的令牌。
- **fine-grained PAT 坑**：REST API `permissions.push=true` 只反映账户权限，**不代表令牌可写**；git 传输/API 写操作被拒(403 "denied to izqilar")时，多为令牌「Contents」未设 Read and write 或仓库未加入授权列表。判定法：用 `curl -X POST .../git/refs` 建引用，403=令牌无写权。修法：令牌改 Contents=Read and write（含本仓库）或改用 Classic PAT(`repo` 范围)。令牌仅用于一次性 `git -c credential.helper= push`，不写入 .git/config、不持久化。

## 1 环境/启动（★重启铁律）
DB：postgresql://h5design:h5design_dev_2026@localhost:5432/h5design_platform。密码 Test123456；ADMIN 13800000002、SP 13800000001（dev123456）；USER 13900001001~003（Test123456）。startup.ps1 启动（detached）；**:3000 跑 `node dist/main`（watchdog 每5s探活重启，勿手起第二个）。改 server 源码后必须 `pnpm --filter @h5design/server run build:compiled` 再 kill :3000 让 watchdog 拉新代码——只改源码不 build = 线上仍是旧行为**（2026-09-19 导出 subject 404 即此因）。core 改码须重建 dist；prisma 改 schema 须 regenerate；验证 `pnpm --filter @h5design/{web,admin,editor,render,ui,server} run typecheck`。

## 2 draft/live 口径 ★
加载一律 `draftSchema ?? schema`（effectiveSchema，helper 在 provider-console.controller.ts 顶部；导出 export.service 同）；保存只写草稿；发布=原子替换 schema+清草稿。列表行归一后抹 draftSchema，SERVICE_SELECT 须含 draftSchema:true。

## 3 编辑器内核/渲染铁律
只认扁平属性、从不读 el.props；仅 visible===false 隐藏。文本排版复刻 Konva（render/src/lib/textLayout.ts）：宽度含尾部 letterSpacing；固定 height 超行 break；容器 overflow:visible。文本轮廓传 2×宽+lineJoin=round。justify/justify-all 由 installTextJustifySupport 替换 _sceneFunc（末行不拉伸/全拉伸；空格拉 wordSpacing 否则 letterSpacing；RTL textAlign=right）。复制/剪切/粘贴/右键菜单已落地（store clipboard 多选，+24 偏移）。画布缩放=Konva 内部 scale。admin PreviewStage schema 优先于 cover。

## 4 导出/字体
终端用户无发布权：`PublishModal exportOnly` + `<EditorApp exportOnly/>`；web 卡片「导出」→ ExportWorkDialog（React.lazy）。**图片=服务端渲染**（/export/prepare→image，token 参数必须叫 `et`，puppeteer-core+ffmpeg）；**视频/GIF=客户端** exportProjectToVideo（不经过服务端，排障时勿混淆）。付费字体授权决定分辨率/水印；字体目录真值 getFontCatalog()+useSyncExternalStore；动态注册须订阅 loadingdone+clearTextMeasureCache。

## 5 通用坑（血泪）
- ⚠️ 同文件一条消息并行多 Edit 会互相覆盖→必须串行；改完 Grep/Read 抽查落盘。
- ⚠️ i18next `t()` 缺 key 返回原 key 字符串（真值），`t(x)||'兜底'` 永不生效→**必须 `t(x,{defaultValue:'…'})`**；zh-CN/en 与小语种包结构不对称，小语种缺失走 fallback。
- ⚠️「背景尺寸/平铺」等下拉是自定义 BilingualSelect（非原生 select），Playwright 按按钮文案点；Chrome 归一化 `100% auto`→`100%`。Playwright 脚本放 apps/web 根，chromium-1228，期望值从 DB 推导。
- ⚠️ Nest 装饰器顺序无关但 TS 必选不能跟可选后（TS1016）：@Query 可选放 @Body/@Res 后。
- web/admin 登录失败先查 :3000；运营端 vite 不代理 /api（直连 :3000），注入登录态须 Node 侧 login 后写 localStorage。

## 6 UI 对齐约定（真值=运营端）
web 个人中心：grid `md:grid-cols-[240px_1fr]`，禁 max-w-7xl 居中；根 fontSize 14；字号令牌 全局14/菜单13.5/表头12.5/面板头14.5/页头18/KPI27。侧栏折叠 useEffect 依赖只能放 activeGroup。
账号胶囊 web 触发器红底白描边(#c81e42)、头像白底红字；下拉面板 account-panel.css 镜像 admin（选择器加 `.h5-acc-scope` 前缀），改色/尺寸两端同步。顶部导航：首页/模板库/服务云/设计工坊。金额展示用 formatCents；手机号 maskPhone；fetch 认证头统一 authHeaders()。

## 7 统一登录落点
真值=auth.service.ts `ROLE_HOME`（USER→web /user/works；SP→admin /sp/studio；AGENT/ADMIN→admin dashboard）；`generateTokens()` 与 user 平级下发 `home`。跨端一次性票据 `?ticket=`（45s 单次，/auth/ticket + /auth/exchange；web bootstrap rehydrate authStore）。运营端登录页遇 USER 静默 `window.location.replace(bridge)`（不弹提示不写会话）；Refine HttpError 额外字段须对象展开。

## 8 i18n/权限约定
6 语言；admin fallbackLng zh-CN、web en；admin `common` 命名空间取自 `admin/src/i18n/locales/<lang>/web-common.json`（web common.json 的手动同步副本）。admin 枚举标签唯一真值 `config/labels.ts`（存 i18n 键，调用时 t()）。accessControlProvider 对 admin/* 未映射资源 fail-closed；改权限须同步后端 getAccess。

## 9 历史修复索引
#42 resolveShadow 阴影门控；#43 字体目录懒拉取；#44 kashida；#45 复制粘贴；#46 justify 段首空格。三端像素一致性见技能 `h5design-draft-live-parity`。2026-09-19 视察视角全链路（读/写/编辑/发布/删除/导出/升级）已补 subject 支持；web 详情弹窗 readonlyHintWebEdit 缺 key 已补并改 defaultValue 写法。

## 11 SchemaThumbnail 使用铁律 + 回归排查法
- `SchemaThumbnail`(@h5design/render) 根节点 `absolute inset-0`：**父容器必须有 position(relative)**，否则逃逸到最近的 fixed/viewport 铺满全屏（web 详情弹窗曾因此"整页被作品铺满"）。全仓 7 处使用点已核对；新增使用点必查。
- `/api/projects` 列表 select 必含 `publishCode`（否则已发布作品详情二维码区块不显示）。
- Playwright 回归 web 端：require('@playwright/test')（无裸 playwright 包）；先注入 localStorage(access_token/user_info)；hover 卡片图区 `div[class*="_root_"]` 触发 .root:hover 后按钮才可点（hover 外层卡片中心会落信息区，按钮 pointer-events:none 点不动）。

## 12.5 组织内员工岗位体系（2026-09-21 P0 落地，文档 docs/平台角色边界规范化.md）
- **双轴模型**：平台身份 `User.role`（不动）× 组织内岗位 `OrgStaff.staffRole`。员工沿用 USER 身份，不新增 STAFF 角色（会冲击 ROLE_HOME/canSeeByRole/getAccess/RolesGuard/DataScope 全线）。
- **一表统三层**：`model OrgStaff`（orgType=PROVIDER|AGENT|CONSOLE，orgId；CONSOLE 固定 `'console'`）。存量 `ProviderTeamMember` **P2 已删表**（一次性迁移脚本 `migrate-team-to-org-staff.mjs` 同步删除）；对外契约不变（响应补 `teamRole` = `staffRole` 别名）。
- **岗位字典唯一真值源（P2）**：`packages/core/src/staff-roles.ts`，导出 `OrgType` / `TEAM_SVC_META` / `PROVIDER_ROLE_META` / `AGENT_ROLE_META` / `CONSOLE_ROLE_META` / `STAFF_ROLE_POOLS` / `STAFF_ROLE_TEMPLATES` / `staffRoleMetaOf` / `staffPermPool` / `STAFF_FORBIDDEN_PERMS` / `SCOPE_OPTS_BY_ORG` / `staffRolePool` / `validDataScope` / `checkFuncPerms` 等。前端 `apps/admin/src/config/staffRoles.ts` 退化为 `export * from '@h5design/core'` facade；服务端 `staff.service.ts` 改从 `@h5design/core` 引入（旧 `team-role.meta.ts` 已删除）。**改岗位池/职责/权限/数据范围只动 core 一处**。
- 岗位控件必须 **AutoComplete**（存量是自由文本，严格 Select 会让旧值显示为空）；服务商层岗位池随 `serviceType` 联动，15 项服务类型只有 5 项命中原型（「婚礼策划」→别名「婚庆策划」），其余走 `TEAM_DEFAULT_ROLES` fallback。
- 服务端强制：`dataScope` 按层白名单（PROVIDER self/service/provider；AGENT self/region/agent；CONSOLE self/all）；`funcPerms` 按层权限池；红线 `STAFF_FORBIDDEN_PERMS`（role:manage/settings:manage 全员禁；withdrawal:review/operate 禁于 PROVIDER）。
- 三层页面同构于 `pages/staffTeamPages.tsx`（List/Create/Member），代理商=`/agent/team`、总台=`/admin/team`、服务商=`/sp/team`。新增 `admin/*` 资源**必须同时加进 accessControlProvider 的 ADMIN-only 白名单**，否则 `admin/*` 兜底 fail-closed 会把菜单藏掉。
- **P0+P1+P2 已落地（2026-09-21）**：P1 员工登录与鉴权门控全通（要点同上）；P2 岗位字典统一到 `packages/core/src/staff-roles.ts` 单一真值源、删 `team-role.meta.ts` 与 `ProviderTeamMember` 旧表（详见文档 §13.6）。**红线 R-05（DISABLED 在 login+jwt 双校验）+ R-06（停用成员从 staff 剔除）现已真正生效**。后续 P3（员工审计留痕 `AuditModule` 接入 `ProviderConsoleModule`）见文档 §10.1。
- **P1 新坑**：① R-05 只在 jwt 校验不够，必须堵在 `generateTokens()` 漏斗；② `/auth/access` staff 映射曾漏 funcPerms；③ 员工走团队接口 orgId 取 `membership.orgId`（非 `req.user.id`）；④ 同文件并行 Edit 互相覆盖老坑又复发，必须串行+Grep 抽查。

## 12 fetch 铁律 + curl 验证盲区
- 自写 fetch 封装发 JSON 字符串 body **必须显式 `Content-Type: application/json`**（fetch 默认 text/plain → NestJS parser 跳过 → 服务端空 body，报"xxx必填"400）。web 端 client.ts request() 已有默认；admin editorServices.ts authedFetch 已修（2026-09-19）。新增 fetch 封装必查。
- **curl 验证会掩盖 Content-Type 类 bug**（curl 手动带了头）——前端管线问题必须用 Playwright 走真实浏览器链路复现，看请求 body/头 + 服务端响应三元组，不要只 curl 服务端。
- 运营端 Playwright：注入 `layer.view='user'`（否则 ObjectScopeBar 不渲染）；对象搜索框 `xpath=//span[text()="搜索"]/following::input[1]`（AutoComplete data-testid 不落 input；页面首个 select 输入框是语言选择器）；antd select input 是 readonly，click+pressSequentially。
- **antd Select 展开后不能直接 `click(#id)`**（被 `.ant-select-selection-item` span 拦截）→ 点外层 `.ant-select-selector`；已展开则 `focus()` + `keyboard.type()`。长列表（>10 项）走虚拟滚动，靠后的项**必须先搜索**才点得到。AutoComplete 读全量选项前**先清空输入框**（否则被 filterOption 滤成 1 项）；读下拉项要限定 `:not(.ant-select-dropdown-hidden)`，否则混入已隐藏下拉残留。
- **i18next 默认 `nsSeparator=':'`** → 含冒号的 key（如 `pages.team.perm.order:view`）会被切成 ns+key 而查不到。逐调用传 `{ nsSeparator: false }`，**不要改全局配置**（会影响 `common:xxx` 命名空间用法）。
- `prisma generate` 若报 EPERM rename `query_engine-windows.dll.node`：先 kill 占用 :3000 的 node（DLL 被映射），再把旧 dll 改名（`mv … qe_old.node`）后重新 generate。服务端未捕获异常不打堆栈到 server.log，排查 500 优先用「分步最小复现 + 直接跑 Prisma」定位。
