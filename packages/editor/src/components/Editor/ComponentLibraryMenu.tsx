import { useTranslation } from 'react-i18next';
import type { WidgetKind } from '@h5design/core';
import { getWidgetDefault } from '../../elements/widget/registry';

export type ComponentItemKey =
  | 'calendar'
  | 'gallery'
  | 'puzzle'
  | 'externalVideo'
  | 'weddingTimeline'
  | 'paragraph'
  | 'viewCount'
  | 'dynamicNumber'
  | 'screenshot'
  | 'table'
  | 'scrollText'
  | 'flashText'
  | 'mapNav'
  | 'phoneCall'
  | 'hyperlink'
  | 'vote'
  | 'messageBoard'
  | 'relay'
  | 'like'
  | 'countdown'
  | 'dataChart'
  | 'quiz'
  | 'lottery'
  | 'quickForm'
  | 'inputBox'
  | 'idCard'
  | 'dropdown'
  | 'multiSelect'
  | 'singleSelect'
  | 'rating'
  | 'uploadImage'
  | 'formCount'
  | 'region'
  | 'submitButton'
  | 'wechatNickname'
  | 'wechatAvatar'
  | 'wechatAvatarWall'
  | 'workCover'
  | 'workTitle';

interface ComponentItem {
  key: ComponentItemKey;
  elementType?: 'text' | 'button' | 'video' | 'calendar' | 'gallery' | 'puzzle' | 'countdown' | 'mapNav' | 'messageBoard' | 'timeline' | 'like' | 'widget';
  preset?: Record<string, unknown>;
}

/** 构造一个「组件」型菜单项，preset 携带该 widget 的默认尺寸与配置 */
function widgetItem(kind: WidgetKind): ComponentItem {
  return {
    key: kind,
    elementType: 'widget',
    preset: { widget: kind, ...getWidgetDefault(kind) } as Record<string, unknown>,
  };
}

interface ComponentCategory {
  key: 'common' | 'interactive' | 'form' | 'feature';
  items: ComponentItemKey[];
}

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  {
    key: 'common',
    items: [
      'calendar',
      'gallery',
      'puzzle',
      'externalVideo',
      'weddingTimeline',
      'paragraph',
      'viewCount',
      'dynamicNumber',
      'screenshot',
      'table',
      'scrollText',
      'flashText',
    ],
  },
  {
    key: 'interactive',
    items: [
      'mapNav',
      'phoneCall',
      'hyperlink',
      'vote',
      'messageBoard',
      'relay',
      'like',
      'countdown',
      'dataChart',
      'quiz',
      'lottery',
    ],
  },
  {
    key: 'form',
    items: [
      'quickForm',
      'inputBox',
      'idCard',
      'dropdown',
      'multiSelect',
      'singleSelect',
      'rating',
      'uploadImage',
      'formCount',
      'region',
      'submitButton',
    ],
  },
  {
    key: 'feature',
    items: [
      'wechatNickname',
      'wechatAvatar',
      'wechatAvatarWall',
      'workCover',
      'workTitle',
    ],
  },
];

