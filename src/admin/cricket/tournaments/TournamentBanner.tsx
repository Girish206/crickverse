import type { CricketTournament } from "../../../api/types";
import { bannerFor, logoFor } from "./tournamentArt";

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Upcoming / live / completed from the tournament's dates (UTC days).
function phaseOf(t: CricketTournament): { label: string; tone: string } | null {
  if (!t.startDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const start = t.startDate.slice(0, 10);
  if (today < start) return { label: "Upcoming", tone: "is-upcoming" };
  // An open-ended one (no end date yet) stays live.
  if (t.endDate && today > t.endDate.slice(0, 10)) return { label: "Completed", tone: "is-done" };
  return { label: "Live", tone: "is-live" };
}

// The top of a tournament's page (under its PageHeader): cover image, a
// floating card with the logo, name, status, dates and
// place straddling its bottom edge. The rest of the details are on the
// Info tab (TournamentInfo). Tournaments without a banner or logo get stock
// art (tournamentArt.ts).
export function TournamentBanner({ tournament: t }: { tournament: CricketTournament }) {
  const place = [t.ground, t.city].filter(Boolean).join(", ");
  const dates = t.startDate
    ? `${shortDate(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ` – ${shortDate(t.endDate)}` : ""}`
    : null;
  const phase = phaseOf(t);

  return (
    <div className="cricket-th">
      <div className="cricket-th-cover" style={{ backgroundImage: `url(${bannerFor(t)})` }} />

      {/* Floating card straddling the cover's bottom edge. */}
      <div className="cricket-th-identity">
        <span className="cricket-tour-logo" style={{ backgroundImage: `url(${logoFor(t)})` }} aria-hidden="true" />
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
