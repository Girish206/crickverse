import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import {
  useCricketTournament,
  useGenerateCricketTeams,
  useMoveCricketPlayer,
  useRemoveCricketTeam,
  useSetCricketMatchSets,
  useSwapCricketPlayers,
} from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketPlayer } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import DefaultModal from "../../dms/components/DefaultModal";
import { CricketTournamentForm } from "./CricketTournamentForm";
import { CricketSquadPicker } from "./CricketSquadPicker";
import { AutoTeamCount, ExistingTeamPicker, TeamForm } from "./CricketTeamTools";
import { CricketKpis } from "../CricketKpis";
import { roleOf } from "../playerRoles";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { CricketMatchForm } from "../matches/CricketMatchForm";
import { LeaderboardGrid, PointsTable } from "../leaderboard/CricketLeaderboard";
import { TournamentBanner } from "./TournamentBanner";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

type Tab = "teams" | "matches" | "points" | "stats";

// How the teams are filled: generated from matched sets, or built by hand
// (new teams or copies of other tournaments' teams).
type BuildMode = "auto" | "manual";

type TeamModal = { kind: "new" } | { kind: "edit"; index: number } | { kind: "existing" };

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: "teams", label: "Teams", icon: "fa-people-group" },
  { value: "matches", label: "Matches", icon: "fa-calendar-days" },
  { value: "points", label: "Points Table", icon: "fa-table-list" },
  { value: "stats", label: "Stats", icon: "fa-ranking-star" },
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

