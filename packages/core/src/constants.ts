import { CURRENT_SCHEMA_VERSION } from './schema';
import type {
  Element,
  ElementType,
  Project,
  ProjectSettings,
  RectElement,
  TextElement,
  CalendarElement,
  GalleryElement,
  PuzzleElement,
  CountdownElement,
  MapNavElement,
  MessageBoardElement,
  TimelineElement,
  LikeElement,
  WidgetElement,
} from './schema';

/** 默认画布尺寸（iPhone 设计基准） */
export const CANVAS_DEFAULT = {
  width: 375,
  height: 667,
} as const;

/** 画布规格预设分类（用于下拉框分组） */
export type CanvasPresetCategory = 'mobile' | 'card' | 'greeting' | 'social' | 'print';

/** 画布规格预设：width/height 以 `unit` 为单位（'px' 屏幕像素 / 'mm' 实物毫米） */
export interface CanvasPreset {
  id: string;
  category: CanvasPresetCategory;
  /** 中文展示名（预设名不做 i18n，UI 以中文为主） */
  label: string;
  width: number;
  height: number;
  unit: 'px' | 'mm';
}

/**
 * 日常设计常见画布规格。
 * - 屏幕类（手机/社交）用 px，单位即逻辑像素，与编辑器画布坐标 1:1；
 * - 实物类（名片/贺卡/印刷）用 mm，落库时按 MM_TO_PX_DPI 折算成 px（300dpi 印刷标准）。
 * 当前默认画布 375×667 对应 `iphone-678`，作为「自定义」未命中时的默认选项。
 */
export const CANVAS_PRESETS: CanvasPreset[] = [
  // 手机屏幕（竖版为主）
  { id: 'iphone-se', category: 'mobile', label: 'iPhone SE / 5 (320×568)', width: 320, height: 568, unit: 'px' },
  { id: 'iphone-678', category: 'mobile', label: 'iPhone 6/7/8 (375×667)', width: 375, height: 667, unit: 'px' },
  { id: 'iphone-678-plus', category: 'mobile', label: 'iPhone 6/7/8 Plus (414×736)', width: 414, height: 736, unit: 'px' },
  { id: 'iphone-x', category: 'mobile', label: 'iPhone X / XS / 11 Pro (375×812)', width: 375, height: 812, unit: 'px' },
  { id: 'iphone-xr', category: 'mobile', label: 'iPhone XR / 11 (414×896)', width: 414, height: 896, unit: 'px' },
  { id: 'iphone-1214', category: 'mobile', label: 'iPhone 12/13/14 (390×844)', width: 390, height: 844, unit: 'px' },
  { id: 'iphone-1516', category: 'mobile', label: 'iPhone 15/16 (393×852)', width: 393, height: 852, unit: 'px' },
  { id: 'iphone-promax', category: 'mobile', label: 'iPhone 15/16 Pro Max (430×932)', width: 430, height: 932, unit: 'px' },
  { id: 'android-base', category: 'mobile', label: 'Android 基准 (360×640)', width: 360, height: 640, unit: 'px' },
  { id: 'android-large', category: 'mobile', label: 'Android 大屏 (412×892)', width: 412, height: 892, unit: 'px' },

  // 名片
  { id: 'card-cn', category: 'card', label: '标准名片 (横 90×54mm)', width: 90, height: 54, unit: 'mm' },
  { id: 'card-intl', category: 'card', label: '国际名片 (横 85×54mm)', width: 85, height: 54, unit: 'mm' },
  { id: 'card-vertical', category: 'card', label: '竖版名片 (54×90mm)', width: 54, height: 90, unit: 'mm' },

  // 贺卡 / 请柬
  { id: 'greeting-a5', category: 'greeting', label: '对折贺卡 (A5 148×210mm)', width: 148, height: 210, unit: 'mm' },
  { id: 'greeting-a6', category: 'greeting', label: '单页贺卡 (A6 105×148mm)', width: 105, height: 148, unit: 'mm' },
  { id: 'greeting-square', category: 'greeting', label: '方形贺卡 (145×145mm)', width: 145, height: 145, unit: 'mm' },
  { id: 'invite-landscape', category: 'greeting', label: '横版请柬 (210×100mm)', width: 210, height: 100, unit: 'mm' },
  { id: 'invite-portrait', category: 'greeting', label: '竖版请柬 (140×210mm)', width: 140, height: 210, unit: 'mm' },

  // 社交媒体 / 海报
  { id: 'poster-phone', category: 'social', label: '手机海报 (750×1334)', width: 750, height: 1334, unit: 'px' },
  { id: 'poster-full', category: 'social', label: '全屏竖海报 (1080×1920)', width: 1080, height: 1920, unit: 'px' },
  { id: 'xhs-34', category: 'social', label: '小红书 3:4 (1080×1440)', width: 1080, height: 1440, unit: 'px' },
  { id: 'square-11', category: 'social', label: '方形图 1:1 (1080×1080)', width: 1080, height: 1080, unit: 'px' },
  { id: 'mp-cover', category: 'social', label: '公众号封面 (900×383)', width: 900, height: 383, unit: 'px' },
  { id: 'banner-169', category: 'social', label: '横版 Banner 16:9 (1920×1080)', width: 1920, height: 1080, unit: 'px' },

  // 标准印刷纸张
  { id: 'print-a4', category: 'print', label: 'A4 (210×297mm)', width: 210, height: 297, unit: 'mm' },
  { id: 'print-a5', category: 'print', label: 'A5 (148×210mm)', width: 148, height: 210, unit: 'mm' },
  { id: 'print-a6', category: 'print', label: 'A6 (105×148mm)', width: 105, height: 148, unit: 'mm' },
];

