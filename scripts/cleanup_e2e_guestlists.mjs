const API = 'http://localhost:3000';
const PHONE = '13900001001', PASSWORD = 'Test123456';
const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASSWORD }) }).then(r => r.json());
const tok = login.accessToken;
const lists = await fetch(`${API}/api/guest-lists`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json());
const e2e = (lists || []).filter(x => /E2E/.test(x.name || ''));
console.log('E2E lists found:', e2e.length);
for (const l of e2e) {
  const code = await fetch(`${API}/api/guest-lists/${l.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).then(r => r.status);
  console.log(`  DEL ${l.id} (${l.name}) => ${code}`);
}
const after = await fetch(`${API}/api/guest-lists`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json());
console.log('remaining E2E lists:', (after || []).filter(x => /E2E/.test(x.name || '')).length);
