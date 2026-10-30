import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { championOf, makeResolver } from "../format/formatEngine";
import { bannerFor } from "./tournamentArt";
import { TournamentLogo } from "./TournamentLogo";
import { TeamMark } from "../teams/TeamMark";
import { useSwipeTabs } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";

export type TournamentPhase = "setup" | "upcoming" | "ongoing" | "completed";

const PHASE_LABELS: Record<TournamentPhase, string> = {
  setup: "Setting up",
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
};

// Generated or built by hand: at least two teams, each with players.
export const teamsReady = (t: CricketTournament) =>
  t.teams.length >= 2 && t.teams.every((team) => team.playerIds.length > 0);

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Whether its format has a champion yet, from whatever of its matches are
// at hand (other tournaments' are left out). Unless they're all of them
// (`every`, as on its own page), only a final or a series is trusted: a
// league's table needs every match, and a list may hold just some.
export function hasChampion(t: CricketTournament, matches: CricketMatch[], every = false) {
  const format = t.format;
  if (!format || format.phases.length === 0) return false;
  if (!every && format.phases[format.phases.length - 1].kind === "round-robin") return false;
  const own = matches.filter((m) => m.tournamentId === t.id);
  if (own.length === 0) return false;
  return championOf(format, own, makeResolver(t, format, own)) !== null;
}

// Completed once the organiser marks it finished or its champion is
// decided; otherwise setting up until the teams are ready, then from its
// dates.
export function tournamentPhase(t: CricketTournament, matches?: CricketMatch[]): TournamentPhase {
  if (t.finishedAt) return "completed";
  if (matches && hasChampion(t, matches)) return "completed";
  if (!teamsReady(t)) return "setup";
  const today = todayIso();
  if (t.endDate && t.endDate.slice(0, 10) < today) return "completed";
  if (t.startDate && t.startDate.slice(0, 10) > today) return "upcoming";
  return "ongoing";
}

// "12 – 20 Oct 2026", "28 Oct – 3 Nov 2026", or one day / one end of it.
function dateRange(start: string | null, end: string | null) {
  const fmt = (value: string, parts: Intl.DateTimeFormatOptions) => new Date(value).toLocaleDateString(undefined, parts);
  const full = { day: "numeric", month: "short", year: "numeric" } as const;
  if (start && end) {
    const [from, to] = [start.slice(0, 10), end.slice(0, 10)];
    if (from === to) return fmt(start, full);
    if (from.slice(0, 7) === to.slice(0, 7)) return `${fmt(start, { day: "numeric" })} – ${fmt(end, full)}`;
    if (from.slice(0, 4) === to.slice(0, 4)) return `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, full)}`;
    return `${fmt(start, full)} – ${fmt(end, full)}`;
  }
  if (start) return `From ${fmt(start, full)}`;
  if (end) return `Till ${fmt(end, full)}`;
  return "Dates not set";
}

// Ground and city, once each ("Oval, Oval" → "Oval").
function placeOf(t: CricketTournament) {
  const parts = [t.ground, t.city].map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i).join(", ");
}

// The viewer's team in a tournament, for the card's bottom strip.
export function TeamFootnote({ team }: { team: { name: string; logoUrl?: string | null } | null }) {
  if (!team) {
    return (
      <span className="cricket-tour-card-team is-pending">
        <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i>
        Teams not picked yet
      </span>
    );
  }
  return (
    <span className="cricket-tour-card-team">
      <TeamMark className="cricket-tour-card-team-dot" name={team.name} logoUrl={team.logoUrl} />
      <span className="cricket-tour-card-team-text">
        <small>Your team</small>
        <strong>{team.name}</strong>
      </span>
    </span>
  );
}

