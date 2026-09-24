/**
 * 内容安全服务 — 红线词库 + 文本机审 + 图片机审(预留接口)
 *
 * v2 内容审核闸口核心组件：
 * - 红线词库：优先从数据库 RedlineWord 表加载（总台可维护、可停用），表为空时播种内置高频违规词（含类别）。
 * - 文本机审：扫描模板/作品名称与 Schema 文本，命中即返回敏感词 + 所属红线类别 + 命中字段路径。
 * - 图片机审：预留 scanImage 接口，后续接入腾讯云/阿里云内容审核 API。
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** 红线类别（固定分类法，机审与人工复核共用；仅词库内容可由总台维护） */
export const REDLINE_CATEGORIES = [
  { key: 'political', label: '政治敏感' },
  { key: 'ideology', label: '意识形态' },
  { key: 'porn', label: '色情低俗' },
  { key: 'violence', label: '暴力恐怖' },
  { key: 'gambling', label: '赌博' },
  { key: 'drug', label: '毒品' },
  { key: 'fraud', label: '诈骗' },
  { key: 'infringement', label: '侵权' },
  { key: 'false_ad', label: '虚假宣传' },
  { key: 'other', label: '其他' },
] as const;

export type RedlineCategoryKey = (typeof REDLINE_CATEGORIES)[number]['key'];

const REDLINE_KEYS: string[] = REDLINE_CATEGORIES.map((c) => c.key);

/**
 * 审核驳回的红线闸口强校验（决策点 6/7）：
 * 驳回（reject）必须同时填写审核意见 + 选择有效红线类别，否则拒绝请求。
 * 这是「前端已强制、后端兜底」的防御纵深，避免绕过前端直接调 API 漏掉红线。
 */
export function assertRejectRedline(cat?: string, note?: string): void {
  if (!cat || !REDLINE_KEYS.includes(cat)) {
    throw new BadRequestException('驳回操作必须选择有效的红线类别（redlineCategory）');
  }
  if (!note || !note.trim()) {
    throw new BadRequestException('驳回操作必须填写审核意见（reviewNote）');
  }
}

/** 内置播种词（表为空时写入 DB，便于总台后续维护） */
const BUILTIN_REDLINE_WORDS: { word: string; category: RedlineCategoryKey }[] = [
  // 政治敏感
  { word: '反动', category: 'political' },
  { word: '颠覆', category: 'political' },
  { word: '分裂国家', category: 'political' },
  { word: '恐怖主义', category: 'political' },
  { word: '极端主义', category: 'political' },
  // 色情低俗
  { word: '色情', category: 'porn' },
  { word: '淫秽', category: 'porn' },
  { word: '裸聊', category: 'porn' },
  { word: '成人电影', category: 'porn' },
  { word: '招嫖', category: 'porn' },
  { word: '卖淫', category: 'porn' },
  // 暴力恐怖
  { word: '杀人方法', category: 'violence' },
  { word: '制爆', category: 'violence' },
  { word: '炸弹制作', category: 'violence' },
  { word: '种族仇恨', category: 'violence' },
  { word: '灭族', category: 'violence' },
  // 赌博
  { word: '网络赌博', category: 'gambling' },
  { word: '在线赌场', category: 'gambling' },
  { word: '六合彩投注', category: 'gambling' },
  { word: '外围赌球', category: 'gambling' },
  // 毒品
  { word: '冰毒制作', category: 'drug' },
  { word: '海洛因出售', category: 'drug' },
  { word: '大麻种子', category: 'drug' },
  { word: '毒品批发', category: 'drug' },
  // 诈骗 / 违法营销
  { word: '电信诈骗', category: 'fraud' },
  { word: '网络刷单', category: 'fraud' },
  { word: '杀猪盘', category: 'fraud' },
  { word: '庞氏骗局', category: 'fraud' },
  { word: '刷单', category: 'fraud' },
  { word: '套现', category: 'fraud' },
  // 其他违规
  { word: '邪教', category: 'other' },
  { word: '传销组织', category: 'other' },
  { word: '非法集资', category: 'other' },
  { word: '代开发票', category: 'other' },
  { word: '伪造证件', category: 'other' },
  { word: '办假证', category: 'other' },
];

/** 纯文本扫描结果 */
export interface TextScanResult {
  passed: boolean;
  matchedWords: string[];
  /** 命中词所属红线类别 */
  categories: RedlineCategoryKey[];
}

/** 内容扫描结果（含命中的字段路径） */
export interface ContentScanResult {
  passed: boolean;
  matchedWords: string[];
  categories: RedlineCategoryKey[];
  /** 命中敏感词的字段路径列表（如 name / pages[0].elements[1].text） */
  flaggedFields: string[];
}

/** 图片扫描结果 */
export interface ImageScanResult {
  passed: boolean;
  reason?: string;
}

