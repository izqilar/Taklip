// 验证占位符 CRUD 接口 + 清理上一轮残留测试数据（groom/weddingImg1）。
const BASE = 'http://localhost:3000/api';
const PHONE = '13800000002';
const PASSWORD = 'dev123456';

async function main() {
  // 1) 登录取 token
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok || !loginBody.accessToken) {
    console.error('登录失败', loginRes.status, loginBody);
    process.exit(1);
  }
  const token = loginBody.accessToken;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2) 列出
  const listRes = await fetch(`${BASE}/admin/placeholders`, { headers: H });
  const list = await listRes.json();
  console.log('列表 total=', list.total, 'items=', (list.items || []).length);
  for (const it of list.items || []) {
    console.log(`  - ${it.key} | type=${it.type} | scope=${it.scope} | legacy=${it.legacy} | status=${it.status} | label=${JSON.stringify(it.label)}`);
  }

  // 3) 删除上一轮残留测试行（非 legacy 的 groom / weddingImg1）
  const toDelete = (list.items || []).filter((x) => !x.legacy && ['groom', 'weddingImg1'].includes(x.key));
  for (const d of toDelete) {
    const delRes = await fetch(`${BASE}/admin/placeholders/${d.id}`, { method: 'DELETE', headers: H });
    console.log(`删除 ${d.key} -> ${delRes.status}`);
  }

  // 4) 复列确认
  const listRes2 = await fetch(`${BASE}/admin/placeholders`, { headers: H });
  const list2 = await listRes2.json();
  console.log('清理后 total=', list2.total);
  // 5) 顺带验证：新建一个 batch 占位符并删掉（接口全链路）
  const createRes = await fetch(`${BASE}/admin/placeholders`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      key: 'smoke_test_ph',
      type: 'text',
      label: '冒烟测试',
      scope: 'batch',
      requiredDef: false,
      status: 'visible',
    }),
  });
  const created = await createRes.json();
  console.log('新建 ->', createRes.status, created.key || created.message);
  if (created.id) {
    const del2 = await fetch(`${BASE}/admin/placeholders/${created.id}`, { method: 'DELETE', headers: H });
    console.log('删除冒烟测试 ->', del2.status);
  }
  const listRes3 = await fetch(`${BASE}/admin/placeholders`, { headers: H });
  const list3 = await listRes3.json();
  console.log('最终 total=', list3.total);
}

main().catch((e) => { console.error(e); process.exit(1); });
