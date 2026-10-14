import { PrismaClient } from '../apps/server/prisma/prisma-client/index.js';
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://h5design:h5design_dev_2026@localhost:5432/h5design_platform' } } });
const pid = 'cmv414wcj006sjpfqivngjekg';
const jobs = await p.renderJob.findMany({ where: { projectId: pid }, orderBy: { createdAt: 'asc' }, select: { id: true, status: true, mode: true, targetRecordIds: true, createdAt: true, total: true } });
for (const j of jobs) console.log(j.createdAt.toISOString(), j.status, j.mode, 'total=' + j.total, JSON.stringify(j.targetRecordIds));
const pr = await p.batchRenderProject.findUnique({ where: { id: pid } });
console.log('renderCounts =', JSON.stringify(pr.renderCounts), 'remaining calc:', pr.freeRendered, pr.paidRendered, pr.purchasedHeadcount);
await p.$disconnect();
