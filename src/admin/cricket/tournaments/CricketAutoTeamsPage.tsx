import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import {
  useCricketTournament,
  useGenerateCricketTeams,
  useSetCricketMatchSets,
} from "../../../api/hooks/cricket/useCricketTournaments";
import { isGeneratedTeam, type CricketPlayer } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { canManageTournament } from "../canManage";
import { roleOf } from "../playerRoles";
import { ListCard } from "../../components/ListCard";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { Loader } from "../../components/Loader";
import { CricketSquadPicker } from "./CricketSquadPicker";
import { AutoTeamCount } from "./CricketTeamTools";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

function PlayerLabel({ player }: { player: CricketPlayer | undefined }) {
  const role = roleOf(player?.role ?? null);
  return (
    <>
      <span className="cricket-player-name">{player?.name ?? "Removed player"}</span>
      {role && <i className={`fa-solid ${role.icon} cricket-role-icon`} title={role.label} aria-label={role.label}></i>}
    </>
  );
}

// "Create automatically", on its own page: how many teams, then the squad,
// matched sets of equal strength, and generating — each set is dealt out so
// every team gets one of each. Opened from the tournament's Teams tab.
export function CricketAutoTeamsPage() {
  const id = Number(useParams().id);
  const { data: tournament, isLoading } = useCricketTournament(id);
  const { data: players } = useCricketPlayers();
  const { data: matches, isLoading: loadingMatches } = useCricketMatches(id);
  const setMatchSets = useSetCricketMatchSets();
  const generateTeams = useGenerateCricketTeams();
  const [picked, setPicked] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const { admin } = useAdminAuth();
  const canManage = canManageTournament(admin, tournament);
  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);
  const backTo = `/tournaments/${id}?tab=teams`;

  // Generating reshuffles every team, so it's closed once a match is scheduled.
  const scheduled = (matches ?? []).length > 0;
  if (isLoading || loadingMatches || !tournament || !canManage || scheduled) {
    return (
      <>
        <PageHeader title="Create Teams" back={backTo} backLabel="Back to teams" />
        {isLoading || loadingMatches ? (
          <Loader page />
        ) : (
          <ListCard title="Create Teams">
            <p>
              {!tournament
                ? "Tournament not found."
                : !canManage
                  ? "Only the tournament's organiser can create its teams."
                  : "Matches are already scheduled, so the teams can't be generated again. Open a team to move or swap its players."}
            </p>
          </ListCard>
        )}
      </>
    );
  }

  // Only the generated teams are filled from matched sets; hand-built ones
  // keep their players, who aren't matched.
  const generatedTeams = tournament.teams.filter(isGeneratedTeam);
  const manualTeams = tournament.teams.filter((team) => !isGeneratedTeam(team));
  const onManualTeam = new Set(manualTeams.flatMap((team) => team.playerIds));
  const teamCount = generatedTeams.length;
  const sets = tournament.matchSets.map((set) => set.playerIds);
  const matched = new Set(sets.flat());
  // Only the squad can be matched.
  const squad = (players ?? []).filter(
    (player) => tournament.playerIds.includes(player.id) && !onManualTeam.has(player.id),
  );
  const unmatched = squad.filter((player) => !matched.has(player.id));
  const available = unmatched.filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()));
  const hasRosters = generatedTeams.some((team) => team.playerIds.length > 0);
  const busy = setMatchSets.isPending || generateTeams.isPending;

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
        `Every matched set is dealt out at random over the ${teamCount} generated teams, replacing their players and any swaps you made.${
          manualTeams.length > 0 ? " Hand-built teams stay as they are." : ""
        }`,
        tournament!.generatedAt ? "Yes, regenerate" : "Yes, generate",
      ))
    ) {
      return;
    }
    generateTeams.mutate(tournament!.id);
  }

  return (
    <div className="cricket-page">
      <PageHeader title="Create Teams" subtitle={tournament.name} back={backTo} backLabel="Back to teams" />

      <ListCard title="Teams">
        <AutoTeamCount tournament={tournament} />
        {manualTeams.length > 0 && (
          <p className="admin-hint mb-0">
            <i className="fa-solid fa-hand-pointer" aria-hidden="true"></i> Kept as they are:{" "}
            <strong>{manualTeams.map((team) => team.name).join(", ")}</strong> (built by hand). Only the{" "}
            {teamCount} generated team{teamCount === 1 ? "" : "s"} are filled from the matched sets below.
          </p>
        )}
      </ListCard>

      {teamCount >= 2 && (
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

          {/* Step 3: deal the matched sets out; the teams show on the Teams tab. */}
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
              {sets.length === 0 ? (
                "Match some players first, then generate the teams."
              ) : tournament.generatedAt ? (
                <>
                  Teams generated — <Link to={backTo}>open the Teams tab</Link> to move or swap players.
                </>
              ) : (
                `${sets.length} set${sets.length === 1 ? "" : "s"} ready — generate to deal them out across the teams.`
              )}
            </div>
          </ListCard>
        </>
      )}
    </div>
  );
}
