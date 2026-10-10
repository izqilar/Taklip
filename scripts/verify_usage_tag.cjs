/* eslint-disable */
/**
 * 验证「我的图库」卡片「已使用 / 未使用」状态标签（用户端 + 服务商端）：
 *  1) 种数据：上传图库图 A(40×30)、B(41×31)，并给 B 建一条 media 副本（derivedFrom=B）→ B=已使用、A=未使用
 *  2) 断言两端：A 卡片标签=未使用、B 卡片标签=已使用；标签位于缩略图下方首行
 *  3) 断言标签视觉规格（圆角/字号/字重/内边距/圆点/配色）两端【完全一致】
 *  4) 断言卡片内不再渲染文件名（交互信息下沉到缩略图 title）
 * 结束后清理种入数据。
 */
const { chromium } = require('playwright');

const WEB = 'http://localhost:5173';
const ADMIN = 'http://localhost:5174';
const report = { web: {}, admin: {}, errors: [] };

async function login(page, base, phone, password, tokenKey) {
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form input', { timeout: 20000 });
  await page.fill('form input', phone);
  await page.fill('form input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
  await page.waitForFunction((k) => !!localStorage.getItem(k), tokenKey, { timeout: 20000 });
}

async function seed(page, tokenKey, api) {
  return page.evaluate(
    async (arg) => {
      const { tk0, api } = arg;
      const tk = localStorage.getItem(tk0);
      const H = tk ? { Authorization: `Bearer ${tk}` } : {};
      const mk = async (w, h, color) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d');
        x.fillStyle = color;
        x.fillRect(0, 0, w, h);
        return await new Promise((r) => c.toBlob(r, 'image/webp', 0.9));
      };
      const up = async (blob, qs) => {
        const f = new FormData();
        f.append('file', blob, 'image.webp');
        const r = await fetch(api + '/assets/upload' + qs, { method: 'POST', headers: H, body: f });
        let j = null;
        try {
          j = await r.json();
        } catch {}
        return { status: r.status, id: j && j.id };
      };
      const a = await up(await mk(40, 30, '#1122ff'), '?purpose=gallery&width=40&height=30');
      const b = await up(await mk(41, 31, '#22aa33'), '?purpose=gallery&width=41&height=31');
      const copy = await up(
        await mk(42, 32, '#cc8800'),
        '?derivedFrom=' + encodeURIComponent(b.id) + '&width=42&height=32',
      );
      return { a, b, copy };
    },
    { tk0: tokenKey, api },
  );
}

async function cleanup(page, tokenKey, api, ids) {
  return page.evaluate(
    async (arg) => {
      const tk = localStorage.getItem(arg.tokenKey);
      const H = tk ? { Authorization: `Bearer ${tk}` } : {};
      const out = {};
      for (const [k, id] of Object.entries(arg.ids)) {
        if (!id) continue;
        const r = await fetch(arg.api + '/assets/' + id + '?force=1', {
          method: 'DELETE',
          headers: H,
        });
        out[k] = r.status;
      }
      return out;
    },
    { tokenKey, api, ids },
  );
}

/** 读取页面上所有状态标签的文本 + 视觉规格 + 所属卡片（用尺寸文本认卡片） */
async function measure(page) {
  return page.evaluate(() => {
    const tags = Array.from(document.querySelectorAll('span')).filter((s) => {
      const txt = (s.textContent || '').trim();
      return (txt === '已使用' || txt === '未使用') && s.querySelector('i');
    });
    return tags.map((el) => {
      const cs = getComputedStyle(el);
      const dot = el.querySelector('i');
      const r = el.getBoundingClientRect();
      // 卡片根 = 最近的「含 <img> 缩略图」祖先；其文本用于识别卡片、其 img 底边用于「位于图下方」判定
      let card = el;
      let cardText = '';
      let imgBottom = null;
      for (let i = 0; i < 12 && card; i++) {
        card = card.parentElement;
        if (!card) break;
        const img = card.querySelector('img');
        if (img) {
          cardText = (card.textContent || '').replace(/\s+/g, ' ').trim();
          imgBottom = img.getBoundingClientRect().bottom;
          break;
        }
      }
      return {
        label: (el.textContent || '').trim(),
        title: el.getAttribute('title'),
        cardText: cardText.slice(0, 60),
        color: cs.color,
        background: cs.backgroundColor,
        borderRadius: cs.borderRadius,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: `${cs.paddingTop} ${cs.paddingRight}`,
        height: Math.round(r.height),
        dotSize: dot ? Math.round(dot.getBoundingClientRect().width) : null,
        dotColor: dot ? getComputedStyle(dot).backgroundColor : null,
        belowImage: imgBottom == null ? null : r.top >= imgBottom - 1,
      };
    });
  });
}

