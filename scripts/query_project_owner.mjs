/** 查项目属主 id（简化） */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'apps/server/package.json'));
const { PrismaClient } = require2('@prisma/client');
const prisma = new PrismaClient();
const ps = await prisma.project.findMany({
  where: { OR: [{ title: { contains: '银婚' } }, { title: { contains: 'تەكلىپنامە' } }] },
  select: { id: true, title: true, userId: true, updatedAt: true },
  orderBy: { updatedAt: 'desc' },
});
for (const p of ps) console.log(p.title, '| id:', p.id, '| owner:', p.userId);
await prisma.$disconnect();
