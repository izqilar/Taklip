/**
 * verify_invitation_center_alignment.mjs
 * ---------------------------------------------------------------------------
 * 校验「运营端用户视角 · 请柬事务中心」三模块是否与 web 端「请柬事务中心」逐模块对齐。
 *
 * ★ 唯一基准：apps/web/src/user/** 源码（非截图、非运营端旧实现）。
 *   每条校验同时给出 web 基准锚点与 admin 实现锚点，两者都命中才算 PASS；
 *   若 web 基准锚点缺失 → BASE_FAIL（说明基准漂移，需人工复核）。
 *
 * 用法：node scripts/verify_invitation_center_alignment.mjs
 * ---------------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const WEB = {
  fields: 'apps/web/src/user/TemplateFieldDesignPage.tsx',
  lists: 'apps/web/src/user/GuestLists.tsx',
  editor: 'apps/web/src/user/GuestListEditor.tsx',
  jobs: 'apps/web/src/user/InvitationJobs.tsx',
  tplPicker: 'apps/web/src/user/InvitationTemplatePicker.tsx',
  personPicker: 'apps/web/src/user/PersonPickerDialog.tsx',
  nav: 'apps/web/src/user/shared.tsx',
};

const ADMIN = {
  fields: 'apps/admin/src/pages/user/UserTemplateFieldDesign.tsx',
  lists: 'apps/admin/src/pages/user/UserGuestLists.tsx',
  editor: 'apps/admin/src/pages/user/UserGuestListEditor.tsx',
  jobs: 'apps/admin/src/pages/user/UserInvitationCenter.tsx',
  tplPicker: 'apps/admin/src/pages/user/UserInvitationTemplatePicker.tsx',
  personPicker: 'apps/admin/src/pages/user/UserPersonPickerDialog.tsx',
  shared: 'apps/admin/src/pages/user/invitationShared.tsx',
  app: 'apps/admin/src/App.tsx',
  resources: 'apps/admin/src/config/resources.tsx',
};

/**
 * need：全部命中（AND）。any：任一命中（OR，用于等价写法/多语言回退）。
 */
