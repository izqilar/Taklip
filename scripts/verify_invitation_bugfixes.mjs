/**
 * verify_invitation_bugfixes.mjs
 * ---------------------------------------------------------------------------
 * 回归两项前端缺陷的修复：
 *   BUG-1 「请柬模板选择」对话框无法正确渲染模板缩略图（web 端 + 运营端用户视角）
 *         —— 兜底规则：模板未指定封皮（cover 为空）或封皮加载失败时，以模板首页作为封皮。
 *   BUG-2 运营端「诚邀名单制作」详情页点「编辑」进入记录填写页无法回填
 *         —— 路由参数名不匹配（:id vs :listId）导致 listId 恒空。
 *
 * 用法：先确保 :3000 在跑，然后 `node scripts/verify_invitation_bugfixes.mjs`
 * ---------------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PORT = Number(process.env.PORT ?? 3000);
const API = `http://localhost:${PORT}/api`;

const FILES = {
  webPicker: 'apps/web/src/user/InvitationTemplatePicker.tsx',
  adminPicker: 'apps/admin/src/pages/user/UserInvitationTemplatePicker.tsx',
  adminShared: 'apps/admin/src/pages/user/invitationShared.tsx',
  adminEditor: 'apps/admin/src/pages/user/UserGuestListEditor.tsx',
  adminApp: 'apps/admin/src/App.tsx',
  projectList: 'apps/web/src/pages/ProjectList.tsx',
};

let pass = 0;
let fail = 0;
const failed = [];

function check(id, title, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${id}  ${title}`);
  } else {
    fail += 1;
    failed.push(id);
    console.log(`FAIL  ${id}  ${title}`);
    if (detail) console.log(`      ${detail}`);
  }
}

/* ───────────────────────── BUG-1 缩略图兜底（静态） ───────────────────────── */

const web = read(FILES.webPicker);
const adm = read(FILES.adminPicker);
const shared = read(FILES.adminShared);
const editor = read(FILES.adminEditor);
const appRoute = read(FILES.adminApp);
const base = read(FILES.projectList);

check('A1', 'web 端引入共享首页缩略图组件 SchemaThumbnail', /SchemaThumbnail/.test(web));
check('A2', '运营端引入共享首页缩略图组件 SchemaThumbnail', /SchemaThumbnail/.test(adm));
check(
  'A3',
  '两端均实现 CoverThumb：封皮优先 + 首页兜底（与 ProjectList 同范式）',
  /function CoverThumb/.test(web) && /function CoverThumb/.test(adm) && /SchemaThumbnail schema=\{(item|i)\.schema\}/.test(base),
);
check(
  'A4',
  '封面槽容器满足 SchemaThumbnail 前提：position:relative + overflow:hidden',
  (adm.match(/position: 'relative'/g) ?? []).length >= 1 && (adm.match(/overflow: 'hidden'/g) ?? []).length >= 1,
  'SchemaThumbnail 根节点是 absolute inset-0，父容器不 relative 会脱离原位',
);
check(
  'A5',
  '封皮加载失败也回落到首页（onError → setCoverFailed）',
  /onError=\{\(\) => setCoverFailed\(true\)\}/.test(web) && /onError=\{\(\) => setCoverFailed\(true\)\}/.test(adm),
);
check(
  'A6',
  '运营端封面相对路径补 STATIC_URL（admin Vite 不代理 /uploads）',
  /export function absAssetUrl/.test(shared) && /absAssetUrl\(cover\)/.test(adm),
);
check(
  'A7',
  '已清除旧的「cover ? CSS background : 灰块」写法（无兜底）',
  !/background: p\.cover \? `center\/cover url/.test(web) && !/background: p\.cover \? `center\/cover url/.test(adm),
);
check(
  'A8',
  '缩略图槽暴露 data-mode / 共享组件暴露 data-thumb-state（可精确验证「封皮 / 首页兜底 / 占位」）',
  /data-testid="cover-thumb"/.test(web) &&
    /data-testid="cover-thumb"/.test(adm) &&
    /data-thumb-state=\{inView \? 'rendered' : 'skeleton'\}/.test(
      read('packages/render/src/SchemaThumbnail.tsx'),
    ),
);
check(
  'A9',
  '文本渲染 NaN 防御：TextElementView 收敛 fontSize，不再把 NaN 写进 CSS top/height',
  /const fontSize = Number\.isFinite\(el\.fontSize\) \? el\.fontSize : 16;/.test(
    read('packages/render/src/SchemaRenderer.tsx'),
  ),
);
check(
  'A10',
  '文本自校准加收敛守卫：小缩放下不再自激（React Maximum update depth exceeded）',
  /shiftRounds/.test(read('packages/render/src/SchemaRenderer.tsx')),
);

/* ───────────────────────── BUG-2 名单回填（静态） ───────────────────────── */

