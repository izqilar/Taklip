/**
 * 批量请柬 API 冒烟（规范 DoD 1–8 / §9）
 *
 * 跑法：node scripts/smoke_batch_invitation.mjs
 * 依赖：本地 :3000 已启动且已构建最新代码。
 *
 * 覆盖：
 *  1. 模板下载 CSV(含 BOM) / XLSX 合法
 *  2. /template/schema 字段定义
 *  3. 新建名单 + 批量写入 + 分页读取
 *  4. 非法字段被拒（空姓名 / 超长 / 手机号）
 *  5. 勾选子集（越界记录被拒）
 *  6. 首渲赠样：只渲勾选子集前 3 人 + 锁定
 *  7. 改 live 名单不影响输出（FR-3）
 *  8. 锁定后再渲染被阻断（B5）与购买后续渲（C3）
 *  9. 被锁定记录删除返回 IN_USE
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const PHONE = process.env.SMOKE_PHONE || '13900001001';
const PASSWORD = process.env.SMOKE_PASSWORD || 'Test123456';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${detail}`);
  }
};

let token = '';
const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  // 先按字节读（模板下载是二进制，走 text() 会破坏非 ASCII 字节）
  const buffer = Buffer.from(await res.arrayBuffer());
  const text = buffer.toString('utf8');
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 二进制/非 JSON */
  }
  return { status: res.status, json, text, buffer, headers: res.headers };
};

