/**
 * 三端复用的「请柬变量绑定」类型（S5）。
 *
 * 与服务端 invitation.service.getHealth 返回结构对齐；不重复定义判定逻辑
 * （三级阻断 / slug 生成 / 位置描述全在 @h5design/core 纯函数，三端不各写一遍）。
 */

/** 模板变量视图（来自 core collectBindings，含人类可读名） */
export interface HealthVar {
  key: string;
  /** 人类可读变量名（C 方案 binding.name），展示与默认候选用；缺省回落 label */
  name?: string | null;
  /** 标准字段取 GuestFieldDef.label，自定义字段回落 key */
  label: string;
  /** 命中该变量的元素 id 列表（D 模式点选用） */
  elementIds: string[];
  isStandard?: boolean;
}

/** 名单可用列（D 模式元素→字段映射的候选项） */
export interface HealthCandidate {
  key: string;
  label: string;
}

export interface HealthMatched {
  key: string;
  label: string;
  name?: string | null;
}

export interface HealthMissing {
  key: string;
  label: string;
  name?: string | null;
  /** 是否为必填核心变量（如 guest_name） */
  critical: boolean;
  /** 可改指向的名单列 key 列表 */
  remapTargets: string[];
}

export interface HealthEmptyHit {
  key: string;
  label: string;
  rows: number;
}

export interface HealthUnusedField {
  key: string;
  label: string;
}

export interface HealthFontCoverage {
  elementId: string;
  fontFamily: string;
  bindingKey?: string;
  missingChars: string[];
  missingCodepoints: number[];
  affectedRecords: number;
  totalRecords: number;
  uyghurFallback?: boolean;
}

/** getHealth 返回（与服务端一致；name/vars/candidates 为 S5 新增） */
export interface InvitationHealth {
  projectId: string;
  templateId: string;
  listId: string;
  mapping: Record<string, string>;
  vars: HealthVar[];
  candidates: HealthCandidate[];
  matched: HealthMatched[];
  missing: HealthMissing[];
  emptyHits: HealthEmptyHit[];
  unusedFields: HealthUnusedField[];
  fontCoverage: HealthFontCoverage[];
  blocked: boolean;
  orphaned: string[];
  superseded: string[];
}

/** 生成期画布点选的元素（来自 getProjectElements） */
export interface ProjectElement {
  id: string;
  type: string;
  pageIndex: number;
  text?: string;
  /** 该元素已有的 C 绑定 key（若有） */
  bindingKey?: string;
}

/** 生成期元素级绑定（落 project.elementBindings，不回写模板） */
export interface ElementBindingEntry {
  /** 变量 key（ASCII slug，同 C 方案；零绑定模板直接用名单字段 key） */
  key: string;
  name?: string;
  /** 映射到的名单字段 key（与 key 同源时等于 key） */
  listField?: string;
}

export type ElementBindings = Record<string, ElementBindingEntry>;

/** 三级阻断裁决 */
export interface BlockVerdict {
  /** 硬阻断：主按钮禁用 */
  blocked: boolean;
  blockCode?: 'NO_MAPPING_AT_ALL' | 'REQUIRED_UNMAPPED' | 'NO_USABLE_COLUMN';
  blockReason?: string;
  /** 琥珀放行：逐项列「将留空/隐藏，共 N 张」 */
  amber: boolean;
  amberCount: number;
}

export interface VariableMappingDialogProps {
  open: boolean;
  health: InvitationHealth;
  /** D 模式画布点选元素列表（来自 getProjectElements）；缺省则 D 模式不可用 */
  elements?: ProjectElement[];
  /** D 模式预览用模板 schema（Project）；缺省则以元素列表代替画布 */
  previewSchema?: unknown;
  /** i18n 键前缀（默认 invitationMapping，挂在 common 命名空间下） */
  i18nPrefix?: string;
  onClose: () => void;
  /** 保存 C 模式变量→名单列映射（variableMapping） */
  onSaveMapping: (mapping: Record<string, string>) => Promise<void> | void;
  /** 保存 D 模式元素级绑定（elementBindings） */
  onSaveElementBindings: (elementBindings: ElementBindings) => Promise<void> | void;
  /**
   * 字段配对完成回调（保存映射 或 点击「跳过」均可触发）。
   * 仅当用户完成配对时触发，用于推进分步向导进入「批量生成」步骤；不传则忽略。
   */
  onPaired?: () => void;
}
