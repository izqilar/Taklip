import { test, expect, request } from '@playwright/test';

/**
 * 阶段 E 端到端覆盖：双闸口消毒统一
 *  - 场景 A（草稿→发布）：内核 onSave 草稿闸口 + 服务端发布闸口，均应消毒。
 *  - 场景 B（只读页 /p/:code）：无论落库是否已被消毒，渲染层不应出现 XSS 向量。
 *
 * 受测 API（apps/server :3000）：
 *   POST /api/auth/login            {phone,password} -> {accessToken}
 *   POST /api/projects             {title,schema}   -> {id,status}
 *   PUT  /api/projects/:id/draft   {schema,title}    (草稿闸口：服务端 sanitizeSchema)
 *   POST /api/publish/:id          -> {publishCode,url}
 *   GET  /api/p/:publishCode       -> {title,schema} (只读，无需鉴权)
 */

const API = 'http://localhost:3000';
const WEB_USER = { phone: '13900001001', password: 'Test123456' };

// 故意夹带的危险内容（XSS 向量）
const MALICIOUS_SCHEMA = (title: string) => ({
  id: 'p_e2e',
  title,
  width: 375,
  height: 667,
  pages: [
    {
      id: 'pg',
      backgroundImage: 'javascript:alert(1)',
      elements: [
        { id: 'i1', type: 'image', src: 'javascript:alert(1)' },
        { id: 'vBad', type: 'video', src: '<iframe src="javascript:alert(1)"></iframe>' },
        {
          id: 'vGood',
          type: 'video',
          src: '<iframe src="https://player.bilibili.com/player.html?bvid=BV1" scrolling="no" frameborder="no"></iframe>',
        },
        { id: 'b1', type: 'button', text: 'click', link: 'javascript:alert(1)' },
        { id: 't1', type: 'text', text: 'SAFE_MARKER' },
      ],
    },
  ],
});

async function publishWithMalicious(api: any): Promise<{ publishCode: string; id: string }> {
  const lg = await api.post(`${API}/api/auth/login`, {
    data: WEB_USER,
    headers: { 'Content-Type': 'application/json' },
  });
  expect(lg.ok()).toBeTruthy();
  const { accessToken } = await lg.json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  const mk = await api.post(`${API}/api/projects`, {
    data: { title: 'E2E-PhaseE', schema: MALICIOUS_SCHEMA('E2E-Base') },
    headers: H,
  });
  expect(mk.ok()).toBeTruthy();
  const { id } = await mk.json();

  // 草稿闸口：写入带 XSS 的草稿
  const sd = await api.put(`${API}/api/projects/${id}/draft`, {
    data: { title: 'E2E-PhaseE', schema: MALICIOUS_SCHEMA('E2E-DRAFT') },
    headers: H,
  });
  expect(sd.ok()).toBeTruthy();

  // 发布闸口：原子替换 + 再次消毒（真实路由 POST /api/publish/:projectId）
  const pb = await api.post(`${API}/api/publish/${id}`, { headers: H });
  expect(pb.ok()).toBeTruthy();
  const pub = await pb.json();
  expect(pub.publishCode).toBeTruthy();

  return { publishCode: pub.publishCode, id };
}

test.describe('阶段 E — 双闸口消毒 + 只读页 XSS 防护', () => {
  test('场景 B：只读页 /p/:code 不渲染任何 XSS 向量', async ({ page }) => {
    const api = await request.newContext();
    const { publishCode } = await publishWithMalicious(api);

    // 直接拿只读 API 校验落库/渲染数据已消毒
    const got = await api.get(`${API}/api/p/${publishCode}`);
    expect(got.ok()).toBeTruthy();
    const body = await got.json();
    const pg = body.schema.pages[0];
    expect(pg.backgroundImage).toBe('');
    expect(pg.elements.find((e: any) => e.id === 'i1').src).toBe('');
    expect(pg.elements.find((e: any) => e.id === 'vBad').src).toBe('');
    expect(pg.elements.find((e: any) => e.id === 'b1').link).toBe('');
    expect(pg.elements.find((e: any) => e.id === 'vGood').src).toContain('player.bilibili.com');

    // 浏览器内打开只读页，断言真实 DOM 无危险内容
    await page.goto(`/p/${publishCode}`);
    await page.waitForLoadState('networkidle');

    const dom = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      // 只读页是 React SPA，宿主自身会注入打包脚本；只关心「来自 schema 的恶意脚本」，
      // 即内联内容含 XSS 向量，或 src 为 javascript: 的 <script>。
      const scripts = Array.from(document.querySelectorAll('script')).map(
        (s) => (s.textContent || '').trim() || (s.getAttribute('src') || ''),
      );
      const injectedScript = scripts.some((s) => /alert\s*\(|javascript:/i.test(s));
      const iframes = Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src') || '');
      const onHandlers = all.filter((el) =>
        Array.from(el.attributes).some((a) => a.name.toLowerCase().startsWith('on')),
      ).length;
      const jsAttr = all.filter((el) =>
        Array.from(el.attributes).some((a) => /javascript:/i.test(a.value)),
      ).length;
      return { injectedScript, iframes, onHandlers, jsAttr };
    });

    expect(dom.injectedScript, '不应注入含 XSS 向量的 <script>').toBeFalsy();
    expect(dom.onHandlers, '不应存在 on* 事件处理器').toBe(0);
    expect(dom.jsAttr, '不应存在 javascript: 属性').toBe(0);
    expect(
      dom.iframes.every((src) => !/javascript:/i.test(src)),
      'iframe 不应含 javascript:',
    ).toBeTruthy();
    // 合法嵌入应保留
    expect(dom.iframes.some((src) => src.includes('player.bilibili.com'))).toBeTruthy();
    // 安全内容应正常渲染
    await expect(page.getByText('SAFE_MARKER')).toBeVisible();
  });

  test('场景 A：草稿→发布后只读页携带已发布内容', async ({ page }) => {
    const api = await request.newContext();
    const { publishCode } = await publishWithMalicious(api);
    await page.goto(`/p/${publishCode}`);
    await page.waitForLoadState('networkidle');
    // 发布页应正常渲染（标题/安全文本可见），证明草稿→发布链路打通
    await expect(page.getByText('SAFE_MARKER')).toBeVisible();
  });
});
