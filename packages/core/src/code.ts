const CODE_PREFIXES = ['e2e_order_', 'e2e_user_', 'e2e_', 'tpl_seed_', 'test_user_', 'test_', 'dev_', 'demo_', 'order_'];

/**
 * 清理测试数据英文前缀（展示用，不改底层 id）。
 * 种子/演示数据常用 e2e_order_0086、test_user_001、tpl_seed_xxx 这类英文前缀，
 * 直接作为编号/订单号展示会漏出英文。剥离已知前缀，仅保留可读后缀。
 * 真实 cuid 等不含这些前缀，原样返回，不受影响。
 *
 * 统一真值源：运营端 config/labels、web user/shared、web SiteHeader 此前各有一份相同实现。
 */
export const cleanCode = (v?: string | null): string => {
  if (!v) return '—';
  let s = String(v);
  // 反复剥离已知英文前缀，直到不再以任一前缀开头（如 e2e_order_demo_3 → 3）
  for (let i = 0; i < 4; i++) {
    const hit = CODE_PREFIXES.find((p) => s.startsWith(p));
    if (!hit) break;
    s = s.slice(hit.length);
  }
  return s || '—';
};
