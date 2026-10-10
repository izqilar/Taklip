// 复现并验证「画布背景色提交后被陈旧闭包覆盖」的修复
// 模拟 store + ColorPicker.commit（先 onChange 写实时值，再 onCommit 收尾）的行为

function makeStore(initialBackground) {
  let state = { pages: [{ background: initialBackground }], activePage: 0 };
  return {
    getState: () => state,
    setLive: (v) => { state.pages[0].background = v; },
    setCommit: (v) => { state.pages[0].background = v; }, // 含 pushHistory（此处略）
  };
}

// ColorPicker.commit 逻辑：先 onChange(v)，再 onCommit()
function pickerCommit(v, onChange, onCommit) {
  onChange(v);
  onCommit();
}

function run(label, store, onCommit) {
  // 打开取色器时闭包捕获的「旧背景」（旧实现用这个）
  const staleClosureBackground = store.getState().pages[0].background;
  // 用户拖拽选了红色
  const picked = '#ff0000';
  const onChange = (val) => store.setLive(val);
  pickerCommit(picked, onChange, onCommit(store, staleClosureBackground));
  const result = store.getState().pages[0].background;
  const pass = result === picked;
  console.log(`[${label}] 提交后 background = ${JSON.stringify(result)} (期望 ${JSON.stringify(picked)}) ${pass ? '✓' : '✗'}`);
  return pass;
}

// 旧实现：onCommit 用闭包旧值覆盖
const oldOnCommit = (store, stale) => () => store.setCommit(stale);
// 新实现：onCommit 从 store 读实时值，只补历史
const newOnCommit = (store) => () => {
  const cur = store.getState().pages[0].background;
  if (cur != null) store.setCommit(cur);
};

let ok = true;

// 场景1：从未设过背景（transparent/空串）
let s1 = makeStore('');
ok = run('旧-空背景', s1, oldOnCommit) && ok;
let s1b = makeStore('');
ok = run('新-空背景', s1b, newOnCommit) && ok;

// 场景2：默认白底
let s2 = makeStore('#ffffff');
ok = run('旧-白底', s2, oldOnCommit) && ok;
let s2b = makeStore('#ffffff');
ok = run('新-白底', s2b, newOnCommit) && ok;

// 场景3：已设为半透明红，再次改为绿（确保新值不丢）
let s3 = makeStore('rgba(255,0,0,0.5)');
// 用新实现：onChange 写绿，onCommit 读实时值再提交
{
  const onChange = (v) => s3.setLive(v);
  pickerCommit('#00ff00', onChange, newOnCommit(s3));
  const r = s3.getState().pages[0].background;
  const pass = r === '#00ff00';
  ok = pass && ok;
  console.log(`[新-改色] 提交后 background = ${JSON.stringify(r)} (期望 "#00ff00") ${pass ? '✓' : '✗'}`);
}

console.log(ok ? '\nALL PASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
