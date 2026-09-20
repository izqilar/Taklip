/**
 * TAKLIP 设计平台核心数据模型（统一 JSON Schema）
 *
 * 该文件是整个平台的「单一数据源」定义，被编辑态（Konva）与发布态（DOM）渲染器、
 * 前端状态管理、以及后端持久化（PostgreSQL JSONB）共同消费。
 *
 * 层级关系：Project → Page[] → Element[]
 */

/** 元素类型枚举。新增元素类型只需在此扩展 + 注册渲染组件。 */
export type ElementType =
  | 'text'
  | 'image'
  | 'rect'
  | 'circle'
  | 'line'
  | 'button'
  | 'video'
  | 'star'
  | 'triangle'
  | 'ellipse'
  | 'polygon'
  | 'arrow'
  | 'group'
  | 'calendar'
  | 'gallery'
  | 'puzzle'
  | 'countdown'
  | 'mapNav'
  | 'messageBoard'
  | 'timeline'
  | 'like'
  | 'widget';

/**
 * 「组件」菜单中尚未独立成型的占位组件，统一收敛为一个 `widget` 元素类型，
 * 通过 `widget` 判别字段区分具体种类，避免无限扩张 ElementType 联合与三处分发器。
 * 这些组件覆盖：展示 / 互动 / 表单 / 微信能力 四大类。
 */
export type WidgetKind =
  | 'viewCount'
  | 'dynamicNumber'
  | 'screenshot'
  | 'table'
  | 'vote'
  | 'relay'
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
  | 'wechatNickname'
  | 'wechatAvatar'
  | 'wechatAvatarWall'
  | 'workCover'
  | 'workTitle';

/** 入场动画类型 */
export type EnterAnimationType =
  | 'none'
  | 'fadeIn'
  | 'slideIn'
  | 'zoomIn'
  | 'bounceIn'
  | 'rotateIn'
  | 'flipIn';

/** 循环动画类型 */
export type LoopAnimationType =
  | 'none'
  | 'pulse'
  | 'shake'
  | 'float'
  | 'spin';

/** 缓动函数 */
export type EasingType =
  | 'linear'
  | 'ease'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce';

/** 动画分类：入场 / 强调 / 出场 */
export type AnimationCategory = 'enter' | 'emphasis' | 'exit';

/**
 * 单个动画配置（新版动画面板使用）。
 * 兼容旧版 AnimationConfig：当 animation 字段存在时优先使用新版；否则回退到旧字段。
 */
export interface SingleAnimationConfig {
  category: AnimationCategory;
  /** 动画标识，如 fadeIn、bounce、fadeOut */
  type: string;
  /** 时长（秒） */
  duration: number;
  /** 延迟（秒） */
  delay: number;
  /** 重复次数，0 表示播放 1 次（GSAP repeat 语义） */
  repeat: number;
  /** 是否无限循环 */
  loop: boolean;
}

/** 元素动画配置（兼容旧字段 + 新字段） */
export interface AnimationConfig {
  /** 旧版：入场动画类型 */
  enter?: EnterAnimationType;
  /** 旧版：入场时长（秒） */
  enterDuration?: number;
  /** 旧版：入场延迟（秒） */
  enterDelay?: number;
  /** 旧版：入场缓动 */
  enterEasing?: EasingType;
  /** 旧版：循环动画类型 */
  loop?: LoopAnimationType;
  /** 旧版：循环动画时长（秒） */
  loopDuration?: number;
  /** 旧版：循环动画缓动 */
  loopEasing?: EasingType;

  /**
   * 新版：动画配置列表（支持一个元素添加多个入场/强调/出场动画）。
   * 为兼容旧数据，也允许单个 SingleAnimationConfig（读取端应统一处理为数组）。
   */
  animation?: SingleAnimationConfig | SingleAnimationConfig[];
}

