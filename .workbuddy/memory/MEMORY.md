# 项目长期记忆 — 庆柬云 / TAKLIP Cloud（精简版 2026-09-23）

## 0 架构 / 角色 / 视角
- 仓库 github.com/izqilar/Taklip（git 托管，分支 main）。apps/server(:3000 NestJS+Prisma+PG+Redis) / admin(:5174 Refine+antd) / web(:5173 React18+Vite+Konva9+GSAP+i18n 6语言含RTL)。包：@h5design/core(改后必重建dist)/editor/render/ui。
- 角色 USER/SERVICE_PROVIDER/AGENT/ADMIN（原 DESIGNER→SERVICE_PROVIDER）；权限真相源 DataScopeInterceptor(ALL/REGION/SELF)；金额以分存。四层视角 localStorage `layer.view`。
- ADMIN 视察代操作经 `?subject=`：前端 dataProvider `withSubject(path,method)` 拼 subject（GET/写各有白名单）；**服务端 subject 解析旧仅认 ADMIN，现已扩展 AGENT（带辖区校验）**。
- ★视察 vs 自身视角铁律（2026-09-23 P0）：`?subject=` 视察机制**仅属 ADMIN**。判断"是否自身"用 `layerContext.isOwnView = (view === viewOfRole(role))`：ADMIN 仅 console 是自身；真实 SERVICE_PROVIDER/AGENT/USER 登录后 view 即等于自身角色=自身工作台，**必须直接展示自身数据、绝不强制选 subject**。InspectionGate/ProfilePage/useBadges 一律按 isOwnView 放行，仅 ADMIN 在非自身视角视察他人时才要求 objectScope。AdminLayout 检索条显隐= `view !== viewOfRole(role)`。后端 provider/agent console 端点无 subject 即读 req.user 自身（已验证）。
- 主题朱砂 #c24b2e；顶栏/登录红 #c81e42（两套勿混）。未实现功能统一「该功能即将上线」。

## 0.5 git / 推送
- 沙箱无 GitHub 凭据/SSH（~/.ssh 空、22 关闭），HTTPS push 需用户提供令牌。fine-grained PAT 坑：`permissions.push=true` 不代表可写；传输/API 被拒(403 "denied to izqilar")多为令牌 Contents 未设 Read and write。判定：curl 建引用 403=无写权。令牌仅用于一次性 `git -c credential.helper= push`，不写 .git/config。

## 1 环境 / 启动（★重启铁律）
- DB postgresql://h5design:h5design_dev_2026@localhost:5432/h5design_platform；密码 Test123456。账号：ADMIN 13800000002、SP 13800000001(dev123456)、USER 13900001001~003(Test123456)。
- startup.ps1 启动 detached；:3000 跑 `node dist/main`（watchdog 每5s探活重启）。**改 server 源码→`pnpm --filter @h5design/server run build:compiled`→kill :3000 让 watchdog 拉新代码**（只改源码不 build=线上旧行为）。改 core→重建 dist；prisma schema→regenerate。验证 `pnpm --filter @h5design/{web,admin,editor,render,ui,server} run typecheck`。

## 2 draft/live 口径 ★
加载一律 `draftSchema ?? schema`（effectiveSchema）；保存只写草稿；发布=原子替换 schema+清草稿。列表行归一后抹 draftSchema，SERVICE_SELECT 须含 draftSchema:true。

## 3 编辑器内核 / 渲染铁律
只认扁平属性、从不读 el.props；仅 visible===false 隐藏。文本排版复刻 Konva(render/src/lib/textLayout.ts)：宽度含尾部 letterSpacing、固定 height 超行 break、容器 overflow:visible；轮廓 2×宽+lineJoin=round。justify 由 installTextJustifySupport 替换 _sceneFunc（末行不拉伸）；RTL textAlign=right。复制/剪切/粘贴/右键菜单已落地。画布缩放=Konva 内部 scale。

## 4 导出 / 字体
图片=服务端渲染(/export/prepare→image，token 参数必须叫 `et`，puppeteer-core+ffmpeg)；视频/GIF=客户端 exportProjectToVideo（不经服务端）。付费字体授权决定分辨率/水印；字体目录真值 getFontCatalog()+useSyncExternalStore。

## 5 通用坑（铁律）
- 同文件一条消息并行多 Edit 会互相覆盖→必须串行+Grep/Read 抽查落盘。
- i18next `t()` 缺 key 返回原 key，`t(x)||'兜底'` 永不生效→**必须 `t(x,{defaultValue:'…'})`**。
- i18next keySeparator='.' 只走嵌套路径：admin common.json 的 pages 下**扁平点号键（如 "msg.authorityNotice"）不可达**，且会被同名嵌套对象（pages.msg:{}）遮蔽→新增文案一律写嵌套结构，勿再造扁平点号键（2026-09-23 业务消息类型列漏键值即此因，6 语言包已补 pages.msg.authorityNotice/generalMsg）。
- 枚举标签唯一真值 config/labels.ts（存键调用时 t()）；页面内自建 Record 不得模块级冻结 t()（messages.tsx 已改存键+调用时解析）。
- Nest 装饰器顺序无关但 TS 必选不能跟可选后(@Query 可选放 @Body/@Res 后)。
- web/admin 登录失败先查 :3000；运营端 vite 不代理 /api（直连 :3000）。

## 6 UI 对齐（真值=运营端）
web 个人中心 grid `md:grid-cols-[240px_1fr]` 禁 max-w-7xl 居中；根 fontSize14；字号令牌 14/菜单13.5/表头12.5/面板头14.5/页头18/KPI27。金额 formatCents；手机号 maskPhone；fetch 头 authHeaders()。

