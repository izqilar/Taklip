/**
 * 「文本图片填充」复现夹具（用户 real-case：作品 cmuje8nb800011z5cxlptgosw / el_stsxic2omutagiya）。
 *
 * 用法：node scripts/textimgfill_fixture.mjs [--delete]
 *
 * 项目 A `e2e_parity_fixture`：page 0 仅放**用户原始元素**（320×205 / fontSize150 / crop / fit=cover），
 *   —— 供 /parity-text.html?project=e2e_parity_fixture 与编辑器 1:1 对比。
 * 项目 B `e2e_textimgfit_fixture`：page 0 放 5 种适配方式 + 无裁剪对照，验证三端 5 档一致。
 *
 * 图片用真实的 /uploads/1791086195965-448812518.webp（1654×2480），与用户截图同源。
 */
const PHONE = '13900001001';

const IMG = '/uploads/1791086195965-448812518.webp';
/** 用户实际保存的裁剪区域（源图归一化） */
const CROP = { x: 0.138888931274414, y: 0.109259287516276, width: 0.8305555979410808, height: 0.3185184054904514 };

const base = (id, type, x, y, w, h, z) => ({
  id, type, x, y, width: w, height: h, rotation: 0, opacity: 1, visible: true, zIndex: z,
  locked: false, borderWidth: 0, borderColor: '#000000', borderRadius: 0,
  shadowColor: 'transparent', shadowBlur: 0, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0,
});

/** 用户原始元素（逐字段照搬 DB） */
const userElement = {
  ...base('t_photo', 'text', 19, 263, 320, 205, 2),
  fill: '#333333',
  fillType: 'image',
  text: '图片',
  fontSize: 150,
  fontFamily: 'sans-serif',
  fontStyle: 'bold',
  lineHeight: 1.4,
  align: 'left',
  verticalAlign: 'middle',
  letterSpacing: 0,
  wordBreak: 'break-word',
  textDecoration: 'none',
  backgroundColor: 'transparent',
  outlineColor: '#000000',
  outlineWidth: 0,
  outlineStyle: 'solid',
  imageFill: { fit: 'cover', crop: CROP, href: IMG },
};

/** 4 字形一行版本（复刻用户截图里的「图片填充」） */
const userElement4 = {
  ...userElement,
  id: 't_photo4',
  x: 19, y: 24, width: 620, height: 205,
  text: '图片填充',
};

/* ── 项目 B：5 种适配 + 无裁剪对照（小盒，便于同屏对比） ── */
const FIT_CASES = [
  { id: 'f_cover', fit: 'cover', crop: CROP, color: '#4f8cff' },
  { id: 'f_contain', fit: 'contain', crop: CROP, color: '#52c41a' },
  { id: 'f_rep_x', fit: 'repeat-x', crop: CROP, color: '#faad14' },
  { id: 'f_rep_y', fit: 'repeat-y', crop: CROP, color: '#eb2f96' },
  { id: 'f_repeat', fit: 'repeat', crop: CROP, color: '#722ed1' },
  { id: 'f_nocrop', fit: 'cover', crop: null, color: '#13c2c2' },
];
const fitElements = FIT_CASES.map((c, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return {
    ...base(c.id, 'text', 12 + col * 185, 12 + row * 215, 170, 140, i + 1),
    fill: c.color,
    fillType: 'image',
    text: '图片填充',
    fontSize: 30,
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
    lineHeight: 1.2,
    align: 'center',
    verticalAlign: 'middle',
    letterSpacing: 0,
    wordBreak: 'break-word',
    textDecoration: 'none',
    backgroundColor: 'transparent',
    outlineColor: '#000000',
    outlineWidth: 0,
    outlineStyle: 'solid',
    imageFill: { fit: c.fit, crop: c.crop, href: IMG },
  };
});

const proj = (id, title, elements) => ({
  id, title, width: 375, height: 667, version: 1, settings: {},
  pages: [{ id: `${id}_pg`, background: '#ffffff', elements }],
});

const A = { id: 'e2e_parity_fixture', title: 'E2E-ParityTextImgFill' };
const B = { id: 'e2e_textimgfit_fixture', title: 'E2E-TextImgFit5' };

const { PrismaClient } = await import(
  'file:///D:/MyWorkBuddy/2026-08-10-22-39-56/apps/server/prisma/prisma-client/index.js'
);
const prisma = new PrismaClient();

if (process.argv.includes('--delete')) {
  await prisma.project.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  console.log('deleted', A.id, B.id);
  await prisma.$disconnect();
  process.exit(0);
}

const user = await prisma.user.findFirst({ where: { phone: PHONE }, select: { id: true } });
if (!user) { console.error('user not found', PHONE); process.exit(1); }

const upsert = (meta, schema) =>
  prisma.project.upsert({
    where: { id: meta.id },
    update: { title: meta.title, schema, draftSchema: null, userId: user.id },
    create: { id: meta.id, userId: user.id, title: meta.title, status: 'draft', schema },
  });

await upsert(A, proj(A.id, A.title, [userElement4, userElement]));
await upsert(B, proj(B.id, B.title, fitElements));

console.log(JSON.stringify({ A: A.id, B: B.id, cases: FIT_CASES.map((c) => `${c.id}:${c.fit}`) }, null, 1));
await prisma.$disconnect();