// The tournament card used on every tournament list; opens the tournament.
export function TournamentCard({
  tournament,
  matchCount,
  actions,
  footnote,
  matches,
}: {
  tournament: CricketTournament;
  matchCount?: number;
  // Its matches (others' are ignored), so a decided champion shows it as
  // completed.
  matches?: CricketMatch[];
  // Edit / delete buttons, top right of the banner.
  actions?: ReactNode;
  // An extra strip at the bottom, e.g. <TeamFootnote />.
  footnote?: ReactNode;
}) {
  const navigate = useNavigate();
  const open = () => navigate(`/tournaments/${tournament.id}`);
  const phase = tournamentPhase(tournament, matches);
  const place = placeOf(tournament);
  const stats = [
    { value: tournament.teams.length, label: "Teams" },
    { value: tournament.playerIds.length, label: "Players" },
    ...(matchCount !== undefined ? [{ value: matchCount, label: "Matches" }] : []),
  ];
  return (
    <div
      className={`cricket-tour-card is-${phase}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <div className="cricket-tour-card-banner" style={{ backgroundImage: `url(${bannerFor(tournament)})` }}>
        <span className={`cricket-tour-phase is-${phase}`}>
          {phase === "ongoing" && <span className="cricket-live-dot" aria-hidden="true"></span>}
          {PHASE_LABELS[phase]}
        </span>
        {actions && <div className="cricket-tour-card-actions">{actions}</div>}
        <TournamentLogo tournament={tournament} className="cricket-tour-card-logo" />
      </div>

      <div className="cricket-tour-card-body">
        <h3 className="cricket-tour-card-name">{tournament.name}</h3>
        <div className="cricket-tour-card-meta">
          <span>
            <i className="fa-regular fa-calendar" aria-hidden="true"></i>
            {dateRange(tournament.startDate, tournament.endDate)}
          </span>
          {tournament.overs ? (
            <span>
              <i className="fa-solid fa-baseball" aria-hidden="true"></i>
              {tournament.overs} overs
            </span>
          ) : null}
          {place && (
            <span>
              <i className="fa-solid fa-location-dot" aria-hidden="true"></i>
              {place}
            </span>
          )}
        </div>

        <div className="cricket-tour-card-stats">
          {stats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <small>{stat.label}</small>
            </div>
          ))}
        </div>
      </div>

      {footnote && <div className="cricket-tour-card-note">{footnote}</div>}
    </div>
  );
}

type Filter = "all" | TournamentPhase;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "setup", label: "Setting up" },
];

// Parses a tournament name to check if it belongs to a recurring series (e.g. "KPL Season 1", "KPL Season 2")
export function parseTournamentSeries(name: string): { seriesName: string; seasonLabel: string | null } {
  const trimmed = name.trim();
  const seasonMatch = /^(.*?)(?:\s*[-–—:]\s*|\s+)(?:season|edition|s)\s*(\d+|\b20\d\d\b)\s*$/i.exec(trimmed);
  if (seasonMatch) {
    return {
      seriesName: seasonMatch[1].trim(),
      seasonLabel: `Season ${seasonMatch[2]}`,
    };
  }
  const parenMatch = /^(.*?)\s*\((?:season|edition|s)\s*(\d+|\b20\d\d\b)\)\s*$/i.exec(trimmed);
  if (parenMatch) {
    return {
      seriesName: parenMatch[1].trim(),
      seasonLabel: `Season ${parenMatch[2]}`,
    };
  }
  return { seriesName: trimmed, seasonLabel: null };
}

// When a tournament is (or was) on, for putting seasons in order.
const startOf = (t: CricketTournament) => t.startDate ?? t.createdAt;

// The series a tournament belongs to and its season: the organiser's own
// series name and season when set, else read from its name ("KPL Season 2").
// A season with no label goes by its year.
export function seriesOf(t: CricketTournament) {
  const parsed = parseTournamentSeries(t.name);
  const name = t.seriesName?.trim() || parsed.seriesName;
  const season = t.season?.trim() || (t.seriesName ? null : parsed.seasonLabel) || startOf(t).slice(0, 4);
  return { name, key: name.toLowerCase(), season };
}

// Every season of a series, newest first.
export const seasonsOf = (tournaments: CricketTournament[], key: string) =>
  tournaments.filter((t) => seriesOf(t).key === key).sort((a, b) => startOf(b).localeCompare(startOf(a)));

export const seriesPath = (name: string) => `/series/${encodeURIComponent(name)}`;

function TournamentSeriesGroup({
  group,
  renderCard,
}: {
  group: { seriesName: string; items: { tournament: CricketTournament; seasonLabel: string }[] };
  renderCard: (t: CricketTournament) => ReactNode;
}) {
  const sorted = useMemo(() => {
    return [...group.items].sort((a, b) => startOf(b.tournament).localeCompare(startOf(a.tournament)));
  }, [group.items]);

  const [activeId, setActiveId] = useState<number>(sorted[0].tournament.id);
  const activeTournament = sorted.find((item) => item.tournament.id === activeId)?.tournament ?? sorted[0].tournament;
  // Swipes on this group's card move between its seasons.
  const seasonSwipeRef = useSwipeTabs(
    sorted.map((item) => item.tournament.id),
    activeTournament.id,
    setActiveId,
    ".cricket-tour-series-group"
  );

  return (
    <div className="cricket-tour-series-group">
      <div className="cricket-tour-series-bar">
        <Link to={seriesPath(group.seriesName)} className="cricket-tour-series-title" title="All seasons and series stats">
          <i className="fa-solid fa-layer-group me-1" aria-hidden="true"></i> {group.seriesName}
          <i className="fa-solid fa-chevron-right ms-1" aria-hidden="true"></i>
        </Link>
        <div ref={seasonSwipeRef} className="cricket-tour-series-pills" role="tablist">
          {sorted.map((item) => (
            <button
              key={item.tournament.id}
              type="button"
              className={`cricket-tour-series-pill ${item.tournament.id === activeId ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(item.tournament.id);
              }}
            >
              {item.seasonLabel}
            </button>
          ))}
        </div>
      </div>
      {renderCard(activeTournament)}
    </div>
  );
}

