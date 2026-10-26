import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdminBodyClass } from "../admin/useAdminBodyClass";
import { useAdminTheme } from "../admin/useAdminTheme";
import { BrandSignature } from "../admin/components/BrandSignature";
import { Loader } from "../admin/components/Loader";
import "../admin/dms/global.css";
import "../admin/cricket/cricket-matches.css";
import "../app-shell/app-shell.css";
import "./public.css";

// The frame of a shared match / tournament page for someone signed out: a
// slim CricDesk bar with sign-in, the page, then an invitation to the app.
// It uses the app's theme (light/dark as the device or saved choice says).
export function PublicShell({ children }: { children: ReactNode }) {
  useAdminBodyClass();
  useAdminTheme();
  const from = useLocation().pathname;

  return (
    <div className="cv-public">
      <header className="cv-public-bar">
        <Link to="/login" state={{ from }} className="cv-public-brand" aria-label="CricDesk">
          <img src="/favicon.svg" alt="" />
          <span>CricDesk</span>
        </Link>
        <Link to="/login" state={{ from }} className="cv-public-signin">
          Sign in
        </Link>
      </header>
      <main className="cv-public-main">{children}</main>
      <footer className="cv-public-foot">
        <div className="cv-public-cta card">
          <div>
            <strong>Score your own matches</strong>
            <span>Ball-by-ball scoring, tournaments and player stats — free.</span>
          </div>
          <Link to="/login" state={{ from }} className="cv-public-cta-btn">
            Get CricDesk
          </Link>
        </div>
        <BrandSignature small />
      </footer>
    </div>
  );
}

// Loading, private (404) or couldn't load: the page's states before its data.
export function PublicState({
  loading,
  error,
  notPublic,
  what,
  onRetry,
}: {
  loading: boolean;
  error: unknown;
  notPublic: boolean;
  what: "match" | "tournament";
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const from = useLocation().pathname;
  useAdminBodyClass();
  useAdminTheme();

  if (loading) {
    return (
      <div className="cv-public">
        <Loader page label={`Loading the ${what}`} />
      </div>
    );
  }
  if (notPublic) {
    return (
      <main className="cv-shell-msg is-full">
        <i className="fa-solid fa-lock cv-public-lock" aria-hidden="true"></i>
        <h1>This {what} is private</h1>
        <p>Only its players and organisers can see it. Sign in to see it — you'll come straight back here.</p>
        <div className="cv-shell-msg-actions">
          <button type="button" className="cv-shell-btn is-primary" onClick={() => navigate("/login", { state: { from } })}>
            <i className="fa-solid fa-right-to-bracket"></i> Sign in to see it
          </button>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="cv-shell-msg is-full">
        <i className="fa-solid fa-wifi cv-public-lock" aria-hidden="true"></i>
        <h1>Couldn't load the {what}</h1>
        <p>Check your connection and try again.</p>
        <div className="cv-shell-msg-actions">
          <button type="button" className="cv-shell-btn is-primary" onClick={onRetry}>
            <i className="fa-solid fa-rotate-right"></i> Try again
          </button>
        </div>
      </main>
    );
  }
  return null;
}
