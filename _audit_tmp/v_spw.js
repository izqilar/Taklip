import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/providerDetailPages/SPWorkEditor.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=01644d01"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPWorkEditor.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=01644d01"; const useCallback = __vite__cjsImport3_react["useCallback"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"]; const useState = __vite__cjsImport3_react["useState"];
import __vite__cjsImport4_reactRouterDom from "/node_modules/.vite/deps/react-router-dom.js?v=01644d01"; const useParams = __vite__cjsImport4_reactRouterDom["useParams"]; const useNavigate = __vite__cjsImport4_reactRouterDom["useNavigate"];
import { EditorApp, useEditorStore } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/index.ts?t=1789865809343";
import { registerEditorServices } from "/src/editorServices.ts?t=1789865863709";
import { withSubject } from "/src/providers/dataProvider.ts?t=1789865863709";
import { API_URL, authHeaders } from "/src/utility.ts";
import { Spin, message } from "/node_modules/.vite/deps/antd.js?v=01644d01";
registerEditorServices("work");
export const SPWorkEditor = () => {
  _s();
  const { id } = useParams();
  const navigate = useNavigate();
  const loadProject = useEditorStore((s) => s.loadProject);
  const setHostMeta = useEditorStore((s) => s.setHostMeta);
  const [loading, setLoading] = useState(true);
  const [workTitle, setWorkTitle] = useState("");
  const loadedIdRef = useRef(null);
  const reload = useCallback(async () => {
    if (!id || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${withSubject(`provider/works/${id}`)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`加载作品失败 (${res.status})`);
      const work = await res.json();
      if (loadedIdRef.current !== id) return;
      const schema = work.draftSchema && typeof work.draftSchema === "object" ? work.draftSchema : work.schema;
      loadProject(schema, String(id));
      const title = work.title || "";
      setWorkTitle(title);
      setHostMeta({ title });
      setLoading(false);
    } catch (e) {
      loadedIdRef.current = null;
      message.error(e?.message || "作品加载失败");
      navigate("/sp/works");
      setLoading(false);
    }
  }, [id, loadProject, navigate]);
  useEffect(() => {
    reload();
  }, [reload]);
  if (loading) {
    return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-[1000] flex items-center justify-center bg-white", children: /* @__PURE__ */ jsxDEV(Spin, { size: "large" }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPWorkEditor.tsx",
      lineNumber: 92,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPWorkEditor.tsx",
      lineNumber: 91,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(EditorApp, { exitPath: "/sp/works" }, void 0, false, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPWorkEditor.tsx",
    lineNumber: 99,
    columnNumber: 10
  }, this);
};
_s(SPWorkEditor, "GBDFJqeicroJqXVb5MtiR4u21lM=", false, function() {
  return [useParams, useNavigate, useEditorStore, useEditorStore];
});
_c = SPWorkEditor;
var _c;
$RefreshReg$(_c, "SPWorkEditor");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPWorkEditor.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/src/pages/providerDetailPages/SPWorkEditor.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBd0VROzs7Ozs7Ozs7Ozs7Ozs7OztBQWpFUixTQUFTQSxhQUFhQyxXQUFXQyxRQUFRQyxnQkFBZ0I7QUFDekQsU0FBU0MsV0FBV0MsbUJBQW1CO0FBQ3ZDLFNBQVNDLFdBQVdDLHNCQUFzQjtBQUMxQyxTQUFTQyw4QkFBOEI7QUFDdkMsU0FBU0MsbUJBQW1CO0FBQzVCLFNBQVNDLFNBQVNDLG1CQUFtQjtBQUNyQyxTQUFTQyxNQUFNQyxlQUFlO0FBRTlCTCx1QkFBdUIsTUFBTTtBQUV0QixhQUFNTSxlQUFlQSxNQUFNO0FBQUFDLEtBQUE7QUFDaEMsUUFBTSxFQUFFQyxHQUFHLElBQUlaLFVBQTBCO0FBQ3pDLFFBQU1hLFdBQVdaLFlBQVk7QUFDN0IsUUFBTWEsY0FBY1gsZUFBZSxDQUFDWSxNQUFNQSxFQUFFRCxXQUFXO0FBQ3ZELFFBQU1FLGNBQWNiLGVBQWUsQ0FBQ1ksTUFBTUEsRUFBRUMsV0FBVztBQUN2RCxRQUFNLENBQUNDLFNBQVNDLFVBQVUsSUFBSW5CLFNBQVMsSUFBSTtBQUMzQyxRQUFNLENBQUNvQixXQUFXQyxZQUFZLElBQUlyQixTQUFpQixFQUFFO0FBU3JELFFBQU1zQixjQUFjdkIsT0FBc0IsSUFBSTtBQUU5QyxRQUFNd0IsU0FBUzFCLFlBQVksWUFBWTtBQUVyQyxRQUFJLENBQUNnQixNQUFNUyxZQUFZRSxZQUFZWCxHQUFJO0FBQ3ZDUyxnQkFBWUUsVUFBVVg7QUFDdEJNLGVBQVcsSUFBSTtBQUNmLFFBQUk7QUFHRixZQUFNTSxNQUFNLE1BQU1DLE1BQU0sR0FBR25CLE9BQU8sSUFBSUQsWUFBWSxrQkFBa0JPLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRWMsU0FBU25CLFlBQVksRUFBRSxDQUFDO0FBQ3ZHLFVBQUksQ0FBQ2lCLElBQUlHLEdBQUksT0FBTSxJQUFJQyxNQUFNLFdBQVdKLElBQUlLLE1BQU0sR0FBRztBQUNyRCxZQUFNQyxPQUFPLE1BQU1OLElBQUlPLEtBQUs7QUFHNUIsVUFBSVYsWUFBWUUsWUFBWVgsR0FBSTtBQUNoQyxZQUFNb0IsU0FBU0YsS0FBS0csZUFBZSxPQUFPSCxLQUFLRyxnQkFBZ0IsV0FBV0gsS0FBS0csY0FBY0gsS0FBS0U7QUFDbEdsQixrQkFBWWtCLFFBQVFFLE9BQU90QixFQUFFLENBQUM7QUFDOUIsWUFBTXVCLFFBQVFMLEtBQUtLLFNBQVM7QUFDNUJmLG1CQUFhZSxLQUFLO0FBRWxCbkIsa0JBQVksRUFBRW1CLE1BQU0sQ0FBQztBQUNyQmpCLGlCQUFXLEtBQUs7QUFBQSxJQUNsQixTQUFTa0IsR0FBUTtBQUVmZixrQkFBWUUsVUFBVTtBQUN0QmQsY0FBUTRCLE1BQU1ELEdBQUczQixXQUFXLFFBQVE7QUFDcENJLGVBQVMsV0FBVztBQUNwQkssaUJBQVcsS0FBSztBQUFBLElBQ2xCO0FBQUEsRUFFRixHQUFHLENBQUNOLElBQUlFLGFBQWFELFFBQVEsQ0FBQztBQUU5QmhCLFlBQVUsTUFBTTtBQUNkeUIsV0FBTztBQUFBLEVBQ1QsR0FBRyxDQUFDQSxNQUFNLENBQUM7QUFFWCxNQUFJTCxTQUFTO0FBQ1gsV0FDRSx1QkFBQyxTQUFJLFdBQVUsb0VBQ2IsaUNBQUMsUUFBSyxNQUFLLFdBQVg7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUFrQixLQURwQjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBRUE7QUFBQSxFQUVKO0FBSUEsU0FBTyx1QkFBQyxhQUFVLFVBQVMsZUFBcEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUErQjtBQUN4QztBQUFFTixHQS9EV0QsY0FBWTtBQUFBLFVBQ1JWLFdBQ0VDLGFBQ0dFLGdCQUNBQSxjQUFjO0FBQUE7QUFBQSxLQUp2Qk87QUFBWSxJQUFBNEI7QUFBQSxhQUFBQSxJQUFBIiwibmFtZXMiOlsidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsInVzZVBhcmFtcyIsInVzZU5hdmlnYXRlIiwiRWRpdG9yQXBwIiwidXNlRWRpdG9yU3RvcmUiLCJyZWdpc3RlckVkaXRvclNlcnZpY2VzIiwid2l0aFN1YmplY3QiLCJBUElfVVJMIiwiYXV0aEhlYWRlcnMiLCJTcGluIiwibWVzc2FnZSIsIlNQV29ya0VkaXRvciIsIl9zIiwiaWQiLCJuYXZpZ2F0ZSIsImxvYWRQcm9qZWN0IiwicyIsInNldEhvc3RNZXRhIiwibG9hZGluZyIsInNldExvYWRpbmciLCJ3b3JrVGl0bGUiLCJzZXRXb3JrVGl0bGUiLCJsb2FkZWRJZFJlZiIsInJlbG9hZCIsImN1cnJlbnQiLCJyZXMiLCJmZXRjaCIsImhlYWRlcnMiLCJvayIsIkVycm9yIiwic3RhdHVzIiwid29yayIsImpzb24iLCJzY2hlbWEiLCJkcmFmdFNjaGVtYSIsIlN0cmluZyIsInRpdGxlIiwiZSIsImVycm9yIiwiX2MiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiU1BXb3JrRWRpdG9yLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOi/kOiQpeerr+OAjOS9nOWTgeeUu+W4g+e8lui+keWZqOOAjeWuv+S4u+mhteOAglxuICpcbiAqIOS4jiBTUFRlbXBsYXRlRWRpdG9yIOe7k+aehOS4gOiHtO+8jOS9huaVsOaNrua6kOS4uiAvYXBpL3Byb3ZpZGVyL3dvcmtzLzppZO+8iFByb2plY3Qg6ICM6Z2eIFRlbXBsYXRl77yJ44CCXG4gKiDmjqXlhaXlpZHnuqbnm7jlkIzvvJpyZWdpc3RlckVkaXRvclNlcnZpY2VzKCkg4oaSIGxvYWRQcm9qZWN0KCkg4oaSIHNldEhvc3RNZXRhKCkg4oaSIDxFZGl0b3JBcHAvPuOAglxuICog5LiN5YaN5L2/55So6aKd5aSW55qEIGVkaXRvci10b3BiYXIg5YyF6KO55bGC77yM6aG555uu5ZCN56ew6YCa6L+HIGhvc3RNZXRhIOazqOWFpee8lui+keWZqOWGheaguOmhtuagj+WPs+S+p+OAglxuICovXG5pbXBvcnQgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgdXNlUGFyYW1zLCB1c2VOYXZpZ2F0ZSB9IGZyb20gJ3JlYWN0LXJvdXRlci1kb20nO1xuaW1wb3J0IHsgRWRpdG9yQXBwLCB1c2VFZGl0b3JTdG9yZSB9IGZyb20gJ0BoNWRlc2lnbi9lZGl0b3InO1xuaW1wb3J0IHsgcmVnaXN0ZXJFZGl0b3JTZXJ2aWNlcyB9IGZyb20gJy4uLy4uL2VkaXRvclNlcnZpY2VzJztcbmltcG9ydCB7IHdpdGhTdWJqZWN0IH0gZnJvbSAnLi4vLi4vcHJvdmlkZXJzL2RhdGFQcm92aWRlcic7XG5pbXBvcnQgeyBBUElfVVJMLCBhdXRoSGVhZGVycyB9IGZyb20gJy4uLy4uL3V0aWxpdHknO1xuaW1wb3J0IHsgU3BpbiwgbWVzc2FnZSB9IGZyb20gJ2FudGQnO1xuXG5yZWdpc3RlckVkaXRvclNlcnZpY2VzKCd3b3JrJyk7XG5cbmV4cG9ydCBjb25zdCBTUFdvcmtFZGl0b3IgPSAoKSA9PiB7XG4gIGNvbnN0IHsgaWQgfSA9IHVzZVBhcmFtczx7IGlkOiBzdHJpbmcgfT4oKTtcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xuICBjb25zdCBsb2FkUHJvamVjdCA9IHVzZUVkaXRvclN0b3JlKChzKSA9PiBzLmxvYWRQcm9qZWN0KTtcbiAgY29uc3Qgc2V0SG9zdE1ldGEgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5zZXRIb3N0TWV0YSk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbd29ya1RpdGxlLCBzZXRXb3JrVGl0bGVdID0gdXNlU3RhdGU8c3RyaW5nPignJyk7XG5cbiAgLyoqXG4gICAqIOW3suWPkei1t+WKoOi9veeahCBpZO+8iCoq5LiN5piv5biD5bCUKirvvInigJTigJQg5Lik5Liq6KaB5rGC5b+F6aG75ZCM5pe25ruh6Laz77yM5pS55Zue5biD5bCU5Lya5YaN5qyh6Lip5Z2R77yaXG4gICAqICAoYSkgU3RyaWN0TW9kZSDkuIsgZWZmZWN0IOWPjOi3ke+8muWQjOS4gOS4qiBpZCDlj6rmlL7ooYzkuIDmrKHvvIzpgb/lhY3lkIzkuIDmrKEgNDA0IOW8ueS4pOS4qiB0b2FzdO+8m1xuICAgKiAgKGIpIOi3r+eUsSA6aWQg55SxIEHihpJCIOWPmOWMluaXtue7hOS7tuWunuS+i+iiq+WkjeeUqO+8iOWQjOS4gOadoSA8Um91dGU+77yM5rKh5pyJIGtlee+8ie+8jHJlZiDkuI3kvJrph43nva7vvIxcbiAgICogICAgICDlm6DmraTlv4Xpobvog73or4bliKvjgIzmjaLkuobkuKogaWTjgI3lubbmlL7ooYzliqDovb3jgILnlKjluIPlsJTkvJrmsLjkuYXpl6nlnKggdHJ1Ze+8mueUu+W4g+WBnOWcqCBB77yMXG4gICAqICAgICAg6ICM5ZCO57ut5L+d5a2YL+WIoOmZpOS7jeaMiSBBIOeahCBpZCDmj5DkuqQg4oaSIOmdmem7mOWGmeWdj+WPpuS4gOadoeiusOW9le+8iOi3qOiusOW9leS4suWPt++8ieOAglxuICAgKi9cbiAgY29uc3QgbG9hZGVkSWRSZWYgPSB1c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG5cbiAgY29uc3QgcmVsb2FkID0gdXNlQ2FsbGJhY2soYXN5bmMgKCkgPT4ge1xuICAgIC8vIOWQjOS4gCBpZCDlt7LliqDovb3ov4fvvIjlkKsgU3RyaWN0TW9kZSDkuozmrKHosIPnlKjvvInihpIg6Lez6L+H77yb5o2i5LqGIGlkIOKGkiDmlL7ooYxcbiAgICBpZiAoIWlkIHx8IGxvYWRlZElkUmVmLmN1cnJlbnQgPT09IGlkKSByZXR1cm47XG4gICAgbG9hZGVkSWRSZWYuY3VycmVudCA9IGlkO1xuICAgIHNldExvYWRpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEFETUlOIOinhuWvn+inhuinku+8iOeUqOaIty/mnI3liqHllYbop4bop5LnvJbovpHku5bkurrkvZzlk4HvvInlv4XpobvluKYgP3N1YmplY3Q977yMXG4gICAgICAvLyDlkKbliJnmnI3liqHnq6/mjInnmbvlvZXogIXoh6rouqvlvZLlsZ7mn6Xor6Ig4oaSIDQwNO+8iOmihOiniOi1sCBkYXRhUHJvdmlkZXIg5rOo5YWl5LqGIHN1YmplY3Qg5pWF5q2j5bi477yJXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtBUElfVVJMfS8ke3dpdGhTdWJqZWN0KGBwcm92aWRlci93b3Jrcy8ke2lkfWApfWAsIHsgaGVhZGVyczogYXV0aEhlYWRlcnMoKSB9KTtcbiAgICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYOWKoOi9veS9nOWTgeWksei0pSAoJHtyZXMuc3RhdHVzfSlgKTtcbiAgICAgIGNvbnN0IHdvcmsgPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgLy8g56ue5oCB5a6I5Y2r77yaQeKGkkIg5b+r6YCf5YiH5o2i5pe277yM6IulIEEg55qE5ZON5bqU5pma5LqOIEIg6L+U5Zue77yM5b+F6aG75Lii5byD77yMXG4gICAgICAvLyDlkKbliJnkvJrmioogQSDnmoTlhoXlrrnlhpnov5vnlLvluIPvvIjogIwgcHJvamVjdElkIOW3suaYryBC77yJ4oaSIOWPiOS4gOasoei3qOiusOW9leS4suWPt+OAglxuICAgICAgaWYgKGxvYWRlZElkUmVmLmN1cnJlbnQgIT09IGlkKSByZXR1cm47XG4gICAgICBjb25zdCBzY2hlbWEgPSB3b3JrLmRyYWZ0U2NoZW1hICYmIHR5cGVvZiB3b3JrLmRyYWZ0U2NoZW1hID09PSAnb2JqZWN0JyA/IHdvcmsuZHJhZnRTY2hlbWEgOiB3b3JrLnNjaGVtYTtcbiAgICAgIGxvYWRQcm9qZWN0KHNjaGVtYSwgU3RyaW5nKGlkKSk7XG4gICAgICBjb25zdCB0aXRsZSA9IHdvcmsudGl0bGUgfHwgJyc7XG4gICAgICBzZXRXb3JrVGl0bGUodGl0bGUpO1xuICAgICAgLy8g5rOo5YWl57yW6L6R5Zmo6aG25qCP5Y+z5L6nXG4gICAgICBzZXRIb3N0TWV0YSh7IHRpdGxlIH0pO1xuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAvLyDliqDovb3lpLHotKXvvJrmuIXmjonpl6nvvIzlhYHorrjlm57liLDmnKzpobXml7bph43or5XvvJvot7PovazlkI7nu4Tku7bkvJrljbjovb3vvIxyZWYg6Ieq54S26YeN572uXG4gICAgICBsb2FkZWRJZFJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIG1lc3NhZ2UuZXJyb3IoZT8ubWVzc2FnZSB8fCAn5L2c5ZOB5Yqg6L295aSx6LSlJyk7XG4gICAgICBuYXZpZ2F0ZSgnL3NwL3dvcmtzJyk7XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgfSwgW2lkLCBsb2FkUHJvamVjdCwgbmF2aWdhdGVdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHJlbG9hZCgpO1xuICB9LCBbcmVsb2FkXSk7XG5cbiAgaWYgKGxvYWRpbmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaXhlZCBpbnNldC0wIHotWzEwMDBdIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLXdoaXRlXCI+XG4gICAgICAgIDxTcGluIHNpemU9XCJsYXJnZVwiIC8+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgLy8g55u05o6l5riy5p+TIEVkaXRvckFwcO+8jOS4jeWMheijuemineWklumhtuagj++8iOS9nOWTgeWQjeW3sumAmui/hyBob3N0TWV0YSDms6jlhaXlhoXmoLjpobbmoI/vvIlcbiAgLy8gZXhpdFBhdGjvvJrov5DokKXnq6/msqHmnIkgd2ViIOeahCAvZGFzaGJvYXJkIOi3r+eUse+8jOOAjOmAgOWHuue8lui+keOAjeW/hemhu+WbnuS9nOWTgeWIl+ihqFxuICByZXR1cm4gPEVkaXRvckFwcCBleGl0UGF0aD1cIi9zcC93b3Jrc1wiIC8+O1xufTtcbiJdLCJmaWxlIjoiRDovTXlXb3JrQnVkZHkvMjAyNi0wOC0xMC0yMi0zOS01Ni9hcHBzL2FkbWluL3NyYy9wYWdlcy9wcm92aWRlckRldGFpbFBhZ2VzL1NQV29ya0VkaXRvci50c3gifQ==