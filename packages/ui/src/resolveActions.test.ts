import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActionGroups } from './resolveActions.ts';
import type { DesignActionCaps } from './resolveActions.ts';

// 全量回调字典（每个 action 都有对应 on*，便于单独控制 capabilities 观测渲染结果）
const onAll: Partial<Record<keyof DesignActionCaps, (item: any) => void>> = {
  preview: () => {},
  detail: () => {},
  edit: () => {},
  export: () => {},
  delete: () => {},
  unpublish: () => {},
  submitAsTemplate: () => {},
  use: () => {},
  publish: () => {},
};

const keysOf = (
  groups: ReturnType<typeof resolveActionGroups>,
  g: 'top' | 'center' | 'bottom',
) => groups[g].map((a) => a.key);

test('work + 只读：仅 详情/导出/预览（顶:detail,export；中:preview；底:空）', () => {
  const caps: DesignActionCaps = { preview: true, detail: true, export: true };
  const g = resolveActionGroups('work', caps, onAll);
  assert.deepEqual(keysOf(g, 'top'), ['detail', 'export']);
  assert.deepEqual(keysOf(g, 'center'), ['preview']);
  assert.deepEqual(keysOf(g, 'bottom'), []);
});

test('work + 可写（未发布）：顶栏含 详情/导出/删除，中心 预览/编辑', () => {
  const caps: DesignActionCaps = {
    preview: true,
    detail: true,
    export: true,
    edit: true,
    delete: true,
  };
  const g = resolveActionGroups('work', caps, onAll);
  assert.deepEqual(keysOf(g, 'top'), ['detail', 'export', 'delete']);
  assert.deepEqual(keysOf(g, 'center'), ['preview', 'edit']);
});

test('work + 可写 + 已发布：顶栏在 导出 与 删除 之间插入 取消发布', () => {
  const caps: DesignActionCaps = {
    preview: true,
    detail: true,
    export: true,
    edit: true,
    delete: true,
    unpublish: true,
  };
  const g = resolveActionGroups('work', caps, onAll);
  assert.deepEqual(keysOf(g, 'top'), ['detail', 'export', 'unpublish', 'delete']);
});

test('template + admin：底部出现 使用模板(use)', () => {
  const caps: DesignActionCaps = {
    preview: true,
    detail: true,
    export: true,
    edit: true,
    delete: true,
    use: true,
  };
  const g = resolveActionGroups('template', caps, onAll);
  assert.deepEqual(keysOf(g, 'bottom'), ['use']);
});

test('work + 可写 + submitAsTemplate：底部出现 提交为模板', () => {
  const caps: DesignActionCaps = {
    preview: true,
    detail: true,
    export: true,
    edit: true,
    delete: true,
    submitAsTemplate: true,
  };
  const g = resolveActionGroups('work', caps, onAll);
  assert.deepEqual(keysOf(g, 'bottom'), ['submitAsTemplate']);
});

test('capability 为真但 on 缺回调：双闸拦截，按钮不渲染', () => {
  const caps: DesignActionCaps = {
    preview: true,
    detail: true,
    export: true,
    delete: true,
  };
  const onPartial = { preview: () => {}, detail: () => {}, export: () => {} }; // 故意缺 delete
  const g = resolveActionGroups('work', caps, onPartial);
  assert.deepEqual(keysOf(g, 'top'), ['detail', 'export']); // delete 因缺 on 被拦下
});

test('仅预览 capability：中心出现 预览，顶/底为空', () => {
  const caps: DesignActionCaps = { preview: true };
  const g = resolveActionGroups('work', caps, onAll);
  assert.deepEqual(keysOf(g, 'top'), []);
  assert.deepEqual(keysOf(g, 'center'), ['preview']);
  assert.deepEqual(keysOf(g, 'bottom'), []);
});
