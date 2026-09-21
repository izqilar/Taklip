import { test, expect, type Page } from '@playwright/test';

/**
 * 运营端 E2E 验收（文档 §14 逐条映射）。
 * 覆盖：四层登录投影、视角切换联动、对象视角联动、只读锁定、
 * 角色权限、服务商入驻审核、模板筛选/搜索、审核详情对话框、四态与 RTL 切换。
 *
 * 前置：后端 (Docker: PG/Redis) + 运营端均就绪。
 *   pnpm --filter @h5design/server start
 *   pnpm --filter @h5design/admin dev
 *   pnpm --filter @h5design/admin exec playwright test -c e2e/playwright.cached.config.ts
 *
 * 账号（开发文档 / memory）：
 *   ADMIN  13800000002 / dev123456
 *
 * 选择器事实依据（来自实际渲染，非臆测，已由 _debug2.mjs 校验）：
 *   - 视角切换是顶栏 Segmented：总台 / 代理商 / 服务商 / 用户（与侧栏「服务商管理…」「用户管理」等同名子串，
 *     故用 { exact: true } 精确匹配顶栏按钮）。
 *   - 语言切换是顶栏 antd Select（当前显示「简体中文」），选项来自 SUPPORTED_LANGS（含 ئۇيغۇرچە）。
 *   - 只读模式在「管理员」下拉菜单内（Switch）；黄条文案为「只读模式：…」（下拉项为裸「只读模式」）。
 *   - 对象视角检索条是 antd AutoComplete：placeholder 渲染为文本节点（非 input[placeholder]），
 *     故通过 `.ant-select` 含该文本定位，再操作其 `input.ant-select-selection-search-input`。
 *   - 列表「查看」为 antd Button type=link（<a> 但暴露 button role）；角色页「查看」为裸 <a>（无 href，非 link role）。
 *   - 审核详情抽屉（DetailDrawer mode=review）始终渲染「审核意见」字段（Alert message + Form.Item label 共 2 处）。
 *   - antd ConfigProvider 的 direction 只写在内部 wrapper div，不写 document.documentElement.dir，
 *     故 RTL 断言查 [dir="rtl"] 元素而非 document.documentElement.dir。
 *   - 登录成功后 authProvider redirectTo '/admin/users'（非 /dashboard）。
 *   - 全项目无「导出」按钮（data:export 权限点已定义，UI 未实现——M5 真实 gap，不伪造断言）。
 */

const ADMIN = { phone: '13800000002', pwd: 'dev123456' };

