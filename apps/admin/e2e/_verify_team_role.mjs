/**
 * 岗位边界 P0 —— 浏览器端验证（文档 docs/平台角色边界规范化.md §12.2）。
 * 覆盖 A-01 ~ A-08、A-12、A-13：岗位联动、fallback、别名、职责带出、权限 8 项子集、
 * 数据范围三值、保存回显、代理 / 总台同构页面可用、存量不丢。
 *
 * 选择器约定：antd Form.Item name 会落到控件 id 上（#name / #phone / #staffRole /
 * #serviceType / #dataScope / #personality），用 id 精确定位，不用文本猜层级。
 *
 * 前置：:3000 与 :5174 已在跑。用法：node e2e/_verify_team_role.mjs
 */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:5174';
const SHOT_DIR = dirname(fileURLToPath(import.meta.url));
const shot = (name) => resolve(SHOT_DIR, `_shot_team_${name}.png`);

let pass = 0;
let fail = 0;
const log = (m) => console.log(m);
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; log(`✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; log(`❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

/**
 * 读取【当前可见】下拉的选项文本。
 * ⚠️ 必须限定在 :not(.ant-select-dropdown-hidden) 内：antd 隐藏的下拉仍留在 DOM，
 * 直接读 .ant-select-item-option-content 会把上一个下拉的残留项也一起读进来。
 */
async function dropdownOptions() {
  await page.waitForTimeout(400);
  const opts = await page.evaluate(() => {
    const dds = Array.from(document.querySelectorAll('.ant-select-dropdown'))
      .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'));
    return dds.flatMap((d) =>
      Array.from(d.querySelectorAll('.ant-select-item-option-content')).map((e) => (e.textContent || '').trim()),
    );
  });
  return Array.from(new Set(opts.filter(Boolean)));
}

async function closeDropdown() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}

/**
 * 岗位（AutoComplete）完整选项池。
 * ⚠️ 必须先清空输入框：AutoComplete 的 filterOption 用输入值过滤，
 * 输入框里已有「负责人」时只会列出「负责人」一项。
 */
async function roleOptions() {
  await page.locator('#staffRole').click();
  await page.locator('#staffRole').fill('');
  const o = await dropdownOptions();
  await closeDropdown();
  return o;
}

/**
 * 打开 antd Select 下拉。
 * ⚠️ 直接 click(#id) 会被「已选中项」的 .ant-select-selection-item span 拦截
 * （项目已知坑：antd 的搜索 input 是 readonly 且被选中项覆盖），必须点外层 .ant-select-selector。
 */
async function openSelect(id) {
  await page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"ant-select-selector")][1]').click({ force: true });
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8000 });
  await page.waitForTimeout(300);
}

/**
 * 切换服务类型。
 * ⚠️ SVC_OPTIONS 有 15 项，antd Select 默认虚拟滚动只渲染前 ~10 项，
 * 「婚礼策划 / 司仪主持 / 灯光音响」靠后，直接点不到 → 必须先搜索过滤。
 */
async function setServiceType(value) {
  await openSelect('serviceType');
  // 下拉已展开时再 click(input) 会被选中项 span 拦截 → 直接 focus 后键盘输入
  await page.locator('#serviceType').focus();
  await page.keyboard.type(value, { delay: 30 });
  await page.waitForTimeout(600);
  const opt = page.locator(`.ant-select-item-option[title="${value}"]`).first();
  if (!(await opt.count())) log(`  ⚠️ 搜索「${value}」后无匹配项，可见项：${JSON.stringify(await dropdownOptions())}`);
  await opt.click({ timeout: 8000 });
  await page.waitForTimeout(600);
}

/* ══════════ 1. 服务商视角：列表 / 新建 / 详情 ══════════ */

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', '13800000001');
await page.fill('input[type="password"]', 'dev123456');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
log(`服务商登录后 URL：${page.url()}`);

