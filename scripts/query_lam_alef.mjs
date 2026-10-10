/**
 * 查找 schema 中包含 lam(0644) 后紧跟 alef(0627) 的 text 元素，输出完整属性
 * 用法：node scripts/query_lam_alef.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'apps/server/package.json'));
const { PrismaClient } = require2('@prisma/client');
const prisma = new PrismaClient();

const LA = '\u0644\u0627'; // lam + alef（逻辑序）
const projects = await prisma.project.findMany({
  select: { id: true, title: true, updatedAt: true, schema: true },
  orderBy: { updatedAt: 'desc' },
  take: 500,
});
let hits = 0;
for (const p of projects) {
  const schema = p.schema;
  if (!schema || typeof schema !== 'object') continue;
  for (const page of schema.pages || []) {
    for (const el of page.elements || []) {
      if (el.type !== 'text') continue;
      const t = el.text || '';
      if (t.includes(LA)) {
        hits++;
        console.log('---- project:', p.title, '| updatedAt:', p.updatedAt?.toISOString?.());
        console.log('text:', JSON.stringify(t));
        console.log('props:', JSON.stringify({
          fontFamily: el.fontFamily, fontSize: el.fontSize, letterSpacing: el.letterSpacing,
          align: el.align, direction: el.direction, fontStyle: el.fontStyle,
          outlineWidth: el.outlineWidth, binding: el.binding, wordBreak: el.wordBreak,
          fill: el.fill, fillProps: el.fillProps ? Object.keys(el.fillProps) : undefined,
        }));
        // 输出码点序列，检查是否有 ZWNJ/其他控制符夹在中间
        const cps = [...t].map((c) => c.codePointAt(0).toString(16)).join(' ');
        console.log('codepoints:', cps);
      }
    }
  }
}
console.log('hits:', hits, '| projects scanned:', projects.length);
await prisma.$disconnect();
