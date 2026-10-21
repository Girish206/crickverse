import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import { ListCard } from "../../components/ListCard";
import { CricketKpis } from "../CricketKpis";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { MatchCard } from "../matches/matchUi";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

const byDate = (a: string | null, b: string | null) =>
  (a ? new Date(a).getTime() : Infinity) - (b ? new Date(b).getTime() : Infinity);

export function CricketDashboard() {
  const { data: players } = useCricketPlayers();
  const { data: tournaments } = useCricketTournaments();
  const { data: matches, isLoading } = useCricketMatches();
  const all = matches ?? [];
  const tournamentNames = new Map((tournaments ?? []).map((t) => [t.id, t.name]));

  const live = all.filter((m) => m.status === "live");
  const upcoming = all.filter((m) => m.status === "scheduled").sort((a, b) => byDate(a.scheduledAt, b.scheduledAt));
  const results = all
    .filter((m) => m.status === "completed" || m.status === "abandoned")
    .sort((a, b) => byDate(b.scheduledAt ?? b.createdAt, a.scheduledAt ?? a.createdAt))
    .slice(0, 4);
  const totalRuns = all.reduce(
    (sum, m) => sum + m.innings.reduce((s, inn) => s + inn.balls.reduce((r, ball) => r + ball.runs + ball.extras, 0), 0),
    0,
  );

  const section = (title: string, link: string, content: ReactNode) => (
    <section className="cricket-dash-section">
      <div className="cricket-panel-head">
        <h2>{title}</h2>
        <Link to={link} className="admin-link">
          View all
        </Link>
      </div>
      {content}
    </section>
  );

  return (
    <div className="cricket-page">
      <ListCard title="Cricket Dashboard">
        <CricketKpis
          items={[
            { label: "Players", value: players?.length ?? 0, icon: "fa-users", tone: "total" },
            { label: "Tournaments", value: tournaments?.length ?? 0, icon: "fa-trophy", tone: "active" },
            {
              label: "Matches played",
              value: all.filter((m) => m.status === "completed").length,
              icon: "fa-flag-checkered",
              tone: "login",
            },
            { label: "Runs scored", value: totalRuns, icon: "fa-baseball-bat-ball", tone: "guest" },
          ]}
        />
        {isLoading ? (
          <p>Loading...</p>
        ) : all.length === 0 ? (
          <div className="admin-empty-state">
            No matches yet. Add <Link to="/players">players</Link>, set up a{" "}
            <Link to="/tournaments">tournament</Link> and its teams, then schedule matches.
          </div>
        ) : (
          <div className="cricket-dash-grid">
            {section(
              live.length ? `Live now (${live.length})` : "Upcoming",
              "/matches",
              (live.length ? live : upcoming).length === 0 ? (
                <p className="admin-hint">Nothing scheduled.</p>
              ) : (
                <div className="cricket-match-grid">
                  {[...live, ...upcoming].slice(0, 4).map((m) => (
                    <MatchCard key={m.id} match={m} tournamentName={tournamentNames.get(m.tournamentId)} />
                  ))}
                </div>
              ),
            )}
            {section(
              "Recent results",
              "/matches",
              results.length === 0 ? (
                <p className="admin-hint">No completed matches yet.</p>
              ) : (
                <div className="cricket-match-grid">
                  {results.map((m) => (
                    <MatchCard key={m.id} match={m} tournamentName={tournamentNames.get(m.tournamentId)} />
                  ))}
                </div>
              ),
            )}
          </div>
        )}
      </ListCard>

      {all.length > 0 && (
        <ListCard
          title="Top Performers"
          action={
            <Link to="/leaderboard" className="admin-link">
              Full leaderboard
            </Link>
          }
        >
          <LeaderboardGrid matches={all} only={["MVP", "Most Runs", "Most Wickets"]} />
        </ListCard>
      )}
    </div>
  );
}
