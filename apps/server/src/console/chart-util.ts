/**
 * 看板图表聚合共享工具（M3-①）。
 * - bucketMonthly：把近 N 天的订单金额按自然月聚合为最近 6 个月序列，
 *   便于前端 BarCompare 绘制「近6月流水/收入」条形对比图。
 */

export interface MonthBucketInput {
  amount: number; // 金额（分）
  date: Date | string;
}

export interface MonthBucket {
  month: string; // YYYY-MM
  amountCents: number;
}

/** 近 6 个自然月（含当月）的月键序列 */
export function lastSixMonths(now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** 把订单流水按自然月聚合为最近 6 个月序列（缺失月份补 0） */
export function bucketMonthly(rows: MonthBucketInput[], now: Date = new Date()): MonthBucket[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + (r.amount ?? 0));
  }
  return lastSixMonths(now).map((month) => ({ month, amountCents: map.get(month) ?? 0 }));
}

/** 近 180 天的时间下限（看板流水聚合窗口） */
export function since180(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - 180);
  return d;
}