export function CricketTournamentPage() {
  const id = Number(useParams().id);
  const { data: tournament, isLoading } = useCricketTournament(id);
  const { data: players } = useCricketPlayers();
  const setMatchSets = useSetCricketMatchSets();
  const generateTeams = useGenerateCricketTeams();
  const swapPlayers = useSwapCricketPlayers();
  const movePlayer = useMoveCricketPlayer();
  const removeTeam = useRemoveCricketTeam();
  const [mode, setMode] = useState<BuildMode | null>(null);
  const [teamModal, setTeamModal] = useState<TeamModal | null>(null);

  const [picked, setPicked] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  // Player tapped in the teams view, waiting for a swap partner or a team to move to.
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [schedulingMatch, setSchedulingMatch] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "teams";
  const { data: matches } = useCricketMatches(id);
  // Players see their tournament read-only; super admins manage it.
  const { admin } = useAdminAuth();
  const canManage = Boolean(admin?.isSuperAdmin);

  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);

  if (isLoading || !tournament) {
    return (
      <ListCard title="Tournament">
        <p>{isLoading ? "Loading..." : "Tournament not found."}</p>
      </ListCard>
    );
  }

  const teamCount = tournament.teams.length;
  const sets = tournament.matchSets.map((set) => set.playerIds);
  const matchedIds = sets.flat();
  const matched = new Set(matchedIds);
  const setIndexOf = new Map(sets.flatMap((set, index) => set.map((playerId) => [playerId, index] as const)));
  // Only the squad can be matched.
  const squad = (players ?? []).filter((player) => tournament.playerIds.includes(player.id));
  const unmatched = squad.filter((player) => !matched.has(player.id));
  const available = unmatched.filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()));
  const teamPlayerIds = tournament.teams.flatMap((team) => team.playerIds);
  const hasRosters = teamPlayerIds.length > 0;
  const teamsOutdated = tournament.generatedAt !== null && !sameMembers(teamPlayerIds, matchedIds);
  const busy =
    setMatchSets.isPending || generateTeams.isPending || swapPlayers.isPending || movePlayer.isPending || removeTeam.isPending;
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
    setSelected(null);
    generateTeams.mutate(tournament!.id);
  }

  function handlePlayerTap(playerId: number, teamIndex: number) {
    if (selected === null) {
      setSelected(playerId);
      return;
    }
    if (selected === playerId) {
      setSelected(null);
      return;
    }
    const selectedTeam = tournament!.teams.findIndex((team) => team.playerIds.includes(selected));
    if (selectedTeam === teamIndex) {
      setSelected(playerId);
      return;
    }
    swapPlayers.mutate({ id: tournament!.id, playerA: selected, playerB: playerId });
    setSelected(null);
  }

  async function handleRemoveTeam(index: number) {
    const team = tournament!.teams[index];
    if (
      await confirmAction(
        `Remove ${team.name}?`,
        team.playerIds.length
          ? `Its ${team.playerIds.length} player${team.playerIds.length === 1 ? "" : "s"} stay in the squad.`
          : "It has no players yet.",
        "Yes, remove",
      )
    ) {
      setSelected(null);
      removeTeam.mutate({ id: tournament!.id, index });
    }
  }

  function handleMoveHere(teamIndex: number) {
    if (selected === null) return;
    movePlayer.mutate({ id: tournament!.id, playerId: selected, toTeamIndex: teamIndex });
    setSelected(null);
  }

  const selectedTeamIndex =
    selected === null ? -1 : tournament.teams.findIndex((team) => team.playerIds.includes(selected));

  return (
    <div className="cricket-page">
      <ListCard
        title={tournament.name}
        action={
          <div className="d-flex gap-2 flex-wrap">
            <Link
              to={canManage ? "/tournaments" : "/my-tournaments"}
              className="btn btn-link"
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> {canManage ? "All tournaments" : "My tournaments"}
            </Link>
            {canManage && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit
              </Button>
            )}
          </div>
        }
      >
        <TournamentBanner tournament={tournament} />
        <CricketKpis
          items={[
            { label: "In the squad", value: squad.length, icon: "fa-users", tone: "total" },
            ...(canManage
              ? [
                  { label: "Matched sets", value: sets.length, icon: "fa-link", tone: "active" as const },
                  { label: "Not matched yet", value: unmatched.length, icon: "fa-user-clock", tone: "login" as const },
                ]
              : [
                  { label: "Matches", value: matches?.length ?? 0, icon: "fa-calendar-days", tone: "active" as const },
                  {
                    label: "Completed",
                    value: (matches ?? []).filter((m) => m.status === "completed").length,
                    icon: "fa-flag-checkered",
                    tone: "login" as const,
                  },
                ]),
            {
              label: "Players per team",
              value: hasRosters ? tournament.teams.map((team) => team.playerIds.length).join(" / ") : "—",
              icon: "fa-people-group",
              tone: "guest",
              hint: tournament.teams.map((team) => team.name).join(" / "),
            },
          ]}
        />
        <div className="cricket-chip-row">
          {tournament.teams.map((team, index) => (
            <span className="cricket-chip" key={index}>
              <i className="fa-solid fa-shield-halved" aria-hidden="true"></i> {team.name}
            </span>
          ))}
        </div>
      </ListCard>

      <div className="admin-segmented cricket-tabs cricket-page-tabs" role="tablist" aria-label="Tournament sections">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={tab === t.value ? "active" : ""}
            onClick={() => setParams({ tab: t.value }, { replace: true })}
          >
            <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
          </button>
        ))}
      </div>

      {tab === "teams" && !canManage && (
        <ListCard title="Teams">
          {!hasRosters ? (
            <div className="admin-empty-state">The teams haven't been picked yet.</div>
          ) : (
            <div className="cricket-team-grid">
              {tournament.teams.map((team, teamIndex) => (
                <section className="cricket-team" key={teamIndex}>
                  <header className="cricket-team-head">
                    <h3>{team.name}</h3>
                    <span className="cricket-chip">{team.playerIds.length}</span>
                  </header>
                  <ul className="cricket-team-list">
                    {team.playerIds.map((playerId) => (
                      <li key={playerId} className="cricket-team-player is-static">
                        <PlayerLabel player={playerById.get(playerId)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </ListCard>
      )}

      {tab === "teams" && canManage && (
        <>
        <ListCard title={`Teams (${teamCount})`}>
          {teamCount === 0 ? (
            <div className="admin-empty-state">No teams yet — create them automatically or add them by hand below.</div>
          ) : (
            <>
              {teamsOutdated && (
                <div className="admin-banner admin-banner-error mb-3">
                  The matched sets have changed since the teams were generated. Regenerate to include the changes.
                </div>
              )}
              {hasRosters && (
                <p className="admin-hint">
                  {selected === null
                    ? "Tap a player, then tap a player on another team to swap them — or use “Move here” to move them without a swap."
                    : `Swapping ${playerById.get(selected)?.name ?? "player"} — tap a player on another team, or tap again to cancel.`}
                </p>
              )}
              <div className="cricket-team-grid">
                {tournament.teams.map((team, teamIndex) => (
                  <section className="cricket-team" key={teamIndex}>
                    <header className="cricket-team-head">
                      <h3>{team.name}</h3>
                      <span className="d-flex align-items-center gap-1">
                        <span className="cricket-chip">{team.playerIds.length}</span>
                        <button
                          type="button"
                          className="cricket-icon-btn"
                          title="Edit team"
                          aria-label={`Edit ${team.name}`}
                          disabled={busy}
                          onClick={() => setTeamModal({ kind: "edit", index: teamIndex })}
                        >
                          <i className="fa-solid fa-pen" aria-hidden="true"></i>
                        </button>
                        <button
                          type="button"
                          className="cricket-icon-btn"
                          title="Remove team"
                          aria-label={`Remove ${team.name}`}
                          disabled={busy}
                          onClick={() => handleRemoveTeam(teamIndex)}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true"></i>
                        </button>
                      </span>
                    </header>
                    {team.playerIds.length === 0 && <small className="text-muted">No players yet.</small>}
                    <ul className="cricket-team-list">
                      {team.playerIds.map((playerId) => (
                        <li key={playerId}>
                          <button
                            type="button"
                            className={`cricket-team-player ${selected === playerId ? "is-selected" : ""} ${
                              selected !== null && selectedTeamIndex !== teamIndex ? "is-target" : ""
                            }`}
                            disabled={busy}
                            onClick={() => handlePlayerTap(playerId, teamIndex)}
                          >
                            <PlayerLabel player={playerById.get(playerId)} />
                            {setIndexOf.has(playerId) && (
                              <span className="cricket-set-tag" title="Matched set">
                                #{setIndexOf.get(playerId)! + 1}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {selected !== null && selectedTeamIndex !== teamIndex && (
                      <button
                        type="button"
                        className="cricket-move-btn"
                        disabled={busy}
                        onClick={() => handleMoveHere(teamIndex)}
                      >
                        <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> Move here
                      </button>
                    )}
                  </section>
                ))}
              </div>
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
                ? "Teams generated — swap or move players in Teams above."
                : `${sets.length} set${sets.length === 1 ? "" : "s"} ready — generate to deal them out across the teams.`}
          </div>
        </ListCard>
          </>
        )}
        </>
      )}

      {tab === "matches" && (
        <ListCard
          title="Matches"
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
        <ListCard title="Points Table">
          <PointsTable tournament={tournament} matches={matches ?? []} />
        </ListCard>
      )}

      {tab === "stats" && (
        <ListCard title="Tournament Stats">
          <LeaderboardGrid matches={matches ?? []} />
        </ListCard>
      )}

      {schedulingMatch && (
        <DefaultModal
          title="Schedule Match"
          onClose={() => setSchedulingMatch(false)}
          showFooter={false}
          size="lg"
          component={<CricketMatchForm tournamentId={tournament.id} onSaved={() => setSchedulingMatch(false)} />}
        />
      )}


      {teamModal && (
        <DefaultModal
          title={teamModal.kind === "new" ? "New Team" : teamModal.kind === "edit" ? "Edit Team" : "Choose From Existing Teams"}
          onClose={() => setTeamModal(null)}
          showFooter={false}
          size="lg"
          component={
            teamModal.kind === "existing" ? (
              <ExistingTeamPicker tournament={tournament} onSaved={() => setTeamModal(null)} />
            ) : (
              <TeamForm
                tournament={tournament}
                index={teamModal.kind === "edit" ? teamModal.index : undefined}
                onSaved={() => setTeamModal(null)}
              />
            )
          }
        />
      )}

      {editing && (
        <DefaultModal
          title="Edit Tournament"
          onClose={() => setEditing(false)}
          showFooter={false}
          size="lg"
          component={<CricketTournamentForm existing={tournament} onSaved={() => setEditing(false)} />}
        />
      )}
    </div>
  );
}
