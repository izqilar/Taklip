/**
 * 图库选择器「宿主桥」。
 *
 * 编辑器内核（@h5design/editor）是持久化无关的，不能直接渲染 web 端的 React 弹窗。
 * 这里用一个模块级的注册表把「打开图库弹窗」的请求从内核转发到 web 端已挂载的
 * <GalleryModal/> 组件：内核调用 openGalleryPicker() 拿到 Promise，
 * <GalleryModal/> 挂载时通过 registerGalleryPicker 注册真正的打开/关闭实现。
 */

export interface PickedGalleryAsset {
  id: string;
  width: number | null;
  height: number | null;
}

type ResolveFn = (asset: PickedGalleryAsset | null) => void;
type OpenHandler = (resolve: ResolveFn) => void;

let handler: OpenHandler | null = null;

/** 由 <GalleryModal/> 在挂载时调用，卸载时传 null 注销 */
export function registerGalleryPicker(fn: OpenHandler | null): void {
  handler = fn;
}

/** 内核调用：打开图库弹窗并返回一个 Promise（选中=资产，取消/关闭=null） */
export function openGalleryPicker(): Promise<PickedGalleryAsset | null> {
  return new Promise((resolve) => {
    if (!handler) {
      // 未挂载弹窗（如运营端未注入）：直接回退 null，由调用方降级为原生文件上传
      resolve(null);
      return;
    }
    handler(resolve);
  });
}
