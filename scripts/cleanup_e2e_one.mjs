const API = 'http://localhost:3000';
const tok = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }) }).then(r => r.json()).then(d => d.accessToken);
const id = 'cmuuc5nzz002o842jun1c601x';
const recs = await fetch(`${API}/api/guest-lists/${id}/records?page=1&size=200`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json());
const rows = recs?.records ?? [];
console.log('records on list:', rows.length, rows.map(r => r.id));
for (const r of rows) {
  const c = await fetch(`${API}/api/guest-lists/${id}/records/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).then(x => x.status);
  console.log(`  DEL record ${r.id} => ${c}`);
}
const c2 = await fetch(`${API}/api/guest-lists/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).then(x => x.status);
console.log('DEL list =>', c2);
const after = await fetch(`${API}/api/guest-lists`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json());
console.log('remaining E2E lists:', (after || []).filter(x => /E2E/.test(x.name || '')).length);