/** 所有元素共有的基础属性 */
export interface BaseElement {
  id: string;
  type: ElementType;
  /** 画布坐标（左上角，单位 px，基于设计稿基准尺寸） */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 旋转角度，单位 degree */
  rotation: number;
  /** 透明度 0-1 */
  opacity: number;
  /** 图层顺序，越大越靠上 */
  zIndex: number;
  /** 是否可见 */
  visible: boolean;
  /** 是否锁定（不可选中/拖拽） */
  locked: boolean;
  /** 元素备注名，便于图层列表中识别 */
  name?: string;
  /** 表单绑定键：一键制作向导按此键将表单值注入该元素（文本写 text / 图片写 src / 图集写 images） */
  bind?: string;
  /** 动画配置（可选） */
  animation?: AnimationConfig;
  /** 边框宽度 */
  borderWidth?: number;
  /** 边框颜色 */
  borderColor?: string;
  /** 边框圆角 */
  borderRadius?: number;
  /** 边框样式：无边框 / 实线 / 虚线 / 点线 / 双线 */
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  /** 阴影颜色 */
  shadowColor?: string;
  /** 阴影模糊半径 */
  shadowBlur?: number;
  /** 阴影水平偏移 */
  shadowOffsetX?: number;
  /** 阴影垂直偏移 */
  shadowOffsetY?: number;
  /** 阴影不透明度（0~1，默认 1） */
  shadowOpacity?: number;
}

/** 文本元素 */
export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  /**
   * 水平对齐：
   *  - 'left' | 'center' | 'right'：常规对齐
   *  - 'justify'：两端对齐 —— 除每段末行外拉伸铺满宽度，末行按书写方向回退（LTR→左，RTL→右）
   *  - 'justify-all'：分散对齐 —— 所有行（含末行）强制两端对齐
   */
  align: 'left' | 'center' | 'right' | 'justify' | 'justify-all';
  lineHeight: number;
  letterSpacing: number;
  /**
   * 字体样式（Konva 原生语义）：
   * 'normal' | 'italic' | 'bold' | 'italic bold'
   */
  fontStyle: 'normal' | 'italic' | 'bold' | 'italic bold';
  /** 文本装饰：none / underline / line-through */
  textDecoration: 'none' | 'underline' | 'line-through';
  /** 文本背景色/高亮色 */
  backgroundColor: string;
  /** 垂直对齐：top / middle / bottom */
  verticalAlign: 'top' | 'middle' | 'bottom';
  /** 换行方式：normal / break-all / keep-all / break-word */
  wordBreak: 'normal' | 'break-all' | 'keep-all' | 'break-word';
  /** 多语种文本：key -> 文案，用于编辑器内国际化预览 */
  i18n?: Record<string, string>;
  /** 文本轮廓（描边）颜色；为空或 outlineWidth<=0 时不绘制轮廓 */
  outlineColor?: string;
  /** 文本轮廓粗细（px）；0 或不传表示无轮廓 */
  outlineWidth?: number;
  /** 文本轮廓线型：solid / dashed / dotted */
  outlineStyle?: 'solid' | 'dashed' | 'dotted';
  /** 书写方向：ltr（从左向右，默认）/ rtl（从右向左，阿拉伯文等） */
  direction?: 'ltr' | 'rtl';
}

/** 图片元素 */
export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  /** 圆角（独立于边框，直接裁剪图片四角；支持四角独立） */
  cornerRadius?: number | CornerRadius;
  /** 裁剪蒙版（形状遮罩，如圆形/心形/星形等；不重新编码像素，仅作为可视蒙版） */
  clip?: ImageClip;
  /** 适配方式：cover 填充 / contain 适应 / repeat-x 水平平铺 / repeat-y 垂直平铺 */
  objectFit?: 'cover' | 'contain' | 'repeat-x' | 'repeat-y';
  /** 亮度滤镜，百分比，默认 100 */
  filterBrightness?: number;
  /** 对比度滤镜，百分比，默认 100 */
  filterContrast?: number;
  /** 模糊滤镜，px，默认 0 */
  filterBlur?: number;
}

