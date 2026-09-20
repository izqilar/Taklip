import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: string | null;
}

/**
 * 全局错误边界：捕获子树渲染期异常，避免整页白屏。
 * Refine 自带的 <ErrorComponent /> 只覆盖「路由未匹配」场景，
 * 这里兜底 React 渲染崩溃（含编辑器内核、懒加载 chunk 报错等）。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 生产环境也应保留可追踪的堆栈，便于排查（避免静默吞掉）
    console.error('[ErrorBoundary] 渲染异常：', error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack ?? null });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <Result
        status="error"
        title="页面出错了"
        subTitle="应用运行时发生异常，可尝试恢复或刷新页面。若反复出现，请联系管理员。"
        extra={[
          <Button type="primary" key="reload" onClick={this.handleReload}>
            刷新页面
          </Button>,
          <Button key="reset" onClick={this.handleReset}>
            尝试恢复
          </Button>,
        ]}
      >
        {import.meta.env.DEV && errorInfo ? (
          <pre
            style={{
              maxHeight: 320,
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 6,
            }}
          >
            {error.message}
            {errorInfo}
          </pre>
        ) : null}
      </Result>
    );
  }
}
