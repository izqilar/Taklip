/**
 * 镜像 + 缩放 E2E 专用 fixture：同一工程里放「无边框」与「有边框」两张图，
 * 用于对偶对照——判断 resize 异常是由边框裁剪 Group 引起，还是 Konva 负缩放本身引起。
 *
 * 与 scripts/parity_fixture.mjs 分开维护：三端一致性 harness 依赖全局唯一纯色块做
 * 标定，新增元素会破坏它的坐标假设。
 */
const PROJECT_ID = 'e2e_mirror_fixture';
const PHONE = '13900001001';

const SOLID =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGM0TvvPgA0wYRUdtBIAQdsBqAOlHsAAAAAASUVORK5CYII=';

const img = (id, x, y, z, borderWidth, rotation = 0) => ({
  id,
  type: 'image',
  x,
  y,
  width: 200,
  height: 160,
  rotation,
  opacity: 1,
  visible: true,
  zIndex: z,
  locked: false,
  src: SOLID,
  naturalWidth: 8,
  naturalHeight: 8,
  objectFit: 'cover',
  borderWidth,
  borderColor: '#eed5c5',
  borderStyle: 'solid',
  borderRadius: 0,
  cornerRadius: 0,
  shadowColor: 'transparent',
  shadowBlur: 0,
  shadowOpacity: 1,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
});

const schema = {
  id: 'e2e_mirror',
  title: 'E2E-Mirror',
  width: 375,
  height: 667,
  version: 1,
  settings: {},
  pages: [
    {
      id: 'pg_mirror',
      name: 'P1',
      background: '#ffffff',
      elements: [
        img('img_noborder', 20, 40, 1, 0), // 无边框（不套裁剪 Group）
        img('img_bordered', 20, 260, 2, 7), // 有边框（套裁剪 Group）
        img('img_rot30', 20, 480, 3, 0, 30), // 带 30° 旋转（回归保护：Transformer 坐标系改动）
      ],
    },
  ],
};

const { PrismaClient } = await import(
  'file:///D:/MyWorkBuddy/2026-08-10-22-39-56/apps/server/prisma/prisma-client/index.js'
);
const prisma = new PrismaClient();

const user = await prisma.user.findFirst({ where: { phone: PHONE }, select: { id: true } });
if (!user) {
  console.error('user not found:', PHONE);
  process.exit(1);
}

await prisma.project.upsert({
  where: { id: PROJECT_ID },
  update: { schema, draftSchema: null, title: 'E2E-Mirror', userId: user.id },
  create: { id: PROJECT_ID, userId: user.id, title: 'E2E-Mirror', status: 'draft', schema },
});

console.log(JSON.stringify({ projectId: PROJECT_ID, elements: schema.pages[0].elements.map((e) => e.id) }));
await prisma.$disconnect();
