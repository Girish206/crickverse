import { Link } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { CricketKpis } from "../CricketKpis";
import { HomeRail, HomeSection, LiveCount } from "../HomeSection";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { LiveMatchCard, MatchCard } from "../matches/matchUi";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

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

  const card = (m: CricketMatch) => (
    <MatchCard key={m.id} match={m} tournamentName={m.tournamentId === null ? undefined : tournamentNames.get(m.tournamentId)} />
  );
  const liveCard = (m: CricketMatch) => (
    <LiveMatchCard key={m.id} match={m} tournamentName={m.tournamentId === null ? undefined : tournamentNames.get(m.tournamentId)} />
  );

  // Laid out like the player Home: the numbers on its gradient banner, then
  // live, upcoming, results and the top players in its tinted sections.
  return (
    <ListCard title="Dashboard" icon="fa-solid fa-chart-pie" subtitle="Players, tournaments and matches at a glance" plain>
      <div className="cricket-home">
        <CricketKpis
          variant="hero"
          items={[
            { label: "Players", value: players?.length ?? 0, icon: "fa-users", tone: "total" },
            { label: "Tournaments", value: tournaments?.length ?? 0, icon: "fa-trophy", tone: "active" },
            {
              label: "Played",
              value: all.filter((m) => m.status === "completed").length,
              icon: "fa-flag-checkered",
              tone: "login",
              hint: "Matches played",
            },
            { label: "Runs", value: totalRuns, icon: "fa-baseball-bat-ball", tone: "guest", hint: "Runs scored" },
          ]}
        />
        {isLoading ? (
          <Loader />
        ) : all.length === 0 ? (
          <div className="admin-empty-state">
            No matches yet. Add <Link to="/players">players</Link>, set up a{" "}
            <Link to="/tournaments">tournament</Link> and its teams, then schedule matches.
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <HomeSection
                title="Live now"
                icon="fa-solid fa-tower-broadcast"
                tone="live"
                badge={<LiveCount count={live.length} />}
                link={{ to: "/matches", label: "All matches" }}
              >
                <HomeRail>{live.map(liveCard)}</HomeRail>
              </HomeSection>
            )}
            <HomeSection title="Up next" icon="fa-solid fa-clock" tone="next" link={{ to: "/matches", label: "All matches" }}>
              {upcoming.length === 0 ? (
                <p className="admin-hint mb-0">Nothing scheduled.</p>
              ) : (
                <HomeRail>{upcoming.slice(0, 4).map(card)}</HomeRail>
              )}
            </HomeSection>
            <HomeSection title="Recent results" icon="fa-solid fa-flag-checkered" tone="last" link={{ to: "/matches", label: "History" }}>
              {results.length === 0 ? (
                <p className="admin-hint mb-0">No completed matches yet.</p>
              ) : (
                <HomeRail>{results.map(card)}</HomeRail>
              )}
            </HomeSection>
            <HomeSection
              title="Top performers"
              icon="fa-solid fa-ranking-star"
              tone="tournaments"
              link={{ to: "/leaderboard", label: "Leaderboard" }}
            >
              <LeaderboardGrid matches={all} only={["MVP", "Most Runs", "Most Wickets"]} />
            </HomeSection>
          </>
        )}
      </div>
    </ListCard>
  );
}
