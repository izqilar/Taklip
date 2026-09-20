/**
 * 内容安全服务 — 敏感词过滤 + 图片机审(预留接口)
 *
 * - 敏感词库：覆盖政治敏感、色情、暴力、赌博、毒品、广告欺诈等高频违规类目
 * - 文本扫描：支持纯文本扫描与 Schema 递归提取文本扫描
 * - 图片机审：预留 scanImage 接口，后续接入腾讯云/阿里云内容审核 API
 */
import { Injectable, Logger } from '@nestjs/common';

/** 敏感词扫描结果 */
export interface TextScanResult {
  passed: boolean;
  matchedWords: string[];
}

/** 模板内容扫描结果（含命中的字段路径） */
export interface TemplateScanResult {
  passed: boolean;
  matchedWords: string[];
  /** 命中敏感词的字段路径列表（如 name / pages[0].elements[1].text） */
  flaggedFields: string[];
}

/** 图片扫描结果 */
export interface ImageScanResult {
  passed: boolean;
  reason?: string;
}

/**
 * 基础敏感词库。
 * 生产环境应从数据库或外部敏感词服务加载，此处内置高频违规词做基础拦截。
 * 词汇按类目分组，便于后续扩展和审计。
 */
const SENSITIVE_WORDS: string[] = [
  // —— 政治敏感（高频子串） ——
  '反动', '颠覆', '分裂国家', '恐怖主义', '极端主义',
  // —— 色情 ——
  '色情', '淫秽', '裸聊', '成人电影', '招嫖', '卖淫',
  // —— 暴力 / 仇恨 ——
  '杀人方法', '制爆', '炸弹制作', '种族仇恨', '灭族',
  // —— 赌博 ——
  '网络赌博', '在线赌场', '六合彩投注', '外围赌球',
  // —— 毒品 ——
  '冰毒制作', '海洛因出售', '大麻种子', '毒品批发',
  // —— 广告欺诈 / 违法营销 ——
  '代开发票', '伪造证件', '办假证', '刷单', '套现',
  // —— 诈骗 ——
  '电信诈骗', '网络刷单', '杀猪盘', '庞氏骗局',
  // —— 其他 ——
  '邪教', '传销组织', '非法集资',
];

@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);
  private readonly wordSet: Set<string>;
  /** 预编译的正则，用于高效匹配 */
  private readonly scanRegex: RegExp;

  constructor() {
    this.wordSet = new Set(SENSITIVE_WORDS);
    // 转义特殊字符并拼接成 (word1|word2|...) 的全局正则
    const escaped = SENSITIVE_WORDS
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length); // 长词优先匹配
    this.scanRegex = new RegExp(escaped.join('|'), 'gi');
  }

  /**
   * 扫描纯文本，返回命中敏感词列表。
   */
  scanText(text: string): TextScanResult {
    if (!text || typeof text !== 'string') {
      return { passed: true, matchedWords: [] };
    }
    const matches = text.match(this.scanRegex);
    if (!matches || matches.length === 0) {
      return { passed: true, matchedWords: [] };
    }
    // 去重
    const matchedWords = [...new Set(matches.map((m) => m.toLowerCase()))];
    return { passed: false, matchedWords };
  }

  /**
   * 递归提取 Schema 中所有文本字段值。
   * 遍历 Project JSON 的 pages → elements，提取每个元素的 text/title/venue/address 等文本字段。
   * 同时扫描 schema 顶层的 title 字段。
   *
   * @returns 字段路径 → 文本内容 的映射
   */
  private extractTextFields(obj: unknown, basePath = '', out: Map<string, string> = new Map()): Map<string, string> {
    if (obj === null || obj === undefined) return out;
    if (typeof obj === 'string') {
      if (obj.trim()) out.set(basePath, obj);
      return out;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        this.extractTextFields(item, `${basePath}[${i}]`, out);
      });
      return out;
    }
    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      // 需要扫描的文本类字段名
      const textFields = ['text', 'title', 'name', 'venue', 'address', 'buttonText', 'desc', 'placeholder', 'boardTitle', 'likeText'];

      for (const [key, val] of Object.entries(record)) {
        const path = basePath ? `${basePath}.${key}` : key;
        if (textFields.includes(key) && typeof val === 'string') {
          if (val.trim()) out.set(path, val);
        } else if (typeof val === 'object' && val !== null) {
          this.extractTextFields(val, path, out);
        }
      }
      return out;
    }
    return out;
  }

  /**
   * 扫描模板内容（名称 + Schema 中所有文本字段）。
   * 返回是否通过、命中的敏感词列表、以及命中的字段路径。
   */
  scanTemplateContent(name: string, schema: unknown): TemplateScanResult {
    const allMatchedWords: Set<string> = new Set();
    const flaggedFields: string[] = [];

    // 1. 扫描模板名称
    const nameResult = this.scanText(name);
    if (!nameResult.passed) {
      nameResult.matchedWords.forEach((w) => allMatchedWords.add(w));
      flaggedFields.push('name');
    }

    // 2. 递归提取 Schema 中的文本字段并扫描
    const textFields = this.extractTextFields(schema);
    for (const [path, text] of textFields) {
      const result = this.scanText(text);
      if (!result.passed) {
        result.matchedWords.forEach((w) => allMatchedWords.add(w));
        if (!flaggedFields.includes(path)) {
          flaggedFields.push(path);
        }
      }
    }

    return {
      passed: allMatchedWords.size === 0,
      matchedWords: [...allMatchedWords],
      flaggedFields,
    };
  }

  /**
   * 图片内容审核（预留接口）。
   *
   * 当前为占位实现，生产环境应接入：
   * - 腾讯云内容安全：https://cloud.tencent.com/document/product/1125
   * - 阿里云内容审核：https://help.aliyun.com/product/46422
   *
   * 接入时替换此方法实现，调用外部 API 并返回结果。
   */
  async scanImage(_url: string): Promise<ImageScanResult> {
    // 预留：实际接入时调用外部内容审核 API
    // const result = await this.callExternalImageModeration(url);
    // return { passed: result.passed, reason: result.reason };
    return { passed: true };
  }

  /** 获取当前敏感词库大小（调试/审计用） */
  getWordCount(): number {
    return this.wordSet.size;
  }
}
