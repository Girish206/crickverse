import { useState } from "react";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import SelectInput from "../../dms/components/SelectInput";
import { usePlayerNames } from "../matches/matchUtils";
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
} from "../stats";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

interface Board {
  title: string;
  icon: string;
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
    rank: (rows) => rows.filter((s) => s.impact > 0).sort((a, b) => b.impact - a.impact || b.playerOfMatch - a.playerOfMatch),
    value: (s) => points(s.impact),
    detail: (s) => `${impactPerMatch(s)} pts/match · ${s.runs} runs · ${s.wickets} wkts`,
  },
  {
    title: "Best Batter",
    icon: "fa-baseball-bat-ball",
    rank: (rows) =>
      rows.filter((s) => s.runs > 0).sort((a, b) => b.battingImpact - a.battingImpact || b.runs - a.runs),
    value: (s) => points(s.battingImpact),
    detail: (s) => `${s.runs} runs · avg ${battingAverage(s)} · SR ${strikeRate(s.runs, s.ballsFaced)}`,
  },
  {
    title: "Best Bowler",
    icon: "fa-baseball",
    rank: (rows) =>
      rows.filter((s) => s.ballsBowled > 0).sort((a, b) => b.bowlingImpact - a.bowlingImpact || b.wickets - a.wickets),
    value: (s) => points(s.bowlingImpact),
    detail: (s) => `${s.wickets} wkts · econ ${rate(s.runsConceded, s.ballsBowled)} · best ${bestBowling(s)}`,
  },
  {
    title: "Best Fielder",
    icon: "fa-hands",
    rank: (rows) =>
      rows.filter((s) => dismissals(s) > 0).sort((a, b) => b.fieldingImpact - a.fieldingImpact || dismissals(b) - dismissals(a)),
    value: (s) => points(s.fieldingImpact),
    detail: (s) => `${s.catches} ct · ${s.stumpings} st · ${s.runOuts} ro`,
  },
  {
    title: "Most Runs",
    icon: "fa-person-running",
    rank: (rows) => rows.filter((s) => s.runs > 0).sort((a, b) => b.runs - a.runs || a.ballsFaced - b.ballsFaced),
    value: (s) => s.runs,
    detail: (s) => `${s.innings} inns · avg ${battingAverage(s)} · SR ${strikeRate(s.runs, s.ballsFaced)}`,
  },
  {
    title: "Most Wickets",
    icon: "fa-crosshairs",
    rank: (rows) => rows.filter((s) => s.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded),
    value: (s) => s.wickets,
    detail: (s) => `best ${bestBowling(s)} · econ ${rate(s.runsConceded, s.ballsBowled)}`,
  },
  {
    title: "Highest Score",
    icon: "fa-arrow-trend-up",
    rank: (rows) => rows.filter((s) => s.innings > 0).sort((a, b) => b.highest - a.highest),
    value: (s) => `${s.highest}${s.highestNotOut ? "*" : ""}`,
    detail: (s) => `${s.fifties} fifties · ${s.hundreds} hundreds`,
  },
  {
    title: "Best Bowling",
    icon: "fa-bullseye",
    rank: (rows) =>
      rows.filter((s) => s.bestWickets > 0).sort((a, b) => b.bestWickets - a.bestWickets || a.bestRuns - b.bestRuns),
    value: (s) => bestBowling(s),
    detail: (s) => `${s.wickets} wkts in ${s.bowlingInnings} inns`,
  },
  {
    title: "Most Sixes",
    icon: "fa-6",
    rank: (rows) => rows.filter((s) => s.sixes > 0).sort((a, b) => b.sixes - a.sixes),
    value: (s) => s.sixes,
    detail: (s) => `${s.runs} runs`,
  },
  {
    title: "Most Fours",
    icon: "fa-4",
    rank: (rows) => rows.filter((s) => s.fours > 0).sort((a, b) => b.fours - a.fours),
    value: (s) => s.fours,
    detail: (s) => `${s.runs} runs`,
  },
  {
    title: "Best Strike Rate",
    icon: "fa-bolt",
    // At least 10 balls faced.
    rank: (rows) =>
      rows.filter((s) => s.ballsFaced >= 10).sort((a, b) => b.runs / b.ballsFaced - a.runs / a.ballsFaced),
    value: (s) => strikeRate(s.runs, s.ballsFaced),
    detail: (s) => `${s.runs} off ${s.ballsFaced} (min 10 balls)`,
  },
  {
    title: "Best Economy",
    icon: "fa-shield-halved",
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
    rank: (rows) => rows.filter((s) => s.catches > 0).sort((a, b) => b.catches - a.catches),
    value: (s) => s.catches,
    detail: (s) => `${s.stumpings} stumpings · ${s.runOuts} run-outs`,
  },
  {
    title: "Player of the Match",
    icon: "fa-medal",
    rank: (rows) => rows.filter((s) => s.playerOfMatch > 0).sort((a, b) => b.playerOfMatch - a.playerOfMatch),
    value: (s) => s.playerOfMatch,
    detail: (s) => `in ${s.matches} matches`,
  },
];

