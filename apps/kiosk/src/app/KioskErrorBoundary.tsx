import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last line of defence for an unattended device (CLAUDE.md §11/§24, docs/03
 * §29). If any view throws during render, React unmounts the whole tree —
 * on a kiosk that means a permanent blank screen with no way back until
 * staff notice and power-cycle it. This catches that, shows the patient a
 * calm, non-technical message with a clear next step, and lets a tap rebuild
 * a fresh session.
 *
 * The real error text is logged for operators, never shown to the patient.
 */
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  /** Bumped on "Start over" so the subtree remounts from scratch. */
  resetKey: number;
}

export class KioskErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Operational log only — a stable code plus the message/stack, no
    // patient content (CLAUDE.md §25).
    console.error("KIOSK_RENDER_ERROR", error.message, error.stack, info.componentStack);
  }

  private handleStartOver = (): void => {
    this.setState((prev) => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="kiosk-shell">
          <div className="screen screen-error" role="alert">
            <h1>Something went wrong</h1>
            <p className="hint">
              Please start again, or ask a receptionist at the front desk for help.
            </p>
            <button className="primary-action" onClick={this.handleStartOver}>
              Start over
            </button>
          </div>
        </main>
      );
    }

    return <div key={this.state.resetKey} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