/** 四角独立圆角：依次为 左上 / 右上 / 右下 / 左下 */
export interface CornerRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/** 图片裁剪形状（编辑态 Konva 与发布态 DOM 共用，作为形状蒙版 clip） */
export type ImageClipShape =
  | 'none'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'hexagon'
  | 'star'
  | 'heart';

/** 图片裁剪蒙版配置
 * - shape: 形状遮罩（none 表示无遮罩）
 * - crop:  可选的归一化裁剪区域（相对于原图，0~1）
 */
export interface ImageClip {
  shape: ImageClipShape;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** 矩形/形状元素 */
export interface RectElement extends BaseElement {
  type: 'rect';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  /** 圆角：单值=四角相同；对象=四角独立（顺序 topLeft/topRight/bottomRight/bottomLeft） */
  cornerRadius?: number | CornerRadius;
}

/** 圆形元素 */
export interface CircleElement extends BaseElement {
  type: 'circle';
  fill: string;
  radius: number;
  /** 边框颜色 */
  stroke?: string;
  /** 边框宽度 */
  strokeWidth?: number;
  /** 线型：solid / dashed / dotted */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/** 线段元素 */
export interface LineElement extends BaseElement {
  type: 'line';
  stroke: string;
  strokeWidth: number;
  /** 线型：solid / dashed / dotted */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  points: number[];
}

/** 箭头元素（带端点箭头的线段） */
export interface ArrowElement extends BaseElement {
  type: 'arrow';
  stroke: string;
  strokeWidth: number;
  /** 箭头类型：start（起点）/ end（终点，默认）/ both / none */
  arrowType?: 'start' | 'end' | 'both' | 'none';
  /** 箭头大小 */
  arrowSize?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  points: number[];
}

/** 椭圆元素 */
export interface EllipseElement extends BaseElement {
  type: 'ellipse';
  fill: string;
  /** 边框颜色；未设置时填充色即可 */
  stroke?: string;
  strokeWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/** 多边形元素 */
export interface PolygonElement extends BaseElement {
  type: 'polygon';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  /** 边数，默认 5 */
  sides?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/** 按钮元素（可点击，可选跳转链接） */
export interface ButtonElement extends BaseElement {
  type: 'button';
  text: string;
  /** 背景色 */
  fill: string;
  /** 文字颜色 */
  color: string;
  fontSize: number;
  /** 圆角 */
  radius: number;
  /** 跳转链接（可选） */
  link?: string;
}

/** 视频元素 */
export interface VideoElement extends BaseElement {
  type: 'video';
  src: string;
  poster?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  /** 圆角 */
  radius?: number;
}

/** 日历高亮标记形状 */
export type CalendarMarker = 'heart' | 'star' | 'flower' | 'diamond' | 'circle' | 'snow';

/** 日历元素（婚礼/请柬场景常用） */
export interface CalendarElement extends BaseElement {
  type: 'calendar';
  /** 年份，如 2026 */
  year: number;
  /** 月份 1-12 */
  month: number;
  /** 要高亮的日期（1-31） */
  highlightDay: number;
  /** 语言：中文 / 英文 */
  locale: 'zh-CN' | 'en';
  /** 高亮标记形状 */
  marker: CalendarMarker;
  /** 主题色（年月、星期、高亮标记） */
  themeColor: string;
  /** 普通日期文字颜色 */
  dayColor: string;
  /** 高亮日期文字/图标颜色 */
  iconColor: string;
  /** 文字/图标颜色（统一文字） */
  textColor: string;
  /** 背景色 */
  bgColor: string;
  /** 高亮标记是否启用循环动画 */
  iconAnimation: boolean;
  /** 字体 */
  fontFamily: string;
  /** 组件别名 */
  alias?: string;
}

/** 星形元素 */
export interface StarElement extends BaseElement {
  type: 'star';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  /** 角数，默认 5 */
  points?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/** 三角形元素 */
export interface TriangleElement extends BaseElement {
  type: 'triangle';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/** 图集切换方式 */
export type GallerySwitchMode = 'manual' | 'auto';

/** 图集切换动画 */
export type GalleryTransition =
  | 'random'
  | 'blinds'
  | 'blinds3d'
  | 'randomBlocks'
  | 'blocks'
  | 'flipBook'
  | 'camera'
  | 'concentric'
  | 'cube'
  | 'explode'
  | 'fade'
  | 'fall'
  | 'transition'
  | 'circle'
  | 'slide'
  | 'swipe'
  | 'twist'
  | 'waterfall'
  | 'wave'
  | 'zipper';

/** 图集元素（Banner 轮播图） */
export interface GalleryElement extends BaseElement {
  type: 'gallery';
  /** 图片列表 */
  images: string[];
  /** 当前显示索引 */
  currentIndex: number;
  /** 切换方式：手动 / 自动 */
  switchMode: GallerySwitchMode;
  /** 自动切换间隔（秒） */
  switchInterval: number;
  /** 切换动画 */
  transition: GalleryTransition;
  /** 是否正在自动播放 */
  autoplay: boolean;
  /** 组件别名 */
  alias?: string;
}

/** 拼图布局 id（编辑态/发布态在各自渲染层解析为具体几何） */
export type PuzzleLayout =
  | 'two-cols'
  | 'two-hearts'
  | 'three-rows'
  | 'two-hexagons'
  | 'three-cols'
  | 'four-rows'
  | 'grid-2x2'
  | 'left-big-right-stacked'
  | 'three-hex-triangle'
  | 'grid-2x2-square'
  | 'jigsaw-4'
  | 'three-hearts'
  | 'four-leaf'
  | 'hex-flower-7'
  | 'hex-star-6'
  | 'hex-cluster-7'
  | 'hex-cluster-7b'
  | 'grid-3x3';

/** 拼图元素（照片墙 / 拼图） */
export interface PuzzleElement extends BaseElement {
  type: 'puzzle';
  /** 当前选中的布局 id */
  layout: PuzzleLayout;
  /** 填充图片列表，按顺序对应 layout 中的每一块 */
  images: string[];
  /** 块之间间距（px） */
  gap: number;
  /** 组件内边距（px） */
  padding: number;
  /** 背景色（可见于间隙/未填充块） */
  bgColor: string;
  /** 未填充块占位色 */
  placeholderColor: string;
  /** 组件别名 */
  alias?: string;
}

/** 倒计时元素（婚礼/请柬场景：距大喜还有 N 天） */
export interface CountdownElement extends BaseElement {
  type: 'countdown';
  /** 标题文案，如「距婚礼还有」 */
  title: string;
  /** 目标时间（ISO 字符串，如 2026-10-01T12:00:00） */
  target: string;
  /** 是否显示标题 */
  showTitle: boolean;
  /** 背景色 */
  bgColor: string;
  /** 标题/普通文字颜色 */
  textColor: string;
  /** 主题色（分隔符、天数强调） */
  themeColor: string;
  /** 数字底色 */
  digitBgColor: string;
  /** 数字字号 */
  fontSize: number;
  /** 组件别名 */
  alias?: string;
}

/** 地图导航元素（一键唤起地图 App 查看婚礼场地） */
export interface MapNavElement extends BaseElement {
  type: 'mapNav';
  /** 场地名称 */
  venue: string;
  /** 详细地址 */
  address: string;
  /** 按钮文案 */
  buttonText: string;
  /** 主题色（图标、按钮） */
  themeColor: string;
  /** 文字颜色 */
  textColor: string;
  /** 组件别名 */
  alias?: string;
}

/** 留言板元素（宾客祝福留言，前端 localStorage 持久化） */
export interface MessageBoardElement extends BaseElement {
  type: 'messageBoard';
  /** 标题，如「送上你的祝福」 */
  title: string;
  /** 是否允许访客发布留言 */
  allowPost: boolean;
  /** 输入框占位文案 */
  placeholder: string;
  /** 主题色（标题、发送按钮） */
  themeColor: string;
  /** 文字颜色 */
  textColor: string;
  /** 已有留言列表 */
  messages: MessageItem[];
  /** 组件别名 */
  alias?: string;
}

/** 留言条目 */
export interface MessageItem {
  id: string;
  name: string;
  text: string;
  /** 留言时间（ISO 字符串） */
  time: string;
}

/** 时间轴元素（婚礼当天流程节点） */
export interface TimelineElement extends BaseElement {
  type: 'timeline';
  /** 流程节点列表 */
  nodes: TimelineNode[];
  /** 主题色（轴线、节点圆点） */
  themeColor: string;
  /** 文字颜色 */
  textColor: string;
  /** 组件别名 */
  alias?: string;
}

/** 时间轴节点 */
export interface TimelineNode {
  time: string;
  title: string;
  desc: string;
}

/** 点赞元素（为新人点赞，前端 localStorage 持久化） */
export interface LikeElement extends BaseElement {
  type: 'like';
  /** 文案，如「为新人点赞」 */
  text: string;
  /** 主题色（爱心、已点赞态） */
  themeColor: string;
  /** 文字颜色 */
  textColor: string;
  /** 初始点赞数（未点赞时显示） */
  count: number;
  /** 图标尺寸（px） */
  iconSize: number;
  /** 组件别名 */
  alias?: string;
}

/**
 * 万能组件元素。
 * 用一个 `widget` 判别字段承载「组件」菜单里所有的占位组件，
 * 组件特定的配置统一放在 `data` 里，由前端 widget 模块自行解释。
 * 通用展示字段（title/themeColor/textColor/bgColor）提升为顶层便于属性面板统一渲染。
 */
export interface WidgetElement extends BaseElement {
  type: 'widget';
  /** 具体组件种类 */
  widget: WidgetKind;
  /** 组件别名（图层列表显示） */
  alias?: string;
  /** 通用标题文案 */
  title?: string;
  /** 通用正文文案 */
  text?: string;
  /** 主题色（按钮、强调、分隔线） */
  themeColor?: string;
  /** 文字颜色 */
  textColor?: string;
  /** 背景色 */
  bgColor?: string;
  /** 组件特定配置（键由具体 widget 决定） */
  data: Record<string, any>;
}

/** 元素联合类型 */
export type Element =
  | TextElement
  | ImageElement
  | RectElement
  | CircleElement
  | LineElement
  | ButtonElement
  | VideoElement
  | StarElement
  | TriangleElement
  | EllipseElement
  | PolygonElement
  | ArrowElement
  | CalendarElement
  | GalleryElement
  | PuzzleElement
  | CountdownElement
  | MapNavElement
  | MessageBoardElement
  | TimelineElement
  | LikeElement
  | WidgetElement;

/** 单个页面（H5 通常一页，模板可能多页） */
export interface Page {
  id: string;
  name: string;
  elements: Element[];
  background: string;
  /** 页面高度（覆盖项目级 height，长页模式用） */
  height?: number;
  /** 是否开启长页面模式 */
  longPage?: boolean;
  /** 背景图片地址 */
  backgroundImage?: string;
  /** 背景图片尺寸：cover / contain / 100% 100% */
  backgroundSize?: string;
  /** 背景图片平铺：no-repeat / repeat / repeat-x / repeat-y */
  backgroundRepeat?: string;
  /** 背景图片透明度：0~1，默认 1（完全不透明）。仅作用于背景图，不影响背景色 */
  backgroundImageOpacity?: number;
}

/** 背景音乐配置 */
export interface BackgroundMusic {
  name: string;
  url: string;
  icon: string;
}

/** 工程级设置（常规 / 背景音乐 / 分享访问） */
export interface ProjectSettings {
  description?: string;
  cover?: string;
  /** 翻页方式：vertical=上下翻页，horizontal=左右翻页 */
  pageTurnMode: 'vertical' | 'horizontal';
  /** 是否自动翻页 */
  autoFlip: boolean;
  /** 自动翻页间隔（秒） */
  autoFlipInterval: number;
  /** 是否循环翻页 */
  loopFlip: boolean;
  /** 是否显示页码 */
  showPageNumber: boolean;
  /** 是否禁止手动翻页 */
  disableManualFlip: boolean;
  /** 是否隐藏翻页箭头 */
  hideFlipArrow: boolean;
  /** 翻页指示器颜色 */
  flipIndicatorColor?: string;
  /** 是否开启微信授权 */
  wechatAuth: boolean;
  /** 是否开启弹幕留言 */
  barrageComment: boolean;
  /** 是否开启弹幕礼物 */
  barrageGift: boolean;
  /** 背景音乐 */
  backgroundMusic?: BackgroundMusic;
  /** 是否关闭背景音乐 */
  closeBackgroundMusic: boolean;
  /** 是否隐藏背景音乐图标 */
  hideMusicIcon: boolean;
  /** 是否显示背景音乐提示文字 */
  showMusicTip: boolean;
  /** 访问设置：allow=允许访问，password=密码访问，deny=禁止访问 */
  access: 'allow' | 'password' | 'deny';
  /** 访问密钥/密码 */
  accessPassword?: string;
  /** 允许访问开始日期（ISO 字符串） */
  accessDateStart?: string;
  /** 允许访问结束日期（ISO 字符串） */
  accessDateEnd?: string;
  /** 在标题中显示分享次数 */
  showShareCountInTitle: boolean;
  /** 在描述中显示分享次数 */
  showShareCountInDesc: boolean;
  /** 禁止微信分享 */
  disableWechatShare: boolean;
}

/** 当前 schema 版本号。任何一次「设计一次，三端一致」渲染管线迭代都应 bump 此值。 */
export const CURRENT_SCHEMA_VERSION = 1;

/** 工程（一个 H5 作品） */
export interface Project {
  id: string;
  title: string;
  pages: Page[];
  /** 设计稿基准宽高（默认 375 x 667 手机屏） */
  width: number;
  height: number;
  /** 工程级设置 */
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
  /** schema 版本号，用于前后端渲染管线的兼容性判断与迁移 */
  version: number;
}

/**
 * 将任意（可能残缺/历史版本）输入归一化为符合当前版本的 Project。
 * 缺字段时填默认值，缺 version 时补 CURRENT_SCHEMA_VERSION。
 * 用于后端落库前兜底、前端渲染前防御，保证「三端渲染」拿到的是结构完整的 schema。
 */
export function normalizeSchema(
  input: Project | Partial<Project> | null | undefined,
): Project {
  const p = (input ?? {}) as Partial<Project>;
  return {
    id: p.id ?? '',
    title: p.title ?? '未命名作品',
    pages: Array.isArray(p.pages) ? p.pages : [],
    width: typeof p.width === 'number' ? p.width : 375,
    height: typeof p.height === 'number' ? p.height : 667,
    settings: (p.settings ?? {}) as ProjectSettings,
    createdAt: p.createdAt ?? '',
    updatedAt: p.updatedAt ?? '',
    version: typeof p.version === 'number' ? p.version : CURRENT_SCHEMA_VERSION,
  };
}

/** 后端持久化的作品记录（含用户与状态信息） */
export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  cover?: string;
  status: 'draft' | 'published';
  /** 完整 Schema，对应数据库 JSONB 字段 */
  schema: Project;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/* ───────── 圆角工具函数（编辑态 Konva 与发布态 DOM 共用） ───────── */

/** 把任意圆角输入归一化为四角对象（缺省按 0 处理） */
export function normalizeCornerRadius(v: number | CornerRadius | undefined | null): CornerRadius {
  if (v == null) return { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
  if (typeof v === 'number') {
    const r = Math.max(0, v);
    return { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r };
  }
  return {
    topLeft: Math.max(0, v.topLeft || 0),
    topRight: Math.max(0, v.topRight || 0),
    bottomRight: Math.max(0, v.bottomRight || 0),
    bottomLeft: Math.max(0, v.bottomLeft || 0),
  };
}

/** 转为 Konva Rect 的 cornerRadius 参数（单值或 [tl, tr, br, bl] 数组） */
export function toKonvaCornerRadius(v: number | CornerRadius | undefined | null): number | number[] {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.max(0, v);
  const c = normalizeCornerRadius(v);
  return [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];
}

/** 转为 CSS border-radius 字符串（tl tr br bl） */
export function cornerRadiusToCss(v: number | CornerRadius | undefined | null): string {
  const c = normalizeCornerRadius(v);
  return `${c.topLeft}px ${c.topRight}px ${c.bottomRight}px ${c.bottomLeft}px`;
}

/** 四角是否全部相等（用于 UI 判定「统一圆角」） */
export function isUniformCornerRadius(v: number | CornerRadius | undefined | null): boolean {
  if (v == null || typeof v === 'number') return true;
  const c = normalizeCornerRadius(v);
  return c.topLeft === c.topRight && c.topRight === c.bottomRight && c.bottomRight === c.bottomLeft;
}

/* ───────── 图片裁剪蒙版形状（编辑态 Konva 与发布态 DOM 共用） ───────── */

/** 归一化裁剪配置；非法/缺省一律回退到 none（不裁剪） */
const VALID_CLIP_SHAPES: ImageClipShape[] = [
  'none',
  'circle',
  'ellipse',
  'triangle',
  'hexagon',
  'star',
  'heart',
];

function normalizeCropRect(v: unknown): ImageClip['crop'] {
  if (!v || typeof v !== 'object') return undefined;
  const c = v as Record<string, unknown>;
  const n = {
    x: typeof c.x === 'number' ? c.x : 0,
    y: typeof c.y === 'number' ? c.y : 0,
    width: typeof c.width === 'number' ? c.width : 1,
    height: typeof c.height === 'number' ? c.height : 1,
  };
  if (n.width <= 0 || n.height <= 0) return undefined;
  return {
    x: Math.max(0, Math.min(1, n.x)),
    y: Math.max(0, Math.min(1, n.y)),
    width: Math.max(0.01, Math.min(1, n.width)),
    height: Math.max(0.01, Math.min(1, n.height)),
  };
}

/** 归一化裁剪配置；非法/缺省一律回退到 none（不裁剪） */
export function normalizeImageClip(v: ImageClip | ImageClipShape | undefined | null): ImageClip {
  if (!v) return { shape: 'none' };
  if (typeof v === 'string') {
    return { shape: VALID_CLIP_SHAPES.includes(v) ? v : 'none' };
  }
  const shape = (v.shape as ImageClipShape) || 'none';
  const clip: ImageClip = { shape: VALID_CLIP_SHAPES.includes(shape) ? shape : 'none' };
  const crop = normalizeCropRect(v.crop);
  if (crop) {
    // 自动约束 crop 不越界
    crop.width = Math.min(crop.width, 1 - crop.x);
    crop.height = Math.min(crop.height, 1 - crop.y);
    clip.crop = crop;
  }
  return clip;
}

/** 生成正多边形顶点（中心 cx,cy，半径 r，sides 边，startDeg 起始角，单位度） */
function regularPolygonPoints(cx: number, cy: number, r: number, sides: number, startDeg = -90): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = (startDeg - 90) * (Math.PI / 180) + (i * 2 * Math.PI) / sides;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}

/** 生成星形顶点（外/内半径交替，2*points 个顶点） */
function starPoints2(cx: number, cy: number, outer: number, inner: number, points: number, startDeg = -90): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const step = Math.PI / points;
  const startRad = (startDeg - 90) * (Math.PI / 180);
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = startRad + i * step;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}

/** 心形路径：在 0..100 归一化坐标系中定义，再缩放到 w×h */
function heartPathScaled(w: number, h: number): string {
  const sx = w / 100;
  const sy = h / 100;
  const p = (x: number, y: number) => `${(x * sx).toFixed(2)},${(y * sy).toFixed(2)}`;
  return (
    `M${p(50, 88)} ` +
    `C${p(20, 65)} ${p(2, 45)} ${p(2, 28)} ` +
    `C${p(2, 13)} ${p(14, 5)} ${p(27, 5)} ` +
    `C${p(39, 5)} ${p(46, 14)} ${p(50, 22)} ` +
    `C${p(54, 14)} ${p(61, 5)} ${p(73, 5)} ` +
    `C${p(86, 5)} ${p(98, 13)} ${p(98, 28)} ` +
    `C${p(98, 45)} ${p(80, 65)} ${p(50, 88)} Z`
  );
}

/**
 * 生成 SVG path 的 d 字符串（像素坐标系，0,0 在左上角），供 DOM `clip-path: path()` 使用。
 * 当 shape 为 none 时返回空串（调用方据此不裁剪）。
 */
export function buildClipSvgPath(shape: ImageClipShape, w: number, h: number): string {
  if (shape === 'none') return '';
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  const f = (n: number) => n.toFixed(2);
  switch (shape) {
    case 'circle':
      return `M ${f(cx - R)},${f(cy)} a ${f(R)},${f(R)} 0 1,0 ${f(2 * R)},0 a ${f(R)},${f(R)} 0 1,0 ${f(-2 * R)},0 Z`;
    case 'ellipse': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${f(cx - rx)},${f(cy)} a ${f(rx)},${f(ry)} 0 1,0 ${f(2 * rx)},0 a ${f(rx)},${f(ry)} 0 1,0 ${f(-2 * rx)},0 Z`;
    }
    case 'triangle':
      return `M ${f(w / 2)},0 L 0,${f(h)} L ${f(w)},${f(h)} Z`;
    case 'hexagon':
      return 'M ' + regularPolygonPoints(cx, cy, R, 6).map((p) => `${f(p.x)},${f(p.y)}`).join(' L ') + ' Z';
    case 'star':
      return 'M ' + starPoints2(cx, cy, R, R * 0.382, 5).map((p) => `${f(p.x)},${f(p.y)}`).join(' L ') + ' Z';
    case 'heart':
      return heartPathScaled(w, h);
    default:
      return '';
  }
}

/**
 * 在 2D 上下文（Konva.Context 或 CanvasRenderingContext2D）上描出裁剪形状路径。
 * 调用方在之后执行 clip()。坐标基于元素局部盒子（0,0 左上角，w×h 右下角）。
 */
export function drawClipOnContext(
  ctx: {
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arc(x: number, y: number, r: number, start: number, end: number, ccw?: boolean): void;
    ellipse(x: number, y: number, rx: number, ry: number, rot: number, start: number, end: number): void;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
    closePath(): void;
  },
  shape: ImageClipShape,
  w: number,
  h: number,
): void {
  if (shape === 'none') return;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.closePath();
      break;
    case 'ellipse':
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(0, h);
      ctx.lineTo(w, h);
      ctx.closePath();
      break;
    case 'hexagon':
      regularPolygonPoints(cx, cy, R, 6).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      break;
    case 'star':
      starPoints2(cx, cy, R, R * 0.382, 5).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      break;
    case 'heart': {
      const sx = w / 100;
      const sy = h / 100;
      const X = (x: number) => x * sx;
      const Y = (y: number) => y * sy;
      ctx.moveTo(X(50), Y(88));
      ctx.bezierCurveTo(X(20), Y(65), X(2), Y(45), X(2), Y(28));
      ctx.bezierCurveTo(X(2), Y(13), X(14), Y(5), X(27), Y(5));
      ctx.bezierCurveTo(X(39), Y(5), X(46), Y(14), X(50), Y(22));
      ctx.bezierCurveTo(X(54), Y(14), X(61), Y(5), X(73), Y(5));
      ctx.bezierCurveTo(X(86), Y(5), X(98), Y(13), X(98), Y(28));
      ctx.bezierCurveTo(X(98), Y(45), X(80), Y(65), X(50), Y(88));
      ctx.closePath();
      break;
    }
    default:
      break;
  }
}