/** 视觉规格指纹（用于两端逐项比对） */
const styleOf = (t) => ({
  color: t.color,
  background: t.background,
  borderRadius: t.borderRadius,
  fontSize: t.fontSize,
  fontWeight: t.fontWeight,
  padding: t.padding,
  height: t.height,
  dotSize: t.dotSize,
});

async function runSession(browser, { base, phone, password, tokenKey, route, label, api }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(`${label} console: ${m.text()}`);
  });
  await login(page, base, phone, password, tokenKey);
  const ids = await seed(page, tokenKey, api);
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const tags = await measure(page);
  const usedCard = tags.find((t) => /41×31/.test(t.cardText));
  const unusedCard = tags.find((t) => /40×30/.test(t.cardText));

  const out = {
    seeded: ids,
    tagCount: tags.length,
    usedCard,
    unusedCard,
    // 卡片内不应再出现文件名
    filenameHidden: !tags.some((t) => /image\.webp/.test(t.cardText)),
    allTagsBelowImage: tags.length > 0 && tags.every((t) => t.belowImage === true),
    tags,
  };

  await page
    .screenshot({ path: `outputs/usage-tag/${label}_gallery_tag.png`, fullPage: false })
    .catch(() => {});

  out.pass =
    usedCard?.label === '已使用' &&
    unusedCard?.label === '未使用' &&
    usedCard?.belowImage === true &&
    unusedCard?.belowImage === true &&
    out.filenameHidden === true &&
    out.allTagsBelowImage === true &&
    usedCard?.color === 'rgb(210, 72, 48)' &&
    unusedCard?.color === 'rgb(140, 140, 140)';

  out.cleanup = await cleanup(page, tokenKey, api, {
    copy: ids.copy?.id,
    b: ids.b?.id,
    a: ids.a?.id,
  }).catch((e) => String(e));
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch();
  try {
    report.web = await runSession(browser, {
      base: WEB,
      api: 'http://localhost:3000/api',
      phone: '13900001001',
      password: 'Test123456',
      tokenKey: 'access_token',
      route: '/user/gallery',
      label: 'web_user',
    });
    report.admin = await runSession(browser, {
      base: ADMIN,
      api: 'http://localhost:3000/api',
      phone: '13800000001',
      password: 'dev123456',
      tokenKey: 'h5_admin_token',
      route: '/sp/gallery',
      label: 'admin_sp',
    });

    // 两端视觉规格逐项一致
    const w = styleOf(report.web.usedCard || {});
    const a = styleOf(report.admin.usedCard || {});
    const wu = styleOf(report.web.unusedCard || {});
    const au = styleOf(report.admin.unusedCard || {});
    report.crossEnd = {
      usedStyleEqual: JSON.stringify(w) === JSON.stringify(a),
      unusedStyleEqual: JSON.stringify(wu) === JSON.stringify(au),
      webUsed: w,
      adminUsed: a,
    };
    report.pass =
      report.web.pass === true &&
      report.admin.pass === true &&
      report.crossEnd.usedStyleEqual === true &&
      report.crossEnd.unusedStyleEqual === true;
  } catch (e) {
    report.fatal = String(e && e.stack ? e.stack : e);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
})();
