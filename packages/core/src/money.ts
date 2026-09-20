/**
 * 金额（分）→ ¥ 字符串。统一真值源，取代此前散落在
 * apps/admin/src/utility.ts、apps/web/src/user/shared.tsx、ProfilePage 的 `yuan`、
 * providerSettingsPages 的 `money` 的多份重复实现。
 *
 * 语义（统一口径）：
 * - null / undefined / NaN → '-'（与运营端表格口径一致：缺失金额用短横，而非 ¥0.00，避免误导为「零元」）
 * - 其余 → '¥' + 千分位分组 + 固定 2 位小数
 *   · 12345 分 → ¥123.45
 *   · 12300 分 → ¥123.00（强制两位小数，避免 ¥123 歧义）
 *   · 1234567 分 → ¥12,345.67（千分位分组）
 */
export function formatCents(cents?: number | null): string {
  if (cents == null || Number.isNaN(cents)) return '-';
  return `¥${(cents / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
