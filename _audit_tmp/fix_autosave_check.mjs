/**
 * FOLLOW-UP B 验证：
 *  1) 逻辑级模拟「effect 依赖不稳定 vs 稳定」下 30s 自动保存的触发次数；
 *  2) 静态断言：interval 回调走的是不弹窗的后台保存（saveInBackgroundRef.current()），
 *     且 saveInBackground 内部不引用 notifySaveFailed（FIX 2 后的失败信号仍由调用方处理）。
 */
import { readFileSync } from 'node:fs';

const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL: ' + msg);
    process.exitCode = 1;
  } else {
    console.log('PASS: ' + msg);
  }
};

/** 模拟 React effect：deps 变化 → cleanup(clearInterval) + setup(setInterval) */
function sim({ stable, durationMs = 60000, editEveryMs = 1000, intervalMs = 30000 }) {
  let timer = null;
  let intervalCreated = 0;
  let autosaveFired = 0;
  let elapsed = 0;

  const runEffect = () => {
    if (stable) {
      // deps: [] —— 只在挂载时建一次
      if (timer === null) {
        timer = intervalMs;
        intervalCreated += 1;
      }
      return;
    }
    // deps: [saveInBackground] —— 每次编辑重建 → clearInterval + setInterval
    timer = null;
    timer = intervalMs;
    intervalCreated += 1;
  };

  runEffect(); // 挂载
  while (elapsed < durationMs) {
    const step = Math.min(editEveryMs, durationMs - elapsed);
    if (timer !== null) timer -= step;
    elapsed += step;
    if (elapsed < durationMs) runEffect(); // 一次编辑 → 新 identity → effect 重跑
    if (timer !== null && timer <= 0) {
      autosaveFired += 1;
      timer = intervalMs;
    }
  }
  return { intervalCreated, autosaveFired };
}

// 旧写法（依赖不稳定）：60s 内每 1s 编辑一次 → 30s 定时器被重建 60 次，一次都没触发
const before = sim({ stable: false });
assert(
  before.autosaveFired === 0 && before.intervalCreated > 30,
  `对照：旧写法 60s 内自动保存触发 ${before.autosaveFired} 次（定时器重建 ${before.intervalCreated} 次）`,
);

// 新写法（依赖稳定）：同一个定时器连续倒计时 → 30s / 60s 各触发一次
const after = sim({ stable: true });
assert(
  after.autosaveFired === 2 && after.intervalCreated === 1,
  `新写法 60s 内自动保存触发 ${after.autosaveFired} 次（定时器只建 ${after.intervalCreated} 次）`,
);

// 静态断言：interval 用 ref 调后台保存，且后台保存不弹窗
const src = readFileSync(
  new URL('../packages/editor/src/components/Editor/EditorApp.tsx', import.meta.url),
  'utf8',
);
const intervalBlock = src.slice(
  src.indexOf('autoSaveTimer.current = setInterval'),
  src.indexOf('autoSaveTimer.current = setInterval') + 300,
);
assert(
  intervalBlock.includes('saveInBackgroundRef.current()'),
  'interval 回调通过 ref 调最新后台保存（不依赖回调 identity）',
);
assert(
  /useEffect\(\(\) => \{\s*autoSaveTimer\.current = setInterval[\s\S]*?\}, \[\]\);/.test(src),
  'interval effect 依赖为空数组 —— 定时器稳定，不会被编辑打断',
);
const bgStart = src.indexOf('const saveInBackground = useCallback');
const bgBody = src.slice(bgStart, src.indexOf('/* ── 自动保存 ── */'));
assert(
  bgBody.includes('saveProject()') && !bgBody.includes('notifySaveFailed') && !bgBody.includes('alert('),
  '后台保存路径不弹窗（失败只 console.error，顶栏保持「● 未保存」）',
);