/** 组件项与元素类型的映射；未配置的代表需要先占位提示的高级组件 */
export const COMPONENT_ITEM_MAP: Record<ComponentItemKey, ComponentItem> = {
  calendar: { key: 'calendar', elementType: 'calendar' },
  gallery: { key: 'gallery', elementType: 'gallery' },
  puzzle: { key: 'puzzle', elementType: 'puzzle' },
  externalVideo: { key: 'externalVideo', elementType: 'video' },
  weddingTimeline: { key: 'weddingTimeline', elementType: 'timeline' },
  paragraph: {
    key: 'paragraph',
    elementType: 'text',
    preset: {
      text: '段落文本内容',
      width: 280,
      height: 100,
      fontSize: 14,
    },
  },
  viewCount: widgetItem('viewCount'),
  dynamicNumber: widgetItem('dynamicNumber'),
  screenshot: widgetItem('screenshot'),
  table: widgetItem('table'),
  scrollText: {
    key: 'scrollText',
    elementType: 'text',
    preset: { text: '滚动文字内容', width: 260, height: 40, fontSize: 16 },
  },
  flashText: {
    key: 'flashText',
    elementType: 'text',
    preset: { text: '快闪文字', width: 200, height: 60, fontSize: 28, fontStyle: 'bold' },
  },
  mapNav: { key: 'mapNav', elementType: 'mapNav' },
  phoneCall: {
    key: 'phoneCall',
    elementType: 'button',
    preset: { text: '拨打电话', link: 'tel:' },
  },
  hyperlink: {
    key: 'hyperlink',
    elementType: 'button',
    preset: { text: '点击访问', link: 'https://' },
  },
  vote: widgetItem('vote'),
  messageBoard: { key: 'messageBoard', elementType: 'messageBoard' },
  relay: widgetItem('relay'),
  like: { key: 'like', elementType: 'like' },
  countdown: { key: 'countdown', elementType: 'countdown' },
  dataChart: widgetItem('dataChart'),
  quiz: widgetItem('quiz'),
  lottery: widgetItem('lottery'),
  quickForm: widgetItem('quickForm'),
  inputBox: widgetItem('inputBox'),
  idCard: widgetItem('idCard'),
  dropdown: widgetItem('dropdown'),
  multiSelect: widgetItem('multiSelect'),
  singleSelect: widgetItem('singleSelect'),
  rating: widgetItem('rating'),
  uploadImage: widgetItem('uploadImage'),
  formCount: widgetItem('formCount'),
  region: widgetItem('region'),
  submitButton: {
    key: 'submitButton',
    elementType: 'button',
    preset: { text: '提交', fill: '#3b82f6' },
  },
  wechatNickname: widgetItem('wechatNickname'),
  wechatAvatar: widgetItem('wechatAvatar'),
  wechatAvatarWall: widgetItem('wechatAvatarWall'),
  workCover: widgetItem('workCover'),
  workTitle: widgetItem('workTitle'),
};

