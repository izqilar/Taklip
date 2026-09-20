/**
 * 模板种子脚本 — 向 Template 表插入预制 H5 模板
 * 运行: npx tsx prisma/seed-templates.ts
 *
 * 一键制作（Quick Make）支持：关键元素已标注 `bind`，
 * 与 apps/web/src/wizard/quickMakeConfig.ts 的字段一一对应；
 * 末尾 image 元素（bind:'cover'）作为底部封面图承载位。
 */
import { PrismaClient } from './prisma-client';

const prisma = new PrismaClient();

/** 生成模板 schema 的辅助函数 */
function makeTemplateSchema(name: string, bg: string, elements: unknown[]) {
  return {
    id: `tpl_${name}`,
    title: name,
    width: 375,
    height: 667,
    pages: [
      {
        id: `page_${name}`,
        name: '第 1 页',
        background: bg,
        elements,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** 底部封面图承载位（一键制作上传的图片注入到这里） */
const COVER_SLOT = {
  id: 'cover',
  type: 'image',
  x: 0,
  y: 567,
  width: 375,
  height: 100,
  rotation: 0,
  opacity: 1,
  zIndex: 0,
  visible: true,
  locked: false,
  src: '',
  cornerRadius: 8,
  objectFit: 'cover',
};

const templates = [
  {
    name: '浪漫婚礼请柬',
    category: 'wedding',
    tags: ['婚礼', '请柬', '浪漫'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('wedding1', '#FFF0F5', [
      { id: 'el1', type: 'rect', x: 30, y: 60, width: 315, height: 80, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#E75480', cornerRadius: 12 },
      { id: 'el2', type: 'text', x: 50, y: 75, width: 275, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '我们结婚了', fontSize: 36, fontFamily: 'serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 4, bind: 'title' },
      { id: 'el3', type: 'text', x: 50, y: 170, width: 275, height: 30, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '2026年8月15日', fontSize: 16, fontFamily: 'serif', fill: '#E75480', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'date' },
      { id: 'el4', type: 'circle', x: 140, y: 250, width: 95, height: 95, rotation: 0, opacity: 0.9, zIndex: 4, visible: true, locked: false, fill: '#FFB6C1', radius: 47 },
      { id: 'el5', type: 'text', x: 50, y: 380, width: 275, height: 60, rotation: 0, opacity: 1, zIndex: 5, visible: true, locked: false, text: '诚挚邀请您参加我们的婚礼\n共同见证爱的誓言', fontSize: 14, fontFamily: 'sans-serif', fill: '#666', align: 'center', lineHeight: 1.8, letterSpacing: 1, bind: 'invitation' },
      { id: 'el6', type: 'line', x: 50, y: 470, width: 275, height: 2, rotation: 0, opacity: 0.3, zIndex: 6, visible: true, locked: false, stroke: '#E75480', strokeWidth: 1, points: [0, 1, 275, 1] },
      { id: 'el7', type: 'text', x: 50, y: 490, width: 275, height: 30, rotation: 0, opacity: 0.7, zIndex: 7, visible: true, locked: false, text: '地址：XX酒店·XX厅', fontSize: 13, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
  {
    name: '企业招聘海报',
    category: 'recruitment',
    tags: ['招聘', '企业', '海报'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('recruit1', '#1a1a2e', [
      { id: 'el1', type: 'rect', x: 0, y: 0, width: 375, height: 250, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#16213e' },
      { id: 'el2', type: 'text', x: 30, y: 60, width: 315, height: 60, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: 'JOIN US', fontSize: 48, fontFamily: 'sans-serif', fill: '#E94560', align: 'center', lineHeight: 1.2, letterSpacing: 6 },
      { id: 'el3', type: 'text', x: 30, y: 130, width: 315, height: 30, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '加入我们，共创未来', fontSize: 18, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'slogan' },
      { id: 'el4', type: 'rect', x: 30, y: 280, width: 315, height: 60, rotation: 0, opacity: 1, zIndex: 4, visible: true, locked: false, fill: '#E94560', cornerRadius: 8 },
      { id: 'el5', type: 'text', x: 50, y: 290, width: 275, height: 40, rotation: 0, opacity: 1, zIndex: 5, visible: true, locked: false, text: '高级前端工程师', fontSize: 20, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'position' },
      { id: 'el6', type: 'text', x: 30, y: 370, width: 315, height: 100, rotation: 0, opacity: 0.8, zIndex: 6, visible: true, locked: false, text: '岗位要求：\n1. 3年以上前端开发经验\n2. 精通React/Vue\n3. 了解Node.js', fontSize: 14, fontFamily: 'sans-serif', fill: '#CCCCCC', align: 'left', lineHeight: 1.8, letterSpacing: 0, bind: 'requirements' },
      { id: 'el7', type: 'line', x: 30, y: 500, width: 315, height: 2, rotation: 0, opacity: 0.3, zIndex: 7, visible: true, locked: false, stroke: '#E94560', strokeWidth: 1, points: [0, 1, 315, 1] },
      { id: 'el8', type: 'text', x: 30, y: 520, width: 315, height: 30, rotation: 0, opacity: 0.6, zIndex: 8, visible: true, locked: false, text: 'hr@example.com', fontSize: 13, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'contact' },
      COVER_SLOT,
    ]),
  },
  {
    name: '会议邀请函',
    category: 'conference',
    tags: ['会议', '邀请', '商务'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('conf1', '#f0f4f8', [
      { id: 'el1', type: 'rect', x: 30, y: 40, width: 315, height: 587, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#FFFFFF', cornerRadius: 16 },
      { id: 'el2', type: 'rect', x: 30, y: 40, width: 315, height: 6, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, fill: '#3B82F6', cornerRadius: 0 },
      { id: 'el3', type: 'text', x: 50, y: 80, width: 275, height: 40, rotation: 0, opacity: 1, zIndex: 3, visible: true, locked: false, text: '会议邀请函', fontSize: 28, fontFamily: 'sans-serif', fill: '#1E3A5F', align: 'center', lineHeight: 1.5, letterSpacing: 4, bind: 'title' },
      { id: 'el4', type: 'line', x: 120, y: 135, width: 135, height: 2, rotation: 0, opacity: 0.4, zIndex: 4, visible: true, locked: false, stroke: '#3B82F6', strokeWidth: 2, points: [0, 1, 135, 1] },
      { id: 'el5', type: 'text', x: 50, y: 160, width: 275, height: 120, rotation: 0, opacity: 0.8, zIndex: 5, visible: true, locked: false, text: '尊敬的嘉宾：\n\n诚挚邀请您出席2026年度\n技术创新峰会', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'content' },
      { id: 'el6', type: 'rect', x: 80, y: 320, width: 215, height: 100, rotation: 0, opacity: 0.1, zIndex: 6, visible: true, locked: false, fill: '#3B82F6', cornerRadius: 12 },
      { id: 'el7', type: 'text', x: 80, y: 330, width: 215, height: 80, rotation: 0, opacity: 1, zIndex: 7, visible: true, locked: false, text: '时间：2026.09.20\n地点：国际会议中心\n主题：AI驱动未来', fontSize: 14, fontFamily: 'sans-serif', fill: '#1E3A5F', align: 'center', lineHeight: 2, letterSpacing: 0, bind: 'info' },
      { id: 'el8', type: 'text', x: 50, y: 460, width: 275, height: 30, rotation: 0, opacity: 0.5, zIndex: 8, visible: true, locked: false, text: '期待您的莅临', fontSize: 13, fontFamily: 'serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'blessing' },
      COVER_SLOT,
    ]),
  },
  {
    name: '生日祝福贺卡',
    category: 'birthday',
    tags: ['生日', '祝福', '贺卡'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('birthday1', '#FFF8DC', [
      { id: 'el1', type: 'circle', x: 120, y: 80, width: 135, height: 135, rotation: 0, opacity: 0.3, zIndex: 1, visible: true, locked: false, fill: '#FFD700', radius: 67 },
      { id: 'el2', type: 'circle', x: 140, y: 100, width: 95, height: 95, rotation: 0, opacity: 0.5, zIndex: 2, visible: true, locked: false, fill: '#FF6347', radius: 47 },
      { id: 'el3', type: 'text', x: 30, y: 250, width: 315, height: 60, rotation: 0, opacity: 1, zIndex: 3, visible: true, locked: false, text: 'Happy Birthday', fontSize: 36, fontFamily: 'cursive, serif', fill: '#FF6347', align: 'center', lineHeight: 1.2, letterSpacing: 3, bind: 'title' },
      { id: 'el4', type: 'text', x: 30, y: 320, width: 315, height: 40, rotation: 0, opacity: 0.8, zIndex: 4, visible: true, locked: false, text: '愿你天天快乐，岁岁平安', fontSize: 18, fontFamily: 'sans-serif', fill: '#DAA520', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'blessing' },
      { id: 'el5', type: 'rect', x: 80, y: 400, width: 215, height: 50, rotation: 0, opacity: 1, zIndex: 5, visible: true, locked: false, fill: '#FF6347', cornerRadius: 25 },
      { id: 'el6', type: 'text', x: 80, y: 410, width: 215, height: 30, rotation: 0, opacity: 1, zIndex: 6, visible: true, locked: false, text: '点击查看祝福', fontSize: 16, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'cta' },
      { id: 'el7', type: 'line', x: 30, y: 500, width: 315, height: 2, rotation: 0, opacity: 0.2, zIndex: 7, visible: true, locked: false, stroke: '#FFD700', strokeWidth: 1, points: [0, 1, 315, 1] },
      { id: 'el8', type: 'text', x: 30, y: 520, width: 315, height: 30, rotation: 0, opacity: 0.5, zIndex: 8, visible: true, locked: false, text: '— 来自最在乎你的人', fontSize: 13, fontFamily: 'serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'from' },
      COVER_SLOT,
    ]),
  },
  {
    name: '企业宣传画册',
    category: 'marketing',
    tags: ['企业', '宣传', '画册'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('marketing1', '#0F0E17', [
      { id: 'el1', type: 'rect', x: 0, y: 0, width: 375, height: 300, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#1A1A2E' },
      { id: 'el2', type: 'rect', x: 30, y: 30, width: 4, height: 60, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, fill: '#00C49A' },
      { id: 'el3', type: 'text', x: 50, y: 30, width: 280, height: 60, rotation: 0, opacity: 1, zIndex: 3, visible: true, locked: false, text: '创新科技', fontSize: 32, fontFamily: 'sans-serif', fill: '#00C49A', align: 'left', lineHeight: 1.5, letterSpacing: 2, bind: 'title' },
      { id: 'el4', type: 'text', x: 50, y: 100, width: 280, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: 'INNOVATION TECHNOLOGY', fontSize: 12, fontFamily: 'sans-serif', fill: '#888', align: 'left', lineHeight: 1.5, letterSpacing: 3, bind: 'subtitle' },
      { id: 'el5', type: 'text', x: 30, y: 340, width: 315, height: 80, rotation: 0, opacity: 0.8, zIndex: 5, visible: true, locked: false, text: '用科技赋能企业\n让创新触手可及', fontSize: 22, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.8, letterSpacing: 2, bind: 'slogan' },
      { id: 'el6', type: 'rect', x: 100, y: 470, width: 175, height: 50, rotation: 0, opacity: 1, zIndex: 6, visible: true, locked: false, fill: '#00C49A', cornerRadius: 8 },
      { id: 'el7', type: 'text', x: 100, y: 480, width: 175, height: 30, rotation: 0, opacity: 1, zIndex: 7, visible: true, locked: false, text: '了解更多', fontSize: 16, fontFamily: 'sans-serif', fill: '#0F0E17', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'cta' },
      { id: 'el8', type: 'text', x: 30, y: 560, width: 315, height: 30, rotation: 0, opacity: 0.4, zIndex: 8, visible: true, locked: false, text: 'www.example-tech.com', fontSize: 12, fontFamily: 'sans-serif', fill: '#666', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'website' },
      COVER_SLOT,
    ]),
  },
  {
    name: '教育培训招生',
    category: 'education',
    tags: ['教育', '培训', '招生'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('edu1', '#E8F5E9', [
      { id: 'el1', type: 'rect', x: 30, y: 40, width: 315, height: 200, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#2E7D32', cornerRadius: 16 },
      { id: 'el2', type: 'text', x: 50, y: 70, width: 275, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '2026春季招生', fontSize: 28, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 3, bind: 'title' },
      { id: 'el3', type: 'text', x: 50, y: 130, width: 275, height: 30, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '名额有限，先到先得', fontSize: 16, fontFamily: 'sans-serif', fill: '#A5D6A7', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'subtitle' },
      { id: 'el4', type: 'circle', x: 160, y: 170, width: 55, height: 55, rotation: 0, opacity: 0.9, zIndex: 4, visible: true, locked: false, fill: '#FFD54F', radius: 27 },
      { id: 'el5', type: 'text', x: 30, y: 280, width: 315, height: 40, rotation: 0, opacity: 1, zIndex: 5, visible: true, locked: false, text: '课程亮点', fontSize: 20, fontFamily: 'sans-serif', fill: '#2E7D32', align: 'center', lineHeight: 1.5, letterSpacing: 2 },
      { id: 'el6', type: 'text', x: 50, y: 330, width: 275, height: 120, rotation: 0, opacity: 0.8, zIndex: 6, visible: true, locked: false, text: '✓ 资深名师授课\n✓ 小班互动教学\n✓ 课后辅导跟踪\n✓ 免费试听体验', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'left', lineHeight: 2, letterSpacing: 0, bind: 'highlights' },
      { id: 'el7', type: 'rect', x: 80, y: 480, width: 215, height: 50, rotation: 0, opacity: 1, zIndex: 7, visible: true, locked: false, fill: '#2E7D32', cornerRadius: 25 },
      { id: 'el8', type: 'text', x: 80, y: 490, width: 215, height: 30, rotation: 0, opacity: 1, zIndex: 8, visible: true, locked: false, text: '立即报名', fontSize: 18, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'cta' },
      COVER_SLOT,
    ]),
  },
  {
    name: '春节祝福贺卡',
    category: 'festival',
    tags: ['春节', '节日', '祝福'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('festival1', '#D32F2F', [
      { id: 'el1', type: 'rect', x: 30, y: 30, width: 315, height: 5, rotation: 0, opacity: 0.8, zIndex: 1, visible: true, locked: false, fill: '#FFD700' },
      { id: 'el2', type: 'rect', x: 30, y: 632, width: 315, height: 5, rotation: 0, opacity: 0.8, zIndex: 2, visible: true, locked: false, fill: '#FFD700' },
      { id: 'el3', type: 'circle', x: 120, y: 80, width: 135, height: 135, rotation: 0, opacity: 0.15, zIndex: 3, visible: true, locked: false, fill: '#FFD700', radius: 67 },
      { id: 'el4', type: 'text', x: 30, y: 110, width: 315, height: 80, rotation: 0, opacity: 1, zIndex: 4, visible: true, locked: false, text: '新春快乐', fontSize: 48, fontFamily: 'serif', fill: '#FFD700', align: 'center', lineHeight: 1.2, letterSpacing: 8, bind: 'title' },
      { id: 'el5', type: 'text', x: 30, y: 210, width: 315, height: 40, rotation: 0, opacity: 0.9, zIndex: 5, visible: true, locked: false, text: '万事如意 阖家幸福', fontSize: 20, fontFamily: 'serif', fill: '#FFE082', align: 'center', lineHeight: 1.5, letterSpacing: 4, bind: 'blessing' },
      { id: 'el6', type: 'rect', x: 60, y: 300, width: 255, height: 120, rotation: 0, opacity: 0.2, zIndex: 6, visible: true, locked: false, fill: '#FFD700', cornerRadius: 12 },
      { id: 'el7', type: 'text', x: 60, y: 310, width: 255, height: 100, rotation: 0, opacity: 1, zIndex: 7, visible: true, locked: false, text: '辞旧迎新\n福到万家\n喜气盈门', fontSize: 18, fontFamily: 'serif', fill: '#FFD700', align: 'center', lineHeight: 1.8, letterSpacing: 2, bind: 'content' },
      { id: 'el8', type: 'text', x: 30, y: 480, width: 315, height: 30, rotation: 0, opacity: 0.6, zIndex: 8, visible: true, locked: false, text: '— 恭贺新禧 —', fontSize: 14, fontFamily: 'serif', fill: '#FFCC02', align: 'center', lineHeight: 1.5, letterSpacing: 4, bind: 'sign' },
      COVER_SLOT,
    ]),
  },
  {
    name: '简约婚礼邀请',
    category: 'wedding',
    tags: ['婚礼', '简约', '邀请'],
    cover: null,
    isOfficial: false,
    schema: makeTemplateSchema('wedding2', '#FAFAFA', [
      { id: 'el1', type: 'rect', x: 20, y: 40, width: 335, height: 587, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#FFFFFF', cornerRadius: 0 },
      { id: 'el2', type: 'text', x: 30, y: 80, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: 'Wedding Invitation', fontSize: 16, fontFamily: 'serif', fill: '#BDBDBD', align: 'center', lineHeight: 1.5, letterSpacing: 4 },
      { id: 'el3', type: 'line', x: 120, y: 140, width: 135, height: 2, rotation: 0, opacity: 0.3, zIndex: 3, visible: true, locked: false, stroke: '#9E9E9E', strokeWidth: 1, points: [0, 1, 135, 1] },
      { id: 'el4', type: 'text', x: 30, y: 170, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 4, visible: true, locked: false, text: '李明 & 王芳', fontSize: 32, fontFamily: 'serif', fill: '#424242', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'title' },
      { id: 'el5', type: 'text', x: 30, y: 240, width: 315, height: 30, rotation: 0, opacity: 0.6, zIndex: 5, visible: true, locked: false, text: '2026.10.01', fontSize: 18, fontFamily: 'serif', fill: '#9E9E9E', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'date' },
      { id: 'el6', type: 'text', x: 50, y: 320, width: 275, height: 80, rotation: 0, opacity: 0.7, zIndex: 6, visible: true, locked: false, text: '愿与您共同见证\n我们的幸福时刻', fontSize: 15, fontFamily: 'serif', fill: '#757575', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'invitation' },
      { id: 'el7', type: 'line', x: 120, y: 430, width: 135, height: 2, rotation: 0, opacity: 0.3, zIndex: 7, visible: true, locked: false, stroke: '#9E9E9E', strokeWidth: 1, points: [0, 1, 135, 1] },
      { id: 'el8', type: 'text', x: 30, y: 460, width: 315, height: 60, rotation: 0, opacity: 0.5, zIndex: 8, visible: true, locked: false, text: 'XX大酒店 3楼宴会厅\n下午 6:00', fontSize: 13, fontFamily: 'sans-serif', fill: '#BDBDBD', align: 'center', lineHeight: 1.8, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
  {
    name: '宝宝满月宴请柬',
    category: 'birth_celebration',
    tags: ['满月', '宴请'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('birthceleb1', '#FFF0F5', [
      { id: 'el1', type: 'text', x: 30, y: 120, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '小宝贝满月啦', fontSize: 32, fontFamily: 'serif', fill: '#E75480', align: 'center', lineHeight: 1.5, letterSpacing: 3, bind: 'title' },
      { id: 'el2', type: 'text', x: 50, y: 200, width: 275, height: 80, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '诚邀您共享这份喜悦\n见证成长的第一步', fontSize: 15, fontFamily: 'sans-serif', fill: '#666', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'invitation' },
      { id: 'el3', type: 'text', x: 50, y: 400, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: 'XX酒楼 · 中午 12:00', fontSize: 14, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
  {
    name: '乔迁新居邀请函',
    category: 'housewarming',
    tags: ['乔迁宴'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('housewarming1', '#E8F5E9', [
      { id: 'el1', type: 'text', x: 30, y: 120, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '乔迁之喜', fontSize: 36, fontFamily: 'serif', fill: '#2E7D32', align: 'center', lineHeight: 1.5, letterSpacing: 6, bind: 'title' },
      { id: 'el2', type: 'text', x: 50, y: 200, width: 275, height: 80, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '新居落成，诚邀您\n来家里坐坐', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'invitation' },
      { id: 'el3', type: 'text', x: 50, y: 400, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: '阳光花园 3 栋 1001', fontSize: 14, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
  {
    name: '升学宴邀请函',
    category: 'school_promotion',
    tags: ['大学'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('school1', '#E3F2FD', [
      { id: 'el1', type: 'text', x: 30, y: 120, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '金榜题名', fontSize: 36, fontFamily: 'serif', fill: '#1565C0', align: 'center', lineHeight: 1.5, letterSpacing: 6, bind: 'title' },
      { id: 'el2', type: 'text', x: 50, y: 200, width: 275, height: 80, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '十余年寒窗，终成硕果\n恭贺考入理想学府', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'content' },
      { id: 'el3', type: 'text', x: 50, y: 400, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: 'XX大酒店 · 晚宴 18:00', fontSize: 14, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'info' },
      COVER_SLOT,
    ]),
  },
  {
    name: '老同学聚会邀请',
    category: 'social_gathering',
    tags: ['同学聚会'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('social1', '#FFF3E0', [
      { id: 'el1', type: 'text', x: 30, y: 120, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '同学聚首', fontSize: 34, fontFamily: 'serif', fill: '#EF6C00', align: 'center', lineHeight: 1.5, letterSpacing: 5, bind: 'title' },
      { id: 'el2', type: 'text', x: 50, y: 200, width: 275, height: 80, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '多少年未见\n不如今晚把酒言欢', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'invitation' },
      { id: 'el3', type: 'text', x: 50, y: 400, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: '老地方餐厅 · 晚 19:00', fontSize: 14, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
  {
    name: '追悼会讣告',
    category: 'memorial',
    tags: ['追悼会', '讣告'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('memorial1', '#ECEFF1', [
      { id: 'el1', type: 'text', x: 30, y: 120, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '沉痛讣告', fontSize: 32, fontFamily: 'serif', fill: '#455A64', align: 'center', lineHeight: 1.5, letterSpacing: 4, bind: 'title' },
      { id: 'el2', type: 'text', x: 50, y: 200, width: 275, height: 100, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '痛悼尊敬的 XXX 先生\n于今日安详辞世\n兹定于 X 月 X 日举行追悼仪式', fontSize: 15, fontFamily: 'serif', fill: '#37474F', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'content' },
      { id: 'el3', type: 'text', x: 50, y: 420, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: 'XX 殡仪馆 · 上午 9:00', fontSize: 14, fontFamily: 'serif', fill: '#78909C', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'info' },
      COVER_SLOT,
    ]),
  },
  {
    name: '企业标识展示卡',
    category: 'brand',
    tags: ['标识', '视觉识别'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('brand1', '#0F0E17', [
      { id: 'el1', type: 'rect', x: 30, y: 60, width: 315, height: 200, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#1A1A2E', cornerRadius: 16 },
      { id: 'el2', type: 'circle', x: 140, y: 90, width: 95, height: 95, rotation: 0, opacity: 0.9, zIndex: 2, visible: true, locked: false, fill: '#00C49A', radius: 47 },
      { id: 'el3', type: 'text', x: 30, y: 290, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 3, visible: true, locked: false, text: '品牌 VI 形象', fontSize: 28, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.5, letterSpacing: 2, bind: 'title' },
      { id: 'el4', type: 'text', x: 30, y: 360, width: 315, height: 40, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: '统一视觉 · 专业可信', fontSize: 15, fontFamily: 'sans-serif', fill: '#A5D6A7', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'slogan' },
      { id: 'el5', type: 'text', x: 30, y: 520, width: 315, height: 30, rotation: 0, opacity: 0.4, zIndex: 5, visible: true, locked: false, text: 'www.your-brand.com', fontSize: 13, fontFamily: 'sans-serif', fill: '#666', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'website' },
      COVER_SLOT,
    ]),
  },
  {
    name: '新店开业促销',
    category: 'opening',
    tags: ['开业'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('opening1', '#FCE4EC', [
      { id: 'el1', type: 'rect', x: 0, y: 0, width: 375, height: 220, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, fill: '#C2185B' },
      { id: 'el2', type: 'text', x: 30, y: 60, width: 315, height: 60, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '盛大开业', fontSize: 44, fontFamily: 'sans-serif', fill: '#FFFFFF', align: 'center', lineHeight: 1.2, letterSpacing: 6, bind: 'title' },
      { id: 'el3', type: 'text', x: 30, y: 130, width: 315, height: 30, rotation: 0, opacity: 0.85, zIndex: 3, visible: true, locked: false, text: '全场 5 折 · 进店有礼', fontSize: 18, fontFamily: 'sans-serif', fill: '#FFD54F', align: 'center', lineHeight: 1.5, letterSpacing: 1, bind: 'slogan' },
      { id: 'el4', type: 'text', x: 50, y: 320, width: 275, height: 80, rotation: 0, opacity: 0.8, zIndex: 4, visible: true, locked: false, text: '即日起营业\n恭候您的光临\n共庆开张大吉', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'content' },
      { id: 'el5', type: 'text', x: 50, y: 460, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 5, visible: true, locked: false, text: 'XX 商业街 88 号', fontSize: 14, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
  {
    name: '商务客户答谢宴',
    category: 'biz_social',
    tags: ['客户答谢'],
    cover: null,
    isOfficial: true,
    schema: makeTemplateSchema('bizsocial1', '#EDE7F6', [
      { id: 'el1', type: 'text', x: 30, y: 120, width: 315, height: 50, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, text: '感恩有您', fontSize: 34, fontFamily: 'serif', fill: '#5E35B1', align: 'center', lineHeight: 1.5, letterSpacing: 5, bind: 'title' },
      { id: 'el2', type: 'text', x: 50, y: 200, width: 275, height: 80, rotation: 0, opacity: 0.8, zIndex: 3, visible: true, locked: false, text: '一路同行，感谢信赖\n诚邀共赴答谢之宴', fontSize: 15, fontFamily: 'sans-serif', fill: '#333', align: 'center', lineHeight: 2, letterSpacing: 1, bind: 'invitation' },
      { id: 'el3', type: 'text', x: 50, y: 400, width: 275, height: 30, rotation: 0, opacity: 0.6, zIndex: 4, visible: true, locked: false, text: 'XX 宴会厅 · 晚 18:30', fontSize: 14, fontFamily: 'sans-serif', fill: '#999', align: 'center', lineHeight: 1.5, letterSpacing: 0, bind: 'location' },
      COVER_SLOT,
    ]),
  },
];

async function main() {
  console.log(`\n开始插入 ${templates.length} 个模板...`);

  for (const tpl of templates) {
    await prisma.template.upsert({
      where: { id: `tpl_seed_${tpl.category}_${tpl.name}` },
      update: {
        name: tpl.name,
        category: tpl.category,
        tags: tpl.tags,
        cover: tpl.cover,
        schema: tpl.schema as object,
        isOfficial: tpl.isOfficial,
        status: 'APPROVED',
      },
      create: {
        id: `tpl_seed_${tpl.category}_${tpl.name}`,
        name: tpl.name,
        category: tpl.category,
        tags: tpl.tags,
        cover: tpl.cover,
        schema: tpl.schema as object,
        isOfficial: tpl.isOfficial,
        status: 'APPROVED',
      },
    });
    console.log(`  ✅ ${tpl.name} [${tpl.category}]`);
  }

  const count = await prisma.template.count();
  console.log(`\n✅ Seed 完成：共 ${count} 个模板`);
}

main()
  .catch((e) => {
    console.error('Seed 失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