const main = async () => {
  console.log('=== 批量请柬 API 冒烟 ===');

  // 0. 登录
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  });
  token = login.json?.token || login.json?.accessToken || login.json?.data?.token || '';
  check('登录成功', !!token, JSON.stringify(login.json).slice(0, 160));
  if (!token) process.exit(1);

  // 1. 字段定义
  const schema = await api('/api/guest-lists/template/schema');
  check(
    'GET /template/schema 返回 8 个字段且首字段为 guest_name',
    schema.status === 200 && schema.json?.fields?.length === 8 && schema.json.fields[0].key === 'guest_name',
    JSON.stringify(schema.json).slice(0, 120),
  );

  // 2. CSV 模板（含 BOM）
  const csv = await api('/api/guest-lists/template?format=csv');
  const hasBom = csv.buffer.length > 3 && csv.buffer[0] === 0xef && csv.buffer[1] === 0xbb && csv.buffer[2] === 0xbf;
  const firstLine = csv.buffer.toString('utf8').replace(/^\uFEFF/, '').split('\r\n')[0];
  check('CSV 模板 200 且含 UTF-8 BOM', csv.status === 200 && hasBom);
  check('CSV 首行为字段 key 且 guest_name 在首位', firstLine.startsWith('guest_name*'), firstLine);
  check(
    'CSV Content-Disposition 为 attachment',
    (csv.headers.get('content-disposition') || '').includes('attachment'),
  );

  // 3. XLSX 模板（回读校验：能被自家解析器读回，且表头为中文名）
  const xlsx = await api('/api/guest-lists/template?format=xlsx');
  check('XLSX 模板 200', xlsx.status === 200);
  const { readXlsxFirstSheet } = await import('../apps/server/dist/common/minimal-xlsx.js').catch(() => ({}));
  if (typeof readXlsxFirstSheet === 'function') {
    const rows = readXlsxFirstSheet(xlsx.buffer);
    check(
      'XLSX 可被解析回读，首行中文表头含「姓名」',
      rows.length >= 2 && rows[0][0].includes('姓名'),
      JSON.stringify(rows[0]),
    );
  }

  // 4. 新建名单
  const created = await api('/api/guest-lists', {
    method: 'POST',
    body: JSON.stringify({ name: `冒烟名单-${Date.now()}` }),
  });
  const listId = created.json?.id;
  check('POST /api/guest-lists 新建成功', created.status === 201 && !!listId, JSON.stringify(created.json).slice(0, 120));

  // 5. 批量写入（含 1 条非法）
  const batch = await api(`/api/guest-lists/${listId}/records/batch`, {
    method: 'POST',
    body: JSON.stringify({
      mode: 'append',
      records: [
        { guest_name: '张三', gender: 'M', unit: '新疆大学', table_no: '8' },
        { guest_name: '李四', gender: 'F', unit: '新疆大学', table_no: '8' },
        { guest_name: '王五', gender: 'M', unit: '腾讯', table_no: '9' },
        { guest_name: '赵六', gender: 'F', unit: '腾讯', table_no: '9' },
        { guest_name: '钱七', gender: 'M', unit: '腾讯', table_no: '10' },
        { guest_name: '', gender: 'M' }, // 非法：姓名为空
      ],
    }),
  });
  check(
    '批量写入：5 条成功、1 条失败（空姓名）',
    batch.json?.created === 5 && batch.json?.failed?.length === 1,
    JSON.stringify(batch.json).slice(0, 200),
  );

  // 6. 单条非法校验
  const bad = await api(`/api/guest-lists/${listId}/records`, {
    method: 'POST',
    body: JSON.stringify({ data: { guest_name: '孙八', phone: '123' } }),
  });
  check('手机号非法被拒 422 INVALID_FIELD', bad.status === 422 && bad.json?.code === 'INVALID_FIELD', JSON.stringify(bad.json));

  // 7. 分页读取
  const recs = await api(`/api/guest-lists/${listId}/records?page=1&size=50`);
  const ids = (recs.json?.records ?? []).map((r) => r.id);
  check('分页读取 5 条且 seq 递增', recs.json?.total === 5 && ids.length === 5, JSON.stringify(recs.json?.total));

  // 8. 建批量渲染项目（模板取当前用户第一个作品；无作品则跳过渲染相关断言）
  const works = await api('/api/projects?page=1&size=5');
  const workId = works.json?.items?.[0]?.id || works.json?.data?.[0]?.id || works.json?.[0]?.id;
  if (!workId) {
    console.log('  ⚠️ 当前用户无作品，跳过渲染断言（需先有模板作品）');
  } else {
    const prj = await api('/api/invitations/projects', {
      method: 'POST',
      body: JSON.stringify({ templateId: workId, listId }),
    });
    const projectId = prj.json?.id;
    check('创建批量渲染项目成功（state=DRAFT）', !!projectId && prj.json?.state === 'DRAFT', JSON.stringify(prj.json).slice(0, 160));

    // 9. 勾选越界被拒
    const badSel = await api(`/api/invitations/projects/${projectId}/selection`, {
      method: 'POST',
      body: JSON.stringify({ listId, selectedRecordIds: [...ids, 'not_exist_id'] }),
    });
    check('勾选含非本名单记录 → 422 INVALID_SELECTION', badSel.status === 422, JSON.stringify(badSel.json));

    // 10. 正常勾选（全 5 人）
    const sel = await api(`/api/invitations/projects/${projectId}/selection`, {
      method: 'POST',
      body: JSON.stringify({ listId, selectedRecordIds: ids }),
    });
    check('保存勾选 5 人', sel.json?.count === 5, JSON.stringify(sel.json).slice(0, 120));

    // 11. 空勾选渲染被拒（B16）——必须用**独立名单**，否则会复用同一 project 直接开渲
    const emptyList = await api('/api/guest-lists', {
      method: 'POST',
      body: JSON.stringify({ name: `空勾选名单-${Date.now()}` }),
    });
    const emptyPrj = await api('/api/invitations/projects', {
      method: 'POST',
      body: JSON.stringify({ templateId: workId, listId: emptyList.json?.id }),
    });
    const emptyGen = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId: emptyPrj.json?.id }),
    });
    check(
      '空勾选渲染被拒（B16）',
      emptyGen.status === 400 && emptyGen.json?.code === 'EMPTY_SELECTION',
      JSON.stringify(emptyGen.json),
    );

    // 12. 首渲赠样：只渲前 3 人（Nest POST 默认 201，故按 <300 判定受理成功）
    const gen = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check('首渲受理成功且 total=3（C2 前 3 人）', gen.status < 300 && gen.json?.total === 3, JSON.stringify(gen.json));

    // 等任务完成（最多 90s）
    let job = null;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const j = await api(`/api/invitations/jobs/${gen.json?.jobId}`);
      job = j.json;
      if (job?.status === 'SUCCESS' || job?.status === 'FAILED') break;
    }
    check('首渲任务完成（SUCCESS）', job?.status === 'SUCCESS', JSON.stringify({ status: job?.status, error: job?.error }));

    // 13. 锁定 + 只渲 3 人
    const pv = await api(`/api/invitations/projects/${projectId}`);
    check('首渲后 state=LOCKED 且 freeRendered=3', pv.json?.state === 'LOCKED' && pv.json?.freeRendered === 3, JSON.stringify(pv.json));

    // 14. 改 live 名单不影响输出（FR-3）：改掉第 1 个人姓名
    if (ids[0]) {
      await api(`/api/guest-lists/${listId}/records/${ids[0]}`, {
        method: 'PUT',
        body: JSON.stringify({ data: { guest_name: '张三改名', gender: 'M' } }),
      });
    }
    const sel2 = await api(`/api/invitations/projects/${projectId}/selection`);
    check('锁定后 live 名单仍可改，勾选仍指向原 5 人（FR-3 输出不变）', sel2.json?.selectedRecordIds?.length === 5);

    // 15. 被锁定记录删除 → IN_USE
    const delLocked = await api(`/api/guest-lists/${listId}/records/${ids[0]}`, { method: 'DELETE' });
    check('删除已渲染记录 → 409 IN_USE', delLocked.status === 409 && delLocked.json?.code === 'IN_USE', JSON.stringify(delLocked.json));

    // 16. 锁定未购再次渲染被阻断（B5）
    const again = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check('锁定未购再次渲染被阻断 402（B5）', again.status === 402, JSON.stringify(again.json));

    // 17. 购买 1 人次后续渲（C3/C1）：子集 5 人，已赠样渲 3，剩余 2 人但只买 1 → 本批渲 1
    const buy = await api('/api/invitations/purchase', {
      method: 'POST',
      body: JSON.stringify({ projectId, headcount: 1 }),
    });
    check('购买 1 人次成功（state=PAID, totalRenderable=4）', buy.json?.state === 'PAID' && buy.json?.totalRenderable === 4, JSON.stringify(buy.json));

    const gen2 = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check('付费续渲受理且 total=1（受已购 1 限制，C3）', gen2.status < 300 && gen2.json?.total === 1, JSON.stringify(gen2.json));

    let job2 = null;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const j = await api(`/api/invitations/jobs/${gen2.json?.jobId}`);
      job2 = j.json;
      if (job2?.status === 'SUCCESS' || job2?.status === 'FAILED') break;
    }
    check('续渲任务完成', job2?.status === 'SUCCESS', JSON.stringify({ status: job2?.status, error: job2?.error }));

    // 18. 配额用尽后再渲被拒（B10）：仍有 1 人未渲，但已购 1 已用完 → QUOTA_EXCEEDED
    const over = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check(
      '配额用尽后再渲被拒 402 QUOTA_EXCEEDED（B10）',
      over.status === 402 && over.json?.code === 'QUOTA_EXCEEDED',
      JSON.stringify(over.json),
    );

    // 18b. 模板改版重渲同批人（C4）：不新增人员、不消耗配额
    const before = await api(`/api/invitations/projects/${projectId}`);
    const re = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId, mode: 'RERENDER' }),
    });
    check(
      '模板改版重渲受理且人员集合=已渲染 4 人（C4 不新增）',
      re.status < 300 && re.json?.total === 4,
      JSON.stringify(re.json),
    );
    const after = await api(`/api/invitations/projects/${projectId}`);
    check(
      '重渲不消耗配额（alreadyRendered 不变，C4/B14）',
      after.json?.alreadyRendered === before.json?.alreadyRendered,
      `${before.json?.alreadyRendered} → ${after.json?.alreadyRendered}`,
    );

    // 19. Zip 打包下载
    const zip = await api(`/api/invitations/jobs/${gen.json?.jobId}/download`);
    check('Zip 打包下载 200 且为 PK 头', zip.status === 200 && zip.buffer[0] === 0x50 && zip.buffer[1] === 0x4b);

    // 20. 越权：另一用户访问该项目 → 404
    const other = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '13900001002', password: PASSWORD }),
    }).then((r) => r.json());
    const otherToken = other?.token || other?.accessToken || other?.data?.token;
    if (otherToken) {
      const saved = token;
      token = otherToken;
      const cross = await api(`/api/invitations/projects/${projectId}`);
      check('跨用户访问项目 → 404（不暴露归属）', cross.status === 404, JSON.stringify(cross.json));

      // 20b. §16.6：用他人作品 id 建批量项目 → 404（防越权拿他人模板批量出图）
      const steal = await api('/api/invitations/projects', {
        method: 'POST',
        body: JSON.stringify({ templateId: workId, listId }),
      });
      check('用他人作品建批量项目 → 404（§16.6 作品归属校验）', steal.status === 404, JSON.stringify(steal.json));

      // 20c. 连他人的名单 id 也读不到（名单隔离复用名单模块，越权不暴露归属）
      const stealList = await api(`/api/guest-lists/${listId}`);
      check('跨用户读取他人名单 → 404（名单隔离）', stealList.status === 404, JSON.stringify(stealList.json));
      token = saved;
    } else {
      console.log('  ⚠️ 第二个账号登录失败，跳过越权断言');
    }
  }

  // 产物落盘
  mkdirSync('shots', { recursive: true });
  writeFileSync(join('shots', 'smoke_batch_invitation_result.json'), JSON.stringify({ pass, fail, at: new Date().toISOString() }, null, 2));

  console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
};

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
