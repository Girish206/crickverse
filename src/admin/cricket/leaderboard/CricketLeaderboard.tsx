import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketTeam, CricketTournament } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { usePlayerNames, usePlayerPhotos } from "../matches/matchUtils";
import { AwardCard } from "../matches/AwardCard";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { PillSelect } from "../PillSelect";
import { MvpPointsHelp } from "../matches/MvpPointsGuide";
import { NrrGuide } from "./NrrGuide";
import { BALL_TYPES, MATCH_TYPES } from "../cricketOptions";
import {
  battingAverage,
  bestBowling,
  countsForTable,
  impactPerMatch,
  oversText,
  playerMatchLines,
  playerStats,
  points,
  pointsTable,
  rate,
  strikeRate,
  teamMatchLines,
  type ImpactRow,
  type PlayerStats,
  type PointsRow,
} from "../stats";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";
import { TeamMark } from "../teams/TeamMark";
import { useSwipeTabs } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";

type Category = "overall" | "batting" | "bowling" | "fielding";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "batting", label: "Batting" },
  { value: "bowling", label: "Bowling" },
  { value: "fielding", label: "Fielding" },
];

interface Board {
  title: string;
  icon: string;
  category: Category;
  // Who qualifies, best first.
  rank: (rows: PlayerStats[]) => PlayerStats[];
  value: (s: PlayerStats) => string | number;
  detail: (s: PlayerStats) => string;
}

const dismissals = (s: PlayerStats) => s.catches + s.stumpings + s.runOuts;

const BOARDS: Board[] = [
  {
    title: "MVP",
    icon: "fa-star",
    category: "overall",
    rank: (rows) => rows.filter((s) => s.impact > 0).sort((a, b) => b.impact - a.impact || b.playerOfMatch - a.playerOfMatch),
    value: (s) => points(s.impact),
    detail: (s) => `${impactPerMatch(s)} pts/match · ${s.runs} runs · ${s.wickets} wkts`,
  },
  {
    title: "Best Fielder",
    icon: "fa-hands",
    category: "fielding",
    rank: (rows) =>
      rows.filter((s) => dismissals(s) > 0).sort((a, b) => dismissals(b) - dismissals(a) || b.fieldingImpact - a.fieldingImpact),
    value: (s) => dismissals(s),
    detail: (s) => `${s.catches} ct · ${s.stumpings} st · ${s.runOuts} ro`,
  },
  {
    title: "Most Runs",
    icon: "fa-person-running",
    category: "batting",
    rank: (rows) => rows.filter((s) => s.runs > 0).sort((a, b) => b.runs - a.runs || a.ballsFaced - b.ballsFaced),
    value: (s) => s.runs,
    detail: (s) => `${s.innings} inns · avg ${battingAverage(s)} · SR ${strikeRate(s.runs, s.ballsFaced)}`,
  },
  {
    title: "Most Wickets",
    icon: "fa-crosshairs",
    category: "bowling",
    rank: (rows) => rows.filter((s) => s.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded),
    value: (s) => s.wickets,
    detail: (s) => `best ${bestBowling(s)} · econ ${rate(s.runsConceded, s.ballsBowled)}`,
  },
  {
    title: "Highest Score",
    icon: "fa-arrow-trend-up",
    category: "batting",
    rank: (rows) => rows.filter((s) => s.innings > 0).sort((a, b) => b.highest - a.highest),
    value: (s) => `${s.highest}${s.highestNotOut ? "*" : ""}`,
    detail: (s) => `${s.fifties} fifties · ${s.hundreds} hundreds`,
  },
  {
    title: "Best Bowling",
    icon: "fa-bullseye",
    category: "bowling",
    rank: (rows) =>
      rows.filter((s) => s.bestWickets > 0).sort((a, b) => b.bestWickets - a.bestWickets || a.bestRuns - b.bestRuns),
    value: (s) => bestBowling(s),
    detail: (s) => `${s.wickets} wkts in ${s.bowlingInnings} inns`,
  },
  {
    title: "Most Sixes",
    icon: "fa-6",
    category: "batting",
    rank: (rows) => rows.filter((s) => s.sixes > 0).sort((a, b) => b.sixes - a.sixes),
    value: (s) => s.sixes,
    detail: (s) => `${s.runs} runs`,
  },
  {
    title: "Most Fours",
    icon: "fa-4",
    category: "batting",
    rank: (rows) => rows.filter((s) => s.fours > 0).sort((a, b) => b.fours - a.fours),
    value: (s) => s.fours,
    detail: (s) => `${s.runs} runs`,
  },
  {
    title: "Best Strike Rate",
    icon: "fa-bolt",
    category: "batting",
    // At least 10 balls faced.
    rank: (rows) =>
      rows.filter((s) => s.ballsFaced >= 10).sort((a, b) => b.runs / b.ballsFaced - a.runs / a.ballsFaced),
    value: (s) => strikeRate(s.runs, s.ballsFaced),
    detail: (s) => `${s.runs} off ${s.ballsFaced} (min 10 balls)`,
  },
  {
    title: "Best Economy",
    icon: "fa-shield-halved",
    category: "bowling",
    // At least 2 overs bowled.
    rank: (rows) =>
      rows
        .filter((s) => s.ballsBowled >= 12)
        .sort((a, b) => a.runsConceded / a.ballsBowled - b.runsConceded / b.ballsBowled),
    value: (s) => rate(s.runsConceded, s.ballsBowled),
    detail: (s) => `${s.runsConceded} runs in ${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6} ov (min 2)`,
  },
  {
    title: "Most Catches",
    icon: "fa-hand",
    category: "fielding",
    rank: (rows) => rows.filter((s) => s.catches > 0).sort((a, b) => b.catches - a.catches),
    value: (s) => s.catches,
    detail: (s) => `${s.stumpings} stumpings · ${s.runOuts} run-outs`,
  },
  {
    title: "Player of the Match",
    icon: "fa-medal",
    category: "overall",
    rank: (rows) => rows.filter((s) => s.playerOfMatch > 0).sort((a, b) => b.playerOfMatch - a.playerOfMatch),
    value: (s) => s.playerOfMatch,
    detail: (s) => `in ${s.matches} matches`,
  },
];

