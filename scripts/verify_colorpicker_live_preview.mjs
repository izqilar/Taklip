/**
 * 颜色对话框「实时预览」验证：
 * 在编辑器对选中对象（矩形）打开「单色填充」取色器，拖拽竖向色相条，
 * 断言——在 mouseup 之前（拖拽过程中）选中对象的 fill 已经同步为拖拽终点色相，
 * 且最终值与拖拽终点一致；无需点击「确定」。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const USER = '13900001001';
const PWD = 'Test123456';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log('  ✅ ' + name); }
  else { fail += 1; fails.push(`${name} :: ${detail}`); console.log('  ❌ ' + name + ' :: ' + detail); }
};

function hueOf(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === rr) h = ((gg - bb) / d + 6) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return h * 60;
}
const hueDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const parseHex = (s) => {
  const h6 = String(s || '').replace('#', '').slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h6)) return null;
  return [0, 2, 4].map((o) => parseInt(h6.slice(o, o + 2), 16));
};

const errors = [];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('editor.theme', 'dark'); } catch {} });

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="tel"]', USER);
  await page.fill('input[type="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: /新建|New|createNew/ }).first().click();
  await page.waitForURL((u) => u.toString().includes('/editor/'), { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !!window.__editorStore, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    try {
      document.documentElement.classList.add('dark');
      localStorage.setItem('editor.theme', 'dark');
      window.__editorStore.getState().addElement('rect');
    } catch {}
  });
  await page.waitForTimeout(1200);

  // 打开「单色填充」取色器（Fill Section 第一个 colorfield-swatch）
  const diag = await page.evaluate(() => {
    const st = window.__editorStore ? window.__editorStore.getState() : null;
    return {
      store: !!window.__editorStore,
      fillTypes: document.querySelectorAll('[data-fill-type]').length,
      swatches: document.querySelectorAll('[data-testid="colorfield-swatch"]').length,
      selected: st ? st.selectedId : null,
      els: st ? st.project.pages[st.activePage].elements.length : -1,
      fillType: st && st.selectedId ? st.project.pages[st.activePage].elements.find((e) => e.id === st.selectedId)?.fillType : null,
    };
  });
  console.log('DIAG', JSON.stringify(diag));
  await page.screenshot({ path: path.join(OUT, 'verify_live_preview_diag.png') }).catch(() => {});

  await page.locator('[data-testid="colorfield-swatch"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="colorpicker"]', { state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const picker = page.locator('[data-testid="colorpicker"]').first();
  check('取色器（单色填充）已打开', await picker.isVisible().catch(() => false));
  if (!(await picker.isVisible().catch(() => false))) {
    await browser.close();
    console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
    process.exit(2);
  }

  const readFill = () => page.evaluate(() => {
    const st = window.__editorStore.getState();
    const id = st.selectedId;
    const page0 = st.project.pages[st.activePage];
    const el = page0.elements.find((e) => e.id === id);
    return el ? el.fill : null;
  });

  const before = await readFill();
  const beforeRgb = parseHex(before);
  const beforeHue = beforeRgb ? hueOf(beforeRgb[0], beforeRgb[1], beforeRgb[2]) : -1;
  console.log(`\n拖拽前 fill=${before} (hue≈${Math.round(beforeHue)}°)`);

  const track = page.locator('[data-testid="colorpicker-hue"]').first();
  const tb = await track.boundingBox();
  const tStart = 0.12;
  const tEnd = 0.7; // 期望色相 ≈ 252°

  // 模拟真实拖拽：down → 移动到终点（多步，触发 window mousemove）→ 读取「拖拽中」的 fill → up
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tStart * tb.height);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tEnd * tb.height, { steps: 14 });
  await page.waitForTimeout(200); // 拖拽过程中，尚未 mouseup

  const mid = await readFill();
  const midRgb = parseHex(mid);
  const midHue = midRgb ? hueOf(midRgb[0], midRgb[1], midRgb[2]) : -1;
  const wantHue = tEnd * 360;
  console.log(`拖拽中 fill=${mid} (hue≈${Math.round(midHue)}°)，期望 ≈ ${Math.round(wantHue)}°`);

  check(
    '拖拽过程中（mouseup 之前）选中对象 fill 已实时同步为拖拽终点色相',
    midRgb != null && hueDiff(midHue, wantHue) <= 6 && mid !== before,
    `before=${before}(${Math.round(beforeHue)}°) mid=${mid}(${Math.round(midHue)}°) 期望 ${Math.round(wantHue)}°`,
  );

  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await readFill();
  const afterRgb = parseHex(after);
  const afterHue = afterRgb ? hueOf(afterRgb[0], afterRgb[1], afterRgb[2]) : -1;
  console.log(`松手后 fill=${after} (hue≈${Math.round(afterHue)}°)`);
  check(
    '松手后最终 fill == 拖拽终点色相（无需点确定）',
    afterRgb != null && hueDiff(afterHue, wantHue) <= 6 && after === mid,
    `after=${after}(${Math.round(afterHue)}°) 期望 ${Math.round(wantHue)}°`,
  );

  // 不点「确定」，直接关闭弹层，确认 live 值已落库（非暂存）
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  const closed = await readFill();
  check('关闭后 fill 仍为拖拽终点值（已落库，非仅预览）', closed === after, `closed=${closed} after=${after}`);

  await page.screenshot({ path: path.join(OUT, 'verify_live_preview_full.png') }).catch(() => {});
  await browser.close();

  fs.writeFileSync(
    path.join(OUT, 'verify_live_preview_result.json'),
    JSON.stringify({ pass, fail, fails, errors: errors.slice(0, 8), before, mid, after }, null, 2),
  );
  console.log(`\n汇总: ${pass} PASS / ${fail} FAIL   页面错误 ${errors.length}`);
  if (fails.length) console.log('失败项:\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exit(fail === 0 ? 0 : 2);
})().catch((e) => {
  console.error('FATAL', e);
  console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
  process.exit(1);
});
