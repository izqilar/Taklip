/**
 * 运营端「作品画布编辑器」宿主页。
 *
 * 与 SPTemplateEditor 结构一致，但数据源为 /api/provider/works/:id（Project 而非 Template）。
 * 接入契约相同：registerEditorServices() → loadProject() → setHostMeta() → <EditorApp/>。
 * 不再使用额外的 editor-topbar 包裹层，项目名称通过 hostMeta 注入编辑器内核顶栏右侧。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EditorApp, useEditorStore } from '@h5design/editor';
import { registerEditorServices } from '../../editorServices';
import { withSubject } from '../../providers/dataProvider';
import { API_URL, authHeaders } from '../../utility';
import { Spin, message } from 'antd';

registerEditorServices('work');

export const SPWorkEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadProject = useEditorStore((s) => s.loadProject);
  const setHostMeta = useEditorStore((s) => s.setHostMeta);
  const [loading, setLoading] = useState(true);
  const [workTitle, setWorkTitle] = useState<string>('');

  /**
   * 已发起加载的 id（**不是布尔**）—— 两个要求必须同时满足，改回布尔会再次踩坑：
   *  (a) StrictMode 下 effect 双跑：同一个 id 只放行一次，避免同一次 404 弹两个 toast；
   *  (b) 路由 :id 由 A→B 变化时组件实例被复用（同一条 <Route>，没有 key），ref 不会重置，
   *      因此必须能识别「换了个 id」并放行加载。用布尔会永久闩在 true：画布停在 A，
   *      而后续保存/删除仍按 A 的 id 提交 → 静默写坏另一条记录（跨记录串号）。
   */
  const loadedIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    // 同一 id 已加载过（含 StrictMode 二次调用）→ 跳过；换了 id → 放行
    if (!id || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    setLoading(true);
    try {
      // ADMIN 视察视角（用户/服务商视角编辑他人作品）必须带 ?subject=，
      // 否则服务端按登录者自身归属查询 → 404（预览走 dataProvider 注入了 subject 故正常）
      const res = await fetch(`${API_URL}/${withSubject(`provider/works/${id}`)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`加载作品失败 (${res.status})`);
      const work = await res.json();
      // 竞态守卫：A→B 快速切换时，若 A 的响应晚于 B 返回，必须丢弃，
      // 否则会把 A 的内容写进画布（而 projectId 已是 B）→ 又一次跨记录串号。
      if (loadedIdRef.current !== id) return;
      const schema = work.draftSchema && typeof work.draftSchema === 'object' ? work.draftSchema : work.schema;
      loadProject(schema, String(id));
      const title = work.title || '';
      setWorkTitle(title);
      // 注入编辑器顶栏右侧
      setHostMeta({ title });
      setLoading(false);
    } catch (e: any) {
      // 加载失败：清掉闩，允许回到本页时重试；跳转后组件会卸载，ref 自然重置
      loadedIdRef.current = null;
      message.error(e?.message || '作品加载失败');
      navigate('/sp/works');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadProject, navigate]);

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

  // 直接渲染 EditorApp，不包裹额外顶栏（作品名已通过 hostMeta 注入内核顶栏）
  // exitPath：运营端没有 web 的 /dashboard 路由，「退出编辑」必须回作品列表
  return <EditorApp exitPath="/sp/works" />;
};
