import assert from 'node:assert';
import { describe, it } from 'node:test';
import { fitShrinkFontSize } from './textFit';

/** 模拟测量：宽度随字号线性增长（每字号 10px/字符），高度 = 行高 * 字号 */
function makeMeasure(text: string, perChar = 10, lineHeight = 1.2) {
  const chars = Math.max(1, text.length);
  return (size: number) => ({ width: chars * perChar * size / 16, height: size * lineHeight });
}

describe('fitShrinkFontSize', () => {
  it('基准字号已放得下 → 不缩小', () => {
    const r = fitShrinkFontSize({
      text: '张三',
      baseSize: 32,
      minRatio: 0.6,
      maxWidth: 200,
      maxHeight: 60,
      measure: makeMeasure('张三'),
    });
    assert.equal(r, 32);
  });

  it('超长文本 → 缩小到下限或适配值', () => {
    const r = fitShrinkFontSize({
      text: '一二三四五六七八九十十一十二十三',
      baseSize: 32,
      minRatio: 0.6,
      maxWidth: 100, // 基准宽约 13*10*2=260 > 100，需要缩小
      maxHeight: 60,
      measure: makeMeasure('一二三四五六七八九十十一十二十三'),
    });
    assert.ok(r < 32, `应缩小，得到 ${r}`);
    assert.ok(r >= Math.round(32 * 0.6), `不应低于下限 ${Math.round(32 * 0.6)}，得到 ${r}`);
  });

  it('连最小字号都放不下 → 返回最小', () => {
    const r = fitShrinkFontSize({
      text: 'x'.repeat(200),
      baseSize: 32,
      minRatio: 0.5,
      maxWidth: 20,
      maxHeight: 20,
      measure: makeMeasure('x'.repeat(200), 10, 1.2),
    });
    assert.equal(r, Math.round(32 * 0.5));
  });

  it('空文本 → 返回基准字号', () => {
    const r = fitShrinkFontSize({
      text: '',
      baseSize: 24,
      minRatio: 0.6,
      maxWidth: 100,
      maxHeight: 50,
      measure: makeMeasure(''),
    });
    assert.equal(r, 24);
  });

  it('高度约束生效（多行场景）', () => {
    // 每字号高 = size*1.2；容器高 30 → 基准 32 高 38.4 超限，需缩小到 <=25
    const r = fitShrinkFontSize({
      text: '短',
      baseSize: 32,
      minRatio: 0.5,
      maxWidth: 1000, // 宽不约束
      maxHeight: 30,
      measure: makeMeasure('短'),
    });
    assert.ok(r <= 25, `高度约束下应缩到 <=25，得到 ${r}`);
  });
});
