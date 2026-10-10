/**
 * 人员名单字段定义（规范 §9.1）——**前后端共用的单一真值源**。
 *
 * 同时被三处消费，任何字段变更只需改这里：
 *   1. 服务端模板下载（CSV/XLSX 生成 `/api/guest-lists/template`）
 *   2. 服务端字段定义接口（`/api/guest-lists/template/schema`）
 *   3. 导入解析 / 在线编辑保存的双端校验（B15）
 *
 * 铁律：空文本列统一存 `null`（非空串）；未登记列导入时忽略（不报错）。
 */

/** 名单字段类型 */
export type GuestFieldType = 'string' | 'enum';

/** 单个字段定义 */
export interface GuestFieldDef {
  /** 字段 key（模板 CSV 首行 / JSONB 键名），稳定不可随意改 */
  key: string;
  /** 中文表头（XLSX 首行 / 前端表头） */
  label: string;
  type: GuestFieldType;
  required: boolean;
  /** string 类型的最大字符数 */
  maxLen?: number;
  /** enum 类型允许取值 */
  values?: string[];
  /** 建议枚举（string 类型，仅作 UI 提示，不强制校验） */
  enum?: string[];
  /** string 类型的正则校验（来源串以 ^ 开头、$ 结尾） */
  pattern?: string;
  /** 示例值（模板第二行 / schema 接口） */
  example: string;
}

/** 字段定义版本：结构变更时递增，供前端缓存失效判断 */
export const GUEST_FIELDS_VERSION = '1.0';

/** 标准化人员名单模板字段（顺序即模板列顺序，首列必须是 guest_name） */
export const GUEST_FIELD_DEFS: readonly GuestFieldDef[] = [
  { key: 'guest_name', label: '姓名', type: 'string', required: true, maxLen: 20, example: '张三' },
  {
    key: 'guest_title',
    label: '称谓',
    type: 'string',
    required: false,
    maxLen: 10,
    enum: ['先生', '女士', '博士', '教授', '同学', '同仁'],
    example: '',
  },
  { key: 'gender', label: '性别', type: 'enum', required: false, values: ['M', 'F', 'U'], example: 'M' },
  { key: 'unit', label: '单位', type: 'string', required: false, maxLen: 50, example: '新疆大学' },
  { key: 'table_no', label: '桌号', type: 'string', required: false, maxLen: 10, example: '8' },
  {
    key: 'phone',
    label: '手机号',
    type: 'string',
    required: false,
    pattern: '^1[3-9]\\d{9}$',
    example: '13900001001',
  },
  { key: 'address', label: '地址', type: 'string', required: false, maxLen: 100, example: '' },
  { key: 'remark', label: '备注', type: 'string', required: false, maxLen: 100, example: '' },
] as const;

/** key → 定义 的索引 */
const DEF_BY_KEY: Record<string, GuestFieldDef> = GUEST_FIELD_DEFS.reduce(
  (acc, d) => {
    acc[d.key] = d;
    return acc;
  },
  {} as Record<string, GuestFieldDef>,
);

/** 已登记字段 key 全集 */
export const GUEST_FIELD_KEYS: readonly string[] = GUEST_FIELD_DEFS.map((d) => d.key);

export const getGuestFieldDef = (key: string): GuestFieldDef | undefined => DEF_BY_KEY[key];

/**
 * 名单列定义归一化（供批量生成「人员名单」弹窗表头/取数）。
 *
 * 服务端 `listRecords` 响应带回 `columnDefs`（名单创建时快照的模板字段数组，
 * 例如婚礼模板为 `[{key:'ext_husband'},{key:'ext_wife'}]`）。弹窗必须据此渲染列，
 * 而不能硬编码 `GUEST_FIELD_DEFS` —— 否则像婚礼这类「首列非 guest_name」的模板，
 * 名单数据以 `ext_*` 为键，而标准前 5 列（姓名/称谓/性别/单位/桌号）全空 → 整列空白。
 *
 * 为空 / 非数组时回落到标准前 5 列，保证历史或异常数据仍有可用表头。
 */
export function toColumnDefs(input: unknown): GuestFieldDef[] {
  if (Array.isArray(input) && input.length) return input as GuestFieldDef[];
  return GUEST_FIELD_DEFS.slice(0, 5) as GuestFieldDef[];
}

