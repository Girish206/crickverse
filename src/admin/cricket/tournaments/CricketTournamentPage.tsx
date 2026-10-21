import { useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import {
  useCricketTournament,
  useGenerateCricketTeams,
  useSetCricketMatchSets,
  useSetCricketTournamentScorers,
} from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketPlayer, CricketTournament } from "../../../api/types";
import { avatarColorFor } from "../avatarColor";
import { pointsTable } from "../stats";
import { ListCard } from "../../components/ListCard";
import { PageHeader, PageHeaderAction } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { CricketTournamentForm } from "./CricketTournamentForm";
import { CricketSquadPicker } from "./CricketSquadPicker";
import { AutoTeamCount, ExistingTeamPicker, TeamForm } from "./CricketTeamTools";
import { roleOf } from "../playerRoles";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { canManageTournament } from "../canManage";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { CricketMatchForm } from "../matches/CricketMatchForm";
import { LeaderboardGrid, PointsTable } from "../leaderboard/CricketLeaderboard";
import { TournamentBanner } from "./TournamentBanner";
import { TournamentInfo } from "./TournamentInfo";
import { TournamentStats } from "./TournamentStats";
import { FollowHeaderAction } from "../follow/FollowButton";
import { ScorersSheet } from "../ScorersSheet";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type Tab = "info" | "teams" | "matches" | "points" | "stats" | "totals";

// How the teams are filled: generated from matched sets, or built by hand
// (new teams or copies of other tournaments' teams).
type BuildMode = "auto" | "manual";

type TeamModal = { kind: "new" } | { kind: "existing" };

// Same underlined, sticky tabs as the match page.
const TABS: { value: Tab; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "matches", label: "Matches" },
  { value: "teams", label: "Teams" },
  { value: "points", label: "Points Table" },
  { value: "stats", label: "Leaderboard" },
  { value: "totals", label: "Stats" },
];

