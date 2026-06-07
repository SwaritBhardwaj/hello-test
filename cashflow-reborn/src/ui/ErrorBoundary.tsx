import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * App-wide error boundary. Without this, any thrown render error unmounts the
 * whole React tree and leaves a blank white page (which is exactly how the
 * CoachInsight infinite-loop bug manifested). With it, the player sees a
 * recoverable message instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for debugging; a real app would ship this to an error tracker.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] felt-table flex items-center justify-center p-6">
          <div className="paper max-w-md w-full rounded-game shadow-card ring-4 ring-brass/40 overflow-hidden">
            <div className="bg-wood-700 px-6 py-4 text-card font-display text-xl">Something went wrong</div>
            <div className="p-6 space-y-4">
              <p className="text-ink leading-relaxed">
                The game hit an unexpected error and paused to avoid a blank screen.
                Your progress this session may be affected, but you can reload and keep going.
              </p>
              <pre className="text-2xs text-ink-soft bg-card-edge rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
              <button
                onClick={this.handleReload}
                className="btn-3d w-full bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 px-4 py-3"
              >
                Reload the game
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