## 7 统一登录落点
ROLE_HOME：USER→web /user/works；SP→admin /sp/studio；AGENT/ADMIN→admin dashboard。跨端票据 `?ticket=`(45s 单次)。运营端登录遇 USER 静默 replace(bridge)。

## 8 i18n / 权限
6 语言；admin fallback zh-CN、web en。admin 枚举标签真值 `config/labels.ts`（存 i18n 键）。accessControlProvider 对 admin/* 未映射资源 fail-closed；改权限须同步后端 getAccess。

## 9 历史修复索引（一句话）
#42 resolveShadow 阴影门控；#43 字体目录懒拉取；#44 kashida；#45 复制粘贴；#46 justify 段首空格。2026-09-19 视察视角全链路补 subject 支持。

## 11 SchemaThumbnail 铁律
根节点 `absolute inset-0`：**父容器必须有 position(relative)**，否则铺满全屏（web 详情弹窗曾"整页被作品铺满"）。`/api/projects` 列表 select 必含 publishCode。`SchemaThumbnail` 7 处使用点已核对。

## 12 fetch 铁律 + 验证盲区
- 自写 fetch 发 JSON 串 body **必须显式 `Content-Type: application/json`**（否则 Nest 解析空 body→400）。
- curl 验证会掩盖 Content-Type 类 bug——前端管线问题必须用 Playwright 走真实浏览器复现。
- 运营端 Playwright：注入 `layer.view='user'`；对象搜索框 AutoComplete（data-testid 不落 input）；antd Select 点 `.ant-select-selector` 外层、长列表先搜索；AutoComplete 读全量前先清空输入框。
- i18next 默认 `nsSeparator=':'`→含冒号 key 被切分；逐调用传 `{ nsSeparator: false }`，勿改全局。

## 12.5 组织内员工岗位体系（2026-09-21~22 落地）
- 双轴：平台身份 `User.role` × 组织内岗位 `OrgStaff.staffRole`（员工沿用 USER，不新增 STAFF 角色）。
- 岗位字典唯一真值源 `packages/core/src/staff-roles.ts`；前端 `staffRoles.ts`=facade；server `staff.service.ts` 从 core 引（旧 `team-role.meta.ts` 已删）。改岗位池只动 core 一处。
- 岗位控件必须 AutoComplete；服务商层随 serviceType 联动。
- **入口收口（2026-09-22 最终态）**：三层员工管理合并进「角色与权限」页 `/admin/roles` `/agent/roles` `/sp/roles`（sp/roles 为合并新增菜单项）。**团队资源名是 API 路径 `provider/team` 非 `sp/team`**。
- 权限边界：`team:manage` 不在任何层 staffPermPool 内 + admin/roles 仅 ADMIN 可见 ⇒ 团队管理只能各层拥有者执行（R-03 防自我提权，刻意设计）。
- 员工操作审计 P3：AuditModule 接 StaffModule，create/update/remove/bindUser 写 AuditLog；可视化端点 `GET {provider|agent|admin}/team/:id/audit-logs`。

## 12.6 入驻管线单一真源（2026-09-25 落地，docs/服务商入驻与归属管线改造方案.md + docs/新客户注册为代理商或服务商方案.md）
- **铁律**：注册只建 `USER`；`role`/`providerStatus` 变更**只能**在总台终审 `APPROVED` 落地（`user-console.applyQualificationResult`）。自服务 `applyForProvider` / `submit-provider-review` 已收口（前者只建申请，后者已删）。
- 两段审：代理一审 `FIRST_PENDING→FIRST_PASSED/REJECTED`（`PATCH /api/agent/qualifications/:id/review`，只设标记）；总台终审 `→APPROVED/REJECTED`（`POST /api/user/qualifications/:id/review`，`@Roles('ADMIN')`）。**驳回原因两侧均必填**。
- 材料前置：申请即带主体材料（`MATERIALS_REQUIRED=true`）；服务商 `regionPath` **必填**（否则产出无人管辖的孤立主体）；代理商辖区须三级且不重叠（提交时预检 + 终审前强校验，DB 不加唯一约束——同辖区多服务商共用）。
- 终审落地连带：`regionPath` 固化 + `agentId` 最长前缀匹配 + ProviderWallet + `type=MAIN` 主合同 + 实名置 APPROVED；代理商另出 `type=AGENCY` 代理协议（甲方恒为平台，代理商非签约方）。
- 付费闸门：存在 MAIN 合同时须 `EFFECTIVE` 才可上架付费（`template.service` + `provider-console.createService`，后者曾绕过校验已补齐）。合同推进 `POST /api/provider/contracts/:id/advance` **必须传 body.stage**（APPROVING/EFFECTIVE）。
- 风险预检 `GET /api/admin/qualifications/:id/precheck` **只标记不自动放行**；一审质量护栏 `GET /api/admin/agent-review-quality`。badges 细分 `onboardingFirst`/`onboardingFinal`。
- 重提：`resubmitOfId` 仅可基于本人 REJECTED/WITHDRAWN，生成新申请。招商意向转入驻**不代客建申请**，只置 WON + 邀请链接。

## 13 用户视角侧栏角标（2026-09-23 新增）
- `GET /api/console/badges` 按被视察对象/登录者作用域下发菜单待办数。
- 用户视角三项：通知公告 `noticeUnread`(本人可见已发布 ANNOUNCEMENT 且未读) / 业务消息 `messagePending`(非 ANNOUNCEMENT 未读=待处理) / 我的反馈 `feedbackPending`(本人发起未关闭工单=待回复)。仅当 me.role==='USER' 时统计，其余恒 0。
- 角标真值键：`BadgeKey`(resources.tsx) + `MenuBadges`(useBadges.ts)，前端 `LayerSider` 按 `meta.badgeKey` 渲染；非总台未选对象一律 0（InspectionGate 门控）。