// Tournament (or all-time) stats over the given matches: award cards for the
// headline boards, then one board at a time picked by category tab and
// dropdown. `only` instead shows those boards side by side as compact cards
// (the dashboard). `playerIds` narrows it to those players (a team's page),
// with `scope` naming whose heroes they are.
export function LeaderboardGrid({
  matches,
  limit = 5,
  only,
  playerIds,
  scope = "tournament",
}: {
  matches: CricketMatch[];
  limit?: number;
  only?: string[];
  playerIds?: number[];
  scope?: string;
}) {
  const nameOf = usePlayerNames();
  const photoOf = usePlayerPhotos();
  const rows = [...playerStats(matches).values()].filter((row) => !playerIds || playerIds.includes(row.playerId));
  if (!matches.some((match) => match.innings.some((innings) => innings.balls.length > 0))) {
    return <div className="admin-empty-state">Stats appear once matches are scored.</div>;
  }
  if (only) {
    return (
      <div className="cricket-board-grid">
        {BOARDS.filter((board) => only.includes(board.title)).map((board) => (
          <section className="cricket-panel" key={board.title}>
            <h2 className="cricket-section-title">
              <i className={`fa-solid ${board.icon}`} aria-hidden="true"></i> {board.title}
            </h2>
            <BoardList board={board} rows={rows} limit={limit} />
          </section>
        ))}
      </div>
    );
  }
  // The #1 of the headline boards, shown as award cards above the boards.
  const board = (title: string) => BOARDS.find((b) => b.title === title)!;
  const headline = [
    { title: `Player of the ${scope}`, board: board("MVP"), label: "MVP", featured: true },
    { title: "Top run scorer", board: board("Most Runs"), label: "Runs" },
    { title: "Top wicket taker", board: board("Most Wickets"), label: "Wkts" },
    { title: "Best fielder", board: board("Best Fielder"), label: "Dis" },
  ]
    .map((award) => ({ ...award, top: award.board.rank(rows)[0] }))
    .filter((award) => award.top);
  return (
    <>
      {headline.length > 0 && (
        <section className="cricket-awards cricket-tour-awards">
          <h2 className="cricket-section-title">
            <i className="fa-solid fa-award" aria-hidden="true"></i> Heroes of the {scope}
          </h2>
          <div className="cricket-award-grid">
            {headline.map((award) => (
              <AwardCard
                key={award.title}
                title={award.title}
                icon={award.board.icon}
                playerId={award.top.playerId}
                name={nameOf(award.top.playerId)}
                photoUrl={photoOf(award.top.playerId)}
                line={award.board.detail(award.top)}
                pointsLabel={award.label}
                points={award.board.value(award.top)}
                featured={award.featured}
              />
            ))}
          </div>
        </section>
      )}
      <StatsBoards rows={rows} matches={matches} />
    </>
  );
}

