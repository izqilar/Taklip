/**
 * 运营端「模板画布编辑器」宿主页（方案 A draft/live）。
 *
 * 接入共享内核 @h5design/editor 的最少三步：
 *   1. 本页（已 code-split）在模块求值时调用 registerEditorServices() 注入运营端实现
 *      （草稿/发布指向 /api/provider/services/:id）；
 *   2. 拉取模板，按 `draftSchema ?? schema` 调 loadProject 载入（优先草稿，无草稿则线上）；
 *   3. 渲染 <EditorApp/>（无 props，内部从 store 读 projectId / project / hostMeta）。
 *
 * 项目元信息（名称/版本/草稿状态/放弃草稿按钮）通过 editorStore.hostMeta 注入到
 * 编辑器内核顶栏右侧，与 web 端布局完全一致——不再使用额外的 editor-topbar 包裹层。
 *
 * ⚠️ 内核与其样式都改为**按需加载**（本页由 App.tsx 的 React.lazy 懒加载）：
 * 编辑器内核含 Konva/GSAP，体积很大，放进入口会让登录页等页面白等几 MB 下载。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EditorApp, useEditorStore } from '@h5design/editor';
import { registerEditorServices } from '../../editorServices';
import { withSubject } from '../../providers/dataProvider';
import { API_URL, authHeaders } from '../../utility';
import { App as AntdApp, Button, Tag, Spin, message } from 'antd';

// 模块求值早于组件渲染：保证 <EditorApp/> 挂载前宿主服务已注入
registerEditorServices();

interface TplMeta {
  name?: string;
  liveVersion: number;
  hasDraft: boolean;
}

export const SPTemplateEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadProject = useEditorStore((s) => s.loadProject);
  const setHostMeta = useEditorStore((s) => s.setHostMeta);
  const { modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<TplMeta | null>(null);

  /**
   * 已发起加载的 id（**不是布尔**）—— 两个要求必须同时满足：
   *  (a) StrictMode 下 effect 双跑：同一个 id 只放行一次，避免同一次 404 弹两个 toast；
   *  (b) 路由 :id 由 A→B 变化时组件实例被复用（同一条 <Route>，没有 key），ref 不会重置，
   *      必须能识别「换了个 id」并放行加载，否则画布停在 A 而保存/删除仍按 A 的 id 提交
   *      → 静默写坏另一条记录（跨记录串号）。
   */
  const loadedIdRef = useRef<string | null>(null);

  /**
   * 完整重载：拉取模板 + loadProject（重置画布为服务端状态）
   * @param force 绕过「同一 id 只加载一次」的闩 —— 放弃草稿后需要按同一个 id
   *   重新拉取线上版本，否则会被幂等闩挡住，画布停留在已废弃的草稿上。
   */
  const reload = useCallback(async (force = false) => {
    // 同一 id 已加载过（含 StrictMode 二次调用）→ 跳过；换了 id 或 force → 放行
    if (!id) return;
    if (!force && loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    setLoading(true);
    try {
      // ADMIN 视察服务商视角编辑他人模板：必须带 ?subject=，否则按登录者归属查询 → 404
      const res = await fetch(`${API_URL}/${withSubject(`provider/services/${id}`)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`加载模板失败 (${res.status})`);
      const tpl = await res.json();
      // 竞态守卫：A→B 快速切换时，若 A 的响应晚于 B 返回，必须丢弃，
      // 否则会把 A 的内容写进画布（而 projectId 已是 B）→ 跨记录串号。
      if (loadedIdRef.current !== id) return;
      const initial =
        tpl.draftSchema && typeof tpl.draftSchema === 'object' ? tpl.draftSchema : tpl.schema;
      loadProject(initial, String(id));
      const newMeta: TplMeta = {
        name: tpl.name,
        liveVersion: tpl.liveVersion ?? 1,
        hasDraft: !!tpl.draftSchema,
      };
      setMeta(newMeta);
      // 注入编辑器顶栏右侧（与 web 端布局对齐，不再用额外 topbar）
      setHostMeta({
        title: newMeta.name,
        version: newMeta.liveVersion,
        hasDraft: newMeta.hasDraft,
        actions: newMeta.hasDraft ? (
          <Button size="small" danger onClick={discardDraft}>
            放弃草稿
          </Button>
        ) : undefined,
      });
      setLoading(false);
    } catch (e: any) {
      // 加载失败：清掉闩，允许回到本页时重试
      loadedIdRef.current = null;
      message.error(e?.message || '模板加载失败');
      navigate('/sp/templates');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadProject, navigate]);

  /**
   * 放弃草稿：清空 draftSchema 并重载画布为线上版本。
   * 会丢弃当前未发布的草稿改动且不可恢复 —— 必须先二次确认，避免一次误点毁掉工作成果。
   */
  const discardDraft = () => {
    if (!id) return;
    modal.confirm({
      title: '放弃草稿',
      content: '将丢弃当前未发布的草稿改动，画布恢复为线上版本，此操作不可恢复。确定继续？',
      okText: '放弃草稿',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await fetch(`${API_URL}/${withSubject(`provider/services/${id}/draft`)}`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
          if (!res.ok) throw new Error(`放弃草稿失败 (${res.status})`);
          message.success('已放弃草稿，画布已恢复线上版本');
          // force：同一 id 也要重新拉取，绕过幂等闩（否则读到的还是刚被丢弃的草稿）
          await reload(true);
        } catch (e: any) {
          // 自行兜住：antd 只 console.error 不提示，用户会以为删除成功了
          message.error(e?.message || '操作失败');
        }
      },
    });
  };

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white">
        <Spin size="large" />
      </div>
    );
  }

  // 直接渲染 EditorApp，不包裹额外顶栏（元信息已通过 hostMeta 注入内核顶栏）
  // exitPath：运营端没有 web 的 /dashboard 路由，「退出编辑」必须回模板列表
  return <EditorApp exitPath="/sp/templates" />;
};
