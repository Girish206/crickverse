import type { ReactNode } from "react";
import type { CricketTournament } from "../../../api/types";

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Upcoming / live / completed from the tournament's dates (UTC days).
function phaseOf(t: CricketTournament): { label: string; tone: string } | null {
  if (!t.startDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const start = t.startDate.slice(0, 10);
  const end = (t.endDate ?? t.startDate).slice(0, 10);
  if (today < start) return { label: "Upcoming", tone: "is-upcoming" };
  if (today > end) return { label: "Completed", tone: "is-done" };
  return { label: "Live", tone: "is-live" };
}

// The top of a tournament's page: cover image with the back link and
// actions over it, a floating card with the logo, name, status, dates and
// place straddling its bottom edge. The rest of the details are on the
// Info tab (TournamentInfo). Older tournaments without a banner get a
// gradient cover.
export function TournamentBanner({
  tournament: t,
  back,
  actions,
}: {
  tournament: CricketTournament;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  const place = [t.ground, t.city].filter(Boolean).join(", ");
  const dates = t.startDate
    ? `${shortDate(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ` – ${shortDate(t.endDate)}` : ""}`
    : null;
  const phase = phaseOf(t);

  return (
    <div className="cricket-th">
      <div
        className={`cricket-th-cover ${t.bannerUrl ? "" : "is-empty"}`}
        style={t.bannerUrl ? { backgroundImage: `url(${t.bannerUrl})` } : undefined}
      >
        <div className="cricket-th-bar">
          {back}
          {actions && <div className="cricket-th-actions">{actions}</div>}
        </div>
      </div>

      {/* Floating card straddling the cover's bottom edge. */}
      <div className="cricket-th-identity">
        <span
          className="cricket-tour-logo"
          style={t.logoUrl ? { backgroundImage: `url(${t.logoUrl})` } : undefined}
          aria-hidden="true"
        >
          {!t.logoUrl && t.name.charAt(0).toUpperCase()}
        </span>
        <div className="cricket-th-title">
          <h1>{t.name}</h1>
          {(phase || dates || place) && (
            <div className="cricket-th-meta">
              {phase && <span className={`cricket-th-phase ${phase.tone}`}>{phase.label}</span>}
              {dates && (
                <span>
                  <i className="fa-regular fa-calendar" aria-hidden="true"></i> {dates}
                </span>
              )}
              {place && (
                <span>
                  <i className="fa-solid fa-location-dot" aria-hidden="true"></i> {place}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
