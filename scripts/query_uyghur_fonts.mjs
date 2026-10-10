/**
 * 查询含维吾尔文字符的 text 元素用了哪些字体（判定用户实际字体）
 * 用法：node scripts/query_uyghur_fonts.mjs （需在 apps/server 目录上下文运行 prisma client）
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'apps/server/package.json'));
const { PrismaClient } = require2('@prisma/client');
const prisma = new PrismaClient();

const projects = await prisma.project.findMany({
  select: { id: true, title: true, updatedAt: true, schema: true },
  orderBy: { updatedAt: 'desc' },
  take: 300,
});

const UY = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const found = new Map(); // fontFamily -> { texts: [], project: string, updatedAt }
for (const p of projects) {
  const schema = p.schema;
  if (!schema || typeof schema !== 'object') continue;
  const pages = schema.pages || [];
  for (const page of pages) {
    for (const el of page.elements || []) {
      if (el.type !== 'text') continue;
      const t = el.text || '';
      if (UY.test(t)) {
        const fam = el.fontFamily || '(none)';
        if (!found.has(fam)) found.set(fam, { texts: [], project: p.title, updatedAt: p.updatedAt });
        const rec = found.get(fam);
        if (rec.texts.length < 5) rec.texts.push(t.slice(0, 60));
      }
    }
  }
}
console.log('projects scanned:', projects.length);
for (const [fam, rec] of found) {
  console.log('\nFONT:', fam, '| project:', rec.project, '| updatedAt:', rec.updatedAt?.toISOString?.());
  for (const t of rec.texts) console.log('   text:', JSON.stringify(t));
}
if (found.size === 0) console.log('no uyghur text elements found');
await prisma.$disconnect();