// Phase filter + card grid, the tournament twin of MatchesBoard.
export function TournamentsBoard({
  tournaments,
  empty,
  renderCard,
  matches,
}: {
  tournaments: CricketTournament[];
  empty: ReactNode;
  renderCard: (tournament: CricketTournament) => ReactNode;
  // The matches at hand, for tournamentPhase (see TournamentCard).
  matches?: CricketMatch[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const swipeRef = useSwipeTabs(FILTERS.map((f) => f.value), filter, setFilter);
  // One list per tab, so a swipe brings the next one in beside it.
  const listFor = (filter: Filter) => {
    const visible = tournaments.filter((t) => filter === "all" || tournamentPhase(t, matches) === filter);
    const grouped = new Map<string, { seriesName: string; items: { tournament: CricketTournament; seasonLabel: string }[] }>();
    for (const t of visible) {
      const { name, key, season } = seriesOf(t);
      if (!grouped.has(key)) {
        grouped.set(key, { seriesName: name, items: [] });
      }
      grouped.get(key)!.items.push({ tournament: t, seasonLabel: season });
    }
    return visible.length === 0 ? (
      <div className="admin-empty-state">{tournaments.length === 0 ? empty : "No tournaments here."}</div>
    ) : (
      <div className="cricket-match-grid">
        {[...grouped.values()].map((group) =>
          group.items.length === 1 ? (
            renderCard(group.items[0].tournament)
          ) : (
            <TournamentSeriesGroup key={group.seriesName} group={group} renderCard={renderCard} />
          ),
        )}
      </div>
    );
  };

  return (
    <>
      <div className="cricket-squad-toolbar">
        <div ref={swipeRef} className="admin-segmented cricket-tabs cricket-text-tabs is-justified" role="tablist" aria-label="Tournament status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? "active" : ""}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <SwipePanels swipe={swipeRef} values={FILTERS.map((f) => f.value)} current={filter}>
        {listFor}
      </SwipePanels>
    </>
  );
}