// Leaderboard cards (top 5 each) over the given matches; `only` limits it
// to some boards by title.
export function LeaderboardGrid({
  matches,
  limit = 5,
  only,
}: {
  matches: CricketMatch[];
  limit?: number;
  only?: string[];
}) {
  const nameOf = usePlayerNames();
  const rows = [...playerStats(matches).values()];
  if (!matches.some((match) => match.innings.some((innings) => innings.balls.length > 0))) {
    return <div className="admin-empty-state">Stats appear once matches are scored.</div>;
  }
  // The #1 of the headline boards, shown as award cards above the full grid.
  const headline = only
    ? []
    : [
        { title: "Player of the tournament", board: BOARDS[0], featured: true },
        { title: "Best batter", board: BOARDS[1] },
        { title: "Best bowler", board: BOARDS[2] },
        { title: "Best fielder", board: BOARDS[3] },
      ]
        .map((award) => ({ ...award, top: award.board.rank(rows)[0] }))
        .filter((award) => award.top);
  return (
    <>
      {headline.length > 0 && (
        <div className="cricket-award-grid cricket-tour-awards">
          {headline.map((award) => (
            <div key={award.title} className={`cricket-award ${award.featured ? "is-featured" : ""}`}>
              <span className="cricket-award-title">
                <i className={`fa-solid ${award.board.icon}`} aria-hidden="true"></i> {award.title}
              </span>
              <strong className="cricket-award-name">{nameOf(award.top.playerId)}</strong>
              <span className="cricket-award-line">{award.board.detail(award.top)}</span>
              <span className="cricket-award-points">{award.board.value(award.top)} pts</span>
            </div>
          ))}
        </div>
      )}
      <LeaderboardCards rows={rows} limit={limit} only={only} />
    </>
  );
}

function LeaderboardCards({ rows, limit, only }: { rows: PlayerStats[]; limit: number; only?: string[] }) {
  const nameOf = usePlayerNames();
  return (
    <div className="cricket-board-grid">
      {BOARDS.filter((board) => !only || only.includes(board.title)).map((board) => {
        const ranked = board.rank(rows).slice(0, limit);
        return (
          <section className="cricket-panel" key={board.title}>
            <h2 className="cricket-section-title">
              <i className={`fa-solid ${board.icon}`} aria-hidden="true"></i> {board.title}
            </h2>
            {ranked.length === 0 ? (
              <p className="admin-hint mb-0">No one yet.</p>
            ) : (
              <ol className="cricket-board-list">
                {ranked.map((s, index) => (
                  <li key={s.playerId}>
                    <span className="cricket-board-rank">{index + 1}</span>
                    <span className="cricket-board-name">
                      <strong>{nameOf(s.playerId)}</strong>
                      <small>{board.detail(s)}</small>
                    </span>
                    <span className="cricket-board-value">{board.value(s)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function PointsTable({ tournament, matches }: { tournament: CricketTournament; matches: CricketMatch[] }) {
  const rows = pointsTable(tournament, matches);
  return (
    <div className="admin-table-wrap">
      <table className="admin-table cricket-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
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
            <tr key={row.teamIndex}>
              <td>{index + 1}</td>
              <td className="fw-semibold">{row.name}</td>
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
      <p className="admin-hint mt-2 mb-0">Win 2 points, tie or no result 1. NRR counts an all-out side as facing its full overs.</p>
    </div>
  );
}

export function CricketLeaderboardPage() {
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const { data: matches, isLoading } = useCricketMatches(tournamentId ?? undefined);
  const { data: tournaments } = useCricketTournaments();
  return (
    <ListCard title="Leaderboard">
      <div className="cricket-filter-select">
        <SelectInput
          label="Tournament (all if empty)"
          size="sm"
          options={(tournaments ?? []).map((t) => ({ value: t.id, label: t.name }))}
          value={tournamentId ?? ""}
          onChange={(value) => setTournamentId(value || null)}
        />
      </div>
      {isLoading ? <p>Loading...</p> : <LeaderboardGrid matches={matches ?? []} />}
    </ListCard>
  );
}
