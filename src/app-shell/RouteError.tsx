import { useEffect, useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { isChunkLoadError, reloadOnceForNewBuild } from "./chunkReload";
import { NotFound } from "./NotFound";
import "./app-shell.css";

// What a route shows when it crashes while rendering or its code fails to
// load, instead of React Router's bare developer screen. `full` when it
// replaces the whole app (no layout around it).
export function RouteError({ full = false }: { full?: boolean }) {
  const error = useRouteError();
  const chunk = isChunkLoadError(error);
  // A new version went out while this tab was open: reload once to get it.
  const [reloading] = useState(() => chunk && reloadOnceForNewBuild());

  useEffect(() => {
    if (!reloading) console.error(error);
  }, [error, reloading]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound full={full} />;

  return (
    <main className={`cv-shell-msg${full ? " is-full" : ""}`} role="alert">
      <img src="/favicon.svg" alt="" className="cv-shell-msg-logo" />
      {reloading ? (
        <h1>Updating CricDesk…</h1>
      ) : (
        <>
          <h1>Something went wrong</h1>
          <p>
            {chunk
              ? "A new version of CricDesk is out. Reload to get it."
              : "This page hit a problem. Reloading usually fixes it."}
          </p>
          <div className="cv-shell-msg-actions">
            <button type="button" className="cv-shell-btn is-primary" onClick={() => window.location.reload()}>
              <i className="fa-solid fa-rotate-right"></i> Reload
            </button>
            {/* A full page load, so nothing from the broken state carries over. */}
            <a href="/" className="cv-shell-btn">
              <i className="fa-solid fa-house"></i> Go home
            </a>
          </div>
        </>
      )}
    </main>
  );
}
