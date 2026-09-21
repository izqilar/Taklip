/**
 * 一次性脚本：把「我的团队 / 岗位边界」相关 i18n 键写入运营端语言包。
 *
 * - 键为 flat dot 形式（与项目现有一致：`pages.col.action`）
 * - 只写 zh-CN 与 en；ug / kk-CN / ky-CN / uz-CN 依赖 fallbackLng:'zh-CN'
 *   （与现有 status 组同策略，见 docs/平台角色边界规范化.md §8.2）
 * - 幂等：已存在的键不覆盖
 *
 * 用法：node scripts/add-team-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = resolve(__dirname, '../src/i18n/locales');

/** 岗位/职责名属业务数据，不做 i18n；这里只翻译 UI 文案 */
const ZH = {
  'pages.team.role': '团队角色',
  'pages.team.rolePlaceholder': '如：花艺师 / 客服专员（可选择或自行填写）',
  'pages.team.duties': '职责',
  'pages.team.funcPerms': '功能权限',
  'pages.team.dataScope': '数据权限',
  'pages.team.trait': '特长',
  'pages.team.traitPlaceholder': '由服务类型自动带出，可修改',
  'pages.team.serviceType': '服务类型',
  'pages.team.name': '成员姓名',
  'pages.team.namePlaceholder': '如：古丽娜尔',
  'pages.team.phone': '手机号',
  'pages.team.accountStatus': '账号状态',
  'pages.team.colMemberNo': '成员编号',
  'pages.team.colName': '姓名',
  'pages.team.colPhone': '手机',
  'pages.team.scopeSelf': '自身',
  'pages.team.scopeService': '自身（服务域）',
  'pages.team.scopeProvider': '本服务商',
  'pages.team.scopeRegion': '本辖区',
  'pages.team.scopeAgent': '本代理商',
  'pages.team.scopeAll': '全平台',
  'pages.team.create': '＋ 新建成员',
  'pages.team.save': '保存成员',
  'pages.team.newTitle': '新建团队成员',
  'pages.team.newSub': '按服务类型配置成员岗位、职责与权限',
  'pages.team.detailTitle': '团队成员详情',
  'pages.team.detailSub': '角色化团队建设 · 按服务类型差异化岗位',
  'pages.team.searchPlaceholder': '搜索成员姓名…',
  'pages.team.filterAll': '全部',
  'pages.team.filterActive': '正常',
  'pages.team.filterPending': '待激活',
  'pages.team.filterDisabled': '停用',
  'pages.team.memberName': '成员姓名',
  'pages.team.autoNo': 'MT-（自动生成）',
  'pages.team.autoNoHint': '工号（MT-xxxx）由系统按当前最大编号自动生成，无需填写。',
  'pages.team.created': '成员已添加',
  'pages.team.removed': '成员已移除',
  'pages.team.disabled': '成员已停用',
  'pages.team.enabled': '成员已启用',
  'pages.team.disable': '停用成员',
  'pages.team.enable': '启用成员',
  'pages.team.remove': '移除成员',
  'pages.team.perm.order:view': '订单查询',
  'pages.team.perm.order:handle': '订单处理',
  'pages.team.perm.order:aftersale': '售后处理',
  'pages.team.perm.message:send': '站内信收发',
  'pages.team.perm.template:publish': '模板/服务上架',
  'pages.team.perm.content:offline': '内容下架',
  'pages.team.perm.data:export': '列表数据导出',
  'pages.team.perm.qualification:manage': '资质管理',
  'pages.action.view': '查看',
  'pages.action.cancel': '取消',
  'pages.action.back': '返回',
  'pages.msg.fixForm': '请先修正表单中的校验项',
  'pages.msg.requiredName': '请填写成员姓名',
  'pages.msg.requiredPhone': '请填写手机号',
  'pages.msg.phoneFormat': '须为 11 位数字',
  'pages.msg.requiredRole': '请填写或选择岗位',
  'pages.msg.removeFailed': '移除失败',
  'menu.admin.team': '我的团队',
  'menu.agent.team': '我的团队',
};