function sameMembers(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function PlayerLabel({ player }: { player: CricketPlayer | undefined }) {
  const role = roleOf(player?.role ?? null);
  return (
    <>
      <span className="cricket-player-name">{player?.name ?? "Removed player"}</span>
      {role && <i className={`fa-solid ${role.icon} cricket-role-icon`} title={role.label} aria-label={role.label}></i>}
    </>
  );
}

// The Teams tab: one card per team — initial, name, player count and
// record — opening the team's own page (CricketTeamPage).
function TeamCards({ tournament, matches }: { tournament: CricketTournament; matches: CricketMatch[] }) {
  const record = new Map(pointsTable(tournament, matches).map((row) => [row.teamIndex, row]));
  return (
    <div className="cricket-team-cards">
      {tournament.teams.map((team, teamIndex) => {
        const row = record.get(teamIndex);
        return (
          <Link key={teamIndex} to={`/tournaments/${tournament.id}/teams/${teamIndex}`} className="cricket-team-card">
            <span className="cricket-team-card-logo" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
              {team.name.charAt(0).toUpperCase()}
            </span>
            <span className="cricket-team-card-text">
              <strong>{team.name}</strong>
              <small>
                {team.playerIds.length} player{team.playerIds.length === 1 ? "" : "s"}
                {row && row.played > 0 && ` · W${row.won} L${row.lost} · ${row.points} pts`}
              </small>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </Link>
        );
      })}
    </div>
  );
}

export function CricketTournamentPage() {
  const id = Number(useParams().id);
  const { data: tournament, isLoading } = useCricketTournament(id);
  const { data: players } = useCricketPlayers();
  const setMatchSets = useSetCricketMatchSets();
  const generateTeams = useGenerateCricketTeams();
  const setScorers = useSetCricketTournamentScorers();
  const [mode, setMode] = useState<BuildMode | null>(null);
  const [teamModal, setTeamModal] = useState<TeamModal | null>(null);

  const [picked, setPicked] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [pickingScorers, setPickingScorers] = useState(false);
  const [schedulingMatch, setSchedulingMatch] = useState(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const { data: matches } = useCricketMatches(id);
  // Players see their tournament read-only; its creator and super admins
  // manage it.
  const { admin } = useAdminAuth();
  const canManage = canManageTournament(admin, tournament);

  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);
  const backTo = admin?.isSuperAdmin ? "/tournaments" : "/my-tournaments";

  if (isLoading || !tournament) {
    return (
      <>
        <PageHeader title="Tournament" back={backTo} />
        {isLoading ? (
          <Loader page />
        ) : (
          <ListCard title="Tournament">
            <p>Tournament not found.</p>
          </ListCard>
        )}
      </>
    );
  }

  const teamCount = tournament.teams.length;
  const sets = tournament.matchSets.map((set) => set.playerIds);
  const matchedIds = sets.flat();
  const matched = new Set(matchedIds);
  // Only the squad can be matched.
  const squad = (players ?? []).filter((player) => tournament.playerIds.includes(player.id));
  const unmatched = squad.filter((player) => !matched.has(player.id));
  const available = unmatched.filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()));
  const teamPlayerIds = tournament.teams.flatMap((team) => team.playerIds);
  const hasRosters = teamPlayerIds.length > 0;
  const teamsOutdated = tournament.generatedAt !== null && !sameMembers(teamPlayerIds, matchedIds);
  const busy =
    setMatchSets.isPending || generateTeams.isPending;
  // Until one is picked: generating if they've started matching, by hand if
  // the teams were filled some other way.
  const buildMode: BuildMode = mode ?? (sets.length > 0 || tournament.generatedAt || !hasRosters ? "auto" : "manual");

  function saveSets(next: number[][]) {
    setMatchSets.mutate({ id: tournament!.id, sets: next });
  }

  // Picking the last player a set needs files it straight away.
  function togglePick(playerId: number) {
    if (picked.includes(playerId)) {
      setPicked(picked.filter((other) => other !== playerId));
      return;
    }
    const next = [...picked, playerId];
    if (next.length === teamCount) {
      saveSets([...sets, next]);
      setPicked([]);
    } else {
      setPicked(next);
    }
  }

  async function handleGenerate() {
    if (
      hasRosters &&
      !(await confirmAction(
        tournament!.generatedAt ? "Generate teams again?" : "Replace the current players?",
        "Every matched set is dealt out at random, replacing the players now on the teams and any swaps you made.",
        tournament!.generatedAt ? "Yes, regenerate" : "Yes, generate",
      ))
    ) {
      return;
    }
    generateTeams.mutate(tournament!.id);
  }

  return (
    <div className="cricket-page">
      <PageHeader
        title={tournament.name}
        subtitle="Tournament"
        back={backTo}
        backLabel={admin?.isSuperAdmin ? "All tournaments" : "My tournaments"}
        actions={
          <>
            <FollowHeaderAction target={{ kind: "tournament", targetId: tournament.id, teamIndex: null }} />
            {canManage && (
              <>
                <PageHeaderAction icon="fa-solid fa-user-pen" label="Scorers" onClick={() => setPickingScorers(true)} />
                <PageHeaderAction icon="fa-solid fa-pen" label="Edit tournament" onClick={() => setEditing(true)} />
              </>
            )}
          </>
        }
      />
      {/* Banner + tabs: one header that stays pinned on phones. */}
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <TournamentBanner tournament={tournament} />
        </div>
  
        <div className="cricket-match-tabs" role="tablist" aria-label="Tournament sections">
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

      {tab === "info" && (
        <ListCard>
          <TournamentInfo tournament={tournament} matches={matches ?? []} />
        </ListCard>
      )}

      {tab === "teams" && !canManage && (
        <ListCard>
          {teamCount === 0 ? (
            <div className="admin-empty-state">The teams haven't been picked yet.</div>
          ) : (
            <TeamCards tournament={tournament} matches={matches ?? []} />
          )}
        </ListCard>
      )}

      {tab === "teams" && canManage && (
        <>
        <ListCard>
          {teamCount === 0 ? (
            <div className="admin-empty-state">No teams yet — create them automatically or add them by hand below.</div>
          ) : (
            <>
              {teamsOutdated && (
                <div className="admin-banner admin-banner-error mb-3">
                  The matched sets have changed since the teams were generated. Regenerate to include the changes.
                </div>
              )}
              <TeamCards tournament={tournament} matches={matches ?? []} />
            </>
          )}
        </ListCard>

        <ListCard title="Add Teams">
          <div className="admin-segmented mb-3" role="radiogroup" aria-label="How to make the teams">
            {(
              [
                { value: "auto", label: "Create automatically", icon: "fa-shuffle" },
                { value: "manual", label: "Create manually", icon: "fa-hand-pointer" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={buildMode === option.value}
                className={buildMode === option.value ? "active" : ""}
                onClick={() => setMode(option.value)}
              >
                <i className={`fa-solid ${option.icon}`} aria-hidden="true"></i> {option.label}
              </button>
            ))}
          </div>
          {buildMode === "auto" ? (
            <AutoTeamCount tournament={tournament} />
          ) : (
            <>
              <p className="admin-hint">
                Make a new team and pick its players, or bring in a team from any other tournament with its players.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Button variant="primary" disabled={teamCount >= 8} onClick={() => setTeamModal({ kind: "new" })}>
                  <i className="fa-solid fa-plus" aria-hidden="true"></i> New team
                </Button>
                <Button variant="outline" disabled={teamCount >= 8} onClick={() => setTeamModal({ kind: "existing" })}>
                  <i className="fa-solid fa-people-group" aria-hidden="true"></i> Choose from existing teams
                </Button>
              </div>
            </>
          )}
        </ListCard>

        {buildMode === "auto" && teamCount >= 2 && (
          <>
        {/* Step 1: pick who's playing from the shared player list. */}
        <ListCard title={`1. Squad (${tournament.playerIds.length})`}>
          <CricketSquadPicker tournament={tournament} busy={busy} />
        </ListCard>

        {/* Step 2: match players of equal strength into sets of teamCount. */}
        <ListCard title="2. Match Players">
          <p className="admin-hint">
            Pick {teamCount} players you think are an even match — the set is saved as soon as you pick the{" "}
            {teamCount === 2 ? "second" : `${teamCount}th`}. When teams are generated each player in a set goes to a
            different team.
          </p>
          <div className="cricket-match-layout">
            <section className="cricket-panel">
              <div className="cricket-panel-head">
                <h2>Unmatched ({unmatched.length})</h2>
              </div>
              <input
                type="search"
                className="form-control shadow-none mb-2"
                placeholder="Search players"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {picked.length > 0 && (
                <div className="cricket-picked-bar">
                  <span>
                    Picked {picked.length}/{teamCount}:{" "}
                    <strong>{picked.map((playerId) => playerById.get(playerId)?.name).join(", ")}</strong>
                  </span>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="admin-link-btn"
                      disabled={busy}
                      title="For leftover players when the count doesn't divide evenly"
                      onClick={() => {
                        saveSets([...sets, picked]);
                        setPicked([]);
                      }}
                    >
                      Save as short set
                    </button>
                    <button type="button" className="admin-link-btn" onClick={() => setPicked([])}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <div className="cricket-pick-list">
                {available.length === 0 ? (
                  <div className="admin-empty-state">
                    {squad.length ? "Everyone in the squad is matched." : "Pick the squad above first."}
                  </div>
                ) : (
                  available.map((player) => (
                    <button
                      type="button"
                      key={player.id}
                      className={`cricket-pick ${picked.includes(player.id) ? "is-picked" : ""}`}
                      aria-pressed={picked.includes(player.id)}
                      disabled={busy}
                      onClick={() => togglePick(player.id)}
                    >
                      <i
                        className={`fa-${picked.includes(player.id) ? "solid fa-circle-check" : "regular fa-circle"}`}
                        aria-hidden="true"
                      ></i>
                      <PlayerLabel player={player} />
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="cricket-panel">
              <div className="cricket-panel-head">
                <h2>Matched Sets ({sets.length})</h2>
                {sets.length > 0 && (
                  <button
                    type="button"
                    className="admin-link-btn text-danger"
                    disabled={busy}
                    onClick={async () => {
                      if (await confirmAction("Clear all matched sets?", "Every player goes back to Available.", "Clear all")) {
                        saveSets([]);
                      }
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {sets.length === 0 ? (
                <div className="admin-empty-state">No sets yet.</div>
              ) : (
                <ol className="cricket-set-list">
                  {sets.map((set, index) => (
                    <li key={set.join("-")} className={set.length < teamCount ? "is-short" : ""}>
                      <span className="cricket-set-number">{index + 1}</span>
                      <div className="cricket-set-players">
                        {set.map((playerId, i) => (
                          <span key={playerId} className="cricket-set-player">
                            {i > 0 && <span className="cricket-vs">vs</span>}
                            <PlayerLabel player={playerById.get(playerId)} />
                          </span>
                        ))}
                        {set.length < teamCount && <small className="text-muted">short set</small>}
                      </div>
                      <button
                        type="button"
                        className="cricket-icon-btn"
                        title="Unmatch this set"
                        aria-label="Unmatch this set"
                        disabled={busy}
                        onClick={() => saveSets(sets.filter((_, i) => i !== index))}
                      >
                        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </ListCard>

        {/* Step 3: deal the matched sets out; the result shows under Teams above. */}
        <ListCard
          title="3. Generate Teams"
          action={
            <Button variant="primary" disabled={busy || sets.length === 0} onClick={handleGenerate}>
              <i className="fa-solid fa-shuffle" aria-hidden="true"></i>{" "}
              {tournament.generatedAt ? "Regenerate Teams" : "Generate Teams"}
            </Button>
          }
        >
          <div className="admin-empty-state">
            {sets.length === 0
              ? "Match some players first, then generate the teams."
              : tournament.generatedAt
                ? "Teams generated — open a team above to move or swap its players."
                : `${sets.length} set${sets.length === 1 ? "" : "s"} ready — generate to deal them out across the teams.`}
          </div>
        </ListCard>
          </>
        )}
        </>
      )}

      {tab === "matches" && (
        <ListCard
          action={
            canManage ? (
              <Button variant="primary" onClick={() => setSchedulingMatch(true)}>
                + Schedule
              </Button>
            ) : undefined
          }
        >
          <MatchesBoard matches={matches ?? []} onNew={canManage ? () => setSchedulingMatch(true) : undefined} />
        </ListCard>
      )}

      {tab === "points" && (
        <ListCard>
          <PointsTable tournament={tournament} matches={matches ?? []} />
        </ListCard>
      )}

      {tab === "stats" && (
        <ListCard>
          <LeaderboardGrid matches={matches ?? []} />
        </ListCard>
      )}

      {tab === "totals" && (
        <ListCard>
          <TournamentStats matches={matches ?? []} />
        </ListCard>
      )}

      {schedulingMatch && (
        <BottomSheet
          title="Schedule Match"
          icon="fa-solid fa-baseball-bat-ball"
          onClose={() => setSchedulingMatch(false)}
          wide
          fullScreen
        >
          <CricketMatchForm tournamentId={tournament.id} onSaved={() => setSchedulingMatch(false)} />
        </BottomSheet>
      )}

      {teamModal && (
        <BottomSheet
          title={teamModal.kind === "new" ? "New Team" : "Choose From Existing Teams"}
          onClose={() => setTeamModal(null)}
          wide
        >
          {teamModal.kind === "existing" ? (
            <ExistingTeamPicker tournament={tournament} onSaved={() => setTeamModal(null)} />
          ) : (
            <TeamForm tournament={tournament} onSaved={() => setTeamModal(null)} />
          )}
        </BottomSheet>
      )}

      {editing && (
        <BottomSheet title="Edit Tournament" onClose={() => setEditing(false)} wide>
          <CricketTournamentForm existing={tournament} onSaved={() => setEditing(false)} />
        </BottomSheet>
      )}
      {pickingScorers && (
        <ScorersSheet
          title="Tournament Scorers"
          note="Scorers can edit and score every match in this tournament. Each match's captains can already score it."
          scorerIds={tournament.scorerIds}
          squads={tournament.teams}
          saving={setScorers.isPending}
          onSave={(playerIds) => setScorers.mutateAsync({ id: tournament.id, playerIds })}
          onClose={() => setPickingScorers(false)}
        />
      )}
    </div>
  );
}
