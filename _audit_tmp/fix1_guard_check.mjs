/**
 * FIX 1 逻辑级验证（非 DOM 测试）：
 * 复刻两个宿主页里「加载闸门」的真实逻辑，模拟 React 18 的行为：
 *   - StrictMode：组件**首次挂载**时 effect 会 setup → cleanup → setup（双跑）；
 *     **更新**（:id 变化）时不会双跑，只正常跑一次；
 *   - 路由 /sp/works/:id/editor 是同一条 <Route> 且没有 key → A→B 时组件实例被复用，
 *     useRef 不会重置（这正是旧布尔闸门失效的根因）。
 */
const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL: ' + msg);
    process.exitCode = 1;
  } else {
    console.log('PASS: ' + msg);
  }
};

/** 旧实现：布尔闸门（回归前） */
function oldHost() {
  const requestedRef = { current: false };
  const fetches = [];
  return {
    fetches,
    reload(id) {
      if (!id || requestedRef.current) return;
      requestedRef.current = true;
      fetches.push(id);
    },
  };
}

/** 新实现：记录「已加载的 id」（SPWorkEditor / SPTemplateEditor 现状） */
function newHost() {
  const loadedIdRef = { current: null };
  const fetches = [];
  return {
    fetches,
    reload(id, force = false) {
      if (!id) return;
      if (!force && loadedIdRef.current === id) return;
      loadedIdRef.current = id;
      fetches.push(id);
    },
  };
}

/** StrictMode 挂载：effect 双跑（setup → cleanup → setup） */
const mountStrict = (host, id) => {
  host.reload(id);
  host.reload(id);
};
/** 更新：:id 变化，组件实例复用，effect 只跑一次 */
const update = (host, id) => host.reload(id);

// ── 场景 1：StrictMode 下挂载 A，不得重复加载 ────────────────────────────
const h1 = newHost();
mountStrict(h1, 'A');
assert(h1.fetches.length === 1, `StrictMode 挂载 A 只请求一次（实际 ${h1.fetches.length} 次：${h1.fetches}）`);

// ── 场景 2：A → B 必须真正加载 B ─────────────────────────────────────────
update(h1, 'B');
assert(h1.fetches.join(',') === 'A,B', `A→B 会加载 B（实际 ${h1.fetches}）`);

// ── 场景 3：回到 A 也仍然加载（不因「以前加载过」而被吞） ────────────────
update(h1, 'A');
assert(h1.fetches.join(',') === 'A,B,A', `B→A 会重新加载 A（实际 ${h1.fetches}）`);

// ── 场景 4：放弃草稿后的 force 重载（同一 id 也要重拉） ──────────────────
const h2 = newHost();
mountStrict(h2, 'T1');
h2.reload('T1', true);
assert(h2.fetches.join(',') === 'T1,T1', `放弃草稿后 force 重载同一 id 生效（实际 ${h2.fetches}）`);

// ── 对照：旧布尔闸门在 A→B 时不加载 B（即被修复的回归） ──────────────────
const old = oldHost();
mountStrict(old, 'A');
update(old, 'B');
assert(
  old.fetches.join(',') === 'A',
  `对照：旧布尔闸门 A→B 只加载了 A（回归复现：${old.fetches}）`,
);
