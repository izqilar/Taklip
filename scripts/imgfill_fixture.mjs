/**
 * 「形状 / 文本 图片填充」验证用夹具工程（#85 / #87 / #88）。
 *
 * 用法：node scripts/imgfill_fixture.mjs [--delete]
 *
 * 元素（固定布局，便于像素级采样 + 面板/变换行为验证）：
 *  - s_img：矩形（形状图片填充）—— 验证 ① 面板 5 项适配列表框 + 更换/裁剪按钮
 *                                           ② 缩放无橡皮泥（对齐图片对象范式）
 *  - t_img：文本（文本图片填充）—— 验证 ③ 编辑态 vs 预览态位移一致（#87）
 *
 * 图片为内联 PNG dataURL（左半红 / 右半蓝，居中线 = 元素水平中线），
 * 用于检测「cover 居中」在两端是否同位置。
 */
import { deflateSync } from 'node:zlib';

/* ── 最小 PNG 编码器（RGB，无依赖） ── */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePng(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const left = x < w / 2;
      raw[o++] = left ? 220 : 20; // R
      raw[o++] = 30; // G
      raw[o++] = left ? 30 : 220; // B
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
const PNG_HREF = 'data:image/png;base64,' + makePng(80, 80).toString('base64');

const PROJECT_ID = 'e2e_imgfill_fixture';
const PHONE = '13900001001';

const base = (id, type, x, y, w, h, z) => ({
  id, type, x, y, width: w, height: h, rotation: 0, opacity: 1, visible: true, zIndex: z,
  locked: false, borderWidth: 0, borderColor: '#000000', borderRadius: 0,
  shadowColor: 'transparent', shadowBlur: 0, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0,
});

const schema = {
  id: 'e2e_imgfill',
  title: 'E2E-ImgFill',
  width: 375,
  height: 667,
  version: 1,
  settings: {},
  pages: [
    {
      id: 'pg',
      background: '#ffffff',
      elements: [
        // ① 矩形 + 图片填充（cover）
        {
          ...base('s_img', 'rect', 40, 40, 200, 160, 1),
          fill: '#3366ff',
          strokeWidth: 0,
          lineStyle: 'solid',
          cornerRadius: 0,
          fillType: 'image',
          imageFill: { href: PNG_HREF, fit: 'cover' },
        },
        // ② 文本 + 图片填充（cover）—— 验证编辑/预览位移一致
        {
          ...base('t_img', 'text', 40, 260, 280, 100, 2),
          fill: '#cc0000',
          text: 'IMG',
          fontSize: 64,
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
          fillType: 'image',
          imageFill: { href: PNG_HREF, fit: 'cover' },
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
  update: { schema, draftSchema: null, title: 'E2E-ImgFill', userId: user.id },
  create: { id: PROJECT_ID, userId: user.id, title: 'E2E-ImgFill', status: 'draft', schema },
});

console.log(
  JSON.stringify(
    { projectId: PROJECT_ID, imageHrefBytes: PNG_HREF.length, elements: schema.pages[0].elements.map((e) => ({ id: e.id, type: e.type, fillType: e.fillType })) },
    null, 1,
  ),
);
await prisma.$disconnect();
