/** 倒计时共享逻辑：剩余时间计算 + 单位标签 */

export interface RemainingTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

const UNIT_LABELS_ZH = ['天', '时', '分', '秒'];
const UNIT_LABELS_EN = ['D', 'H', 'M', 'S'];

export function getUnitLabels(lang: 'zh' | 'en' = 'zh'): string[] {
  return lang === 'en' ? UNIT_LABELS_EN : UNIT_LABELS_ZH;
}

/** 根据目标时间（ISO 字符串）计算剩余时间 */
export function getRemaining(target: string): RemainingTime {
  const t = new Date(target).getTime();
  const diff = t - Date.now();
  if (Number.isNaN(t) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, done: false };
}

/** ISO 时间字符串 <-> datetime-local input value 互转 */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19);
}

/** 单个数字块的值（两位补零，天数至少两位） */
export function padDigits(n: number, minLen = 2): string {
  const s = String(n);
  return s.length >= minLen ? s : '0'.repeat(minLen - s.length) + s;
}