// Category tabs, a dropdown of that category's boards, and the chosen
// board's top ten.
function StatsBoards({ rows, matches }: { rows: PlayerStats[]; matches: CricketMatch[] }) {
  const [category, setCategory] = useState<Category>("overall");
  const [title, setTitle] = useState(BOARDS[0].title);
  const pickCategory = (value: Category) => {
    setCategory(value);
    setTitle(BOARDS.find((b) => b.category === value)!.title);
  };
  // Swipes on the boards change category; elsewhere they're the page's.
  const swipeRef = useSwipeTabs(CATEGORIES.map((c) => c.value), category, pickCategory, ".cricket-stats");
  return (
    <section className="cricket-stats">
      <div ref={swipeRef} className="admin-segmented cricket-tabs cricket-stats-tabs" role="tablist" aria-label="Stat category">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={category === c.value}
            className={category === c.value ? "active" : ""}
            onClick={() => pickCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <SwipePanels swipe={swipeRef} values={CATEGORIES.map((c) => c.value)} current={category}>
        {(category) => {
          // A category swiped in shows its first board.
          const boards = BOARDS.filter((board) => board.category === category);
          const board = boards.find((b) => b.title === title) ?? boards[0];
          return (
            <>
              <div className="cricket-stats-head">
                <h2 className="cricket-section-title mb-0">
                  <i className={`fa-solid ${board.icon}`} aria-hidden="true"></i> {board.title}
                </h2>
                <PillSelect
                  label="Leaderboard"
                  value={board.title}
                  options={boards.map((b) => ({ value: b.title, label: b.title }))}
                  onChange={setTitle}
                />
              </div>
              {board.title === "MVP" && <MvpPointsHelp className="mb-2" />}
              <BoardList board={board} rows={rows} limit={10} matches={matches} />
            </>
          );
        }}
      </SwipePanels>
    </section>
  );
}

// Enter / Space on a row that acts as a button.
const onActivate = (action: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
};

// With `matches`, each player opens to their match-by-match figures.
function BoardList({ board, rows, limit, matches }: { board: Board; rows: PlayerStats[]; limit: number; matches?: CricketMatch[] }) {
  const nameOf = usePlayerNames();
  const photoOf = usePlayerPhotos();
  const [openId, setOpenId] = useState<number | null>(null);
  const ranked = board.rank(rows).slice(0, limit);
  if (ranked.length === 0) return <p className="admin-hint mb-0">No one yet.</p>;
  return (
    <ol className="cricket-board-list">
      {ranked.map((s, index) => {
        const name = nameOf(s.playerId);
        const open = openId === s.playerId;
        const podium = index < 3 ? `is-podium is-rank-${index + 1}` : "";
        const row = (
          <>
            <span className="cricket-board-rank">{index + 1}</span>
            <PlayerAvatar name={name} photoUrl={photoOf(s.playerId)} className="cricket-board-avatar" />
            <span className="cricket-board-name">
              <strong>
                <PlayerLink playerId={s.playerId}>{name}</PlayerLink>
              </strong>
              <small>{board.detail(s)}</small>
            </span>
            <span className="cricket-board-value">{board.value(s)}</span>
          </>
        );
        if (!matches) {
          return (
            <li key={s.playerId} className={podium}>
              {row}
            </li>
          );
        }
        const toggle = () => setOpenId(open ? null : s.playerId);
        return (
          <li key={s.playerId} className={`${podium} is-expandable ${open ? "is-open" : ""}`}>
            <div className="cricket-board-row" role="button" tabIndex={0} aria-expanded={open} onClick={toggle} onKeyDown={onActivate(toggle)}>
              {row}
              <i className="fa-solid fa-chevron-down cricket-expand-icon" aria-hidden="true"></i>
            </div>
            {open && <PlayerMatches playerId={s.playerId} matches={matches} category={board.category} />}
          </li>
        );
      })}
    </ol>
  );
}

const dismissalsIn = (row: ImpactRow) => row.catches + row.stumpings + row.runOuts;

const SHOWS: Record<Category, (row: ImpactRow) => boolean> = {
  overall: () => true,
  batting: (row) => row.bat !== null,
  bowling: (row) => row.bowl !== null && row.bowl.legalBalls > 0,
  fielding: (row) => dismissalsIn(row) > 0,
};

const fieldingText = (row: ImpactRow) =>
  [
    row.catches && `${row.catches} ct`,
    row.stumpings && `${row.stumpings} st`,
    row.runOuts && `${row.runOuts} ro`,
  ]
    .filter(Boolean)
    .join(" · ");

// A match's figures for the board's category: "54* (32)", "3/18 (4.0)",
// "2 ct · 1 ro", or MVP points overall.
function figure(row: ImpactRow, category: Category) {
  if (category === "batting" && row.bat) return `${row.bat.runs}${row.bat.out ? "" : "*"} (${row.bat.balls})`;
  if (category === "bowling" && row.bowl) return `${row.bowl.wickets}/${row.bowl.runs} (${oversText(row.bowl.legalBalls)})`;
  if (category === "fielding") return fieldingText(row);
  return `${points(row.total)} pts`;
}

const shortDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;

// One player's figures in each match, for the board they were opened from.
function PlayerMatches({ playerId, matches, category }: { playerId: number; matches: CricketMatch[]; category: Category }) {
  const lines = playerMatchLines(matches, playerId).filter(({ row }) => SHOWS[category](row));
  if (lines.length === 0) return <p className="cricket-perf-empty">Nothing to show yet.</p>;
  return (
    <ul className="cricket-perf-list">
      {lines.map(({ match, row }) => (
        <li key={match.id}>
          <Link to={`/matches/${match.id}`} className="cricket-perf-item cricket-team-result">
            <span className="cricket-team-result-date">{shortDate(match.scheduledAt) ?? "–"}</span>
            <span className="cricket-team-result-team">
vs {match.teams[1 - row.team].name}</span>
            <span className="cricket-team-result-outcome cricket-perf-figure-text">{figure(row, category)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PointsTable({ tournament, matches }: { tournament: CricketTournament; matches: CricketMatch[] }) {
  return (
    <div className="cricket-standings">
      <StandingsTable
        rows={pointsTable(tournament, matches)}
        teams={tournament.teams}
        matches={matches.filter(countsForTable)}
        note={<p className="admin-hint mt-2 mb-0">Win 2 points, tie or no result 1. NRR follows the ICC rules.</p>}
      />
    </div>
  );
}

// One table of standings. With `qualify`, a line marks the cut and the
// teams above it get a Q once `settled` (every match played). With
// `matches` (the ones the table counts), each team opens to its results.
export function StandingsTable({
  rows,
  teams,
  qualify = 0,
  settled = false,
  matches,
  note,
  nrrHelp = true,
}: {
  rows: PointsRow[];
  // The tournament's teams, for their logos.
  teams?: CricketTeam[];
  qualify?: number;
  settled?: boolean;
  matches?: CricketMatch[];
  // A line right under the table (e.g. matches played), above the NRR help.
  note?: ReactNode;
  // The "How NRR is worked out" link under it (off where the page has its own).
  nrrHelp?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const inTable = new Set(rows.map((row) => row.teamIndex));
  const own = (matches ?? []).filter((match) => match.teams.every((team) => inTable.has(team.teamIndex)));
  // T / NR columns with nothing in them yet are left out on phones.
  const tiedClass = rows.some((row) => row.tied > 0) ? undefined : "is-optional";
  const noResultClass = rows.some((row) => row.noResult > 0) ? undefined : "is-optional";
  return (
    <>
    <div className="cricket-standings-scroll">
      <table className="cricket-standings-table">
        <thead>
          <tr>
            <th className="is-rank">#</th>
            <th className="is-team">Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th className={tiedClass}>T</th>
            <th className={noResultClass}>NR</th>
            <th className="is-points">Pts</th>
            <th>NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row, index) => {
            const open = openIndex === row.teamIndex;
            const toggle = () => setOpenIndex(open ? null : row.teamIndex);
            const classes = [
              qualify > 0 && index === qualify - 1 && index < rows.length - 1 ? "is-cut" : "",
              matches ? "is-expandable" : "",
              open ? "is-open" : "",
            ].filter(Boolean);
            const cells = (
              <tr
                key={row.teamIndex}
                className={classes.join(" ") || undefined}
                {...(matches && { role: "button", tabIndex: 0, "aria-expanded": open, onClick: toggle, onKeyDown: onActivate(toggle) })}
              >
                <td className="is-rank">
                  <span className="cricket-standings-rank">{index + 1}</span>
                </td>
                <td className="is-team fw-semibold">
                  <span className="cricket-standings-name" title={row.name}>
                    <TeamMark className="cricket-standings-logo" name={row.name} logoUrl={teams?.[row.teamIndex]?.logoUrl} />
                    <span className="cricket-standings-label">{row.name}</span>
                    {settled && index < qualify && <span className="cricket-q-tag" title="Qualified">Q</span>}
                    {matches && <i className="fa-solid fa-chevron-down cricket-expand-icon" aria-hidden="true"></i>}
                  </span>
                </td>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.lost}</td>
                <td className={tiedClass}>{row.tied}</td>
                <td className={noResultClass}>{row.noResult}</td>
                <td className="is-points">{row.points}</td>
                <td className={row.nrr > 0 ? "is-up" : row.nrr < 0 ? "is-down" : undefined}>
                  {(row.nrr >= 0 ? "+" : "") + row.nrr.toFixed(3)}
                </td>
              </tr>
            );
            if (!open) return [cells];
            return [
              cells,
              <tr key={`${row.teamIndex}-results`} className="cricket-standings-detail">
                <td colSpan={9}>
                  <TeamResults teamIndex={row.teamIndex} matches={own} />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
    {note}
    {matches && nrrHelp && <NrrGuide rows={rows} matches={own} />}
    </>
  );
}

// How a match went for one side, from the result text ("Royal Warriors
// won by 6 wickets" → "Won by 6 wickets" / "Lost by 6 wickets").
function resultFor(match: CricketMatch, outcome: "won" | "lost" | "tied" | "nr" | null) {
  if (outcome === null) return match.status === "live" ? "Live" : "Upcoming";
  if (outcome === "nr") return "No result";
  if (outcome === "tied") return "Tied";
  const margin = match.resultText?.match(/ won (by .+)$/i)?.[1];
  const verb = outcome === "won" ? "Won" : "Lost";
  return margin ? `${verb} ${margin}` : verb;
}

// A team's matches in a table, one line each: when, against whom and how
// it went; each opens the match.
function TeamResults({ teamIndex, matches }: { teamIndex: number; matches: CricketMatch[] }) {
  const lines = teamMatchLines(matches, teamIndex);
  if (lines.length === 0) return <p className="cricket-perf-empty">No matches yet.</p>;
  return (
    <ul className="cricket-perf-list">
      {lines.map(({ match, opponent, outcome }) => (
        <li key={match.id}>
          <Link to={`/matches/${match.id}`} className="cricket-perf-item cricket-team-result">
            <span className="cricket-team-result-date">{shortDate(match.scheduledAt) ?? "–"}</span>
            <span className="cricket-team-result-team">vs {opponent.name}</span>
            <span className={`cricket-team-result-outcome is-${outcome ?? match.status}`}>{resultFor(match, outcome)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The year a match was played (its start, else when it was made).
const yearOf = (match: CricketMatch) => (match.scheduledAt ?? match.createdAt).slice(0, 4);

// Open to every signed-in player: the API returns the matches each may view.
// Narrowed by tournament (asked of the API) and by season, ball type and
// match type (from the matches themselves).
export function CricketLeaderboardPage() {
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [year, setYear] = useState("");
  const [ballType, setBallType] = useState("");
  const [matchType, setMatchType] = useState("");
  const { data: matches, isLoading } = useCricketMatches(tournamentId ?? undefined);
  const { data: tournaments } = useCricketTournaments();
  const all = matches ?? [];
  const years = [...new Set(all.map(yearOf))].sort().reverse();
  const shown = all.filter(
    (m) => (!year || yearOf(m) === year) && (!ballType || m.ballType === ballType) && (!matchType || m.matchType === matchType),
  );
  return (
    <ListCard
      title="Leaderboard"
      icon="fa-solid fa-ranking-star"
      subtitle="Top run-scorers, wicket-takers and award winners"
    >
      {/* Pills, as on My Matches; each one's first option clears it. */}
      <div className="cricket-leaderboard-filters">
        <PillSelect
          label="Tournament"
          value={tournamentId === null ? "" : String(tournamentId)}
          options={[
            { value: "", label: "All tournaments" },
            ...(tournaments ?? []).map((t) => ({ value: String(t.id), label: t.name })),
          ]}
          onChange={(value) => setTournamentId(value ? Number(value) : null)}
        />
        <PillSelect
          label="Season"
          value={year}
          options={[{ value: "", label: "All seasons" }, ...years.map((y) => ({ value: y, label: y }))]}
          onChange={setYear}
        />
        <PillSelect
          label="Ball type"
          value={ballType}
          options={[{ value: "", label: "Any ball" }, ...BALL_TYPES.map((b) => ({ value: b.value, label: `${b.label} ball` }))]}
          onChange={setBallType}
        />
        <PillSelect
          label="Match type"
          value={matchType}
          options={[{ value: "", label: "All formats" }, ...MATCH_TYPES.map((m) => ({ value: m.value, label: m.label }))]}
          onChange={setMatchType}
        />
      </div>
      {isLoading ? <Loader /> : <LeaderboardGrid matches={shown} />}
    </ListCard>
  );
}