const EN = {
  'pages.team.role': 'Team role',
  'pages.team.rolePlaceholder': 'e.g. Florist / CS (select or type)',
  'pages.team.duties': 'Duties',
  'pages.team.funcPerms': 'Function permissions',
  'pages.team.dataScope': 'Data scope',
  'pages.team.trait': 'Specialty',
  'pages.team.traitPlaceholder': 'Auto-filled by service type, editable',
  'pages.team.serviceType': 'Service type',
  'pages.team.name': 'Name',
  'pages.team.namePlaceholder': 'e.g. Gulnar',
  'pages.team.phone': 'Phone',
  'pages.team.accountStatus': 'Account status',
  'pages.team.colMemberNo': 'Member No.',
  'pages.team.colName': 'Name',
  'pages.team.colPhone': 'Phone',
  'pages.team.scopeSelf': 'Self',
  'pages.team.scopeService': 'Own (service)',
  'pages.team.scopeProvider': 'Whole provider',
  'pages.team.scopeRegion': 'Own region',
  'pages.team.scopeAgent': 'Whole agency',
  'pages.team.scopeAll': 'All platform',
  'pages.team.create': '＋ New member',
  'pages.team.save': 'Save member',
  'pages.team.newTitle': 'New team member',
  'pages.team.newSub': 'Configure role, duties and permissions by service type',
  'pages.team.detailTitle': 'Team member detail',
  'pages.team.detailSub': 'Role-based team · differentiated by service type',
  'pages.team.searchPlaceholder': 'Search member name…',
  'pages.team.filterAll': 'All',
  'pages.team.filterActive': 'Active',
  'pages.team.filterPending': 'Pending',
  'pages.team.filterDisabled': 'Disabled',
  'pages.team.memberName': 'Member name',
  'pages.team.autoNo': 'MT- (auto)',
  'pages.team.autoNoHint': 'Member No. (MT-xxxx) is generated automatically.',
  'pages.team.created': 'Member added',
  'pages.team.removed': 'Member removed',
  'pages.team.disabled': 'Member disabled',
  'pages.team.enabled': 'Member enabled',
  'pages.team.disable': 'Disable',
  'pages.team.enable': 'Enable',
  'pages.team.remove': 'Remove member',
  'pages.team.perm.order:view': 'Order view',
  'pages.team.perm.order:handle': 'Order handle',
  'pages.team.perm.order:aftersale': 'After-sale',
  'pages.team.perm.message:send': 'Internal message',
  'pages.team.perm.template:publish': 'Publish template',
  'pages.team.perm.content:offline': 'Take down',
  'pages.team.perm.data:export': 'Export data',
  'pages.team.perm.qualification:manage': 'Qualification',
  'pages.action.view': 'View',
  'pages.action.cancel': 'Cancel',
  'pages.action.back': 'Back',
  'pages.msg.fixForm': 'Please fix the invalid fields first',
  'pages.msg.requiredName': 'Name is required',
  'pages.msg.requiredPhone': 'Phone is required',
  'pages.msg.phoneFormat': 'Must be 11 digits',
  'pages.msg.requiredRole': 'Select or type a role',
  'pages.msg.removeFailed': 'Remove failed',
  'menu.admin.team': 'My team',
  'menu.agent.team': 'My team',
};

/** 把 flat dot 键写回嵌套对象 */
function merge(target, flat) {
  let added = 0;
  let skipped = 0;
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (cur[last] === undefined) {
      cur[last] = val;
      added++;
    } else {
      skipped++;
    }
  }
  return { added, skipped };
}

for (const [lng, dict] of [['zh-CN', ZH], ['en', EN]]) {
  const file = resolve(base, lng, 'common.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const { added, skipped } = merge(json, dict);
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`✓ ${lng}: 新增 ${added} 键 · 已存在跳过 ${skipped} 键 → ${file}`);
}
