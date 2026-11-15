import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useTournamentsMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketTournaments } from "../../../api/hooks/cricket/useCricketTournaments";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ListCard } from "../../components/ListCard";
import { Loader } from "../../components/Loader";
import { PageHeader } from "../../components/PageHeader";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { TournamentCard, seasonsOf, seriesOf } from "./TournamentCard";
import { TournamentLogo } from "./TournamentLogo";
import { TournamentStats } from "./TournamentStats";
import { bannerFor } from "./tournamentArt";
import { useSwipeTabs } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

type Tab = "seasons" | "leaderboard" | "stats";

const TABS: { value: Tab; label: string }[] = [
  { value: "seasons", label: "Seasons" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "stats", label: "Stats" },
];

// A recurring tournament's seasons in one place, with the leaderboard and
// stats across all of them. Only the seasons the viewer can open count
// towards the stats.
export function SeriesPage() {
  const { name = "" } = useParams();
  const key = name.toLowerCase();
  const { admin } = useAdminAuth();
  const { data: tournaments, isLoading } = useCricketTournaments();
  const seasons = seasonsOf(tournaments ?? [], key);
  const results = useTournamentsMatches(seasons.map((t) => t.id));
  const matches = results.flatMap((r) => r.data ?? []);
  const loadingMatches = results.some((r) => r.isLoading);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "seasons";
  const swipeRef = useSwipeTabs(TABS.map((t) => t.value), tab, (value) =>
    setParams({ tab: value }, { replace: true, state: location.state }),
  );
  const backTo = admin?.isSuperAdmin ? "/tournaments" : "/my-tournaments";

  if (isLoading) {
    return (
      <>
        <PageHeader title="Series" back={backTo} />
        <Loader />
      </>
    );
  }
  if (seasons.length === 0) {
    return (
      <>
        <PageHeader title="Series" back={backTo} />
        <ListCard title={name}>
          <div className="admin-empty-state">No tournaments in this series.</div>
        </ListCard>
      </>
    );
  }

  const latest = seasons[0];
  const seriesName = seriesOf(latest).name;
  const teams = new Set(seasons.flatMap((t) => t.teams.map((team) => team.name.trim().toLowerCase()))).size;
  const players = new Set(seasons.flatMap((t) => t.playerIds)).size;

  return (
    <div className="cricket-page">
      <PageHeader title={seriesName} subtitle="Series" back={backTo} backLabel="Back" />
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <div className="cricket-th">
            <div className="cricket-th-cover" style={{ backgroundImage: `url(${bannerFor(latest)})` }} />
            <div className="cricket-th-identity">
              <TournamentLogo tournament={latest} className="cricket-tour-logo" />
              <div className="cricket-th-title">
                <h1>{seriesName}</h1>
                <div className="cricket-th-meta">
                  <span>
                    <i className="fa-solid fa-layer-group" aria-hidden="true"></i> {seasons.length}{" "}
                    {seasons.length === 1 ? "season" : "seasons"}
                  </span>
                  <span>
                    <i className="fa-solid fa-people-group" aria-hidden="true"></i> {teams} teams
                  </span>
                  <span>
                    <i className="fa-solid fa-users" aria-hidden="true"></i> {players} players
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={swipeRef} className="cricket-match-tabs" role="tablist" aria-label="Series sections">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? "active" : ""}
              onClick={() => setParams({ tab: t.value }, { replace: true, state: location.state })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <SwipePanels swipe={swipeRef} values={TABS.map((t) => t.value)} current={tab} eager>
        {(tab) => (
          <>
            {tab === "seasons" && (
              <ListCard>
                <div className="cricket-match-grid">
                  {seasons.map((t) => (
                    <div key={t.id} className="cricket-series-season">
                      <span className="cricket-series-season-label">{seriesOf(t).season}</span>
                      <TournamentCard tournament={t} matches={matches} />
                    </div>
                  ))}
                </div>
              </ListCard>
            )}
            {tab === "leaderboard" && (
              <ListCard>{loadingMatches ? <Loader /> : <LeaderboardGrid matches={matches} scope="series" />}</ListCard>
            )}
            {tab === "stats" && <ListCard>{loadingMatches ? <Loader /> : <TournamentStats matches={matches} />}</ListCard>}
          </>
        )}
      </SwipePanels>
    </div>
  );
}