const CHECKS = [
  /* ───────────────────────── 模块一 · 模板字段设计 ───────────────────────── */
  {
    id: 'A1',
    title: '模板列表页：区分系统默认模板 vs 用户自建模板',
    web: { file: WEB.fields, need: ['isSystem', 'systemTag'] },
    admin: { file: ADMIN.fields, need: ['isSystem', 'SystemTag'] },
  },
  {
    id: 'A2',
    title: '模板列表页：补齐「新建模板」入口',
    web: { file: WEB.fields, need: ['newTemplate', '新建模板', 'setMode(\'new\')'] },
    admin: { file: ADMIN.fields, need: ['新建模板', 'setMode(\'new\')'] },
  },
  {
    id: 'A3',
    title: '模板列表行操作：查看 / 编辑 / 删除 三件套',
    web: { file: WEB.fields, need: ['setMode(\'view\')', 'setMode(\'edit\')', 'action.delete'] },
    admin: { file: ADMIN.fields, need: ['setMode(\'view\')', 'setMode(\'edit\')', '删除'] },
  },
  {
    id: 'A4',
    title: '系统模板不可编辑 / 不可删除（canEdit 守卫）',
    web: { file: WEB.fields, need: ['const canEdit = (tpl: TemplateView) => !tpl.isSystem'] },
    admin: { file: ADMIN.fields, need: ['canEdit', 'isSystem'] },
  },
  {
    id: 'A5',
    title: '编辑页复用 @h5design/ui TemplateFieldDesign（字段增删改）',
    web: { file: WEB.fields, need: ['from \'@h5design/ui\'', '<TemplateFieldDesign'] },
    admin: { file: ADMIN.fields, need: ['@h5design/ui', '<TemplateFieldDesign'] },
  },
  {
    id: 'A6',
    title: '新建页支持模板命名（showName + nameValue / onNameChange）',
    web: { file: WEB.fields, need: ['showName', 'nameValue', 'onNameChange'] },
    admin: { file: ADMIN.fields, need: ['showName', 'nameValue', 'onNameChange'] },
  },
  {
    id: 'A7',
    title: '四种模式 list / view / edit / new',
    web: { file: WEB.fields, need: ["type Mode = 'list' | 'view' | 'edit' | 'new'"] },
    admin: { file: ADMIN.fields, need: ["type Mode = 'list' | 'view' | 'edit' | 'new'"] },
  },

  /* ───────────────────────── 模块二 · 诚邀名单制作 ───────────────────────── */
  {
    id: 'B1',
    title: '列表页 · 下载模板（模板下拉 + xlsx/csv 格式）',
    web: { file: WEB.lists, need: ['下载模板', "'xlsx'", "'csv'", 'dlFormat'] },
    admin: { file: ADMIN.lists, need: ['下载模板', 'xlsx', 'csv'] },
  },
  {
    id: 'B2',
    title: '列表页 · 新建名单（名称 + 可选模板）',
    web: { file: WEB.lists, need: ['新建名单', 'templateId'] },
    admin: { file: ADMIN.lists, need: ['新建名单', 'templateId'] },
  },
  {
    id: 'B3',
    title: '列表页 · 文件导入（目标名单 + 追加 / 覆盖）',
    web: { file: WEB.lists, need: ['导入为新名单', 'append', 'overwrite'] },
    admin: { file: ADMIN.lists, need: ['导入为新名单', 'append', 'overwrite'] },
  },
  {
    id: 'B4',
    title: '列表页 · 表格列（名单名称 / 人数 / 更新时间 / 操作编辑·删除）',
    web: { file: WEB.lists, need: ['人数', 'action.delete'] },
    admin: { file: ADMIN.lists, need: ['人数', '删除', '更新时间'] },
  },
  {
    id: 'B5',
    title: '详情页 · 在线表格编辑（新增一行 / 删除行 / 单元格编辑）',
    web: { file: WEB.editor, need: ['addRow', 'removeRow', 'patchCell'] },
    admin: { file: ADMIN.editor, need: ['addRow', 'removeRow', 'patchCell'] },
  },
  {
    id: 'B6',
    title: '详情页 · 「保存并返回」自动落库（非 disabled，防 click 丢失）',
    web: { file: WEB.editor, need: ['saveAndReturn', 'save-and-back', 'leaving'] },
    admin: { file: ADMIN.editor, need: ['saveAndReturn', 'save-and-back', 'leaving'] },
  },
  {
    id: 'B7',
    title: '落库不变量：tmp_ 临时行只在失焦 POST，绝不 PUT',
    web: { file: WEB.editor, need: ["row.id.startsWith('tmp_')", 'commitTempRow'] },
    admin: { file: ADMIN.editor, need: ["row.id.startsWith('tmp_')", 'commitTempRow'] },
  },
  {
    id: 'B8',
    title: '必填校验：缺失行标红（invalidRows）',
    web: { file: WEB.editor, need: ['invalidRows'] },
    admin: { file: ADMIN.editor, need: ['invalidRows'] },
  },
  {
    id: 'B9',
    title: 'Excel 多行粘贴（pasteRows）',
    web: { file: WEB.editor, need: ['pasteRows'] },
    admin: { file: ADMIN.editor, need: ['pasteRows'] },
  },
  {
    id: 'B10',
    title: '名单名称单独回填（loadMeta 与 load 解耦，避免被 load() 清空）',
    web: { file: WEB.editor, need: ['loadMeta'] },
    admin: { file: ADMIN.editor, need: ['loadMeta'] },
  },
  {
    id: 'B11',
    title: '列定义回落：优先 columnDefs 快照，缺失回落 field-design',
    web: { file: WEB.editor, need: ['columnDefs', 'field-design'] },
    admin: { file: ADMIN.editor, need: ['columnDefs', 'field-design'] },
  },

  /* ───────────────────────── 模块三 · 请柬批量生成 ───────────────────────── */
  {
    id: 'C1',
    title: '选择区三个按钮：模板选择 / 宾客名单选择 / 批量生成',
    web: { file: WEB.jobs, need: ['请柬模板选择', '宾客名单选择', '批量生成'] },
    admin: { file: ADMIN.jobs, need: ['请柬模板选择', '宾客名单选择', '批量生成'] },
  },
  {
    id: 'C2',
    title: '任务进度表：复选框 / 任务(姓名) / 状态 / 进度 / 操作(预览·重新生成)',
    web: { file: WEB.jobs, need: ['预览', '重新生成', 'deleteSelected', 'packDownload'] },
    admin: { file: ADMIN.jobs, need: ['预览', '重新生成', '删除选择', '打包下载'] },
  },
  {
    id: 'C3',
    title: '轮询终态以 job 状态为准（SUCCESS / PARTIAL / FAILED）',
    web: { file: WEB.jobs, need: ["job.status === 'SUCCESS'", "'PARTIAL'", "'FAILED'"] },
    admin: { file: ADMIN.jobs, need: ['SUCCESS', 'PARTIAL', 'FAILED'] },
  },
  {
    id: 'C4',
    title: '批量生成链路：setGuestSelection → POST /invitations/batch-generate',
    web: { file: WEB.jobs, need: ['setGuestSelection', 'batch-generate'] },
    admin: { file: ADMIN.jobs, need: ['setGuestSelection', 'batch-generate'] },
  },
  {
    id: 'C5',
    title: '重新生成走 RERENDER + targetRecordIds',
    web: { file: WEB.jobs, need: ['RERENDER', 'targetRecordIds'] },
    admin: { file: ADMIN.jobs, need: ['RERENDER', 'targetRecordIds'] },
  },
  {
    id: 'C6',
    title: '模板选择对话框：左作品列表 + 右手机壳实时预览（SchemaRenderer）',
    web: { file: WEB.tplPicker, need: ['SchemaRenderer', 'BEZEL', 'FRAME_W'] },
    admin: { file: ADMIN.tplPicker, need: ['SchemaRenderer', 'BEZEL', 'FRAME_W'] },
  },
  {
    id: 'C7',
    title: '模板选择对话框：上一页 / 下一页 / 页码 + 播放动画 + 重播',
    web: { file: WEB.tplPicker, need: ['上一页', '下一页', '重播动画', '播放动画'] },
    admin: { file: ADMIN.tplPicker, need: ['上一页', '下一页', '重播', '播放动画'] },
  },
  {
    id: 'C8',
    title: '模板选择对话框：选中态高亮 + 取消 / 确认',
    web: { file: WEB.tplPicker, need: ['button.cancel', 'button.confirm'] },
    admin: { file: ADMIN.tplPicker, need: ['取消', '确认', 'BRAND'] },
  },
  {
    id: 'C9',
    title: '宾客名单对话框：名单下拉 + 搜索 + 全选 / 反选 + 已选 N 人',
    web: { file: WEB.personPicker, need: ['全选', '反选', '已选', '搜索姓名/单位/桌号'] },
    admin: { file: ADMIN.personPicker, need: ['全选', '反选', '已选', '搜索姓名/单位/桌号'] },
  },
  {
    id: 'C10',
    title: '宾客名单对话框：人员表列取 GUEST_FIELD_DEFS.slice(0,5)',
    web: { file: WEB.personPicker, need: ['GUEST_FIELD_DEFS.slice(0, 5)'] },
    admin: { file: ADMIN.personPicker, need: ['GUEST_FIELD_DEFS.slice(0, 5)'] },
  },
  {
    id: 'C11',
    title: '宾客名单对话框：已锁定名单提示 + 禁用改动（locked）',
    web: { file: WEB.personPicker, need: ['locked', '已锁定名单'] },
    admin: { file: ADMIN.personPicker, need: ['locked', '已锁定名单'] },
  },
  {
    id: 'C12',
    title: '宾客名单对话框：取消 / 确认选择 底栏',
    web: { file: WEB.personPicker, need: ['action.cancel', 'batch.confirm'] },
    admin: { file: ADMIN.personPicker, need: ['取消', '确认选择'] },
  },
  {
    id: 'C13',
    title: '人员回显链路：createBatchProject → getGuestSelection（继承勾选）→ setGuestSelection',
    web: { file: WEB.personPicker, need: ['createBatchProject', 'getGuestSelection', 'setGuestSelection'] },
    admin: { file: ADMIN.personPicker, need: ['/invitations/projects', '/selection'] },
  },
  {
    id: 'C14',
    title: '预览/下载走鉴权（authHeaders + Blob，admin 无 /api 代理）',
    web: { file: WEB.jobs, need: ['/api/invitations'] },
    admin: { file: ADMIN.jobs, need: ['authHeaders', 'STATIC_URL', 'downloadWithAuth'] },
  },

  /* ───────────────────────── 公共 · 监督口径与装配 ───────────────────────── */
  {
    id: 'D1',
    title: 'subject 监督口径：useSubjectScope 统一注入 q / subjBody / scopeForImage',
    web: { file: WEB.jobs, need: ['/api/invitations'] },
    admin: { file: ADMIN.shared, need: ['useSubjectScope', 'subjBody', 'scopeForImage'] },
  },
  {
    id: 'D2',
    title: 'subject 必须 memo（useCallback/useMemo），否则下游 effect 无限轮询',
    web: { file: WEB.jobs, need: ['useCallback'] },
    admin: { file: ADMIN.shared, need: ['useCallback', 'useMemo'] },
  },
  {
    id: 'D3',
    title: 'admin 请求走绝对 API_URL + authHeaders（401 → clearSession）',
    web: { file: WEB.jobs, need: ['/api/'] },
    admin: { file: ADMIN.shared, need: ['API_URL', 'authHeaders', 'clearSession'] },
  },
  {
    id: 'D4',
    title: '路由装配：fields / lists / lists/:id / jobs 四路由齐全',
    web: { file: WEB.nav, need: ['invitations'] },
    admin: {
      file: ADMIN.app,
      need: [
        '/user/invitations/fields',
        '/user/invitations/lists',
        '/user/invitations/lists/:id',
        '/user/invitations/jobs',
      ],
    },
  },
  {
    id: 'D5',
    title: '菜单：请柬事务中心为独立一级分组 invitationcenter',
    web: { file: WEB.nav, need: ['请柬事务中心'] },
    admin: { file: ADMIN.resources, need: ['invitationcenter'] },
  },
];

