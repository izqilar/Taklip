import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/Editor.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=bf0c7844"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=bf0c7844"; const useEffect = __vite__cjsImport3_react["useEffect"]; const useState = __vite__cjsImport3_react["useState"];
import { useParams, Link } from "/node_modules/.vite/deps/react-router-dom.js?v=bf0c7844";
import { useTranslation } from "/node_modules/.vite/deps/react-i18next.js?v=bf0c7844";
import { api } from "/src/api/client.ts";
import { useEditorStore } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/index.ts";
import { EditorApp } from "/@fs/D:/MyWorkBuddy/2026-08-10-22-39-56/packages/editor/src/index.ts";
import { registerEditorServices } from "/src/editorServices.ts";
registerEditorServices();
export default function Editor() {
  _s();
  const { t } = useTranslation(["common", "errors"]);
  const { projectId } = useParams();
  const loadProject = useEditorStore((s) => s.loadProject);
  const newProject = useEditorStore((s) => s.newProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectId) {
        newProject();
        setLoading(false);
        return;
      }
      try {
        const detail = await api.getProject(projectId);
        if (cancelled) return;
        if (detail.schema) {
          loadProject(detail.schema, String(detail.id));
        } else {
          newProject();
        }
        setLoading(false);
      } catch (err) {
        console.error("Load project failed:", err);
        setError(t("errors:dashboard.loadProjectError"));
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject, newProject, t]);
  if (loading) {
    return /* @__PURE__ */ jsxDEV("div", { className: "flex h-full items-center justify-center bg-gray-900 text-gray-400", children: t("common:status.loadingProject") }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx",
      lineNumber: 80,
      columnNumber: 7
    }, this);
  }
  if (error) {
    return /* @__PURE__ */ jsxDEV("div", { className: "flex h-full items-center justify-center bg-gray-900", children: /* @__PURE__ */ jsxDEV("div", { className: "text-center", children: [
      /* @__PURE__ */ jsxDEV("p", { className: "mb-2 text-red-400", children: error }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx",
        lineNumber: 90,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(Link, { to: "/user/works", className: "text-blue-400 hover:underline", children: t("common:button.backToList") }, void 0, false, {
        fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx",
        lineNumber: 91,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx",
      lineNumber: 89,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx",
      lineNumber: 88,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(EditorApp, { exportOnly: true }, void 0, false, {
    fileName: "D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx",
    lineNumber: 101,
    columnNumber: 10
  }, this);
}
_s(Editor, "NZb1AEcnStkjoccFfnc2j6l+gXI=", false, function() {
  return [useTranslation, useParams, useEditorStore, useEditorStore];
});
_c = Editor;
var _c;
$RefreshReg$(_c, "Editor");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/MyWorkBuddy/2026-08-10-22-39-56/apps/web/src/pages/Editor.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBNERNOzs7Ozs7Ozs7Ozs7Ozs7OztBQXpETixTQUFTQSxXQUFXQyxnQkFBZ0I7QUFDcEMsU0FBU0MsV0FBV0MsWUFBWTtBQUNoQyxTQUFTQyxzQkFBc0I7QUFDL0IsU0FBU0MsV0FBVztBQUNwQixTQUFRQyxzQkFBcUI7QUFDN0IsU0FBU0MsaUJBQWlCO0FBRTFCLFNBQVNDLDhCQUE4QjtBQUt2Q0EsdUJBQXVCO0FBRXZCLHdCQUF3QkMsU0FBUztBQUFBQyxLQUFBO0FBQy9CLFFBQU0sRUFBRUMsRUFBRSxJQUFJUCxlQUFlLENBQUMsVUFBVSxRQUFRLENBQUM7QUFDakQsUUFBTSxFQUFFUSxVQUFVLElBQUlWLFVBQWlDO0FBQ3ZELFFBQU1XLGNBQWNQLGVBQWUsQ0FBQ1EsTUFBTUEsRUFBRUQsV0FBVztBQUN2RCxRQUFNRSxhQUFhVCxlQUFlLENBQUNRLE1BQU1BLEVBQUVDLFVBQVU7QUFDckQsUUFBTSxDQUFDQyxTQUFTQyxVQUFVLElBQUloQixTQUFTLElBQUk7QUFDM0MsUUFBTSxDQUFDaUIsT0FBT0MsUUFBUSxJQUFJbEIsU0FBd0IsSUFBSTtBQUV0REQsWUFBVSxNQUFNO0FBQ2QsUUFBSW9CLFlBQVk7QUFFaEIsbUJBQWVDLE9BQU87QUFDcEIsVUFBSSxDQUFDVCxXQUFXO0FBQ2RHLG1CQUFXO0FBQ1hFLG1CQUFXLEtBQUs7QUFDaEI7QUFBQSxNQUNGO0FBRUEsVUFBSTtBQUNGLGNBQU1LLFNBQVMsTUFBTWpCLElBQUlrQixXQUFXWCxTQUFTO0FBQzdDLFlBQUlRLFVBQVc7QUFFZixZQUFJRSxPQUFPRSxRQUFRO0FBQ2pCWCxzQkFBWVMsT0FBT0UsUUFBbUJDLE9BQU9ILE9BQU9JLEVBQUUsQ0FBQztBQUFBLFFBQ3pELE9BQU87QUFDTFgscUJBQVc7QUFBQSxRQUNiO0FBQ0FFLG1CQUFXLEtBQUs7QUFBQSxNQUNsQixTQUFTVSxLQUFLO0FBQ1pDLGdCQUFRVixNQUFNLHdCQUF3QlMsR0FBRztBQUN6Q1IsaUJBQVNSLEVBQUUsbUNBQW1DLENBQUM7QUFDL0NNLG1CQUFXLEtBQUs7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFFQUksU0FBSztBQUNMLFdBQU8sTUFBTTtBQUNYRCxrQkFBWTtBQUFBLElBQ2Q7QUFBQSxFQUNGLEdBQUcsQ0FBQ1IsV0FBV0MsYUFBYUUsWUFBWUosQ0FBQyxDQUFDO0FBRTFDLE1BQUlLLFNBQVM7QUFDWCxXQUNFLHVCQUFDLFNBQUksV0FBVSxxRUFDWkwsWUFBRSw4QkFBOEIsS0FEbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUVBO0FBQUEsRUFFSjtBQUVBLE1BQUlPLE9BQU87QUFDVCxXQUNFLHVCQUFDLFNBQUksV0FBVSx1REFDYixpQ0FBQyxTQUFJLFdBQVUsZUFDYjtBQUFBLDZCQUFDLE9BQUUsV0FBVSxxQkFBcUJBLG1CQUFsQztBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQXdDO0FBQUEsTUFDeEMsdUJBQUMsUUFBSyxJQUFHLGVBQWMsV0FBVSxpQ0FDOUJQLFlBQUUsMEJBQTBCLEtBRC9CO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFFQTtBQUFBLFNBSkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUtBLEtBTkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQU9BO0FBQUEsRUFFSjtBQUlBLFNBQU8sdUJBQUMsYUFBVSxZQUFVLFFBQXJCO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FBcUI7QUFDOUI7QUFBQ0QsR0FqRXVCRCxRQUFNO0FBQUEsVUFDZEwsZ0JBQ1FGLFdBQ0ZJLGdCQUNEQSxjQUFjO0FBQUE7QUFBQSxLQUpYRztBQUFNLElBQUFvQjtBQUFBLGFBQUFBLElBQUEiLCJuYW1lcyI6WyJ1c2VFZmZlY3QiLCJ1c2VTdGF0ZSIsInVzZVBhcmFtcyIsIkxpbmsiLCJ1c2VUcmFuc2xhdGlvbiIsImFwaSIsInVzZUVkaXRvclN0b3JlIiwiRWRpdG9yQXBwIiwicmVnaXN0ZXJFZGl0b3JTZXJ2aWNlcyIsIkVkaXRvciIsIl9zIiwidCIsInByb2plY3RJZCIsImxvYWRQcm9qZWN0IiwicyIsIm5ld1Byb2plY3QiLCJsb2FkaW5nIiwic2V0TG9hZGluZyIsImVycm9yIiwic2V0RXJyb3IiLCJjYW5jZWxsZWQiLCJsb2FkIiwiZGV0YWlsIiwiZ2V0UHJvamVjdCIsInNjaGVtYSIsIlN0cmluZyIsImlkIiwiZXJyIiwiY29uc29sZSIsIl9jIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkVkaXRvci50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDnvJbovpHlmajot6/nlLHpobUg4oCUIOagueaNriBVUkwg5Lit55qEIHByb2plY3RJZCDku44gQVBJIOWKoOi9veS9nOWTge+8jOeEtuWQjua4suafkyBFZGl0b3JBcHBcbiAqL1xuaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IHVzZVBhcmFtcywgTGluayB9IGZyb20gJ3JlYWN0LXJvdXRlci1kb20nO1xuaW1wb3J0IHsgdXNlVHJhbnNsYXRpb24gfSBmcm9tICdyZWFjdC1pMThuZXh0JztcbmltcG9ydCB7IGFwaSB9IGZyb20gJ0AvYXBpL2NsaWVudCc7XG5pbXBvcnQge3VzZUVkaXRvclN0b3JlfSBmcm9tICdAaDVkZXNpZ24vZWRpdG9yJztcbmltcG9ydCB7IEVkaXRvckFwcCB9IGZyb20gJ0BoNWRlc2lnbi9lZGl0b3InO1xuaW1wb3J0IHR5cGUgeyBQcm9qZWN0IH0gZnJvbSAnQGg1ZGVzaWduL2NvcmUnO1xuaW1wb3J0IHsgcmVnaXN0ZXJFZGl0b3JTZXJ2aWNlcyB9IGZyb20gJ0AvZWRpdG9yU2VydmljZXMnO1xuXG4vLyDmnKzmqKHlnZflt7Looqvot6/nlLHnuqfmh5LliqDovb3vvIhBcHAudHN4IOeahCBSZWFjdC5sYXp577yJ77yM5q2k5aSE5rOo5YaM5a6/5Li75pyN5Yqh5a6e546w77yaXG4vLyDmqKHlnZfmsYLlgLzml6nkuo7nu4Tku7bmuLLmn5PvvIzkv53or4EgPEVkaXRvckFwcC8+IOaMgui9veWJjeacjeWKoeW3suWwsee7qu+8jFxuLy8g5ZCM5pe25oqKIEBoNWRlc2lnbi9lZGl0b3Ig55qE6YeN6YeP57qn5Luj56CB6ZmQ5Yi25Zyo57yW6L6R5ZmoIGNodW5rIOWGheOAglxucmVnaXN0ZXJFZGl0b3JTZXJ2aWNlcygpO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBFZGl0b3IoKSB7XG4gIGNvbnN0IHsgdCB9ID0gdXNlVHJhbnNsYXRpb24oWydjb21tb24nLCAnZXJyb3JzJ10pO1xuICBjb25zdCB7IHByb2plY3RJZCB9ID0gdXNlUGFyYW1zPHsgcHJvamVjdElkOiBzdHJpbmcgfT4oKTtcbiAgY29uc3QgbG9hZFByb2plY3QgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5sb2FkUHJvamVjdCk7XG4gIGNvbnN0IG5ld1Byb2plY3QgPSB1c2VFZGl0b3JTdG9yZSgocykgPT4gcy5uZXdQcm9qZWN0KTtcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG5cbiAgICBhc3luYyBmdW5jdGlvbiBsb2FkKCkge1xuICAgICAgaWYgKCFwcm9qZWN0SWQpIHtcbiAgICAgICAgbmV3UHJvamVjdCgpO1xuICAgICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBkZXRhaWwgPSBhd2FpdCBhcGkuZ2V0UHJvamVjdChwcm9qZWN0SWQpO1xuICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKGRldGFpbC5zY2hlbWEpIHtcbiAgICAgICAgICBsb2FkUHJvamVjdChkZXRhaWwuc2NoZW1hIGFzIFByb2plY3QsIFN0cmluZyhkZXRhaWwuaWQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdQcm9qZWN0KCk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignTG9hZCBwcm9qZWN0IGZhaWxlZDonLCBlcnIpO1xuICAgICAgICBzZXRFcnJvcih0KCdlcnJvcnM6ZGFzaGJvYXJkLmxvYWRQcm9qZWN0RXJyb3InKSk7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxvYWQoKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2FuY2VsbGVkID0gdHJ1ZTtcbiAgICB9O1xuICB9LCBbcHJvamVjdElkLCBsb2FkUHJvamVjdCwgbmV3UHJvamVjdCwgdF0pO1xuXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBoLWZ1bGwgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWdyYXktOTAwIHRleHQtZ3JheS00MDBcIj5cbiAgICAgICAge3QoJ2NvbW1vbjpzdGF0dXMubG9hZGluZ1Byb2plY3QnKX1cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBpZiAoZXJyb3IpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGgtZnVsbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctZ3JheS05MDBcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LWNlbnRlclwiPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cIm1iLTIgdGV4dC1yZWQtNDAwXCI+e2Vycm9yfTwvcD5cbiAgICAgICAgICA8TGluayB0bz1cIi91c2VyL3dvcmtzXCIgY2xhc3NOYW1lPVwidGV4dC1ibHVlLTQwMCBob3Zlcjp1bmRlcmxpbmVcIj5cbiAgICAgICAgICAgIHt0KCdjb21tb246YnV0dG9uLmJhY2tUb0xpc3QnKX1cbiAgICAgICAgICA8L0xpbms+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIC8vIOe7iOerr+eUqOaIt++8iHdlYu+8ieayoeacieWPkeW4g+S9nOWTgS/lj5HluIPkuLrmqKHmnb/nmoTmnYPpmZDvvJrpobbmoI/kuLvmjInpkq7kuLrjgIzlr7zlh7rjgI3vvIxcbiAgLy8g5omT5byA55qE5a+56K+d5qGG5LiN5ZCr44CM56uL5Y2z5Y+R5biD44CN6aG1562+77yM5Y+q5YGa5Zu+54mHIC8g6KeG6aKRIC8gR0lGIOWvvOWHuuOAglxuICByZXR1cm4gPEVkaXRvckFwcCBleHBvcnRPbmx5IC8+O1xufVxuIl0sImZpbGUiOiJEOi9NeVdvcmtCdWRkeS8yMDI2LTA4LTEwLTIyLTM5LTU2L2FwcHMvd2ViL3NyYy9wYWdlcy9FZGl0b3IudHN4In0=