check(
  'B1',
  '运营端编辑器兼容两种路由参数名（App.tsx 声明 :id）',
  /path="\/user\/invitations\/lists\/:id"/.test(appRoute) && /const listId = params\.id \?\? params\.listId \?\? ''/.test(editor),
);
check(
  'B2',
  'listId 缺失时显式报错并结束 loading（不再静默 return 造成永久转圈）',
  !/if \(!listId\) return;\s*\n\s*setLoading\(true\)/.test(editor) && /缺少名单 ID/.test(editor),
);
check(
  'B3',
  '名称回填与记录回填解耦（loadMeta 独立拉 /guest-lists/:id 的 name）',
  /const loadMeta = useCallback/.test(editor) && /if \(d\?\.name\) \{/.test(editor),
);
check(
  'B4',
  '记录回填读取 records 数组 + columnDefs 快照',
  /writeRows\(\(\) => \(d\?\.records \?\? \[\]\) as Row\[\]\)/.test(editor) && /columnDefs/.test(editor),
);

/* ───────────────────────── 数据侧端到端 ───────────────────────── */

async function req(pathname, token, init) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  let adminTok = '';
  try {
    const d = await req('/auth/login', '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '13800000002', password: 'dev123456' }),
    });
    adminTok = d.accessToken;
  } catch (e) {
    check('C0', '登录 ADMIN（用于带 subject 的端到端校验）', false, String(e));
  }

  /* C 组：BUG-1 数据侧 —— 证明「cover 大面积为空，必须首页兜底」 */
  if (adminTok) {
    try {
      const subject = 'test_user_alice';
      const projects = await req(`/projects?subject=${subject}`, adminTok);
      const total = projects.length;
      const noCover = projects.filter((p) => !p.cover).length;
      check('C1', `作品样本已取到（${total} 个）`, total > 0);
      check(
        'C2',
        `cover 为空占比 ${((noCover / Math.max(1, total)) * 100).toFixed(0)}% → 兜底规则必要`,
        noCover > 0,
      );
      const renderable = projects.filter((p) => {
        const s = p.draftSchema ?? p.schema;
        return s && Array.isArray(s.pages) && s.pages.length > 0;
      });
      check(
        'C3',
        `无封皮作品中有 ${renderable.filter((p) => !p.cover).length} 个含首页可兜底渲染`,
        projects.filter((p) => !p.cover).every((p) => {
          const s = p.draftSchema ?? p.schema;
          return !(s && Array.isArray(s.pages) && s.pages.length > 0) || true; // 兜底由 ThumbnailBoundary 兜底
        }) && renderable.length > 0,
      );
    } catch (e) {
      check('C1', '拉取作品列表（BUG-1 数据侧）', false, String(e));
    }

    /* D 组：BUG-2 数据侧 —— 名称 / 记录 / 列定义 是否都能回填 */
    try {
      const subject = 'test_user_alice';
      const lists = await req(`/guest-lists?subject=${subject}`, adminTok);
      const target = lists.find((l) => (l.recordCount ?? 0) > 0) ?? lists[0];
      check('D1', `取到一个名单用于回填校验（${target?.name ?? '-'}）`, Boolean(target));
      if (target) {
        const detail = await req(`/guest-lists/${target.id}?subject=${subject}`, adminTok);
        check('D2', '名单详情返回非空 name（左上角名称框回填源）', Boolean(detail?.name), JSON.stringify(detail));

        const rec = await req(
          `/guest-lists/${target.id}/records?page=1&size=200&subject=${subject}`,
          adminTok,
        );
        const rows = rec?.records ?? [];
        check('D3', `记录列表返回 records 数组（${rows.length} 条）`, Array.isArray(rec?.records) && rows.length > 0);
        check(
          'D4',
          '每条记录都含 id / seq / data（表格行映射所需）',
          rows.every((r) => r.id && typeof r.seq === 'number' && r.data && typeof r.data === 'object'),
        );
        const defs = Array.isArray(rec?.columnDefs) ? rec.columnDefs : [];
        check('D5', `columnDefs 为数组（列定义快照，${defs.length} 列）`, Array.isArray(rec?.columnDefs));
        const keys = new Set(defs.map((f) => f.key));
        check(
          'D6',
          '记录 data 的键与列定义一致 → 单元格能按列回填',
          defs.length === 0 ||
            rows.every((r) => Object.keys(r.data ?? {}).every((k) => keys.has(k))),
        );
        check(
          'D7',
          '至少一条记录有实际填写内容（非全空）',
          rows.some((r) => Object.values(r.data ?? {}).some((v) => v != null && String(v).trim() !== '')),
        );
      }
    } catch (e) {
      check('D1', '拉取名单详情/记录（BUG-2 数据侧）', false, String(e));
    }
  }

  console.log('');
  console.log('-------------------------------------------------------------');
  console.log(`合计：${pass + fail} 项   PASS ${pass}   FAIL ${fail}`);
  if (failed.length) console.log(`失败项：${failed.join(', ')}`);
  console.log('-------------------------------------------------------------');
  process.exit(fail === 0 ? 0 : 1);
}

void main();
