import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 区域名称，用于日志与提示文案（如 "画布" / "属性面板"） */
  name?: string;
  /** 自定义兜底 UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 通用错误边界：捕获子树渲染/生命周期中的未处理异常，
 * 避免单个组件崩溃导致整页白屏（此前 PropertyPanel 的 toFixed 异常曾触发此问题）。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.name ?? 'root'}]`, error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error as Error, this.reset);
      }
      const name = this.props.name ?? '该模块';
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-gray-900 p-6 text-center text-gray-200">
          <div className="text-sm font-semibold text-red-400">{name} 渲染出错</div>
          <div className="max-w-md break-all text-xs text-gray-400">
            {(this.state.error as Error)?.message ?? '未知错误'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition hover:bg-blue-500"
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded border border-gray-600 px-3 py-1 text-sm text-gray-300 transition hover:bg-gray-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
