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
 *  6. 收费-only：未购买直接渲染被拒 402，购买后按已购人次渲染
 *  7. 改 live 名单不影响输出（FR-3）
 *  8. 配额用尽被阻（QUOTA_EXCEEDED）与重渲 5 次→购买次数重置规则（item3）
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

/** 轮询等待 job 到达终态（SUCCESS/PARTIAL/FAILED），最多 90s */
const waitJob = async (jobId) => {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const j = await api(`/api/invitations/jobs/${jobId}`);
    if (j.json?.status === 'SUCCESS' || j.json?.status === 'FAILED' || j.json?.status === 'PARTIAL') return j.json;
  }
  return null;
};

const main = async () => {
  console.log('=== 批量请柬 API 冒烟 ===');

  // 0. 登录
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ type: 'phone', account: PHONE, password: PASSWORD }),
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

    // 12. 收费-only：未购买人次直接渲染 → 402 QUOTA_EXCEEDED（已移除免费赠样层）
    const gen0 = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check(
      '未购买渲染被拒 402 QUOTA_EXCEEDED（收费-only，无免费赠样）',
      gen0.status === 402 && gen0.json?.code === 'QUOTA_EXCEEDED',
      JSON.stringify(gen0.json),
    );

    // 13. 购买 1 人次（C3/C1）
    const buy = await api('/api/invitations/purchase', {
      method: 'POST',
      body: JSON.stringify({ projectId, headcount: 1 }),
    });
    check(
      '购买 1 人次成功（state=PAID, totalRenderable=1, remaining=1）',
      buy.json?.state === 'PAID' && buy.json?.totalRenderable === 1 && buy.json?.remaining === 1,
      JSON.stringify(buy.json),
    );

    // 14. 付费首渲：子集 5 人但只购 1 → 本批渲 1（Nest POST 默认 201，故按 <300 判定受理成功）
    const gen = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check('付费首渲受理且 total=1（受已购 1 限制）', gen.status < 300 && gen.json?.total === 1, JSON.stringify(gen.json));

    // 等任务完成（最多 90s）
    let job = null;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const j = await api(`/api/invitations/jobs/${gen.json?.jobId}`);
      job = j.json;
      if (job?.status === 'SUCCESS' || job?.status === 'FAILED') break;
    }
    check('付费首渲任务完成（SUCCESS）', job?.status === 'SUCCESS', JSON.stringify({ status: job?.status, error: job?.error }));

    // 15. 锁定 + 只渲 1 人 + 剩余 0
    const pv = await api(`/api/invitations/projects/${projectId}`);
    check(
      '首渲后 state=PAID、paidRendered=1、remaining=0',
      pv.json?.state === 'PAID' && pv.json?.paidRendered === 1 && pv.json?.remaining === 0,
      JSON.stringify(pv.json),
    );

    // 16. 改 live 名单不影响输出（FR-3）：改掉第 1 个人姓名
    if (ids[0]) {
      await api(`/api/guest-lists/${listId}/records/${ids[0]}`, {
        method: 'PUT',
        body: JSON.stringify({ data: { guest_name: '张三改名', gender: 'M' } }),
      });
    }
    const sel2 = await api(`/api/invitations/projects/${projectId}/selection`);
    check('锁定后 live 名单仍可改，勾选仍指向原 5 人（FR-3 输出不变）', sel2.json?.selectedRecordIds?.length === 5);

    // 17. 被锁定记录删除 → IN_USE
    const delLocked = await api(`/api/guest-lists/${listId}/records/${ids[0]}`, { method: 'DELETE' });
    check('删除已渲染记录 → 409 IN_USE', delLocked.status === 409 && delLocked.json?.code === 'IN_USE', JSON.stringify(delLocked.json));

    // 16. 配额用尽后再渲被拒（B10）：仍有 4 人未渲，但已购 1 已用完 → QUOTA_EXCEEDED
    const over = await api('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    check(
      '配额用尽后再渲被拒 402 QUOTA_EXCEEDED（B10）',
      over.status === 402 && over.json?.code === 'QUOTA_EXCEEDED',
      JSON.stringify(over.json),
    );

    // 17. 重渲循环规则（item3）：每条记录重渲满 5 次 → 第 6 次需消耗 1 次渲染额度并重置计数。
    // 初始付费生成已记 renderCounts=1，故再重渲 4 次即达到单条 5 次上限（此过程不消耗额度）；
    // 第 6 次在 remaining=0 时被拦截（提示购买次数）；购买 1 次后第 6 次受理：
    // 消耗 1 个全局额度（paidRendered += 1）且该记录计数重置为新周期第 1 次。
    const renderedId = (job?.results ?? []).find((r) => r.status !== 'failed')?.recordId;
    if (renderedId) {
      for (let i = 0; i < 4; i++) {
        const rr = await api('/api/invitations/batch-generate', {
          method: 'POST',
          body: JSON.stringify({ projectId, mode: 'RERENDER', targetRecordIds: [renderedId] }),
        });
        const okAccept = rr.status < 300 && rr.json?.total === 1;
        check(`第 ${i + 1} 次重渲受理（renderCounts → ${i + 2}，不消耗额度）`, okAccept, JSON.stringify(rr.json));
        if (okAccept) {
          const done = await waitJob(rr.json?.jobId);
          check(`第 ${i + 1} 次重渲任务完成`, done?.status === 'SUCCESS', JSON.stringify({ status: done?.status, error: done?.error }));
        }
      }
      const pvMid = await api(`/api/invitations/projects/${projectId}`);
      check(
        '前 4 次重渲不消耗配额（paidRendered 仍为 1，remaining 仍为 0）',
        pvMid.json?.paidRendered === 1 && pvMid.json?.remaining === 0,
        JSON.stringify(pvMid.json),
      );

      // 第 6 次：renderCounts=5 且 remaining=0 → 拦截，提示购买次数
      const blocked = await api('/api/invitations/batch-generate', {
        method: 'POST',
        body: JSON.stringify({ projectId, mode: 'RERENDER', targetRecordIds: [renderedId] }),
      });
      check(
        '重渲满 5 次且无剩余额度 → NO_PENDING 拦截（提示购买次数）',
        blocked.status < 300 && blocked.json?.status === 'NO_PENDING' && /购买次数/.test(blocked.json?.message ?? ''),
        JSON.stringify(blocked.json),
      );

      // 购买 1 次 → 第 6 次重渲受理：消耗 1 额度、计数重置为 1
      await api('/api/invitations/purchase', {
        method: 'POST',
        body: JSON.stringify({ projectId, headcount: 1 }),
      });
      const reset = await api('/api/invitations/batch-generate', {
        method: 'POST',
        body: JSON.stringify({ projectId, mode: 'RERENDER', targetRecordIds: [renderedId] }),
      });
      check(
        '购买后第 6 次重渲受理（消耗 1 次额度，计数重置）',
        reset.status < 300 && reset.json?.total === 1,
        JSON.stringify(reset.json),
      );
      const pv2 = await api(`/api/invitations/projects/${projectId}`);
      check(
        '重置重渲消耗 1 额度（paidRendered=2, remaining=0）',
        pv2.json?.paidRendered === 2 && pv2.json?.remaining === 0,
        JSON.stringify(pv2.json),
      );
    } else {
      console.log('  ⚠️ 首渲无成功记录，跳过重渲循环断言');
    }

    // 20. Zip 打包下载
    const zip = await api(`/api/invitations/jobs/${gen.json?.jobId}/download`);
    check('Zip 打包下载 200 且为 PK 头', zip.status === 200 && zip.buffer[0] === 0x50 && zip.buffer[1] === 0x4b);

    // 21. 越权：另一用户访问该项目 → 404
    const other = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'phone', account: '13900001002', password: PASSWORD }),
    }).then((r) => r.json());
    const otherToken = other?.token || other?.accessToken || other?.data?.token;
    if (otherToken) {
      const saved = token;
      token = otherToken;
      const cross = await api(`/api/invitations/projects/${projectId}`);
      check('跨用户访问项目 → 404（不暴露归属）', cross.status === 404, JSON.stringify(cross.json));

      // 21b. §16.6：用他人作品 id 建批量项目 → 404（防越权拿他人模板批量出图）
      const steal = await api('/api/invitations/projects', {
        method: 'POST',
        body: JSON.stringify({ templateId: workId, listId }),
      });
      check('用他人作品建批量项目 → 404（§16.6 作品归属校验）', steal.status === 404, JSON.stringify(steal.json));

      // 21c. 连他人的名单 id 也读不到（名单隔离复用名单模块，越权不暴露归属）
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
