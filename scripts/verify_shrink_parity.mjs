/**
 * shrink「编辑器(Konva) == 导出(DOM)」实机像素验证（T8 续）。
 *
 * 真实 Chromium 下，对同一「绑定变量 + fit:'shrink' + 超长文案」文本元素：
 *   A) 编辑器 Konva 画布：读 window.__konvaStage 上文本节点的 fontSize / clientRect（真机像素）。
 *   B) 编辑器 DOM 预览（SchemaRenderer，与发布/导出同源）：读文本叶子元素的 computed font-size。
 * 断言：
 *   1. 两端 fontSize 相等（≤1.5px 容差）——证明 shrink 决策完全一致；
 *   2. 两端均 < 设计基准字号（shrink 确实生效）；
 *   3. 两端文本均落在元素框内（clientRect.width ≤ 元素宽 + 容差）——无溢出。
 *
 * 运行：node scripts/verify_shrink_parity.mjs
 * 前置：web :5173（Vite dev，含 __konvaStage 探针）与 server :3000 均已启动。
 * 退出码 0 = 全绿。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
};

/** 服务端登录并写令牌（与 web session 一致） */
async function login(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  return page.evaluate(
    async ([api, phone, password]) => {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      const at = d?.accessToken || d?.token;
      if (!at) return false;
      localStorage.setItem('access_token', at);
      if (d?.refreshToken) localStorage.setItem('refresh_token', d.refreshToken);
      if (d?.user) localStorage.setItem('user_info', JSON.stringify(d.user));
      return true;
    },
    [API, PHONE, PASSWORD],
  );
}

const SAMPLE = '庆柬云批量请柬生成测试'; // 12 个 CJK 字符，换行后仍超高 → 触发 shrink
const BASE_SIZE = 64;
const EL_W = 400;
const EL_H = 60; // 矮框：换行后行高仍超框 → shrink 必须生效（验证真实触发路径）

async function main() {
  console.log('=== shrink 编辑器/导出 实机像素验证 ===');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  check('登录 web 并写入令牌', await login(page));

  /* ── 1. 以既有模板 schema 为基底，注入一个 shrink 绑定超长文本元素 ── */
  const workId = await page.evaluate(
    async ([api, sample, baseSize, elW, elH]) => {
      const h = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      };
      const list = await fetch(`${api}/api/projects`, { headers: h }).then((r) => r.json());
      const items = list?.items || list?.data || list || [];
      const src = items[0]?.id;
      let schema = null;
      if (src) {
        const d = await fetch(`${api}/api/projects/${src}`, { headers: h }).then((r) => r.json());
        schema = d?.schema ?? null;
      }
      // 兜底：若没有任何模板，构造最小 schema
      if (!schema || !schema.pages) {
        schema = { version: 1, width: 1080, height: 1920, background: '#ffffff', pages: [{ elements: [] }] };
      }
      const shrinkEl = {
        id: 'shrink_verify_el',
        type: 'text',
        x: 100,
        y: 100,
        width: elW,
        height: elH,
        rotation: 0,
        fontSize: baseSize,
        fontFamily: 'Microsoft YaHei',
        text: sample,
        binding: { key: 'guest_name', fit: 'shrink', minFontRatio: 0.5 },
        align: 'center',
        verticalAlign: 'middle',
        wordBreak: 'normal',
        lineHeight: 1,
      };
      const pages = Array.isArray(schema.pages) ? schema.pages : [{ elements: [] }];
      pages[0] = { ...pages[0], elements: [shrinkEl] };
      schema.pages = pages;
      const created = await fetch(`${api}/api/projects`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ title: `shrink_verify_${Date.now()}`, schema }),
      }).then((r) => r.json());
      return created?.id || null;
    },
    [API, SAMPLE, BASE_SIZE, EL_W, EL_H],
  );
  check('创建 shrink 验证用作品', !!workId, String(workId));
  if (!workId) {
    await browser.close();
    console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
    process.exit(1);
  }

  /* ── 2. 打开编辑器，等渲染 + 字体就绪 ── */
  await page.goto(`${BASE}/editor/${workId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__konvaStage, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000); // 等字体加载 + shrink 重算

  /* ── 3. 编辑器 Konva 文本节点（真机像素） ── */
  const konva = await page.evaluate(
    (sample) => {
      const stage = window.__konvaStage;
      if (!stage) return { error: 'no __konvaStage' };
      const texts = stage.find('Text');
      const node = texts.find((t) => (t.text() || '').includes(sample.slice(0, 4)));
      if (!node) return { error: 'no text node', count: texts.length };
      return {
        fontSize: node.fontSize(),
        text: node.text(),
        rectW: node.getClientRect({ relativeTo: stage }).width,
        rectH: node.getClientRect({ relativeTo: stage }).height,
      };
    },
    SAMPLE,
  );
  console.log('  [editor Konva]', JSON.stringify(konva));
  check('编辑器 Konva 文本节点存在', !konva.error && typeof konva.fontSize === 'number', konva.error || '');

  /* ── 4. 编辑器 DOM 预览（SchemaRenderer，与导出同源）── */
  await page.locator('button[title="预览"]').click().catch(() => {});
  await page.waitForTimeout(2000);
  const dom = await page.evaluate((sample) => {
    const all = Array.from(document.querySelectorAll('div,span,p'));
    for (const e of all) {
      if (e.children.length === 0 && (e.textContent || '').includes(sample.slice(0, 4))) {
        const fs = parseFloat(getComputedStyle(e).fontSize);
        if (fs > 0) {
          return { fontSize: fs, text: e.textContent, rectW: e.getBoundingClientRect().width };
        }
      }
    }
    return { error: 'no dom text node' };
  }, SAMPLE);
  console.log('  [editor DOM preview]', JSON.stringify(dom));
  check('编辑器 DOM 预览文本节点存在', !dom.error && typeof dom.fontSize === 'number', dom.error || '');

  /* ── 5. 断言 ── */
  if (!konva.error && !dom.error) {
    const e = Math.abs(konva.fontSize - dom.fontSize);
    check('两端 fontSize 一致（shrink 决策同源）', e <= 1.5, `Konva=${konva.fontSize} DOM=${dom.fontSize} Δ=${e.toFixed(2)}`);
    check('编辑器 shrink 已生效（<基准)', konva.fontSize < BASE_SIZE, `Konva=${konva.fontSize}`);
    check('DOM 预览 shrink 已生效（<基准)', dom.fontSize < BASE_SIZE, `DOM=${dom.fontSize}`);
    // 无溢出：文本宽度不超过元素框（Konva clientRect 已含布局；DOM 叶子宽度）
    check('编辑器文本落在元素框内（无溢出）', konva.rectW <= EL_W + 2, `rectW=${konva.rectW.toFixed(1)} boxW=${EL_W}`);
    check('DOM 文本落在元素框内（无溢出）', dom.rectW <= EL_W + 4, `rectW=${dom.rectW.toFixed(1)} boxW=${EL_W}`);
  }

  /* ── 清理：删除验证作品 ── */
  await page
    .evaluate(
      async ([api, id]) => {
        await fetch(`${api}/api/projects/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
      },
      [API, workId],
    )
    .catch(() => {});

  await browser.close();
  console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