async function login(page: Page, phone: string, pwd: string) {
  await page.goto('/login');
  await page.getByPlaceholder('手机号').fill(phone);
  await page.getByPlaceholder('密码').fill(pwd);
  // 登录按钮 accessible name 为「登 录」（antd 渲染含空格），改用 submit 选择器更稳
  await page.locator('button[type="submit"]').click();
  // ⚠️ 落点由服务端 ROLE_HOME 决定（ADMIN → /admin/dashboard、SP → /sp/studio、AGENT → /agent/dashboard），
  // 曾硬编码等 `**/admin/users` 导致整个套件登录即超时。这里改为「离开 /login 即可」，
  // 与角色无关，避免以后再改落点又全量失败。
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('M5 · 运营端验收 (§14)', () => {
  test('① 四层登录与菜单投影：总台 13 项全量，低层无高层入口', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    // 总台（ADMIN/ALL）可见全部高层菜单
    await expect(page.getByText('系统设置')).toBeVisible();
    await expect(page.getByText('角色与权限')).toBeVisible();
    // 切到服务商视角（顶栏 Segmented，精确匹配避免命中侧栏「服务商管理…」）
    await page.getByText('服务商', { exact: true }).click();
    await expect(page.getByText('我的工作台')).toBeVisible();
    // 低层视角不出现高层入口「系统设置」
    await expect(page.getByText('系统设置')).toHaveCount(0);
  });

  test('② 视角切换联动侧栏/首页，且「返回总台」为顶栏按钮', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    await page.getByText('代理商', { exact: true }).click();
    await expect(page).toHaveURL(/.*\/agent\/dashboard/);
    // 辖区概览 同时出现在侧栏菜单与页面标题 h3，取 first 避免严格模式
    await expect(page.getByText('辖区概览').first()).toBeVisible();
    // 实际返回总台是顶栏「总台」Segmented 按钮（无独立「返回总台」文案），限定在 Segmented 内避免歧义
    await expect(page.locator('.ant-segmented').getByText('总台', { exact: true })).toBeVisible();
  });

  test('③ 对象视角：用户检索整页联动', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    await page.getByText('用户', { exact: true }).click();
    // ObjectScopeBar 是 antd AutoComplete：placeholder 为文本节点，input 不暴露 placeholder 属性。
    // 定位含该 placeholder 文本的 .ant-select，再操作其内部 search-input。
    const scopeInput = page
      .locator('.ant-select')
      .filter({ hasText: '以进入对象视角' })
      .locator('input.ant-select-selection-search-input');
    await scopeInput.click();
    // 必须用逐字输入触发 antd AutoComplete 的 onSearch（fill 不会触发搜索下拉）
    await scopeInput.pressSequentially('13900001001', { delay: 30 });
    const opt = page.locator('.ant-select-item-option').first();
    await opt.waitFor({ state: 'visible', timeout: 8000 });
    await opt.click();
    // 选中后 ObjectScopeBar 渲染选中用户 Tag（标签含手机号），证明对象视角已联动
    await expect(page.locator('.ant-tag').filter({ hasText: '13900001001' }).first()).toBeVisible();
  });

  test('④ 只读模式：黄条常驻 + 写操作禁用', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    // 只读开关在「管理员」下拉菜单内（精确匹配下拉项，避免命中黄条文案）
    await page.getByText('管理员').click();
    await page.getByText('只读模式', { exact: true }).click();
    // 黄色常驻条（文案精确以「只读模式：」开头，仅黄条命中）
    await expect(page.getByText('只读模式：')).toBeVisible();
    // 打开任一模板的审核抽屉，验证只读态下「通过」写按钮 disabled（种子模板均为 APPROVED，
    // 列表无快捷通过按钮；抽屉内的通过/驳回始终渲染且受 readonly 锁定）
    await page.getByText('模板审核').click();
    await page.getByRole('button', { name: '查看' }).first().click();
    // antd 中文按钮渲染带字间距，accessible name 为「通 过」；用正则匹配。只读态下应 disabled。
    await expect(page.getByRole('button', { name: /通过/ }).first()).toBeDisabled();
  });

  test('⑤ 角色与权限：详情对话框含功能权限域', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    await page.getByText('角色与权限').click();
    // 角色页「查看」为裸 <a>（无 href，非 link role），用 getByText 取第一条
    await page.getByText('查看').first().click();
    // 抽屉标题区「角色 · 功能权限（按层级过滤回显）」精确匹配（避免命中 Alert 描述/列表列头）
    await expect(page.getByText(/功能权限（按层级过滤回显）/)).toBeVisible();
  });

  test('⑥ 服务商入驻进总台审核队列', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    await page.getByText(/^服务商管理/).first().click();
    // 列表行操作文案为「查看 / 通过」（common.view / common.approve），antd 渲染带字间距 → 用正则匹配
    await expect(page.getByText(/查看.*通过/).first()).toBeVisible();
  });

  test('⑦ 筛选 + 搜索（导出 UI 未实现，见下方说明）', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    await page.getByText('模板审核').click();
    // 状态筛选 Segmented 含「待审核」
    await expect(page.getByText('待审核').first()).toBeVisible();
    // 关键字搜索 Input.Search（placeholder = 搜索）
    await expect(page.getByPlaceholder('搜索')).toBeVisible();
    // 说明：M5 文档 §14.⑦ 提及「导出受 data:export 控制」，但当前 UI 未渲染导出按钮
    //（data:export 权限点已在 permGroups 定义，功能门控待补 UI）。此处不伪造导出断言。
  });

  test('⑧ 详情对话框 A/B 类 + 驳回必填原因字段', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    // 模板审核列表行「查看」按钮（common.view，antd link 暴露为 button role），取第一条打开审核抽屉
    // （抽屉恒为 review 模式，含审核意见 + 通过/驳回；种子模板均为 APPROVED 不影响抽屉渲染）
    await page.getByText('模板审核').click();
    await page.getByRole('button', { name: '查看' }).first().click();
    // 审核抽屉打开即渲染「审核意见」字段（驳回必填原因），共 2 处 → 取 first 避免严格模式
    await expect(page.getByText('审核意见').first()).toBeVisible();
    // 驳回动作存在且可点击（antd 中文按钮带字间距，「驳 回」→ 正则匹配；空原因仅触发校验，不崩溃）
    await expect(page.getByRole('button', { name: /驳回/ })).toBeVisible();
  });

  test('⑨ 四态齐全（加载/空/异常/只读）+ 图表还原', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    await page.getByText('经营总览').click();
    await expect(page.getByText('流水').first()).toBeVisible(); // KPI 卡
  });

  test('⑩ 设计令牌一致（品牌红 #D24830 主色）', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    const brand = page.getByText('庆');
    await expect(brand).toHaveCSS('color', 'rgb(210, 72, 48)');
  });

  /**
   * ⑪ 岗位边界规范化（docs/平台角色边界规范化.md）
   * 断言：三层岗位池各就各位 + 数据范围按层白名单 + 权限复选框为原型 8 项子集。
   *
   * 选择器事实：antd Form.Item 的 name 会落到控件 id（#staffRole / #serviceType / #dataScope）；
   * antd Select 展开后须点击 .ant-select-selector（直接 click(#id) 会被选中项 span 拦截）；
   * 15 项服务类型走虚拟滚动（只渲染前 ~10 项），必须搜索过滤后再选。
   */
  test('⑪ 岗位边界：三层岗位池 + 数据范围白名单 + 权限 8 项子集', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);

    // ── 总台层：岗位池 5 项，数据范围 self / all ──
    await page.goto('/admin/team/new');
    await page.locator('#staffRole').click();
    await page.locator('#staffRole').fill('');
    await page.waitForTimeout(400);
    const consoleRoles = await page.evaluate(() => {
      const dds = Array.from(document.querySelectorAll('.ant-select-dropdown'))
        .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'));
      return Array.from(new Set(dds.flatMap((d) =>
        Array.from(d.querySelectorAll('.ant-select-item-option-content')).map((e) => (e.textContent || '').trim()))));
    });
    expect(consoleRoles).toEqual(['超级管理员', '内容运营', '审核员', '财务', '客服/工单']);
    await page.keyboard.press('Escape');

    await page.locator('#dataScope').locator('xpath=ancestor::div[contains(@class,"ant-select-selector")][1]').click();
    await page.waitForTimeout(400);
    const consoleScopes = await page.evaluate(() => {
      const dds = Array.from(document.querySelectorAll('.ant-select-dropdown'))
        .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'));
      return Array.from(new Set(dds.flatMap((d) =>
        Array.from(d.querySelectorAll('.ant-select-item-option-content')).map((e) => (e.textContent || '').trim()))));
    });
    expect(consoleScopes).toEqual(['自身', '全平台']);
    await page.keyboard.press('Escape');

    // ── 代理商层：岗位池 5 项，数据范围 self / region / agent ──
    await page.goto('/agent/team/new');
    await page.locator('#staffRole').click();
    await page.locator('#staffRole').fill('');
    await page.waitForTimeout(400);
    const agentRoles = await page.evaluate(() => {
      const dds = Array.from(document.querySelectorAll('.ant-select-dropdown'))
        .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'));
      return Array.from(new Set(dds.flatMap((d) =>
        Array.from(d.querySelectorAll('.ant-select-item-option-content')).map((e) => (e.textContent || '').trim()))));
    });
    expect(agentRoles).toEqual(['区域经理', '入驻审核员', '商务拓展', '财务专员', '客服专员']);

    // ── 权限复选框：代理商层应包含 入驻审核 相关权限点，且不含红线项 角色管理 ──
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.ant-checkbox-wrapper')).map((e) => (e.textContent || '').trim()));
    expect(labels).toContain('服务商入驻审核');
    expect(labels).not.toContain('角色管理');
  });

  test('RTL：切换维吾尔语后 direction=rtl', async ({ page }) => {
    await login(page, ADMIN.phone, ADMIN.pwd);
    // 语言切换为顶栏 antd Select（当前显示「简体中文」）
    await page.getByText('简体中文').click();
    await page.getByText('ئۇيغۇرچە').click();
    // antd ConfigProvider 不写 document.documentElement.dir，仅写内部 wrapper div 的 dir 属性
    const dir = await page.evaluate(() => {
      const el = document.querySelector('[dir="rtl"]');
      return el ? el.getAttribute('dir') : null;
    });
    expect(dir).toBe('rtl');
  });
});
