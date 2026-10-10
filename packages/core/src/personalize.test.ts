/**
 * 个性化引擎单测（纯 Node，无框架依赖）
 * 运行：pnpm --filter @h5design/core run test
 *
 * 覆盖规范 §14 DoD 3「个性化引擎」：替换 / 条件称谓 / 令牌混合文案 / 映射 / 不改原模板。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Project, TextElement } from './schema';
import {
  collectBindingKeys,
  collectBindings,
  personalizeSchema,
  resolveBindingValue,
  resolveDesignValue,
  isWholeElementVariable,
  diffBindingKeys,
} from './personalize';
import { inferTitle, normalizeGuestData, validateGuestData } from './guest-fields';

/** 构造最小模板：两页，含「变量姓名」「变量称谓」「混合文案」「静态文案」四类文本 */
function makeTemplate(): Project {
  const text = (
    id: string,
    value: string,
    bindingKey?: string,
  ): TextElement =>
    ({
      id,
      type: 'text',
      text: value,
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      visible: true,
      locked: false,
      fontSize: 24,
      fontFamily: 'sans-serif',
      fill: '#000',
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
      fontStyle: 'normal',
      textDecoration: 'none',
      backgroundColor: 'transparent',
      verticalAlign: 'middle',
      wordBreak: 'normal',
      ...(bindingKey ? { binding: { key: bindingKey } } : {}),
    }) as TextElement;

  return {
    id: 'tpl_1',
    name: '婚礼请柬模板',
    pages: [
      {
        id: 'p1',
        name: '页1',
        background: '#fff',
        elements: [
          text('el_name', '占位姓名', 'guest_name'),
          text('el_title', '占位称谓', 'guest_title'),
          text('el_mixed', '尊敬的 {{guest_name}} {{guest_title}}：'),
          text('el_static', '谨此邀请您出席'),
        ],
      },
      { id: 'p2', name: '页2', background: '#fff', elements: [text('el_unit', '占位单位', 'unit')] },
    ],
    width: 375,
    height: 667,
  } as unknown as Project;
}

const textOf = (p: Project, id: string): string => {
  for (const page of p.pages) {
    const el = page.elements.find((e) => e.id === id) as TextElement | undefined;
    if (el) return el.text;
  }
  return '';
};

test('collectBindingKeys：按出现顺序去重收集变量 key', () => {
  assert.deepEqual(collectBindingKeys(makeTemplate()), ['guest_name', 'guest_title', 'unit']);
  assert.deepEqual(collectBindingKeys(null), []);
});

test('personalizeSchema：变量整段替换，静态文案与混合文案令牌均正确', () => {
  const tpl = makeTemplate();
  const out = personalizeSchema(tpl, {
    data: { guest_name: '张三', guest_title: '先生', gender: 'M', unit: '新疆大学' } as never,
  });

  assert.equal(textOf(out, 'el_name'), '张三');
  assert.equal(textOf(out, 'el_title'), '先生');
  assert.equal(textOf(out, 'el_mixed'), '尊敬的 张三 先生：');
  assert.equal(textOf(out, 'el_static'), '谨此邀请您出席', '静态文案必须原样保留');
  assert.equal(textOf(out, 'el_unit'), '新疆大学');
});

test('personalizeSchema：不修改原模板（模板保持单份真值）', () => {
  const tpl = makeTemplate();
  personalizeSchema(tpl, { data: { guest_name: '李四' } as never });
  assert.equal(textOf(tpl, 'el_name'), '占位姓名');
});

test('条件称谓：guest_title 留空时按 gender 推断先生/女士', () => {
  const tpl = makeTemplate();
  const male = personalizeSchema(tpl, { data: { guest_name: '王五', gender: 'M' } as never });
  const female = personalizeSchema(tpl, { data: { guest_name: '赵六', gender: 'F' } as never });
  const unknown = personalizeSchema(tpl, { data: { guest_name: '钱七', gender: 'U' } as never });

  assert.equal(textOf(male, 'el_title'), '先生');
  assert.equal(textOf(female, 'el_title'), '女士');
  assert.equal(textOf(unknown, 'el_title'), '');
  assert.equal(inferTitle({ gender: 'M' } as never), '先生');
  assert.equal(inferTitle({ guest_title: '博士', gender: 'F' } as never), '博士', '显式称谓优先');
});

test('映射：binding.key → 名单字段可自定义（mapping 生效）', () => {
  const tpl = makeTemplate();
  const out = personalizeSchema(
    tpl,
    { data: { guest_name: '张三', guest_title: '先生' } as never },
    { guest_name: 'unit' }, // 故意把姓名变量映射到 unit 字段
  );
  assert.equal(textOf(out, 'el_name'), '');
  assert.equal(resolveBindingValue('guest_name', { unit: '新疆大学' } as never, { guest_name: 'unit' }), '新疆大学');
});

