/**
 * 「图片对象边框随裁剪形状自适应」验证夹具（#90）。
 *
 * 用法：node scripts/clipborder_fixture.mjs [--delete]
 *
 * 9 个图片元素（3×3 网格，每个 110×90，边框 10px 纯红 #e20000，内容为纯灰 #808080 图）：
 *  - c_none        裁剪形状 none（矩形对照：边框 = 矩形盒式，用于**标定**画布像素映射）
 *  - c_circle      圆形
 *  - c_ellipse     椭圆
 *  - c_triangle    三角形
 *  - c_hexagon     六边形
 *  - c_star        星形
 *  - c_heart       心形
 *  - c_heart_dash  心形 + 虚线边框（线型覆盖）
 *  - c_star_double 星形 + 双线边框（线型覆盖）
 *
 * 颜色刻意选取互不混淆的三色：背景白 / 内容灰 / 边框红，
 * 便于在编辑器画布与预览 DOM 上做「轮廓上必为红、盒角处必非红」的像素采样断言。
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
function makeGrayPng(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      raw[o++] = 128; // 纯灰：与白色背景、红色边框都不混淆
      raw[o++] = 128;
      raw[o++] = 128;
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG_HREF = 'data:image/png;base64,' + makeGrayPng(80, 80).toString('base64');

const PROJECT_ID = 'e2e_clipborder_fixture';
const PHONE = '13900001001';

const W = 110;
const H = 90;
const BW = 10;
const BORDER = '#e20000';

const base = (id, x, y, z) => ({
  id, type: 'image', x, y, width: W, height: H, rotation: 0, opacity: 1, visible: true, zIndex: z,
  locked: false, src: PNG_HREF, objectFit: 'cover',
  naturalWidth: 80, naturalHeight: 80,
  borderWidth: BW, borderColor: BORDER, borderStyle: 'solid', borderRadius: 0,
  clip: { shape: 'none' },
  shadowColor: 'transparent', shadowBlur: 0, shadowOpacity: 1, shadowOffsetX: 0, shadowOffsetY: 0,
  filterBrightness: 100, filterContrast: 100, filterBlur: 0,
});

/** 3×3 网格：列 x = 15 / 132 / 250，行 y = 30 / 140 / 250 */
const COLS = [15, 132, 250];
const ROWS = [30, 140, 250];
const cell = (col, row) => [COLS[col], ROWS[row]];

const SHAPES = [
  'none', 'circle', 'ellipse',
  'triangle', 'hexagon', 'star',
  'heart', 'heart_dash', 'star_double',
];

const elements = [];
SHAPES.forEach((key, i) => {
  const [x, y] = cell(i % 3, Math.floor(i / 3));
  const el = base(`c_${key}`, x, y, i + 1);
  if (key === 'none') {
    el.clip = { shape: 'none' };
  } else if (key === 'heart_dash') {
    el.clip = { shape: 'heart' };
    el.borderStyle = 'dashed';
  } else if (key === 'star_double') {
    el.clip = { shape: 'star' };
    el.borderStyle = 'double';
  } else {
    el.clip = { shape: key };
  }
  elements.push(el);
});

const schema = {
  id: 'e2e_clipborder',
  title: 'E2E-ClipBorder',
  width: 375,
  height: 667,
  version: 1,
  settings: {},
  pages: [
    {
      id: 'pg',
      background: '#ffffff',
      elements,
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
  update: { schema, draftSchema: null, title: 'E2E-ClipBorder', userId: user.id },
  create: { id: PROJECT_ID, userId: user.id, title: 'E2E-ClipBorder', status: 'draft', schema },
});

console.log(
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      box: { W, H, BW, BORDER },
      elements: elements.map((e) => ({ id: e.id, x: e.x, y: e.y, shape: e.clip.shape, style: e.borderStyle })),
    },
    null,
    1,
  ),
);
await prisma.$disconnect();
