/**
 * 发布管线共享纯函数单测（依赖无关，使用 Node 内置 node:test 运行）
 *
 * 运行：node --test packages/core/test/publish-logic.test.mjs
 * 前置：pnpm --filter @h5design/core build （生成 dist/index.js）
 *
 * 覆盖三端统一的发布逻辑决策：
 *   - effectiveSchema：草稿优先于线上的取稿策略
 *   - buildPublishedSchema：取有效稿 + 统一消毒（防 XSS / 危险协议）
 *   - shouldRegeneratePublishCode：首发布生成码 / 重复发布沿用旧码
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveSchema,
  buildPublishedSchema,
  shouldRegeneratePublishCode,
} from '../dist/index.js';

const SAMPLE_LIVE = {
  title: 'live',
  pages: [
    {
      elements: [
        { id: 't1', type: 'text', text: 'hello' },
        // 危险：外链 video 含脚本注入
        { id: 'v1', type: 'video', src: '<iframe src="javascript:alert(1)"></iframe>' },
        // 危险：按钮跳转 javascript: 协议
        { id: 'b1', type: 'button', link: 'javascript:alert(2)' },
      ],
    },
  ],
};

const SAMPLE_DRAFT = {
  title: 'draft',
  pages: [
    {
      elements: [
        { id: 't2', type: 'text', text: 'draft text' },
        { id: 'i1', type: 'image', src: 'https://cdn.example.com/a.png' },
        // 危险内容同样放在「草稿」（实际被发布的有效稿）中，验证发布消毒有效
        { id: 'v1', type: 'video', src: '<iframe src="javascript:alert(1)"></iframe>' },
        { id: 'b1', type: 'button', link: 'javascript:alert(2)' },
      ],
    },
  ],
};

test('effectiveSchema：草稿为对象时优先返回草稿', () => {
  assert.deepEqual(effectiveSchema(SAMPLE_DRAFT, SAMPLE_LIVE), SAMPLE_DRAFT);
});

test('effectiveSchema：草稿为空/非对象时回退线上', () => {
  assert.deepEqual(effectiveSchema(null, SAMPLE_LIVE), SAMPLE_LIVE);
  assert.deepEqual(effectiveSchema(undefined, SAMPLE_LIVE), SAMPLE_LIVE);
  assert.deepEqual(effectiveSchema('not-an-object', SAMPLE_LIVE), SAMPLE_LIVE);
  assert.deepEqual(effectiveSchema(42, SAMPLE_LIVE), SAMPLE_LIVE);
});

test('buildPublishedSchema：取草稿并消毒危险内容', () => {
  const out = buildPublishedSchema(SAMPLE_DRAFT, SAMPLE_LIVE);
  assert.equal(out.title, 'draft');
  const els = out.pages[0].elements;
  const video = els.find((e) => e.id === 'v1');
  const button = els.find((e) => e.id === 'b1');
  // XSS 注入应被消毒为空串
  assert.equal(video.src, '');
  assert.equal(button.link, '');
  // 合法 https 媒体应保留
  const img = els.find((e) => e.id === 'i1');
  assert.equal(img.src, 'https://cdn.example.com/a.png');
});

test('buildPublishedSchema：无草稿时消毒线上稿', () => {
  const out = buildPublishedSchema(null, SAMPLE_LIVE);
  assert.equal(out.title, 'live');
  const video = out.pages[0].elements.find((e) => e.id === 'v1');
  assert.equal(video.src, '');
});

test('shouldRegeneratePublishCode：非 published 需生成新码', () => {
  assert.equal(shouldRegeneratePublishCode('draft'), true);
  assert.equal(shouldRegeneratePublishCode(null), true);
  assert.equal(shouldRegeneratePublishCode(undefined), true);
  assert.equal(shouldRegeneratePublishCode(''), true);
});

test('shouldRegeneratePublishCode：已 published 沿用旧码（保 /p/ 链接稳定）', () => {
  assert.equal(shouldRegeneratePublishCode('published'), false);
});