test('diffBindingKeys：识别模板用到但名单缺失的变量', () => {
  const tpl = makeTemplate();
  const r = diffBindingKeys(tpl, ['guest_name', 'guest_title']);
  assert.deepEqual(r.missing, ['unit']);
});

test('字段校验：必填/超长/枚举/手机号正则（B15）', () => {
  assert.equal(validateGuestData(normalizeGuestData({ guest_name: '张三' })).length, 0);
  assert.match(
    validateGuestData(normalizeGuestData({ guest_name: '' }))[0].message,
    /姓名必填/,
  );
  assert.match(
    validateGuestData(normalizeGuestData({ guest_name: '张'.repeat(21) }))[0].message,
    /不得超过 20/,
  );
  assert.match(
    validateGuestData(normalizeGuestData({ guest_name: '张三', phone: '12345' }))[0].message,
    /手机号格式不正确/,
  );
  assert.match(
    validateGuestData(normalizeGuestData({ guest_name: '张三', gender: 'X' }))[0].message,
    /性别取值必须为/,
  );
});

test('归一化：空串→null、去空格、未登记列被忽略', () => {
  const d = normalizeGuestData({ guest_name: '  张三  ', unit: '', 未登记列: 'x' });
  assert.equal(d.guest_name, '张三');
  assert.equal(d.unit, null);
  assert.equal(Object.keys(d).length, 8, '输出恒为已登记字段集合');
});

/* ───────── 方案 S1 · ElementBinding 扩展（fallback / D2 隐藏 / 设计态样例） ───────── */

const elOf = (p: Project, id: string) => {
  for (const page of p.pages) {
    const el = page.elements.find((e) => e.id === id);
    if (el) return el;
  }
  throw new Error(`元素不存在: ${id}`);
};

/** 构造带完整 binding 扩展字段的模板（unit 为整段变量，mixed 为混合文案） */
function makeTemplateV2(): Project {
  const tpl = makeTemplate();
  // unit：整段变量 + 无值（用于验证 D2 隐藏）
  (elOf(tpl, 'el_unit') as { binding: unknown }).binding = {
    key: 'unit',
    sample: '新疆大学',
    fit: 'shrink',
    minFontRatio: 0.5,
  };
  // name：整段变量 + 兜底值
  (elOf(tpl, 'el_name') as { binding: unknown }).binding = {
    key: 'guest_name',
    sample: '张三',
    fallback: '贵宾',
    fit: 'shrink',
  };
  return tpl;
}

test('fallback：名单该字段为空时使用 element.binding.fallback', () => {
  const tpl = makeTemplateV2();
  const out = personalizeSchema(tpl, { data: {} as never });
  assert.equal(textOf(out, 'el_name'), '贵宾', '空值应回落到 fallback');
  assert.equal(
    (elOf(out, 'el_name') as { visible: boolean }).visible,
    true,
    '有 fallback 时元素不隐藏',
  );
});

test('fallback 优先于 inferTitle（显式压过推断）', () => {
  const tpl = makeTemplate();
  (elOf(tpl, 'el_title') as { binding: unknown }).binding = {
    key: 'guest_title',
    fallback: '贵宾',
  };
  // gender=M 本应推断为「先生」，但显式 fallback 应胜出
  const out = personalizeSchema(tpl, { data: { gender: 'M' } as never });
  assert.equal(textOf(out, 'el_title'), '贵宾');
  // 无 fallback 时仍走推断
  const tpl2 = makeTemplate();
  const out2 = personalizeSchema(tpl2, { data: { gender: 'F' } as never });
  assert.equal(textOf(out2, 'el_title'), '女士');
});

test('D2：整段变量元素值为空时隐藏（visible=false），且有值时恢复', () => {
  const tpl = makeTemplateV2();
  // unit 为空、无 fallback → 隐藏
  const out = personalizeSchema(tpl, { data: { guest_name: '张三' } as never });
  assert.equal(textOf(out, 'el_unit'), '');
  assert.equal(
    (elOf(out, 'el_unit') as { visible: boolean }).visible,
    false,
    'D2：整段变量元素空值必须隐藏',
  );
  // 有值 → 不隐藏
  const out2 = personalizeSchema(tpl, { data: { unit: '新疆大学' } as never });
  assert.equal((elOf(out2, 'el_unit') as { visible: boolean }).visible, true);
});