/** mm → px 折算 DPI（印刷标准 300dpi） */
export const MM_TO_PX_DPI = 300;

/** 毫米 → 像素：mm / 25.4 × DPI */
export function mmToPx(mm: number, dpi: number = MM_TO_PX_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

/** 像素 → 毫米：px / DPI × 25.4 */
export function pxToMm(px: number, dpi: number = MM_TO_PX_DPI): number {
  return (px / dpi) * 25.4;
}

/** 画布背景 */
export const CANVAS_BG = '#ffffff';

/** 生成唯一 ID（前端草稿用，后端会重新分配） */
export function genId(prefix = 'el'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** 倒计时默认目标时间：当前时间往后 30 天 */
export function defaultCountdownTarget(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 19);
}

/**
 * 创建一个空的工程
 *
 * i18n 约定：core 为前后端共用，不得内置任何语言文案。
 * title / page.name 默认留空，由调用方（视图层 t() 或后端 DTO）填充，
 * 视图层渲染时对空值使用本地化兜底文案。
 */
/** 默认工程设置 */
export function createDefaultSettings(): ProjectSettings {
  return {
    description: '',
    cover: '',
    pageTurnMode: 'vertical',
    autoFlip: true,
    autoFlipInterval: 3,
    loopFlip: false,
    showPageNumber: true,
    disableManualFlip: false,
    hideFlipArrow: false,
    flipIndicatorColor: '#000000',
    wechatAuth: true,
    barrageComment: false,
    barrageGift: false,
    closeBackgroundMusic: false,
    hideMusicIcon: false,
    showMusicTip: false,
    access: 'allow',
    showShareCountInTitle: false,
    showShareCountInDesc: false,
    disableWechatShare: false,
  };
}

export function createProject(title = ''): Project {
  const now = new Date().toISOString();
  return {
    id: genId('proj'),
    title,
    pages: [
      {
        id: genId('page'),
        name: '',
        elements: [],
        background: CANVAS_BG,
        height: CANVAS_DEFAULT.height,
        longPage: false,
        backgroundImage: '',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
      },
    ],
    width: CANVAS_DEFAULT.width,
    height: CANVAS_DEFAULT.height,
    settings: createDefaultSettings(),
    createdAt: now,
    updatedAt: now,
    version: CURRENT_SCHEMA_VERSION,
  };
}

/** 各元素类型的默认值工厂 */
export function createElement(
  type: ElementType,
  overrides: Partial<Element> = {},
): Element {
  const base = {
    id: genId(),
    x: 80,
    y: 120,
    width: 200,
    height: 60,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    visible: true,
    locked: false,
    borderWidth: 0,
    borderColor: '#000000',
    borderRadius: 0,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowOpacity: 1,
    ...overrides,
  };

  switch (type) {
    case 'text': {
      // 占位文案、字号、样式等均可由调用方通过 overrides 传入
      // 注意：overrides 已并入 base，但下方显式字段会覆盖，故均优先取调用方传入的值
      const to = overrides as Partial<TextElement>;
      return {
        ...base,
        type: 'text',
        text: to.text ?? '',
        fontSize: to.fontSize ?? 18,
        fontFamily: to.fontFamily ?? 'sans-serif',
        fill: to.fill ?? '#333333',
        align: to.align ?? 'left',
        lineHeight: to.lineHeight ?? 1.4,
        letterSpacing: to.letterSpacing ?? 0,
        fontStyle: to.fontStyle ?? 'normal',
        textDecoration: to.textDecoration ?? 'none',
        backgroundColor: to.backgroundColor ?? 'transparent',
        verticalAlign: to.verticalAlign ?? 'middle',
        wordBreak: to.wordBreak ?? 'break-word',
      } satisfies TextElement;
    }
    case 'rect':
      return {
        ...base,
        type: 'rect',
        fill: '#4f8cff',
        cornerRadius: 4,
      } satisfies RectElement;
    case 'circle':
      return {
        ...base,
        type: 'circle',
        fill: '#ff6b6b',
        radius: 30,
      };
    case 'image': {
      const imgOverrides = overrides as Partial<import('./schema').ImageElement>;
      return {
        ...base,
        type: 'image',
        // 保留调用方传入的 src，修复顶部“图片”上传后 src 被空字符串覆盖导致只显示占位边框的问题
        src: imgOverrides.src ?? '',
        naturalWidth: imgOverrides.naturalWidth ?? 200,
        naturalHeight: imgOverrides.naturalHeight ?? 200,
        objectFit: imgOverrides.objectFit ?? 'cover',
        filterBrightness: imgOverrides.filterBrightness ?? 100,
        filterContrast: imgOverrides.filterContrast ?? 100,
        filterBlur: imgOverrides.filterBlur ?? 0,
      };
    }
    case 'line':
      return {
        ...base,
        type: 'line',
        stroke: '#333333',
        strokeWidth: 2,
        points: [0, 0, 200, 0],
      };
    case 'button':
      return {
        ...base,
        type: 'button',
        text: '',
        fill: '#4f8cff',
        color: '#ffffff',
        fontSize: 16,
        radius: 8,
        link: undefined,
      };
    case 'video':
      return {
        ...base,
        type: 'video',
        src: '',
        poster: undefined,
        autoplay: false,
        muted: true,
        loop: false,
      };
    case 'star':
      return {
        ...base,
        type: 'star',
        fill: '#ffc53d',
        stroke: undefined,
        strokeWidth: 0,
        points: 5,
        lineStyle: 'solid',
      };
    case 'triangle':
      return {
        ...base,
        type: 'triangle',
        fill: '#52c41a',
        stroke: undefined,
        strokeWidth: 0,
        lineStyle: 'solid',
      };
    case 'ellipse':
      return {
        ...base,
        type: 'ellipse',
        width: 160,
        height: 100,
        fill: '#ff6b6b',
        stroke: undefined,
        strokeWidth: 0,
        lineStyle: 'solid',
      };
    case 'polygon':
      return {
        ...base,
        type: 'polygon',
        width: 120,
        height: 120,
        fill: '#52c41a',
        stroke: undefined,
        strokeWidth: 0,
        sides: 5,
        lineStyle: 'solid',
      };
    case 'arrow':
      return {
        ...base,
        type: 'arrow',
        width: 160,
        height: 60,
        stroke: '#333333',
        strokeWidth: 3,
        arrowType: 'end',
        arrowSize: 16,
        lineStyle: 'solid',
        points: [0, 30, 160, 30],
      };
    case 'calendar': {
      const now = new Date();
      const calOverrides = overrides as Partial<CalendarElement>;
      return {
        ...base,
        type: 'calendar',
        width: 280,
        height: 280,
        year: calOverrides.year ?? now.getFullYear(),
        month: calOverrides.month ?? now.getMonth() + 1,
        highlightDay: calOverrides.highlightDay ?? now.getDate(),
        locale: calOverrides.locale ?? 'zh-CN',
        marker: calOverrides.marker ?? 'heart',
        themeColor: calOverrides.themeColor ?? '#ef4444',
        dayColor: calOverrides.dayColor ?? '#4b5563',
        iconColor: calOverrides.iconColor ?? '#ffffff',
        textColor: calOverrides.textColor ?? '#ef4444',
        bgColor: calOverrides.bgColor ?? '#ffffff',
        iconAnimation: calOverrides.iconAnimation ?? false,
        fontFamily: calOverrides.fontFamily ?? 'Microsoft YaHei, PingFang SC, sans-serif',
        alias: calOverrides.alias ?? '',
      } satisfies CalendarElement;
    }
    case 'gallery': {
      const gOverrides = overrides as Partial<GalleryElement>;
      return {
        ...base,
        type: 'gallery',
        width: 320,
        height: 180,
        images: gOverrides.images?.length
          ? gOverrides.images
          : [
              'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
              'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80',
              'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
            ],
        currentIndex: gOverrides.currentIndex ?? 0,
        switchMode: gOverrides.switchMode ?? 'auto',
        switchInterval: gOverrides.switchInterval ?? 3,
        transition: gOverrides.transition ?? 'blinds',
        autoplay: gOverrides.autoplay ?? true,
        alias: gOverrides.alias ?? '',
      } satisfies GalleryElement;
    }
    case 'puzzle': {
      const pOverrides = overrides as Partial<PuzzleElement>;
      const defaultImages = [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
      ];
      return {
        ...base,
        type: 'puzzle',
        width: 280,
        height: 280,
        layout: pOverrides.layout ?? 'grid-2x2-square',
        images: pOverrides.images?.length ? pOverrides.images : defaultImages,
        gap: pOverrides.gap ?? 4,
        padding: pOverrides.padding ?? 4,
        bgColor: pOverrides.bgColor ?? '#ffffff',
        placeholderColor: pOverrides.placeholderColor ?? '#e5e7eb',
        alias: pOverrides.alias ?? '',
      } satisfies PuzzleElement;
    }
    case 'countdown': {
      const cOverrides = overrides as Partial<CountdownElement>;
      return {
        ...base,
        type: 'countdown',
        width: 300,
        height: 90,
        title: cOverrides.title ?? '距婚礼还有',
        target: cOverrides.target ?? defaultCountdownTarget(),
        showTitle: cOverrides.showTitle ?? true,
        bgColor: cOverrides.bgColor ?? '#fff5f5',
        textColor: cOverrides.textColor ?? '#7f1d1d',
        themeColor: cOverrides.themeColor ?? '#ef4444',
        digitBgColor: cOverrides.digitBgColor ?? '#ef4444',
        fontSize: cOverrides.fontSize ?? 28,
        alias: cOverrides.alias ?? '',
      } satisfies CountdownElement;
    }
    case 'mapNav': {
      const mOverrides = overrides as Partial<MapNavElement>;
      return {
        ...base,
        type: 'mapNav',
        width: 300,
        height: 80,
        venue: mOverrides.venue ?? '幸福大酒店',
        address: mOverrides.address ?? '北京市朝阳区幸福路 88 号',
        buttonText: mOverrides.buttonText ?? '导航前往',
        themeColor: mOverrides.themeColor ?? '#ef4444',
        textColor: mOverrides.textColor ?? '#333333',
        alias: mOverrides.alias ?? '',
      } satisfies MapNavElement;
    }
    case 'messageBoard': {
      const mbOverrides = overrides as Partial<MessageBoardElement>;
      return {
        ...base,
        type: 'messageBoard',
        width: 300,
        height: 220,
        title: mbOverrides.title ?? '送上你的祝福',
        allowPost: mbOverrides.allowPost ?? true,
        placeholder: mbOverrides.placeholder ?? '写下你的祝福……',
        themeColor: mbOverrides.themeColor ?? '#ef4444',
        textColor: mbOverrides.textColor ?? '#333333',
        messages: mbOverrides.messages ?? [],
        alias: mbOverrides.alias ?? '',
      } satisfies MessageBoardElement;
    }
    case 'timeline': {
      const tOverrides = overrides as Partial<TimelineElement>;
      return {
        ...base,
        type: 'timeline',
        width: 280,
        height: 320,
        nodes: tOverrides.nodes ?? [
          { time: '15:30', title: '宾客入场', desc: '签到、合影留念' },
          { time: '16:00', title: '仪式开始', desc: '证婚、交换戒指' },
          { time: '18:00', title: '婚宴', desc: '敬酒、互动游戏' },
        ],
        themeColor: tOverrides.themeColor ?? '#ef4444',
        textColor: tOverrides.textColor ?? '#333333',
        alias: tOverrides.alias ?? '',
      } satisfies TimelineElement;
    }
    case 'like': {
      const lOverrides = overrides as Partial<LikeElement>;
      return {
        ...base,
        type: 'like',
        width: 200,
        height: 60,
        text: lOverrides.text ?? '为新人点赞',
        themeColor: lOverrides.themeColor ?? '#ef4444',
        textColor: lOverrides.textColor ?? '#333333',
        count: lOverrides.count ?? 0,
        iconSize: lOverrides.iconSize ?? 24,
        alias: lOverrides.alias ?? '',
      } satisfies LikeElement;
    }
    case 'widget': {
      const wOverrides = overrides as Partial<WidgetElement>;
      return {
        ...base,
        type: 'widget',
        width: wOverrides.width ?? 240,
        height: wOverrides.height ?? 80,
        widget: wOverrides.widget ?? 'viewCount',
        alias: wOverrides.alias ?? '',
        title: wOverrides.title ?? '',
        text: wOverrides.text ?? '',
        themeColor: wOverrides.themeColor ?? '#ef4444',
        textColor: wOverrides.textColor ?? '#333333',
        bgColor: wOverrides.bgColor ?? '#ffffff',
        data: wOverrides.data ?? {},
      } satisfies WidgetElement;
    }
    default:
      return {
        ...base,
        type: 'text',
        text: '',
      } as TextElement;
  }
}