/* ─────────────────────────────── 执行 ─────────────────────────────── */
let pass = 0;
let fail = 0;
const fails = [];
const cache = new Map();

const src = (file) => {
  if (!cache.has(file)) {
    try {
      cache.set(file, read(file));
    } catch {
      cache.set(file, null);
    }
  }
  return cache.get(file);
};

const hit = (file, need, any) => {
  const s = src(file);
  if (s == null) return { ok: false, missing: ['<文件不存在>'] };
  const missing = need.filter((n) => !s.includes(n));
  return any ? { ok: missing.length < need.length, missing } : { ok: missing.length === 0, missing };
};

for (const c of CHECKS) {
  const base = hit(c.web.file, c.web.need, c.web.any);
  if (!base.ok) {
    fail += 1;
    fails.push(c.id);
    console.log(`FAIL  ${c.id}  ${c.title}`);
    console.log(`      [BASE] ${c.web.file} 缺少锚点: ${base.missing.join(' | ')}`);
    continue;
  }
  const impl = hit(c.admin.file, c.admin.need, c.admin.any);
  if (!impl.ok) {
    fail += 1;
    fails.push(c.id);
    console.log(`FAIL  ${c.id}  ${c.title}`);
    console.log(`      [ADMIN] ${c.admin.file} 缺少锚点: ${impl.missing.join(' | ')}`);
    continue;
  }
  pass += 1;
  console.log(`PASS  ${c.id}  ${c.title}`);
}

console.log('');
console.log(`-------------------------------------------------------------`);
console.log(`合计：${CHECKS.length} 项   PASS ${pass}   FAIL ${fail}`);
if (fails.length) console.log(`失败项：${fails.join(', ')}`);
console.log(`-------------------------------------------------------------`);
process.exit(fail === 0 ? 0 : 1);