function IconSvg({
  className = 'h-5 w-5',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function ComponentItemIcon({ itemKey, className = 'h-5 w-5' }: { itemKey: ComponentItemKey; className?: string }) {
  switch (itemKey) {
    case 'calendar':
      return (
        <IconSvg className={className}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </IconSvg>
      );
    case 'gallery':
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </IconSvg>
      );
    case 'puzzle':
      return (
        <IconSvg className={className}>
          <path d="M19 5a3 3 0 0 0-3 3v1h-2V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h1v2H5a3 3 0 0 0-3 3v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2h2v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2a3 3 0 0 0-3-3h-1v-2h1a3 3 0 0 0 3-3V5z" />
        </IconSvg>
      );
    case 'externalVideo':
      return (
        <IconSvg className={className}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <polygon points="10 9 16 12 10 15 10 9" />
        </IconSvg>
      );
    case 'weddingTimeline':
      return (
        <IconSvg className={className}>
          <line x1="6" y1="5" x2="20" y2="5" />
          <circle cx="6" cy="5" r="2" />
          <line x1="6" y1="12" x2="20" y2="12" />
          <circle cx="6" cy="12" r="2" />
          <line x1="6" y1="19" x2="20" y2="19" />
          <circle cx="6" cy="19" r="2" />
        </IconSvg>
      );
    case 'paragraph':
      return (
        <IconSvg className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="14" y1="2" x2="14" y2="8" />
          <line x1="20" y1="8" x2="14" y2="8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </IconSvg>
      );
    case 'viewCount':
      return (
        <IconSvg className={className}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </IconSvg>
      );
    case 'dynamicNumber':
      return (
        <IconSvg className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10v4" />
          <path d="M10 10v4" />
          <path d="M13 10v4" />
          <path d="M16 10v4" />
        </IconSvg>
      );
    case 'screenshot':
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </IconSvg>
      );
    case 'table':
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </IconSvg>
      );
    case 'scrollText':
      return (
        <IconSvg className={className}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
          <path d="M19 16l3 2-3 2" />
        </IconSvg>
      );
    case 'flashText':
      return (
        <IconSvg className={className}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </IconSvg>
      );
    case 'mapNav':
      return (
        <IconSvg className={className}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </IconSvg>
      );
    case 'phoneCall':
      return (
        <IconSvg className={className}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </IconSvg>
      );
    case 'hyperlink':
      return (
        <IconSvg className={className}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </IconSvg>
      );
    case 'vote':
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 12l2 2 4-4" />
        </IconSvg>
      );
    case 'messageBoard':
      return (
        <IconSvg className={className}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </IconSvg>
      );
    case 'relay':
      return (
        <IconSvg className={className}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </IconSvg>
      );
    case 'like':
      return (
        <IconSvg className={className}>
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </IconSvg>
      );
    case 'countdown':
      return (
        <IconSvg className={className}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </IconSvg>
      );
    case 'dataChart':
      return (
        <IconSvg className={className}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </IconSvg>
      );
    case 'quiz':
      return (
        <IconSvg className={className}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </IconSvg>
      );
    case 'lottery':
      return (
        <IconSvg className={className}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2v20" />
          <path d="M2 12h20" />
        </IconSvg>
      );
    case 'quickForm':
      return (
        <IconSvg className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="16" x2="13" y2="16" />
        </IconSvg>
      );
    case 'inputBox':
      return (
        <IconSvg className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </IconSvg>
      );
    case 'idCard':
      return (
        <IconSvg className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M15 16H7a4 4 0 0 1 4-3 4 4 0 0 1 4 3z" />
          <rect x="13" y="6" width="6" height="6" rx="1" />
        </IconSvg>
      );
    case 'dropdown':
      return (
        <IconSvg className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 10l4 4 4-4" />
        </IconSvg>
      );
    case 'multiSelect':
      return (
        <IconSvg className={className}>
          <rect x="3" y="5" width="16" height="14" rx="2" />
          <path d="M8 11l2 2 5-5" />
        </IconSvg>
      );
    case 'singleSelect':
      return (
        <IconSvg className={className}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </IconSvg>
      );
    case 'rating':
      return (
        <IconSvg className={className}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </IconSvg>
      );
    case 'uploadImage':
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          <path d="M16 2v4" />
          <path d="M19 5h-4" />
        </IconSvg>
      );
    case 'formCount':
      return (
        <IconSvg className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="14" y1="2" x2="14" y2="8" />
          <line x1="20" y1="8" x2="14" y2="8" />
          <path d="M8 13h.01" />
          <path d="M12 13h4" />
          <path d="M8 17h.01" />
          <path d="M12 17h4" />
        </IconSvg>
      );
    case 'region':
      return (
        <IconSvg className={className}>
          <path d="M3 6l6 3 6-3 6 3v12l-6-3-6 3-6-3V6z" />
          <line x1="9" y1="9" x2="9" y2="21" />
          <line x1="15" y1="6" x2="15" y2="18" />
        </IconSvg>
      );
    case 'submitButton':
      return (
        <IconSvg className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M8 12h8" />
        </IconSvg>
      );
    case 'wechatNickname':
    case 'wechatAvatar':
    case 'wechatAvatarWall':
      return (
        <IconSvg className={className}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </IconSvg>
      );
    case 'workCover':
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </IconSvg>
      );
    case 'workTitle':
      return (
        <IconSvg className={className}>
          <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </IconSvg>
      );
    default:
      return (
        <IconSvg className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </IconSvg>
      );
  }
}

interface ComponentLibraryMenuProps {
  open: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSelect: (key: ComponentItemKey) => void;
}

export default function ComponentLibraryMenu({
  open,
  onMouseEnter,
  onMouseLeave,
  onSelect,
}: ComponentLibraryMenuProps) {
  const { t } = useTranslation('editor');

  if (!open) return null;

  return (
    <div
      className="absolute left-1/2 top-full z-50 mt-1 w-[560px] max-w-[90vw] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="grid grid-cols-4 gap-4">
        {COMPONENT_CATEGORIES.map((category) => (
          <div key={category.key}>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">
              {t(`editor:componentMenu.categories.${category.key}`)}
            </h4>
            <div className="space-y-0.5">
              {category.items.map((itemKey) => (
                <button
                  key={itemKey}
                  type="button"
                  onClick={() => onSelect(itemKey)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                  title={t(`editor:componentMenu.items.${itemKey}`)}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-blue-500">
                    <ComponentItemIcon itemKey={itemKey} className="h-4 w-4" />
                  </span>
                  <span className="truncate">{t(`editor:componentMenu.items.${itemKey}`)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
