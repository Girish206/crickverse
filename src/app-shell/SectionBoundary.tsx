import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "./reportError";
import "./app-shell.css";

// Keeps a crash inside one part of a page (a match tab, a chart) to that
// part: it shows a small "couldn't show this" note with a retry, the rest of
// the page (the scorer, the other tabs) carries on, and the crash is
// reported. `where` names the part in the report ("match: insights").
// `resetKey`: a change (another tab, new data) tries the part again.
// `silent`: show nothing in its place (an overlay, such as the burst).
interface Props {
  where: string;
  resetKey?: unknown;
  silent?: boolean;
  children: ReactNode;
}

interface State {
  error: Error | null;
  key: unknown;
}

export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    reportError(error, this.props.where);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.silent) return null;
    return (
      <div className="cv-section-error" role="alert">
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <strong>Couldn't show this part</strong>
          <small>The rest of the page still works. We've been told about it.</small>
        </div>
        <button type="button" onClick={() => this.setState({ error: null })}>
          <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Try again
        </button>
      </div>
    );
  }
}
