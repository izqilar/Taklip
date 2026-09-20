import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/providerDetailPages/SPTemplateEditor.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=01644d01"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=01644d01"; const useCallback = __vite__cjsImport3_react["useCallback"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"]; const useState = __vite__cjsImport3_react["useState"];
import __vite__cjsImport4_reactRouterDom from "/node_modules/.vite/deps/react-router-dom.js?v=01644d01"; const useParams = __vite__cjsImport4_reactRouterDom["useParams"]; const useNavigate = __vite__cjsImport4_reactRouterDom["useNavigate"];
import { EditorApp, useEditorStore } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/index.ts?t=1789865285424";
import { registerEditorServices } from "/src/editorServices.ts?t=1789865285424";
import { withSubject } from "/src/providers/dataProvider.ts";
import { API_URL, authHeaders } from "/src/utility.ts";
import { App as AntdApp, Button, Spin, message } from "/node_modules/.vite/deps/antd.js?v=01644d01";
registerEditorServices();
export const SPTemplateEditor = () => {
  _s();
  const { id } = useParams();
  const navigate = useNavigate();
  const loadProject = useEditorStore((s) => s.loadProject);
  const setHostMeta = useEditorStore((s) => s.setHostMeta);
  const { modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const loadedIdRef = useRef(null);
  const reload = useCallback(async (force = false) => {
    if (!id) return;
    if (!force && loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${withSubject(`provider/services/${id}`)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`加载模板失败 (${res.status})`);
      const tpl = await res.json();
      if (loadedIdRef.current !== id) return;
      const initial = tpl.draftSchema && typeof tpl.draftSchema === "object" ? tpl.draftSchema : tpl.schema;
      loadProject(initial, String(id));
      const newMeta = {
        name: tpl.name,
        liveVersion: tpl.liveVersion ?? 1,
        hasDraft: !!tpl.draftSchema
      };
      setMeta(newMeta);
      setHostMeta({
        title: newMeta.name,
        version: newMeta.liveVersion,
        hasDraft: newMeta.hasDraft,
        actions: newMeta.hasDraft ? /* @__PURE__ */ jsxDEV(Button, { size: "small", danger: true, onClick: discardDraft, children: "放弃草稿" }, void 0, false, {
          fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx",
          lineNumber: 104,
          columnNumber: 9
        }, this) : void 0
      });
      setLoading(false);
    } catch (e) {
      loadedIdRef.current = null;
      message.error(e?.message || "模板加载失败");
      navigate("/sp/templates");
      setLoading(false);
    }
  }, [id, loadProject, navigate]);
  const discardDraft = () => {
    if (!id) return;
    modal.confirm({
      title: "放弃草稿",
      content: "将丢弃当前未发布的草稿改动，画布恢复为线上版本，此操作不可恢复。确定继续？",
      okText: "放弃草稿",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await fetch(`${API_URL}/${withSubject(`provider/services/${id}/draft`)}`, {
            method: "DELETE",
            headers: authHeaders()
          });
          if (!res.ok) throw new Error(`放弃草稿失败 (${res.status})`);
          message.success("已放弃草稿，画布已恢复线上版本");
          await reload(true);
        } catch (e) {
          message.error(e?.message || "操作失败");
        }
      }
    });
  };
  useEffect(() => {
    reload();
  }, [reload]);
  if (loading) {
    return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-[1000] flex items-center justify-center bg-white", children: /* @__PURE__ */ jsxDEV(Spin, { size: "large" }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx",
      lineNumber: 157,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx",
      lineNumber: 156,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(EditorApp, {}, void 0, false, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx",
    lineNumber: 163,
    columnNumber: 10
  }, this);
};
_s(SPTemplateEditor, "gsJpsltfT6to6u9gL9LTOqAQvgE=", false, function() {
  return [useParams, useNavigate, useEditorStore, useEditorStore, AntdApp.useApp];
});
_c = SPTemplateEditor;
var _c;
$RefreshReg$(_c, "SPTemplateEditor");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QSxNQUM5QkMsTUFBTSxZQUFZO0FBQ2hCLFlBQUk7QUFDRixnQkFBTTdCLE1BQU0sTUFBTUMsTUFBTSxHQUFHekIsT0FBTyxJQUFJRCxZQUFZLHFCQUFxQlUsRUFBRSxRQUFRLENBQUMsSUFBSTtBQUFBLFlBQ3BGNkMsUUFBUTtBQUFBLFlBQ1I1QixTQUFTekIsWUFBWTtBQUFBLFVBQ3ZCLENBQUM7QUFDRCxjQUFJLENBQUN1QixJQUFJRyxHQUFJLE9BQU0sSUFBSUMsTUFBTSxXQUFXSixJQUFJSyxNQUFNLEdBQUc7QUFDckR2QixrQkFBUWlELFFBQVEsaUJBQWlCO0FBRWpDLGdCQUFNbEMsT0FBTyxJQUFJO0FBQUEsUUFDbkIsU0FBU3dCLEdBQVE7QUFFZnZDLGtCQUFRd0MsTUFBTUQsR0FBR3ZDLFdBQVcsTUFBTTtBQUFBLFFBQ3BDO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFFQWYsWUFBVSxNQUFNO0FBQ2Q4QixXQUFPO0FBQUEsRUFDVCxHQUFHLENBQUNBLE1BQU0sQ0FBQztBQUVYLE1BQUlMLFNBQVM7QUFDWCxXQUNFLHVCQUFDLFNBQUksV0FBVSxvRUFDYixpQ0FBQyxRQUFLLE1BQUssV0FBWDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQWtCLEtBRHBCO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FFQTtBQUFBLEVBRUo7QUFHQSxTQUFPLHVCQUFDLGVBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUFVO0FBQ25CO0FBQUVSLEdBaEhXRCxrQkFBZ0I7QUFBQSxVQUNaYixXQUNFQyxhQUNHRSxnQkFDQUEsZ0JBQ0ZNLFFBQVFZLE1BQU07QUFBQTtBQUFBLEtBTHJCUjtBQUFnQixJQUFBaUQ7QUFBQSxhQUFBQSxJQUFBIiwibmFtZXMiOlsidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsInVzZVBhcmFtcyIsInVzZU5hdmlnYXRlIiwiRWRpdG9yQXBwIiwidXNlRWRpdG9yU3RvcmUiLCJyZWdpc3RlckVkaXRvclNlcnZpY2VzIiwid2l0aFN1YmplY3QiLCJBUElfVVJMIiwiYXV0aEhlYWRlcnMiLCJBcHAiLCJBbnRkQXBwIiwiQnV0dG9uIiwiU3BpbiIsIm1lc3NhZ2UiLCJTUFRlbXBsYXRlRWRpdG9yIiwiX3MiLCJpZCIsIm5hdmlnYXRlIiwibG9hZFByb2plY3QiLCJzIiwic2V0SG9zdE1ldGEiLCJtb2RhbCIsInVzZUFwcCIsImxvYWRpbmciLCJzZXRMb2FkaW5nIiwibWV0YSIsInNldE1ldGEiLCJsb2FkZWRJZFJlZiIsInJlbG9hZCIsImZvcmNlIiwiY3VycmVudCIsInJlcyIsImZldGNoIiwiaGVhZGVycyIsIm9rIiwiRXJyb3IiLCJzdGF0dXMiLCJ0cGwiLCJqc29uIiwiaW5pdGlhbCIsImRyYWZ0U2NoZW1hIiwic2NoZW1hIiwiU3RyaW5nIiwibmV3TWV0YSIsIm5hbWUiLCJsaXZlVmVyc2lvbiIsImhhc0RyYWZ0IiwidGl0bGUiLCJ2ZXJzaW9uIiwiYWN0aW9ucyIsImRpc2NhcmREcmFmdCIsInVuZGVmaW5lZCIsImUiLCJlcnJvciIsImNvbmZpcm0iLCJjb250ZW50Iiwib2tUZXh0IiwiY2FuY2VsVGV4dCIsIm9rQnV0dG9uUHJvcHMiLCJkYW5nZXIiLCJvbk9rIiwibWV0aG9kIiwic3VjY2VzcyIsIl9jIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlNQVGVtcGxhdGVFZGl0b3IudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog6L+Q6JCl56uv44CM5qih5p2/55S75biD57yW6L6R5Zmo44CN5a6/5Li76aG177yI5pa55qGIIEEgZHJhZnQvbGl2Ze+8ieOAglxuICpcbiAqIOaOpeWFpeWFseS6q+WGheaguCBAaDVkZXNpZ24vZWRpdG9yIOeahOacgOWwkeS4ieatpe+8mlxuICogICAxLiDmnKzpobXvvIjlt7IgY29kZS1zcGxpdO+8ieWcqOaooeWdl+axguWAvOaXtuiwg+eUqCByZWdpc3RlckVkaXRvclNlcnZpY2VzKCkg5rOo5YWl6L+Q6JCl56uv5a6e546wXG4gKiAgICAgIO+8iOiNieeovy/lj5HluIPmjIflkJEgL2FwaS9wcm92aWRlci9zZXJ2aWNlcy86aWTvvInvvJtcbiAqICAgMi4g5ouJ5Y+W5qih5p2/77yM5oyJIGBkcmFmdFNjaGVtYSA/PyBzY2hlbWFgIOiwgyBsb2FkUHJvamVjdCDovb3lhaXvvIjkvJjlhYjojYnnqL/vvIzml6DojYnnqL/liJnnur/kuIrvvInvvJtcbiAqICAgMy4g5riy5p+TIDxFZGl0b3JBcHAvPu+8iOaXoCBwcm9wc++8jOWGhemDqOS7jiBzdG9yZSDor7sgcHJvamVjdElkIC8gcHJvamVjdCAvIGhvc3RNZXRh77yJ44CCXG4gKlxuICog6aG555uu5YWD5L+h5oGv77yI5ZCN56ewL+eJiOacrC/ojYnnqL/nirbmgIEv5pS+5byD6I2J56i/5oyJ6ZKu77yJ6YCa6L+HIGVkaXRvclN0b3JlLmhvc3RNZXRhIOazqOWFpeWIsFxuICog57yW6L6R5Zmo5YaF5qC46aG25qCP5Y+z5L6n77yM5LiOIHdlYiDnq6/luIPlsYDlrozlhajkuIDoh7TigJTigJTkuI3lho3kvb/nlKjpop3lpJbnmoQgZWRpdG9yLXRvcGJhciDljIXoo7nlsYLjgIJcbiAqXG4gKiDimqDvuI8g5YaF5qC45LiO5YW25qC35byP6YO95pS55Li6KirmjInpnIDliqDovb0qKu+8iOacrOmhteeUsSBBcHAudHN4IOeahCBSZWFjdC5sYXp5IOaHkuWKoOi9ve+8ie+8mlxuICog57yW6L6R5Zmo5YaF5qC45ZCrIEtvbnZhL0dTQVDvvIzkvZPnp6/lvojlpKfvvIzmlL7ov5vlhaXlj6PkvJrorqnnmbvlvZXpobXnrYnpobXpnaLnmb3nrYnlh6AgTUIg5LiL6L2944CCXG4gKi9cbmltcG9ydCB7IHVzZUNhbGxiYWNrLCB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyB1c2VQYXJhbXMsIHVzZU5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyBFZGl0b3JBcHAsIHVzZUVkaXRvclN0b3JlIH0gZnJvbSAnQGg1ZGVzaWduL2VkaXRvcic7XG5pbXBvcnQgeyByZWdpc3RlckVkaXRvclNlcnZpY2VzIH0gZnJvbSAnLi4vLi4vZWRpdG9yU2VydmljZXMnO1xuaW1wb3J0IHsgd2l0aFN1YmplY3QgfSBmcm9tICcuLi8uLi9wcm92aWRlcnMvZGF0YVByb3ZpZGVyJztcbmltcG9ydCB7IEFQSV9VUkwsIGF1dGhIZWFkZXJzIH0gZnJvbSAnLi4vLi4vdXRpbGl0eSc7XG5pbXBvcnQgeyBBcHAgYXMgQW50ZEFwcCwgQnV0dG9uLCBUYWcsIFNwaW4sIG1lc3NhZ2UgfSBmcm9tICdhbnRkJztcblxuLy8g5qih5Z2X5rGC5YC85pep5LqO57uE5Lu25riy5p+T77ya5L+d6K+BIDxFZGl0b3JBcHAvPiDmjILovb3liY3lrr/kuLvmnI3liqHlt7Lms6jlhaVcbnJlZ2lzdGVyRWRpdG9yU2VydmljZXMoKTtcblxuaW50ZXJmYWNlIFRwbE1ldGEge1xuICBuYW1lPzogc3RyaW5nO1xuICBsaXZlVmVyc2lvbjogbnVtYmVyO1xuICBoYXNEcmFmdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNvbnN0IFNQVGVtcGxhdGVFZGl0b3IgPSAoKSA9PiB7XG4gIGNvbnN0IHsgaWQgfSA9IHVzZVBhcmFtczx7IGlkOiBzdHJpbmcgfT4oKTtcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xuICBjb25zdCBsb2FkUHJvamVjdCA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLmxvYWRQcm9qZWN0KTtcbiAgY29uc3Qgc2V0SG9zdE1ldGEgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5zZXRIb3N0TWV0YSk7XG4gIGNvbnN0IHsgbW9kYWwgfSA9IEFudGRBcHAudXNlQXBwKCk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbbWV0YSwgc2V0TWV0YV0gPSB1c2VTdGF0ZTxUcGxNZXRhIHwgbnVsbD4obnVsbCk7XG5cbiAgLyoqXG4gICAqIOW3suWPkei1t+WKoOi9veeahCBpZO+8iCoq5LiN5piv5biD5bCUKirvvInigJTigJQg5Lik5Liq6KaB5rGC5b+F6aG75ZCM5pe25ruh6Laz77yaXG4gICAqICAoYSkgU3RyaWN0TW9kZSDkuIsgZWZmZWN0IOWPjOi3ke+8muWQjOS4gOS4qiBpZCDlj6rmlL7ooYzkuIDmrKHvvIzpgb/lhY3lkIzkuIDmrKEgNDA0IOW8ueS4pOS4qiB0b2FzdO+8m1xuICAgKiAgKGIpIOi3r+eUsSA6aWQg55SxIEHihpJCIOWPmOWMluaXtue7hOS7tuWunuS+i+iiq+WkjeeUqO+8iOWQjOS4gOadoSA8Um91dGU+77yM5rKh5pyJIGtlee+8ie+8jHJlZiDkuI3kvJrph43nva7vvIxcbiAgICogICAgICDlv4Xpobvog73or4bliKvjgIzmjaLkuobkuKogaWTjgI3lubbmlL7ooYzliqDovb3vvIzlkKbliJnnlLvluIPlgZzlnKggQSDogIzkv53lrZgv5Yig6Zmk5LuN5oyJIEEg55qEIGlkIOaPkOS6pFxuICAgKiAgICAgIOKGkiDpnZnpu5jlhpnlnY/lj6bkuIDmnaHorrDlvZXvvIjot6jorrDlvZXkuLLlj7fvvInjgIJcbiAgICovXG4gIGNvbnN0IGxvYWRlZElkUmVmID0gdXNlUmVmPHN0cmluZyB8IG51bGw+KG51bGwpO1xuXG4gIC8qKlxuICAgKiDlrozmlbTph43ovb3vvJrmi4nlj5bmqKHmnb8gKyBsb2FkUHJvamVjdO+8iOmHjee9rueUu+W4g+S4uuacjeWKoeerr+eKtuaAge+8iVxuICAgKiBAcGFyYW0gZm9yY2Ug57uV6L+H44CM5ZCM5LiAIGlkIOWPquWKoOi9veS4gOasoeOAjeeahOmXqSDigJTigJQg5pS+5byD6I2J56i/5ZCO6ZyA6KaB5oyJ5ZCM5LiA5LiqIGlkXG4gICAqICAg6YeN5paw5ouJ5Y+W57q/5LiK54mI5pys77yM5ZCm5YiZ5Lya6KKr5bmC562J6Zep5oyh5L2P77yM55S75biD5YGc55WZ5Zyo5bey5bqf5byD55qE6I2J56i/5LiK44CCXG4gICAqL1xuICBjb25zdCByZWxvYWQgPSB1c2VDYWxsYmFjayhhc3luYyAoZm9yY2UgPSBmYWxzZSkgPT4ge1xuICAgIC8vIOWQjOS4gCBpZCDlt7LliqDovb3ov4fvvIjlkKsgU3RyaWN0TW9kZSDkuozmrKHosIPnlKjvvInihpIg6Lez6L+H77yb5o2i5LqGIGlkIOaIliBmb3JjZSDihpIg5pS+6KGMXG4gICAgaWYgKCFpZCkgcmV0dXJuO1xuICAgIGlmICghZm9yY2UgJiYgbG9hZGVkSWRSZWYuY3VycmVudCA9PT0gaWQpIHJldHVybjtcbiAgICBsb2FkZWRJZFJlZi5jdXJyZW50ID0gaWQ7XG4gICAgc2V0TG9hZGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgLy8gQURNSU4g6KeG5a+f5pyN5Yqh5ZWG6KeG6KeS57yW6L6R5LuW5Lq65qih5p2/77ya5b+F6aG75bimID9zdWJqZWN0Pe+8jOWQpuWImeaMieeZu+W9leiAheW9kuWxnuafpeivoiDihpIgNDA0XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtBUElfVVJMfS8ke3dpdGhTdWJqZWN0KGBwcm92aWRlci9zZXJ2aWNlcy8ke2lkfWApfWAsIHsgaGVhZGVyczogYXV0aEhlYWRlcnMoKSB9KTtcbiAgICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYOWKoOi9veaooeadv+Wksei0pSAoJHtyZXMuc3RhdHVzfSlgKTtcbiAgICAgIGNvbnN0IHRwbCA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICAvLyDnq57mgIHlrojljavvvJpB4oaSQiDlv6vpgJ/liIfmjaLml7bvvIzoi6UgQSDnmoTlk43lupTmmZrkuo4gQiDov5Tlm57vvIzlv4XpobvkuKLlvIPvvIxcbiAgICAgIC8vIOWQpuWImeS8muaKiiBBIOeahOWGheWuueWGmei/m+eUu+W4g++8iOiAjCBwcm9qZWN0SWQg5bey5pivIELvvInihpIg6Leo6K6w5b2V5Liy5Y+344CCXG4gICAgICBpZiAobG9hZGVkSWRSZWYuY3VycmVudCAhPT0gaWQpIHJldHVybjtcbiAgICAgIGNvbnN0IGluaXRpYWwgPVxuICAgICAgICB0cGwuZHJhZnRTY2hlbWEgJiYgdHlwZW9mIHRwbC5kcmFmdFNjaGVtYSA9PT0gJ29iamVjdCcgPyB0cGwuZHJhZnRTY2hlbWEgOiB0cGwuc2NoZW1hO1xuICAgICAgbG9hZFByb2plY3QoaW5pdGlhbCwgU3RyaW5nKGlkKSk7XG4gICAgICBjb25zdCBuZXdNZXRhOiBUcGxNZXRhID0ge1xuICAgICAgICBuYW1lOiB0cGwubmFtZSxcbiAgICAgICAgbGl2ZVZlcnNpb246IHRwbC5saXZlVmVyc2lvbiA/PyAxLFxuICAgICAgICBoYXNEcmFmdDogISF0cGwuZHJhZnRTY2hlbWEsXG4gICAgICB9O1xuICAgICAgc2V0TWV0YShuZXdNZXRhKTtcbiAgICAgIC8vIOazqOWFpee8lui+keWZqOmhtuagj+WPs+S+p++8iOS4jiB3ZWIg56uv5biD5bGA5a+56b2Q77yM5LiN5YaN55So6aKd5aSWIHRvcGJhcu+8iVxuICAgICAgc2V0SG9zdE1ldGEoe1xuICAgICAgICB0aXRsZTogbmV3TWV0YS5uYW1lLFxuICAgICAgICB2ZXJzaW9uOiBuZXdNZXRhLmxpdmVWZXJzaW9uLFxuICAgICAgICBoYXNEcmFmdDogbmV3TWV0YS5oYXNEcmFmdCxcbiAgICAgICAgYWN0aW9uczogbmV3TWV0YS5oYXNEcmFmdCA/IChcbiAgICAgICAgICA8QnV0dG9uIHNpemU9XCJzbWFsbFwiIGRhbmdlciBvbkNsaWNrPXtkaXNjYXJkRHJhZnR9PlxuICAgICAgICAgICAg5pS+5byD6I2J56i/XG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICkgOiB1bmRlZmluZWQsXG4gICAgICB9KTtcbiAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgLy8g5Yqg6L295aSx6LSl77ya5riF5o6J6Zep77yM5YWB6K645Zue5Yiw5pys6aG15pe26YeN6K+VXG4gICAgICBsb2FkZWRJZFJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIG1lc3NhZ2UuZXJyb3IoZT8ubWVzc2FnZSB8fCAn5qih5p2/5Yqg6L295aSx6LSlJyk7XG4gICAgICBuYXZpZ2F0ZSgnL3NwL3RlbXBsYXRlcycpO1xuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gIH0sIFtpZCwgbG9hZFByb2plY3QsIG5hdmlnYXRlXSk7XG5cbiAgLyoqXG4gICAqIOaUvuW8g+iNieeov++8mua4heepuiBkcmFmdFNjaGVtYSDlubbph43ovb3nlLvluIPkuLrnur/kuIrniYjmnKzjgIJcbiAgICog5Lya5Lii5byD5b2T5YmN5pyq5Y+R5biD55qE6I2J56i/5pS55Yqo5LiU5LiN5Y+v5oGi5aSNIOKAlOKAlCDlv4XpobvlhYjkuozmrKHnoa7orqTvvIzpgb/lhY3kuIDmrKHor6/ngrnmr4Hmjonlt6XkvZzmiJDmnpzjgIJcbiAgICovXG4gIGNvbnN0IGRpc2NhcmREcmFmdCA9ICgpID0+IHtcbiAgICBpZiAoIWlkKSByZXR1cm47XG4gICAgbW9kYWwuY29uZmlybSh7XG4gICAgICB0aXRsZTogJ+aUvuW8g+iNieeovycsXG4gICAgICBjb250ZW50OiAn5bCG5Lii5byD5b2T5YmN5pyq5Y+R5biD55qE6I2J56i/5pS55Yqo77yM55S75biD5oGi5aSN5Li657q/5LiK54mI5pys77yM5q2k5pON5L2c5LiN5Y+v5oGi5aSN44CC56Gu5a6a57un57ut77yfJyxcbiAgICAgIG9rVGV4dDogJ+aUvuW8g+iNieeovycsXG4gICAgICBjYW5jZWxUZXh0OiAn5Y+W5raIJyxcbiAgICAgIG9rQnV0dG9uUHJvcHM6IHsgZGFuZ2VyOiB0cnVlIH0sXG4gICAgICBvbk9rOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7QVBJX1VSTH0vJHt3aXRoU3ViamVjdChgcHJvdmlkZXIvc2VydmljZXMvJHtpZH0vZHJhZnRgKX1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgICAgICAgaGVhZGVyczogYXV0aEhlYWRlcnMoKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGDmlL7lvIPojYnnqL/lpLHotKUgKCR7cmVzLnN0YXR1c30pYCk7XG4gICAgICAgICAgbWVzc2FnZS5zdWNjZXNzKCflt7LmlL7lvIPojYnnqL/vvIznlLvluIPlt7LmgaLlpI3nur/kuIrniYjmnKwnKTtcbiAgICAgICAgICAvLyBmb3JjZe+8muWQjOS4gCBpZCDkuZ/opoHph43mlrDmi4nlj5bvvIznu5Xov4fluYLnrYnpl6nvvIjlkKbliJnor7vliLDnmoTov5jmmK/liJrooqvkuKLlvIPnmoTojYnnqL/vvIlcbiAgICAgICAgICBhd2FpdCByZWxvYWQodHJ1ZSk7XG4gICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgIC8vIOiHquihjOWFnOS9j++8mmFudGQg5Y+qIGNvbnNvbGUuZXJyb3Ig5LiN5o+Q56S677yM55So5oi35Lya5Lul5Li65Yig6Zmk5oiQ5Yqf5LqGXG4gICAgICAgICAgbWVzc2FnZS5lcnJvcihlPy5tZXNzYWdlIHx8ICfmk43kvZzlpLHotKUnKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9KTtcbiAgfTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHJlbG9hZCgpO1xuICB9LCBbcmVsb2FkXSk7XG5cbiAgaWYgKGxvYWRpbmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaXhlZCBpbnNldC0wIHotWzEwMDBdIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLXdoaXRlXCI+XG4gICAgICAgIDxTcGluIHNpemU9XCJsYXJnZVwiIC8+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgLy8g55u05o6l5riy5p+TIEVkaXRvckFwcO+8jOS4jeWMheijuemineWklumhtuagj++8iOWFg+S/oeaBr+W3sumAmui/hyBob3N0TWV0YSDms6jlhaXlhoXmoLjpobbmoI/vvIlcbiAgcmV0dXJuIDxFZGl0b3JBcHAgLz47XG59O1xuIl0sImZpbGUiOiJEOi9NeVdvcmtCdWRkeS8yMDI2LTA4LTEwLTIyLTM5LTU2L2FwcHMvYWRtaW4vc3JjL3BhZ2VzL3Byb3ZpZGVyRGV0YWlsUGFnZXMvU1BUZW1wbGF0ZUVkaXRvci50c3gifQ==