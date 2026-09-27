/**
 * 「填充类型（单色 / 渐变 / 图案）」验证用夹具工程。
 *
 * 用法：node scripts/fill_fixture.mjs [--delete]
 *
 * 元素布局固定，便于像素级采样比对（编辑器 Konva vs 发布态 DOM）：
 *  - r_grad：矩形（DOM 走 div background-image，Konva 走 Rect）
 *  - p_grad：多边形（DOM 走 SVG <defs> + linearGradient，Konva 走 RegularPolygon）
 *  - t_pat ：文本（DOM 走 background-clip:text，Konva 走 Text）
 * 三者覆盖了本次改造的全部三条渲染路径。
 */
const PROJECT_ID = 'e2e_fill_fixture';
const PHONE = '13900001001';

const GRADIENT = {
  type: 'linear',
  angle: 90, // 自左向右
  stops: [
    { color: '#ff0000', position: 0 },
    { color: '#0000ff', position: 1 },
  ],
};

const GRADIENT_RADIAL = {
  type: 'radial',
  angle: 90,
  stops: [
    { color: '#ff0000', position: 0 },
    { color: '#0000ff', position: 1 },
  ],
};

const PATTERN = {
  kind: 'checker',
  foreground: '#111827',
  background: '#ffffff',
  scale: 1,
};

const base = (id, type, x, y, w, h, z) => ({
  id,
  type,
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
  opacity: 1,
  visible: true,
  zIndex: z,
  locked: false,
  borderWidth: 0,
  borderColor: '#000000',
  borderRadius: 0,
  shadowColor: 'transparent',
  shadowBlur: 0,
  shadowOpacity: 1,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
});

const schema = {
  id: 'e2e_fill',
  title: 'E2E-Fill',
  width: 375,
  height: 667,
  version: 1,
  settings: {},
  pages: [
    {
      id: 'pg_fill',
      background: '#ffffff',
      elements: [
        // ① 矩形 + 线性渐变（左红 → 右蓝）
        {
          ...base('r_grad', 'rect', 40, 40, 240, 120, 1),
          fill: '#3366ff',
          stroke: undefined,
          strokeWidth: 0,
          lineStyle: 'solid',
          cornerRadius: 0,
          fillType: 'gradient',
          gradientFill: GRADIENT,
          patternFill: PATTERN,
        },
        // ② 多边形 + 径向渐变（走 SVG <defs> 路径）
        {
          ...base('p_grad', 'polygon', 40, 200, 160, 160, 2),
          fill: '#3366ff',
          sides: 6,
          stroke: undefined,
          strokeWidth: 0,
          lineStyle: 'solid',
          fillType: 'gradient',
          gradientFill: GRADIENT_RADIAL,
          patternFill: PATTERN,
        },
        // ③ 矩形 + 图案填充（DOM 走 background-image 平铺，Konva 走 fillPatternImage）
        {
          ...base('r_pat', 'rect', 220, 200, 120, 160, 4),
          fill: '#3366ff',
          stroke: undefined,
          strokeWidth: 0,
          lineStyle: 'solid',
          cornerRadius: 0,
          fillType: 'pattern',
          gradientFill: GRADIENT,
          patternFill: PATTERN,
        },
        // ④ 文本 + 图案填充（走 background-clip:text 路径）
        {
          ...base('t_pat', 'text', 40, 400, 240, 80, 3),
          fill: '#cc0000',
          text: 'FILL',
          fontSize: 48,
          fontFamily: 'Arial',
          fontStyle: 'bold',
          lineHeight: 1.4,
          letterSpacing: 0,
          align: 'center',
          verticalAlign: 'middle',
          wordBreak: 'normal',
          textDecoration: 'none',
          backgroundColor: 'transparent',
          direction: 'ltr',
          outlineColor: '#000000',
          outlineWidth: 0,
          outlineStyle: 'solid',
          fillType: 'pattern',
          gradientFill: GRADIENT,
          patternFill: PATTERN,
        },
      ],
    },
  ],
};

const { PrismaClient } = await import(
  'file:///D:/MyWorkBuddy/2026-08-10-22-39-56/apps/server/prisma/prisma-client/index.js'
);
const prisma = new PrismaClient();

if (process.argv.includes('--delete')) {
  await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
  console.log('deleted fixture', PROJECT_ID);
  await prisma.$disconnect();
  process.exit(0);
}

const user = await prisma.user.findFirst({ where: { phone: PHONE }, select: { id: true } });
if (!user) {
  console.error('user not found:', PHONE);
  process.exit(1);
}

await prisma.project.upsert({
  where: { id: PROJECT_ID },
  update: { schema, draftSchema: null, title: 'E2E-Fill', userId: user.id },
  create: { id: PROJECT_ID, userId: user.id, title: 'E2E-Fill', status: 'draft', schema },
});

console.log(
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      layout: schema.pages[0].elements.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        w: e.width,
        h: e.height,
        fillType: e.fillType,
      })),
    },
    null,
    1,
  ),
);
await prisma.$disconnect();