test('D2 作用域：混合文案元素即使令牌为空也不隐藏，只保留前后缀', () => {
  const tpl = makeTemplateV2();
  const out = personalizeSchema(tpl, { data: {} as never });
  assert.equal(
    (elOf(out, 'el_mixed') as { visible: boolean }).visible,
    true,
    '混合文案元素不参与 D2 隐藏',
  );
  // el_mixed 自身无 binding → 令牌无 fallback 可套，替换为空串；但前后缀「尊敬的」「：」必须保留
  assert.equal(textOf(out, 'el_mixed'), '尊敬的  ：', '前后缀保留，令牌按各自取值链替换');
});

test('D2 不污染模板：隐藏只作用于产物副本', () => {
  const tpl = makeTemplateV2();
  personalizeSchema(tpl, { data: {} as never });
  assert.equal(
    (elOf(tpl, 'el_unit') as { visible: boolean }).visible,
    true,
    '模板本身的 visible 不得被改写',
  );
});

test('isWholeElementVariable：整段变量 true，混合文案 / 无绑定 false', () => {
  const tpl = makeTemplateV2();
  assert.equal(isWholeElementVariable(elOf(tpl, 'el_name')), true);
  assert.equal(isWholeElementVariable(elOf(tpl, 'el_unit')), true);
  assert.equal(isWholeElementVariable(elOf(tpl, 'el_static')), false, '无绑定元素不是变量');
  // 混合文案：binding.key 存在但 text 含 {{}} → false
  (elOf(tpl, 'el_mixed') as { binding: unknown }).binding = { key: 'guest_name' };
  assert.equal(isWholeElementVariable(elOf(tpl, 'el_mixed')), false);
});

test('resolveDesignValue：取 binding.sample，缺省回落字段 example', () => {
  const tpl = makeTemplateV2();
  assert.equal(resolveDesignValue(elOf(tpl, 'el_unit')), '新疆大学', 'sample 优先');
  // 无 sample 的标准字段回落 example
  const tpl2 = makeTemplate();
  assert.equal(resolveDesignValue(elOf(tpl2, 'el_name')), '张三', 'guest_name example 为「张三」');
  assert.equal(resolveDesignValue(elOf(tpl2, 'el_static')), '', '非变量元素无设计值');
});

test('collectBindings：聚合命中元素、样例、兜底与溢出策略，且不新增表', () => {
  const tpl = makeTemplateV2();
  // 追加一处 guest_name 重复占位（同模板内重复占位管理）
  const dup = { ...(elOf(tpl, 'el_name') as object), id: 'el_name_2' };
  tpl.pages[0].elements.push(dup as never);

  const vars = collectBindings(tpl);
  assert.deepEqual(
    vars.map((v) => v.key),
    ['guest_name', 'guest_title', 'unit'],
    '按出现顺序去重',
  );
  const name = vars.find((v) => v.key === 'guest_name')!;
  assert.deepEqual(name.elementIds, ['el_name', 'el_name_2'], '重复占位聚合到同一变量');
  assert.equal(name.sample, '张三');
  assert.equal(name.fallback, '贵宾');
  assert.equal(name.fit, 'shrink');
  assert.equal(name.isStandard, true);
  assert.equal(name.label, '姓名');
  assert.equal(collectBindings(null).length, 0);
});

test('collectBindings：自定义字段（ext_ 前缀）标记为非标准，label 回落 key', () => {
  const tpl = makeTemplate();
  const text = (id: string, key: string) =>
    ({
      id,
      type: 'text',
      text: '占位',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      visible: true,
      locked: false,
      fontSize: 24,
      fontFamily: 'sans-serif',
      fill: '#000',
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
      fontStyle: 'normal',
      textDecoration: 'none',
      backgroundColor: 'transparent',
      verticalAlign: 'middle',
      wordBreak: 'normal',
      binding: { key, sample: '第一场' },
    }) as never;
  tpl.pages[0].elements.push(text('el_session', 'ext_session'));
  tpl.pages[0].elements.push(text('el_date', 'ext_date'));

  const session = collectBindings(tpl).find((v) => v.key === 'ext_session')!;
  assert.equal(session.isStandard, false, 'ext_ 前缀为非标准字段');
  assert.equal(session.label, 'ext_session', '未登记字段 label 回落 key');
  assert.equal(session.sample, '第一场');

  // D1：场次/日期不在标准字段集，体检时应判为「名单无同名字段」
  const health = diffBindingKeys(tpl, ['guest_name', 'guest_title', 'unit']);
  assert.deepEqual(health.missing, ['ext_session', 'ext_date']);
});

test('applyTokens 多令牌各自取 fallback', () => {
  const tpl = makeTemplate();
  (elOf(tpl, 'el_mixed') as { binding: unknown }).binding = { key: 'guest_name', fallback: '贵宾' };
  const out = personalizeSchema(tpl, { data: { guest_title: '先生' } as never });
  assert.equal(textOf(out, 'el_mixed'), '尊敬的 贵宾 先生：');
});