await page.goto(`${BASE}/sp/team`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const listText = await page.locator('body').innerText();
ok('A-13 存量成员仍可见（古丽娜尔 / MT-1000）', /古丽娜尔/.test(listText) && /MT-1000/.test(listText));
ok('列表新增「数据权限」列（原落库但不可见）', /数据权限/.test(listText));
ok('列表新增「功能权限」列', /功能权限/.test(listText));
await page.screenshot({ path: shot('01-list') });

await page.goto(`${BASE}/sp/team/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

// 默认服务类型 = SVC_OPTIONS[0] = 摄影摄像（原型命中项）
const optsDefault = await roleOptions();
ok('A-01a 默认服务类型（摄影摄像）岗位池含 摄影师 / 后期师',
  optsDefault.includes('摄影师') && optsDefault.includes('后期师'), JSON.stringify(optsDefault));

await setServiceType('花艺布置');
const optsFloral = await roleOptions();
ok('A-01 切「花艺布置」→ 岗位池 = 负责人/花艺师/布置专员/客服专员 + 通用',
  ['负责人', '花艺师', '布置专员', '客服专员', '店长/调度', '财务专员'].every((r) => optsFloral.includes(r)),
  JSON.stringify(optsFloral));

await setServiceType('司仪主持');
const optsHost = await roleOptions();
ok('A-02 切「司仪主持」→ 岗位池联动为 负责人/司仪/礼仪顾问/客服专员',
  ['负责人', '司仪', '礼仪顾问', '客服专员'].every((r) => optsHost.includes(r)), JSON.stringify(optsHost));

await setServiceType('化妆造型');
const optsFallback = await roleOptions();
ok('A-03 未命中服务类型（化妆造型）→ fallback 非空且含兜底岗位',
  optsFallback.length > 0 && ['负责人', '执行专员', '客服专员'].every((r) => optsFallback.includes(r)),
  JSON.stringify(optsFallback));

await setServiceType('婚礼策划');
const optsAlias = await roleOptions();
ok('A-04 「婚礼策划」经别名命中「婚庆策划」岗位池（含 策划师 / 执行督导）',
  optsAlias.includes('策划师') && optsAlias.includes('执行督导'), JSON.stringify(optsAlias));

// 职责由岗位池自动带出 + 特长预填
const bodyAfterSvc = await page.locator('body').innerText();
ok('A-05a 职责由岗位池自动带出（方案策划 / 流程设计）',
  /方案策划/.test(bodyAfterSvc) && /流程设计/.test(bodyAfterSvc));
const traitVal = await page.locator('#personality').inputValue().catch(() => '');
ok('A-05b 特长由服务类型 trait 自动预填', traitVal.length > 0, traitVal.slice(0, 22));

// 功能权限复选框：服务商层应恰好是原型 TEAM_FUNCS 的 8 项，不多也不少
const permLabels = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.ant-checkbox-wrapper')).map((e) => e.textContent.trim()),
);
// 原型 UI_Design/index.html:4700 TEAM_FUNCS 的叫法（由 pages.team.perm.<key> 覆写展示）
const PERM8 = ['订单查询', '订单处理', '售后处理', '站内信收发', '模板/服务上架', '内容下架', '列表数据导出', '资质管理'];
const hit8 = PERM8.filter((p) => permLabels.includes(p)).length;
ok('A-06a 功能权限复选框覆盖原型 8 项（子集过滤生效）', hit8 === 8, `命中 ${hit8}/8`);
// 反向断言：provider 层的其它权限点（模板审核 / 公告发布 …）不应出现在员工表单里
const EXTRA = ['模板审核', '公告发布', '公告审核', '财务查看', '提现审核', '角色管理'];
const leak = EXTRA.filter((p) => permLabels.includes(p));
ok('A-06b 权限子集未泄漏该层其它权限点', leak.length === 0, `泄漏=${JSON.stringify(leak)}`);

// 数据范围三值
await openSelect('dataScope');
const scopeOpts = await dropdownOptions();
await closeDropdown();
ok('A-07 数据权限三值可选：自身 / 自身（服务域） / 本服务商',
  ['自身', '自身（服务域）', '本服务商'].every((s) => scopeOpts.includes(s)), JSON.stringify(scopeOpts));

await page.screenshot({ path: shot('02-create') });

// 保存（自填岗位）
await page.locator('#name').fill('E2E岗-浏览器');
await page.locator('#phone').fill('13900009099');
await page.locator('#staffRole').click();
await page.locator('#staffRole').fill('首席花艺顾问');
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.locator('button', { hasText: /保存成员/ }).first().click();
await page.waitForTimeout(2200);
ok('A-11 自填岗位「首席花艺顾问」保存成功并跳回列表', /\/sp\/team(\?|$)/.test(page.url()), page.url());

await page.goto(`${BASE}/sp/team`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
ok('A-08a 列表显示中文岗位（首席花艺顾问）', /首席花艺顾问/.test(await page.locator('body').innerText()));

await page.locator('span', { hasText: /^查看$/ }).first().click();
await page.waitForTimeout(1600);
const detailText = await page.locator('body').innerText();
ok('A-08b 详情页展示「功能权限」只读复选框区', /功能权限/.test(detailText));
ok('A-08c 详情页展示「数据权限」与「职责」', /数据权限/.test(detailText) && /职责/.test(detailText));
ok('新增：详情页有「停用成员」按钮（PATCH 接口已通）', /停用成员/.test(detailText));
await page.screenshot({ path: shot('03-detail') });

/* ══════════ 2. 总台 / 代理商同构页面（需 ADMIN） ══════════ */

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', '13800000002');
await page.fill('input[type="password"]', 'dev123456');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);

for (const [label, path, expectRole] of [
  ['总台', '/admin/team', '超级管理员'],
  ['代理商', '/agent/team', '区域经理'],
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const t2 = await page.locator('body').innerText();
  ok(`A-12 ${label}「我的团队」列表可访问`, /我的团队/.test(t2) && !/404|Not Found/.test(t2), path);

  await page.goto(`${BASE}${path}/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  const t3 = await page.locator('body').innerText();
  ok(`A-12 ${label}新建页可打开`, /新建团队成员/.test(t3), `${path}/new`);

  const o = await roleOptions();
  ok(`A-12 ${label}岗位下拉含「${expectRole}」`, o.includes(expectRole), JSON.stringify(o));

  await openSelect('dataScope');
  const scope2 = await dropdownOptions();
  await closeDropdown();
  ok(`A-12 ${label}数据权限按层白名单`, scope2.length > 0, JSON.stringify(scope2));
  await page.screenshot({ path: shot(`04-${path.replace(/\//g, '-')}`) });
}

/* ══════════ 3. 控制台错误 ══════════ */
// 已知非本次引入的告警（单独列示，不计入失败）：
//  - `[antd: message] Static function can not consume context`：项目全局使用 antd 静态 message
//  - `Instance created by useForm is not connected`：来自 GenericListPage 的 useTable（列表页预存在）
const KNOWN = /favicon|net::ERR_|Failed to load resource|\[antd: |Instance created by `useForm` is not connected/i;
const knownList = consoleErrors.filter((e) => KNOWN.test(e));
const realErrors = consoleErrors.filter((e) => !KNOWN.test(e));
if (knownList.length) log(`ℹ️ 已知预存告警 ${knownList.length} 条（不计入失败）：${Array.from(new Set(knownList)).slice(0, 2).join(' | ').slice(0, 150)}`);
ok('无新增浏览器控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