/**
 * 从名单记录的实际数据键推导列定义（供 `columnDefs` 缺失/为空时兜底）。
 *
 * 场景：名单创建时未带模板（或模板无字段），`listRecords` 返回的 `columnDefs` 为空对象，
 * 此时不能再硬编码 `GUEST_FIELD_DEFS` —— 否则像婚礼这类以 `ext_husband/ext_wife` 为键的名单
 * 会被渲染成「姓名/称谓/性别/单位/桌号」全空白列。
 *
 * 取值规则：取所有记录 data 键的并集；标准 key 用中文表头，自定义 `ext_*` key 用 key 本身作表头，
 * 保证名单内容真实可见（必要时再结合模板字段设计补全友好表头）。
 */
export function deriveColumnsFromRecords(
  rows: { data?: Record<string, string | null> | null }[] | null | undefined,
): GuestFieldDef[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const r of rows ?? []) {
    const data = r?.data;
    if (!data || typeof data !== 'object') continue;
    for (const k of Object.keys(data)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map(
    (k) => getGuestFieldDef(k) ?? { key: k, label: k, type: 'string', required: false, example: '' },
  );
}

/** 名单行数据（JSONB 形状）：key → string|null */
export type GuestData = Record<string, string | null>;

/** 字段级校验错误 */
export interface GuestFieldError {
  field: string;
  message: string;
}

/**
 * 归一化名单行数据：
 *  - 去首尾空格
 *  - 空串 → null（铁律：空值统一 null）
 *  - 丢弃未登记字段（导入多余列不报错、不落库）
 *  - `gender` 归一化为大写 M/F/U
 */
export function normalizeGuestData(
  input: Record<string, unknown>,
  defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS,
): GuestData {
  const out: GuestData = {};
  for (const def of defs) {
    const raw: unknown = input?.[def.key];
    // 未登记列：按「中文表头 → key」兜底再找一次，兼容用户用中文表头导入
    const rawVal: unknown = raw ?? input?.[def.label];
    let v = typeof rawVal === 'string' ? rawVal : rawVal == null ? '' : String(rawVal);
    v = v.trim();
    if (def.key === 'gender' && v) v = v.toUpperCase();
    out[def.key] = v === '' ? null : v;
  }
  return out;
}

/**
 * 校验名单行（须先经 `normalizeGuestData`）。
 * @returns 字段级错误数组；空数组表示合法。
 */
export function validateGuestData(
  data: GuestData,
  defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS,
): GuestFieldError[] {
  const errors: GuestFieldError[] = [];
  for (const def of defs) {
    const v = data?.[def.key];
    if (def.required) {
      if (v == null || v === '') {
        errors.push({ field: def.key, message: `${def.label}必填` });
        continue;
      }
    }
    if (v == null || v === '') continue; // 选填且为空 → 合法

    if (def.maxLen != null && [...v].length > def.maxLen) {
      errors.push({ field: def.key, message: `${def.label}不得超过 ${def.maxLen} 个字符` });
      continue;
    }
    if (def.type === 'enum' && def.values && !def.values.includes(v)) {
      errors.push({ field: def.key, message: `${def.label}取值必须为 ${def.values.join('/')}` });
      continue;
    }
    if (def.pattern && !new RegExp(def.pattern).test(v)) {
      errors.push({ field: def.key, message: `${def.label}格式不正确` });
    }
  }
  return errors;
}

/** 归一化 + 校验一步到位 */
export function normalizeAndValidateGuestData(
  input: Record<string, unknown>,
  defs: readonly GuestFieldDef[] = GUEST_FIELD_DEFS,
) {
  const data = normalizeGuestData(input, defs);
  return { data, errors: validateGuestData(data, defs) };
}

/**
 * 按性别推断称谓（名单未填 `guest_title` 时兜底，规范 §9.1）。
 * @returns '先生' | '女士' | ''（未知/未填时返回空串，调用方决定如何拼接）
 */
export function inferTitle(data: GuestData | null | undefined): string {
  if (!data) return '';
  const explicit = (data.guest_title ?? '').trim();
  if (explicit) return explicit;
  const g = (data.gender ?? '').toUpperCase();
  if (g === 'M') return '先生';
  if (g === 'F') return '女士';
  return '';
}
