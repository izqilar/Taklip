/**
 * 诊断：DOM（SchemaRenderer）每个文本元素的真实基线 vs Konva(canvas) 期望基线。
 *
 * 目标：确认 TextElementView 里的运行时修正是否真的生效、修正量是否合理，
 *       从而解释 1:1 harness 里残余的 ~1 CSS px 垂直偏差来源。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const { chromium } = pw;
const PROJECT_ID = process.argv[2] || 'e2e_parity_fixture';
const BASE = 'http://localhost:5173';

const TEXTS = {
  txt_mid: { fontSize: 24, lineHeight: 1.4, fontFamily: 'Arial' },
  txt_top: { fontSize: 24, lineHeight: 1.4, fontFamily: 'Arial' },
  txt_big: { fontSize: 38, lineHeight: 1.4, fontFamily: 'Times New Roman' },
  txt_multi: { fontSize: 14, lineHeight: 1.4, fontFamily: 'Arial' },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
await page.goto(`${BASE}/parity-text.html?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const out = await page.evaluate(({ TEXTS }) => {
  const res = {};
  for (const [id, cfg] of Object.entries(TEXTS)) {
    const host = document.querySelector(`[data-element-id="${id}"]`);
    if (!host) {
      res[id] = { err: 'not found' };
      continue;
    }
    const spans = Array.from(host.querySelectorAll('span')).filter((s) => s.textContent && s.textContent.trim());
    const fill = spans[spans.length - 1];
    if (!fill) {
      res[id] = { err: 'no fill span' };
      continue;
    }
    const wrapper = fill.parentElement;
    const cs = getComputedStyle(fill);
    const lineHeightPx = cfg.fontSize * cfg.lineHeight;

    const probe = document.createElement('span');
    probe.style.cssText =
      'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;pointer-events:none;';
    fill.appendChild(probe);
    const wrapRect = wrapper.getBoundingClientRect();
    const probeBottom = probe.getBoundingClientRect().bottom;
    const fillRectNoProbe = fill.getBoundingClientRect();
    probe.remove();

    const sActual = wrapRect.height > 0 ? wrapRect.height / lineHeightPx : 1;
    const domBaselineLocal = (probeBottom - wrapRect.top) / sActual;

    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    const upAlpha = ctx.measureText('Hg').actualBoundingBoxAscent || 0;
    ctx.textBaseline = 'middle';
    const upMiddle = ctx.measureText('Hg').actualBoundingBoxAscent || 0;
    const middleToBaseline = upAlpha - upMiddle;
    const canvasBaselineLocal = lineHeightPx / 2 + middleToBaseline;

    res[id] = {
      scale: +sActual.toFixed(5),
      wrapH: +wrapRect.height.toFixed(2),
      wrapTopStyle: wrapper.style.top,
      appliedTransform: getComputedStyle(wrapper).transform,
      fillTopLocal: +((fillRectNoProbe.top - wrapRect.top) / sActual).toFixed(3),
      probeBaselineLocal: +domBaselineLocal.toFixed(3),
      middleToBaseline: +middleToBaseline.toFixed(3),
      canvasBaselineLocal: +canvasBaselineLocal.toFixed(3),
      corr: +(canvasBaselineLocal - domBaselineLocal).toFixed(3),
      lineHeightPx: +lineHeightPx.toFixed(3),
    };
  }
  return res;
}, { TEXTS });

console.log(JSON.stringify(out, null, 1));
await browser.close();
