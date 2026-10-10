/**
 * 多选拖拽（整体平移）验证：
 * 在编辑器新建两个矩形并全选，用真实鼠标拖拽其中一个对象，断言——
 *  · 拖拽过程中（mouseup 之前）所有选中对象的位移完全一致（同一 delta）；
 *  · 任意两选中对象的相对位置在拖拽中保持不变；
 *  · 松手后所有对象最终坐标落库（= 拖拽终点），相对位置仍不变。
 * 反向基线：若仅被拖对象移动、其余静止，则 delta 不一致 → 断言失败。
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

  // 新建两个矩形（不重叠），并全选
  const ids = await page.evaluate(() => {
    const S = () => window.__editorStore.getState(); // 每次取最新 state（action 会生成新 state 对象）
    S().addElement('rect');
    const id1 = S().selectedId;
    S().updateElement(id1, { x: 100, y: 100, width: 80, height: 60 });
    S().addElement('rect');
    const id2 = S().selectedId;
    S().updateElement(id2, { x: 320, y: 220, width: 80, height: 60 });
    S().setSelection([id1, id2], false);
    return { id1, id2 };
  });
  await page.waitForTimeout(800);

  const selDiag = await page.evaluate(({ id1, id2 }) => {
    const st = window.__editorStore.getState();
    const p = st.project.pages[st.activePage];
    const e1 = p.elements.find((e) => e.id === id1);
    const e2 = p.elements.find((e) => e.id === id2);
    return {
      selectedIds: st.selectedIds,
      e1: e1 ? { x: e1.x, y: e1.y } : null,
      e2: e2 ? { x: e2.x, y: e2.y } : null,
    };
  }, ids);
  console.log('SEL', JSON.stringify(selDiag));
  check('已选中两个对象', (selDiag.selectedIds || []).length === 2, JSON.stringify(selDiag.selectedIds));
  if ((selDiag.selectedIds || []).length !== 2) {
    await browser.close();
    console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
    process.exit(2);
  }

  const startRel = { dx: selDiag.e2.x - selDiag.e1.x, dy: selDiag.e2.y - selDiag.e1.y };

  // 计算被拖对象在屏幕上的中心坐标 + 画布缩放
  const info = await page.evaluate(({ id1 }) => {
    const st = window.__editorStore.getState();
    const stage = st.stageRef;
    const node = stage.findOne('#' + id1);
    if (!node) return { error: 'node-not-found' };
    const scale = stage.scaleX();
    const abs = node.getAbsolutePosition();
    const rect = stage.container().getBoundingClientRect();
    return { sx: rect.left + abs.x, sy: rect.top + abs.y, scale };
  }, { id1: ids.id1 });
  console.log('INFO', JSON.stringify(info));
  if (info.error) {
    check('找到被拖对象节点', false, info.error);
    await browser.close();
    console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
    process.exit(2);
  }

  const DX = 60, DY = 40; // 屏幕像素位移
  const expDx = DX / info.scale;
  const expDy = DY / info.scale;

  await page.mouse.move(info.sx, info.sy);
  await page.mouse.down();
  await page.mouse.move(info.sx + DX / 2, info.sy + DY / 2, { steps: 6 });
  await page.waitForTimeout(180); // 拖拽过程中（尚未 mouseup）

  const mid = await page.evaluate(({ id1, id2 }) => {
    const st = window.__editorStore.getState();
    const p = st.project.pages[st.activePage];
    const e1 = p.elements.find((e) => e.id === id1);
    const e2 = p.elements.find((e) => e.id === id2);
    return { e1: { x: e1.x, y: e1.y }, e2: { x: e2.x, y: e2.y } };
  }, ids);

  const midD1 = { dx: mid.e1.x - selDiag.e1.x, dy: mid.e1.y - selDiag.e1.y };
  const midD2 = { dx: mid.e2.x - selDiag.e2.x, dy: mid.e2.y - selDiag.e2.y };
  const midRel = { dx: mid.e2.x - mid.e1.x, dy: mid.e2.y - mid.e1.y };
  // 注意：mid 读取发生在「移动到半程（+DX/2）」之后，故位移应约为期望的一半。
  const expMidDx = expDx / 2;
  const expMidDy = expDy / 2;
  console.log(`拖拽中 delta1=${JSON.stringify(midD1)} delta2=${JSON.stringify(midD2)} 期望≈(${expMidDx.toFixed(1)},${expMidDy.toFixed(1)})（半程）`);

  check(
    '拖拽过程中被拖对象已移动（约等于期望半程位移）',
    Math.abs(midD1.dx - expMidDx) <= 2 && Math.abs(midD1.dy - expMidDy) <= 2,
    `delta1=${JSON.stringify(midD1)} 期望(${expMidDx.toFixed(1)},${expMidDy.toFixed(1)})`,
  );
  check(
    '拖拽过程中其余选中对象位移与被拖对象一致（整体平移）',
    Math.abs(midD2.dx - midD1.dx) <= 1.5 && Math.abs(midD2.dy - midD1.dy) <= 1.5,
    `delta1=${JSON.stringify(midD1)} delta2=${JSON.stringify(midD2)}`,
  );
  check(
    '拖拽过程中两对象相对位置保持不变',
    Math.abs(midRel.dx - startRel.dx) <= 1.5 && Math.abs(midRel.dy - startRel.dy) <= 1.5,
    `startRel=${JSON.stringify(startRel)} midRel=${JSON.stringify(midRel)}`,
  );

  await page.mouse.move(info.sx + DX, info.sy + DY, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(220);

  const after = await page.evaluate(({ id1, id2 }) => {
    const st = window.__editorStore.getState();
    const p = st.project.pages[st.activePage];
    const e1 = p.elements.find((e) => e.id === id1);
    const e2 = p.elements.find((e) => e.id === id2);
    return { e1: { x: e1.x, y: e1.y }, e2: { x: e2.x, y: e2.y } };
  }, ids);
  const afterD1 = { dx: after.e1.x - selDiag.e1.x, dy: after.e1.y - selDiag.e1.y };
  const afterD2 = { dx: after.e2.x - selDiag.e2.x, dy: after.e2.y - selDiag.e2.y };
  const afterRel = { dx: after.e2.x - after.e1.x, dy: after.e2.y - after.e1.y };
  console.log(`松手后 delta1=${JSON.stringify(afterD1)} delta2=${JSON.stringify(afterD2)}`);

  check(
    '松手后两对象位移仍然一致（整组移动已落库）',
    Math.abs(afterD2.dx - afterD1.dx) <= 1.5 && Math.abs(afterD2.dy - afterD1.dy) <= 1.5,
    `delta1=${JSON.stringify(afterD1)} delta2=${JSON.stringify(afterD2)}`,
  );
  check(
    '松手后两对象相对位置仍不变',
    Math.abs(afterRel.dx - startRel.dx) <= 1.5 && Math.abs(afterRel.dy - startRel.dy) <= 1.5,
    `startRel=${JSON.stringify(startRel)} afterRel=${JSON.stringify(afterRel)}`,
  );
  check(
    '松手后位移约等于期望（非仅预览，已提交）',
    Math.abs(afterD1.dx - expDx) <= 2 && Math.abs(afterD1.dy - expDy) <= 2,
    `delta1=${JSON.stringify(afterD1)} 期望(${expDx.toFixed(1)},${expDy.toFixed(1)})`,
  );

  await page.screenshot({ path: path.join(OUT, 'verify_multiselect_drag.png') }).catch(() => {});
  await browser.close();

  fs.writeFileSync(
    path.join(OUT, 'verify_multiselect_drag_result.json'),
    JSON.stringify({
      pass, fail, fails,
      errors: errors.slice(0, 8),
      startRel, mid, after,
      midD1, midD2, afterD1, afterD2,
      expected: { expDx, expDy },
    }, null, 2),
  );
  console.log(`\n汇总: ${pass} PASS / ${fail} FAIL   页面错误 ${errors.length}`);
  if (fails.length) console.log('失败项:\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exit(fail === 0 ? 0 : 2);
})().catch((e) => {
  console.error('FATAL', e);
  console.log(`\n汇总: ${pass} PASS / ${fail} FAIL`);
  process.exit(1);
});
