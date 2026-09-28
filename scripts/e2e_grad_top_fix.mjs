/**
 * 验证「渐变填充文本 - 顶部镂空修复」：
 * 复刻 SchemaRenderer 的 fill span（background-clip:text），用 line-height:0.5 人为制造
 * 字形 ink 溢出 em 盒顶部（与用户截图红框标在字形顶部的现象一致），对比：
 *   - old：填充 span 仅向下加高（top 不变，height 2×FS）——顶部溢出无背景 → 顶部镂空
 *   - new：对称扩展（top = em盒顶 − FS，height 3×FS，padding FS）——顶部溢出被覆盖
 * 用 pngjs 对三个相同位置的 span（solid 取字形 ink 掩码 / old / new）截图做像素覆盖分析，
 * 统计「字形 ink 区域中渐变未被绘制（白色）」的缺失率，重点看字形顶部 band。
 *
 * 结论预期：new 顶部 band 缺失率 ≈ 0，且 new 总体缺失率 ≤ old；证明对称扩展覆盖了顶部溢出。
 */
import { createRequire } from 'module';
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const require = createRequire(import.meta.url);
const { PNG } = require('D:/MyWorkBuddy/2026-08-10-22-39-56/node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs');

const { chromium } = pw;

const FS = 80;
const GLYPH_LEFT = 20;
const GLYPH_TOP = 120; // 字形在 stage 中的 top（三种模式一致）
const STAGE = 400;

const gradCss = `
  color: transparent;
  -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(90deg, #ff0000, #dd1100);
  background-size: ${STAGE}px ${STAGE}px; background-repeat: no-repeat;
  font-size: ${FS}px; line-height: 0.5; white-space: pre; position: absolute; left: ${GLYPH_LEFT}px;
`;
const stageWrap = (id, inner) => `<div id="${id}" style="position:relative;width:${STAGE}px;height:${STAGE}px;background:#fff;font-family:Arial,sans-serif;font-weight:bold;overflow:hidden;">${inner}</div>`;

const html = `<!DOCTYPE html><html><body style="margin:0">
${stageWrap('stageSolid', `<span style="position:absolute;left:${GLYPH_LEFT}px;top:${GLYPH_TOP}px;color:#000;font-size:${FS}px;line-height:0.5;white-space:pre;">庆柬云</span>`)}
${stageWrap('stageOld', `<span style="${gradCss}top:${GLYPH_TOP}px;height:${FS * 2}px;background-position:-${GLYPH_LEFT}px -${GLYPH_TOP}px;">庆柬云</span>`)}
${stageWrap('stageNew', `<span style="${gradCss}top:${GLYPH_TOP - FS}px;box-sizing:border-box;height:${FS * 3}px;padding-top:${FS}px;padding-bottom:${FS}px;background-position:-${GLYPH_LEFT}px -${GLYPH_TOP - FS}px;">庆柬云</span>`)}
</body></html>`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 700 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

async function shotSel(sel) {
  const el = await page.$(sel);
  const buf = await el.screenshot();
  return PNG.sync.read(buf);
}
function decodeMask(png) {
  // solid 黑字 → 字形 ink 掩码
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  let top = height, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < 90 && g < 90 && b < 90) { mask[y * width + x] = 1; if (y < top) top = y; if (y > bottom) bottom = y; }
    }
  }
  return { mask, width, height, top, bottom };
}
function coverage(png, mask) {
  const { width, height, data } = png;
  let painted = 0, missing = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const y = Math.floor(i / width), x = i % width;
    const p = (y * width + x) * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const white = r > 240 && g > 240 && b > 240;
    const red = r > 140 && g < 90 && b < 90;
    if (white) missing++;
    else if (red) painted++;
    // 抗锯齿灰边：忽略（既不计数）
  }
  return { painted, missing, total: painted + missing };
}

const solid = await shotSel('#stageSolid');
const oldP = await shotSel('#stageOld');
const newP = await shotSel('#stageNew');
const m = decodeMask(solid);
check('solid 字形掩码有效', m.bottom > m.top, `top=${m.top} bottom=${m.bottom}`);

const covOld = coverage(oldP, m.mask);
const covNew = coverage(newP, m.mask);
const missOld = covOld.total ? covOld.missing / covOld.total : 1;
const missNew = covNew.total ? covNew.missing / covNew.total : 1;
check('old（向下扩展）存在顶部镂空缺失', missOld > 0.01, `缺失率=${(missOld * 100).toFixed(2)}%`);
check('new（对称扩展）缺失率≈0', missNew < 0.02, `缺失率=${(missNew * 100).toFixed(2)}%`);
check('new 缺失率 ≤ old（顶部被覆盖）', missNew <= missOld + 0.001, `old=${(missOld * 100).toFixed(2)}% new=${(missNew * 100).toFixed(2)}%`);

// 顶部 band：字形 ink 掩码最顶上 20% 行
const bandH = Math.max(2, Math.round((m.bottom - m.top) * 0.2));
const bandTop = m.top;
let bOldMiss = 0, bOldTot = 0, bNewMiss = 0, bNewTot = 0;
for (let y = bandTop; y < bandTop + bandH; y++) {
  for (let x = 0; x < m.width; x++) {
    if (!m.mask[y * m.width + x]) continue;
    const io = (y * m.width + x) * 4;
    const inO = oldP.data[io], ing = oldP.data[io + 1], inb = oldP.data[io + 2];
    const inN = newP.data[io], ingN = newP.data[io + 1], inbN = newP.data[io + 2];
    if (inO > 240 && ing > 240 && inb > 240) bOldMiss++; bOldTot++;
    if (inN > 240 && ingN > 240 && inbN > 240) bNewMiss++; bNewTot++;
  }
}
const bMissOld = bOldTot ? bOldMiss / bOldTot : 1;
const bMissNew = bNewTot ? bNewMiss / bNewTot : 1;
check('顶部 band：old 存在镂空', bMissOld > 0.05, `band缺失=${(bMissOld * 100).toFixed(2)}%`);
check('顶部 band：new 已覆盖（≈0 镂空）', bMissNew < 0.03, `band缺失=${(bMissNew * 100).toFixed(2)}%`);

console.log(`\n===== ${results.filter((r) => r.ok).length}/${results.length} PASS =====`);
await browser.close();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
