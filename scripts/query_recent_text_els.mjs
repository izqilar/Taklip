/**
 * 查最近 24h 更新的项目中所有 text 元素，输出字体/字距/码点，
 * 重点检查是否残留 Presentation Forms (FB50-FDFF / FE70-FEFF)
 * 用法：node scripts/query_recent_text_els.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'apps/server/package.json'));
const { PrismaClient } = require2('@prisma/client');
const prisma = new PrismaClient();

const since = new Date(Date.now() - 24 * 3600 * 1000);
const projects = await prisma.project.findMany({
  where: { updatedAt: { gte: since } },
  select: { id: true, title: true, updatedAt: true, schema: true },
  orderBy: { updatedAt: 'desc' },
});
console.log('recent projects:', projects.length);
let pfHits = 0;
for (const p of projects) {
  const schema = p.schema;
  if (!schema || typeof schema !== 'object') continue;
  for (const page of schema.pages || []) {
    for (const el of page.elements || []) {
      if (el.type !== 'text') continue;
      const t = el.text || '';
      if (!t.trim()) continue;
      const cps = [...t].map((c) => c.codePointAt(0));
      const hasPF = cps.some((cp) => (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff));
      if (hasPF) pfHits++;
      // 只打印含 lam/alef 或 PF 的元素，避免刷屏
      const hasLA = cps.some((cp) => cp === 0x644) && cps.some((cp) => cp === 0x627);
      if (!hasLA && !hasPF) continue;
      console.log('---- project:', p.title, '| updatedAt:', p.updatedAt?.toISOString?.());
      console.log('text:', JSON.stringify(t.slice(0, 60)));
      console.log('font:', el.fontFamily, '| ls:', el.letterSpacing, '| align:', el.align, '| dir:', el.direction, '| bold:', el.fontStyle);
      console.log('cps:', cps.map((c) => c.toString(16)).join(' '));
      if (hasPF) console.log('*** HAS PRESENTATION FORMS ***');
    }
  }
}
console.log('projects:', projects.length, '| elements with PF:', pfHits);
await prisma.$disconnect();
