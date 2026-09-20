import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const BASE = 'http://localhost:3000';
const r = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13800000002', password: 'dev123456' }),
});
const j = await r.json();
console.log('LOGIN keys:', Object.keys(j));
const token = j.accessToken || j.access_token || j.token || (j.user && (j.user.accessToken || j.user.access_token));
console.log('TOKEN?', !!token);
if (!token) { console.log('body:', JSON.stringify(j).slice(0, 300)); process.exit(0); }
for (const S of ['all', 'APPROVED', 'PENDING', 'REJECTED', 'TAKEN_DOWN']) {
  const res = await fetch(`${BASE}/api/templates/admin?status=${S}&pageSize=3`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const d = await res.json();
  console.log(S, '-> total=', d.total, 'items=', (d.items || []).length, 'sampleStatus=', (d.items || []).map((x) => x.status).join(','));
}
// user/resolve
const ur = await fetch(`${BASE}/api/user/resolve?keyword=13900001001`, { headers: { Authorization: 'Bearer ' + token } });
const ud = await ur.json();
console.log('user/resolve ->', JSON.stringify(ud).slice(0, 300));
