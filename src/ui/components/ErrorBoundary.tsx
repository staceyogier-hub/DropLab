import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so a single bad component cannot blank the app.
 * Errors are shown locally; nothing is reported anywhere (no network).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local console only — no telemetry / error reporting service.
    console.error('DropLab error:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="main" role="alert">
          <div className="card">
            <h2>Something went wrong</h2>
            <p>
              DropLab hit an unexpected error while rendering. Your data has not left this machine.
            </p>
            <pre className="mono small" style={{ whiteSpace: 'pre-wrap', color: 'var(--red)' }}>
              {this.state.error.message}
            </pre>
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
