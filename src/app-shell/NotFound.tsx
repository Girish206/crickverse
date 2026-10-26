import { Link } from "react-router-dom";
import "./app-shell.css";

// Any address the app doesn't know (an old link, a typo). Shown inside the
// app's layout, so the menu is still there to go somewhere else.
export function NotFound({ full = false }: { full?: boolean }) {
  return (
    <main className={`cv-shell-msg${full ? " is-full" : ""}`}>
      <span className="cv-shell-msg-code">404</span>
      <h1>Page not found</h1>
      <p>This page doesn't exist, or the link has moved.</p>
      <div className="cv-shell-msg-actions">
        <Link to="/" replace className="cv-shell-btn is-primary">
          <i className="fa-solid fa-house"></i> Go home
        </Link>
      </div>
    </main>
  );
}