@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);
  /** 词 → 类别 映射（小写键） */
  private readonly wordMap = new Map<string, RedlineCategoryKey>();
  /** 预编译正则，用于高效匹配 */
  private scanRegex: RegExp = /(?!)/; // 默认空匹配（永不命中）
  /** 是否已加载词库（懒加载，避免 DI 未完成时访问 DB） */
  private loaded = false;

  constructor(private readonly prisma: PrismaService) {}

  /** 懒加载词库：优先 DB，空则播种内置词 */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    let rows: { word: string; category: string }[] = [];
    try {
      rows = await this.prisma.redlineWord.findMany({ where: { enabled: true } });
      if (rows.length === 0) {
        await this.seedBuiltin();
        rows = await this.prisma.redlineWord.findMany({ where: { enabled: true } });
      }
    } catch (e) {
      this.logger.error('红线词库加载失败，回退内置词库', e as Error);
    }
    this.rebuildIndex(rows);
    this.loaded = true;
  }

  /** 将词库写入 DB（幂等：仅当表为空时） */
  private async seedBuiltin(): Promise<void> {
    const count = await this.prisma.redlineWord.count();
    if (count > 0) return;
    await this.prisma.redlineWord.createMany({
      data: BUILTIN_REDLINE_WORDS.map((w) => ({ word: w.word, category: w.category })),
      skipDuplicates: true,
    });
  }

  /** 用行数据重建内存索引与正则 */
  private rebuildIndex(rows: { word: string; category: string }[]): void {
    this.wordMap.clear();
    for (const r of rows) {
      this.wordMap.set(r.word.toLowerCase(), r.category as RedlineCategoryKey);
    }
    if (this.wordMap.size === 0) {
      this.scanRegex = /(?!)/;
      return;
    }
    const escaped = [...this.wordMap.keys()]
      .sort((a, b) => b.length - a.length) // 长词优先匹配
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    this.scanRegex = new RegExp(escaped.join('|'), 'gi');
  }

  /** 重新加载词库（总台维护词库后调用） */
  async refreshWordCache(): Promise<number> {
    const rows = await this.prisma.redlineWord.findMany({ where: { enabled: true } });
    this.rebuildIndex(rows);
    this.loaded = true;
    return this.wordMap.size;
  }

  /** 红线类别清单（供前端人工复核面板渲染勾选项） */
  getRedlineCategories(): { key: RedlineCategoryKey; label: string }[] {
    return REDLINE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));
  }

  /** 扫描纯文本，返回命中敏感词与所属红线类别 */
  async scanText(text: string): Promise<TextScanResult> {
    await this.ensureLoaded();
    if (!text || typeof text !== 'string') {
      return { passed: true, matchedWords: [], categories: [] };
    }
    const matches = text.match(this.scanRegex);
    if (!matches || matches.length === 0) {
      return { passed: true, matchedWords: [], categories: [] };
    }
    const wordSet = new Set<string>();
    const catSet = new Set<RedlineCategoryKey>();
    for (const m of matches) {
      const key = m.toLowerCase();
      wordSet.add(key);
      const cat = this.wordMap.get(key);
      if (cat) catSet.add(cat);
    }
    return {
      passed: false,
      matchedWords: [...wordSet],
      categories: [...catSet],
    };
  }

  /** 递归提取 Schema 中所有文本字段值（字段路径 → 文本） */
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

  /** 扫描内容（名称 + Schema 文本），返回是否通过、命中词、红线类别、命中字段 */
  async scanContent(name: string, schema: unknown): Promise<ContentScanResult> {
    const allWords = new Set<string>();
    const allCats = new Set<RedlineCategoryKey>();
    const flaggedFields: string[] = [];

    const nameResult = await this.scanText(name);
    if (!nameResult.passed) {
      nameResult.matchedWords.forEach((w) => allWords.add(w));
      nameResult.categories.forEach((c) => allCats.add(c));
      flaggedFields.push('name');
    }

    const textFields = this.extractTextFields(schema);
    for (const [path, text] of textFields) {
      const result = await this.scanText(text);
      if (!result.passed) {
        result.matchedWords.forEach((w) => allWords.add(w));
        result.categories.forEach((c) => allCats.add(c));
        if (!flaggedFields.includes(path)) flaggedFields.push(path);
      }
    }

    return {
      passed: allWords.size === 0,
      matchedWords: [...allWords],
      categories: [...allCats],
      flaggedFields,
    };
  }

  /**
   * 图片内容审核（预留接口）。
   * 当前为占位实现，生产环境应接入腾讯云/阿里云内容审核 API。
   */
  async scanImage(_url: string): Promise<ImageScanResult> {
    // 预留：实际接入时调用外部内容审核 API
    return { passed: true };
  }

  /** 当前词库大小（调试/审计用） */
  getWordCount(): number {
    return this.wordMap.size;
  }
}
