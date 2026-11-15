import { useState } from "react";
import { useClientErrors, useDismissClientErrors, type ClientError } from "../../../api/hooks/cricket/useClientErrors";
import { HomeSection } from "../HomeSection";

// Which phone or browser, in a few words, from its user agent.
function deviceOf(row: ClientError) {
  const ua = row.userAgent ?? "";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : "";
  const browser = row.native
    ? "app"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : "";
  return [os, browser].filter(Boolean).join(" · ") || "Unknown device";
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

// Database page: crashes on people's phones and browsers, grouped, newest
// first. Mark one fixed to take it off the list (it returns if it recurs).
export function AppErrorsSection() {
  const { data, isLoading, isError } = useClientErrors();
  const dismiss = useDismissClientErrors();
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];

  return (
    <HomeSection title={`App errors${rows.length ? ` (${rows.length})` : ""}`} icon="fa-solid fa-bug" tone="next">
      {isLoading ? (
        <p className="admin-hint mb-0">Loading…</p>
      ) : isError ? (
        <p className="admin-hint mb-0">Couldn't load the error list.</p>
      ) : rows.length === 0 ? (
        <p className="admin-hint mb-0">
          <i className="fa-solid fa-circle-check" aria-hidden="true"></i> No crashes reported. Errors on people's phones and
          browsers show up here.
        </p>
      ) : (
        <>
          <ul className="cricket-app-errors">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="cricket-app-error-head"
                  onClick={() => setOpen(open === row.id ? null : row.id)}
                  aria-expanded={open === row.id}
                >
                  <span className="cricket-app-error-count" title="Times it happened">
                    ×{row.count}
                  </span>
                  <span className="cricket-app-error-text">
                    <strong>{row.message}</strong>
                    <small>{[row.where, deviceOf(row), ago(row.lastAt)].filter(Boolean).join(" · ")}</small>
                  </span>
                  <i className={`fa-solid fa-chevron-${open === row.id ? "up" : "down"}`} aria-hidden="true"></i>
                </button>
                {open === row.id && (
                  <div className="cricket-app-error-body">
                    <dl>
                      <dt>Page</dt>
                      <dd>{row.url ?? "—"}</dd>
                      <dt>First seen</dt>
                      <dd>{new Date(row.firstAt).toLocaleString()}</dd>
                      <dt>Last seen</dt>
                      <dd>{new Date(row.lastAt).toLocaleString()}</dd>
                      {row.adminId !== null && (
                        <>
                          <dt>Account</dt>
                          <dd>#{row.adminId}</dd>
                        </>
                      )}
                    </dl>
                    {row.stack && <pre>{row.stack}</pre>}
                    <button
                      type="button"
                      className="cricket-app-error-fixed"
                      onClick={() => dismiss.mutate(row.id)}
                      disabled={dismiss.isPending}
                    >
                      <i className="fa-solid fa-check" aria-hidden="true"></i> Mark fixed
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="cricket-app-error-fixed mt-2" onClick={() => dismiss.mutate(null)} disabled={dismiss.isPending}>
            <i className="fa-solid fa-broom" aria-hidden="true"></i> Clear all
          </button>
        </>
      )}
    </HomeSection>
  );
}
