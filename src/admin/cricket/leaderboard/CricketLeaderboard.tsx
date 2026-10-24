import { useState } from "react";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import SelectInput from "../../dms/components/SelectInput";
import { usePlayerNames, usePlayerPhotos } from "../matches/matchUtils";
import { AwardCard } from "../matches/AwardCard";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { PillSelect } from "../PillSelect";
import {
  battingAverage,
  bestBowling,
  impactPerMatch,
  playerStats,
  points,
  pointsTable,
  rate,
  strikeRate,
  type PlayerStats,
  type PointsRow,
} from "../stats";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

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
      rows.filter((s) => dismissals(s) > 0).sort((a, b) => b.fieldingImpact - a.fieldingImpact || dismissals(b) - dismissals(a)),
    value: (s) => points(s.fieldingImpact),
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
    { title: "Best fielder", board: board("Best Fielder"), label: "Pts" },
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
      <StatsBoards rows={rows} />
    </>
  );
}

// Category tabs, a dropdown of that category's boards, and the chosen
// board's top ten.
function StatsBoards({ rows }: { rows: PlayerStats[] }) {
  const [category, setCategory] = useState<Category>("overall");
  const [title, setTitle] = useState(BOARDS[0].title);
  const boards = BOARDS.filter((board) => board.category === category);
  const board = boards.find((b) => b.title === title) ?? boards[0];
  return (
    <section className="cricket-stats">
      <div className="admin-segmented cricket-tabs cricket-stats-tabs" role="tablist" aria-label="Stat category">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={category === c.value}
            className={category === c.value ? "active" : ""}
            onClick={() => {
              setCategory(c.value);
              setTitle(BOARDS.find((b) => b.category === c.value)!.title);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
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
      <BoardList board={board} rows={rows} limit={10} />
    </section>
  );
}

function BoardList({ board, rows, limit }: { board: Board; rows: PlayerStats[]; limit: number }) {
  const nameOf = usePlayerNames();
  const photoOf = usePlayerPhotos();
  const ranked = board.rank(rows).slice(0, limit);
  if (ranked.length === 0) return <p className="admin-hint mb-0">No one yet.</p>;
  return (
    <ol className="cricket-board-list">
      {ranked.map((s, index) => {
        const name = nameOf(s.playerId);
        return (
          <li key={s.playerId} className={index < 3 ? `is-podium is-rank-${index + 1}` : ""}>
            <span className="cricket-board-rank">{index + 1}</span>
            <PlayerAvatar name={name} photoUrl={photoOf(s.playerId)} className="cricket-board-avatar" />
            <span className="cricket-board-name">
              <strong>
                <PlayerLink playerId={s.playerId}>{name}</PlayerLink>
              </strong>
              <small>{board.detail(s)}</small>
            </span>
            <span className="cricket-board-value">{board.value(s)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function PointsTable({ tournament, matches }: { tournament: CricketTournament; matches: CricketMatch[] }) {
  return (
    <div className="cricket-standings">
      <StandingsTable rows={pointsTable(tournament, matches)} />
      <p className="admin-hint mt-2 mb-0">Win 2 points, tie or no result 1. NRR counts an all-out side as facing its full overs.</p>
    </div>
  );
}

// One table of standings. With `qualify`, a line marks the cut and the
// teams above it get a Q once `settled` (every match played).
export function StandingsTable({ rows, qualify = 0, settled = false }: { rows: PointsRow[]; qualify?: number; settled?: boolean }) {
  return (
    <div className="cricket-standings-scroll">
      <table className="cricket-standings-table">
        <thead>
          <tr>
            <th className="is-rank">#</th>
            <th className="is-team">Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>NR</th>
            <th>Pts</th>
            <th>NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teamIndex} className={qualify > 0 && index === qualify - 1 && index < rows.length - 1 ? "is-cut" : undefined}>
              <td className="is-rank">{index + 1}</td>
              <td className="is-team fw-semibold">
                <span className="cricket-standings-name" title={row.name}>
                  {row.name}
                  {settled && index < qualify && <span className="cricket-q-tag" title="Qualified">Q</span>}
                </span>
              </td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>{row.tied}</td>
              <td>{row.noResult}</td>
              <td className="fw-bold">{row.points}</td>
              <td>{(row.nrr >= 0 ? "+" : "") + row.nrr.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CricketLeaderboardPage() {
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const { data: matches, isLoading } = useCricketMatches(tournamentId ?? undefined);
  const { data: tournaments } = useCricketTournaments();
  return (
    <ListCard
      title="Leaderboard"
      icon="fa-solid fa-ranking-star"
      subtitle="Top run-scorers, wicket-takers and award winners"
    >
      <div className="cricket-filter-select">
        <SelectInput
          label="Tournament (all if empty)"
          size="sm"
          options={(tournaments ?? []).map((t) => ({ value: t.id, label: t.name }))}
          value={tournamentId ?? ""}
          onChange={(value) => setTournamentId(value || null)}
        />
      </div>
      {isLoading ? <Loader /> : <LeaderboardGrid matches={matches ?? []} />}
    </ListCard>
  );
}
