/**
 * 注册即入驻（/onboarding）→ 入驻申请（/user/apply）的资料传递通道。
 *
 * 背景：注册页选择「入驻服务商 / 代理商」后进入 /onboarding 填写入驻资料，提交成功即落单
 * 并跳转 /user/apply 查看进度。原实现是裸的 `navigate('/user/apply')`，**不携带任何数据**：
 * 用户在申请页看到的是全新空表单（申请类型默认「加入」、省/市/区下拉与申请说明全空），
 * 会误判为「刚填的资料丢了」。
 *
 * 本模块提供双通道传递，兼顾即时性与健壮性：
 *   ① 导航 state —— 同一 SPA 会话内即时可用，无需等待；
 *   ② sessionStorage —— 兜底「刷新 / 新标签页打开 / 从通知跳回」等导航 state 丢失的场景。
 *
 * 注意：prefill 只是**回显**用户在注册流里已填的内容，不代表可以重复提交；
 * 申请页会以提示条说明「该申请已提交」，引导用户按正常审核流程推进。
 */
export const APPLY_PREFILL_KEY = 'taklip:applyPrefill';

export interface ApplyPrefill {
  /** 刚创建的入驻申请 id（用于提示条展示「已提交」） */
  applicationId?: string | null;
  /** 入驻层次：服务商 / 代理商 */
  kind: 'provider' | 'agent';
  /** 区域路径（末级节点 regionPath，如 "65/6501/650105"） */
  regionPath?: string | null;
  /** 区域可读标签（省 / 市 / 区） */
  regionLabel?: string | null;
  /** 申请说明 */
  reason?: string;
  /** 服务类型（仅服务商） */
  serviceScopes?: string[];
  /** —— 以下为入驻主体资质材料 —— */
  applicantName?: string;
  phone?: string;
  certType?: string;
  certNo?: string;
  certExpire?: string;
  certLongTerm?: boolean;
  issuer?: string | null;
  attachments?: string[];
}

/** 写入预填资料（sessionStorage 不可用时静默降级，导航 state 仍可工作） */
export function writeApplyPrefill(p: ApplyPrefill): void {
  try {
    sessionStorage.setItem(APPLY_PREFILL_KEY, JSON.stringify(p));
  } catch {
    /* 隐私模式 / storage 被禁用：忽略，导航 state 通道仍可用 */
  }
}

/** 读取预填资料；无数据或解析失败返回 null */
export function readApplyPrefill(): ApplyPrefill | null {
  try {
    const raw = sessionStorage.getItem(APPLY_PREFILL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ApplyPrefill) : null;
  } catch {
    return null;
  }
}

/** 清除预填资料（用户确认提示条 / 提交成功后调用） */
export function clearApplyPrefill(): void {
  try {
    sessionStorage.removeItem(APPLY_PREFILL_KEY);
  } catch {
    /* ignore */
  }
}
