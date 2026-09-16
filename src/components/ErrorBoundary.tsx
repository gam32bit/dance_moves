import { Component, type ErrorInfo, type ReactNode } from 'react';
import { describeError } from '../errors';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

/**
 * Without this, a rejected `useLiveQuery` rethrows during render and React
 * unmounts the entire tree — the app goes blank with no explanation.
 * This keeps the failure on screen and readable.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[dance-moves] render failed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="page crash">
        <h1>Something broke</h1>
        <p className="error">{describeError(error)}</p>
        <p className="muted">
          Your saved moves and clips are still on this device. Reloading usually
          gets you back in.
        </p>
        <div className="crash-actions">
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
          <button
            className="btn"
            onClick={() => this.setState({ error: null })}
          >
            Try to continue
          </button>
        </div>
        {error instanceof Error && error.stack && (
          <details className="crash-details">
            <summary className="muted">Technical details</summary>
            <pre>{error.stack}</pre>
          </details>
        )}
      </div>
    );
  }
}
