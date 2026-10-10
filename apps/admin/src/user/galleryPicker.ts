/**
 * 运营端编辑器「图库选择器」桥（与 web 端 apps/web/src/user/galleryPicker.ts 同契约）。
 *
 * 编辑器内核（@h5design/editor）在用户点击「添加图片 / 填充图片 / 背景图片」时调用
 * `services.openAssetPicker()`；该服务由运营端 editorServices.ts 注入，内部再调用本模块的
 * `openGalleryPicker()`。真正打开/关闭弹窗的实现由 GalleryPickerModal 组件在挂载时通过
 * `registerGalleryPicker` 注册。未注册（弹窗未挂载）时 openGalleryPicker 返回 null，
 * 内核会回退到原生文件上传 —— 这正是之前「绕过配额」的根因，现由挂载弹窗解决。
 *
 * ⚠️ 选中的图库图是私有资产（/api/assets/:id/file 需鉴权），编辑器渲染图片依赖公开 URL，
 * 因此 GalleryPickerModal 在选中后会把私有图转存为公开 media 副本，并把公开 url 一并返回，
 * 与 web 端 editorServices.openAssetPicker 行为一致。
 */
export interface PickedGalleryAsset {
  /** 图库原图 id（用于去重 / 溯源） */
  id: string;
  /** 转存后的公开可访问 media URL（编辑器直接 <img>/Konva 加载） */
  url: string;
  width?: number;
  height?: number;
}

type ResolveFn = (asset: PickedGalleryAsset | null) => void;
type OpenHandler = (resolve: ResolveFn) => void;

let handler: OpenHandler | null = null;

/** 选择器弹窗挂载时调用，注册真正打开弹窗的实现；卸载时传 null 注销 */
export function registerGalleryPicker(fn: OpenHandler | null): void {
  handler = fn;
}

/** 内核调用：返回 Promise，弹窗选中后 resolve 选中资产，取消则 resolve null */
export function openGalleryPicker(): Promise<PickedGalleryAsset | null> {
  if (!handler) return Promise.resolve(null);
  return new Promise<PickedGalleryAsset | null>((resolve) => handler!(resolve));
}
