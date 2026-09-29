/**
 * 渐变文本镂空缺陷复现夹具。
 *
 * t_grad：文本 + 线性渐变填充（90°，红→蓝），两行、带轮廓描边、居中。
 * 用于验证：预览 DOM（background-clip:text）与导出管线中字形是否完整着色。
 */
const PROJECT_ID = 'e2e_grad_text_fixture';
const PHONE = '13900001001';

const GRADIENT = {
  type: 'linear',
  angle: 90,
  stops: [
    { color: '#ff0000', position: 0 },
    { color: '#0000ff', position: 1 },
  ],
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
  id: 'e2e_grad_text',
  title: 'E2E-GradText',
  width: 375,
  height: 667,
  version: 1,
  settings: {},
  pages: [
    {
      id: 'pg_grad_text',
      background: '#ffffff',
      elements: [
        // ① 多行渐变文本（无轮廓）
        {
          ...base('t_grad_multi', 'text', 40, 60, 295, 160, 1),
          fill: '#cc0000',
          text: '庆柬云\n渐变文字',
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
          fillType: 'gradient',
          gradientFill: GRADIENT,
        },
        // ② 单行渐变文本 + 轮廓描边
        {
          ...base('t_grad_outline', 'text', 40, 260, 295, 80, 2),
          fill: '#cc0000',
          text: 'OUTLINE',
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
          outlineColor: '#111827',
          outlineWidth: 2,
          outlineStyle: 'solid',
          fillType: 'gradient',
          gradientFill: GRADIENT,
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
  update: { schema, draftSchema: null, title: 'E2E-GradText', userId: user.id },
  create: { id: PROJECT_ID, userId: user.id, title: 'E2E-GradText', status: 'draft', schema },
});

console.log('fixture ready:', PROJECT_ID);
await prisma.$disconnect();
