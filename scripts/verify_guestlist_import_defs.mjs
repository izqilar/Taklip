/**
 * 验证「诚邀名单」导入/粘贴字段映射修复（婚礼模板首列非 guest_name 场景）。
 *
 * 覆盖：
 *  A. 下载婚礼模板 → 表头为 丈夫姓名/夫人姓名（非 guest_name/姓名）
 *  B. 婚礼模板 CSV「直接导入为新名单」(带 templateId) → 成功，无「缺少必填列」
 *  C. 婚礼模板 CSV「导入到婚礼模板名单」(带 listId) → 成功
 *  D. 婚礼模板「粘贴写入」(records/batch，键为 husband_name/wife_name) → 成功
 *  E. 通用模板回归：下载表头含 姓名；导入/粘贴均成功
 *  F. 负向：婚礼 CSV 不带 templateId 且不带 listId → 回落全局字段设计 → 必失败(MISSING_REQUIRED_COLUMN)
 */
const API = 'http://localhost:3000';
const PHONE = '13900001001';
const PASSWORD = 'Test123456';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`);
};

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  });
  if (!r.ok) throw new Error('login failed ' + r.status);
  const d = await r.json();
  return d.accessToken || d.token || d.access_token || d.data?.token;
}

function buildCsv(headerCells, rows) {
  const lines = [headerCells.join(',')];
  for (const row of rows) lines.push(row.join(','));
  return lines.join('\n');
}

async function main() {
  const token = await login();
  const H = { Authorization: `Bearer ${token}` };

  // 列表面板：取模板
  const tplRes = await fetch(`${API}/api/guest-lists/templates`, { headers: H });
  const tpls = (await tplRes.json()).templates || [];
  const wedding = tpls.find((t) => t.id === 'sys_wedding_invite');
  const general = tpls.find((t) => t.id === 'sys_general_invite');
  check('婚礼模板存在', !!wedding, wedding ? wedding.id : '缺失');
  check('通用模板存在', !!general, general ? general.id : '缺失');

  // A. 下载婚礼模板 CSV，看表头
  const wkDl = await fetch(`${API}/api/guest-lists/template?format=csv&templateId=sys_wedding_invite`, { headers: H });
  const wkCsv = await wkDl.text();
  const wkHeader = wkCsv.split('\n')[0].split(',').map((h) => h.replace(/\*$/, ''));
  check('A 婚礼下载表头首列=husband_name(键)', wkHeader[0] === 'husband_name', wkHeader.join('|'));
  check('A 婚礼下载表头不含 guest_name/姓名', !wkHeader.includes('guest_name') && !wkHeader.includes('姓名'), wkHeader.join('|'));

  // B. 婚礼 CSV 直接导入为新名单（带 templateId）
  const wkFileHdr = ['husband_name*', 'wife_name*', 'table_no', 'phone', 'wechat', 'address', 'remark'];
  const wkRows = [
    ['张伟', '李娜', '8', '13900001001', 'wx1', '北京', '好友'],
    ['王强', '赵敏', '9', '13800001002', 'wx2', '上海', ''],
  ];
  const wkCsvBody = buildCsv(wkFileHdr, wkRows);
  const fdB = new FormData();
  fdB.append('file', new Blob([wkCsvBody], { type: 'text/csv' }), 'wedding.csv');
  fdB.append('templateId', 'sys_wedding_invite');
  fdB.append('mode', 'append');
  const impB = await fetch(`${API}/api/guest-lists/import`, { method: 'POST', headers: H, body: fdB });
  const impBd = await impB.json().catch(() => ({}));
  check('B 婚礼CSV直接导入(带templateId)成功', impB.ok && (impBd.created ?? 0) === 2,
    `ok=${impB.ok} created=${impBd.created} msg=${impBd.message || ''}`);

  // C. 先建婚礼模板名单，再把婚礼 CSV 导入到该名单
  const mk = await fetch(`${API}/api/guest-lists`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E婚礼名单_' + Date.now(), templateId: 'sys_wedding_invite' }),
  });
  const mkd = await mk.json();
  const listId = mkd.id;
  check('C 婚礼模板名单创建成功(带columnDefs)', !!listId && Array.isArray(mkd.columnDefs) && mkd.columnDefs.length > 0,
    `id=${listId} colDefs=${(mkd.columnDefs || []).map((c) => c.key).join(',')}`);
  const fdC = new FormData();
  fdC.append('file', new Blob([wkCsvBody], { type: 'text/csv' }), 'wedding.csv');
  fdC.append('listId', listId);
  fdC.append('mode', 'append');
  const impC = await fetch(`${API}/api/guest-lists/import`, { method: 'POST', headers: H, body: fdC });
  const impCd = await impC.json().catch(() => ({}));
  check('C 婚礼CSV导入到婚礼名单成功', impC.ok && (impCd.created ?? 0) === 2,
    `ok=${impC.ok} created=${impCd.created} msg=${impCd.message || ''}`);

  // D. 婚礼模板粘贴写入（records/batch，键为 husband_name/wife_name）
  const batch = await fetch(`${API}/api/guest-lists/${listId}/records/batch`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      records: [
        { data: { husband_name: '粘贴张三', wife_name: '粘贴李四', table_no: '10' } },
        { data: { husband_name: '粘贴王五', wife_name: '粘贴赵六' } },
      ], mode: 'append',
    }),
  });
  const batchD = await batch.json().catch(() => ({}));
  check('D 婚礼粘贴写入成功', batch.ok && (batchD.created ?? 0) === 2,
    `ok=${batch.ok} created=${batchD.created} failed=${JSON.stringify(batchD.failed || [])} msg=${batchD.message || ''}`);

  // E. 通用模板回归
  const gnDl = await fetch(`${API}/api/guest-lists/template?format=csv&templateId=sys_general_invite`, { headers: H });
  const gnCsv = await gnDl.text();
  const gnHeader = gnCsv.split('\n')[0].split(',').map((h) => h.replace(/\*$/, ''));
  check('E 通用下载表头含 姓名(guest_name)', gnHeader.includes('guest_name'), gnHeader.join('|'));
  const gnHdr = ['guest_name*', 'guest_title', 'gender', 'unit', 'table_no', 'phone', 'address', 'remark'];
  const gnRows = [['张三', '先生', 'M', '新疆大学', '1', '13900001001', '', '']];
  const gnBody = buildCsv(gnHdr, gnRows);
  const fdE = new FormData();
  fdE.append('file', new Blob([gnBody], { type: 'text/csv' }), 'general.csv');
  fdE.append('templateId', 'sys_general_invite');
  const impE = await fetch(`${API}/api/guest-lists/import`, { method: 'POST', headers: H, body: fdE });
  const impEd = await impE.json().catch(() => ({}));
  check('E 通用CSV导入成功(回归)', impE.ok && (impEd.created ?? 0) === 1,
    `ok=${impE.ok} created=${impEd.created} msg=${impEd.message || ''}`);

  // F. 负向：婚礼 CSV 不带 templateId 且不带 listId → 回落全局字段设计 → 必失败
  const fdF = new FormData();
  fdF.append('file', new Blob([wkCsvBody], { type: 'text/csv' }), 'wedding.csv');
  fdF.append('mode', 'append');
  const impF = await fetch(`${API}/api/guest-lists/import`, { method: 'POST', headers: H, body: fdF });
  const impFd = await impF.json().catch(() => ({}));
  check('F 婚礼CSV无模板标识导入必失败(证明按模板字段校验)', !impF.ok && impFd.code === 'MISSING_REQUIRED_COLUMN',
    `ok=${impF.ok} code=${impFd.code} msg=${impFd.message || ''}`);

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n结果：${passed}/${checks.length} 通过`);
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(2); });
