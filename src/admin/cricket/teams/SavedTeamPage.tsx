import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { lookupCricketPlayer, useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import {
  useAddCricketSavedTeamPlayers,
  useCreateCricketSavedTeam,
  useCricketSavedTeam,
  useDeleteCricketSavedTeam,
  useSetCricketSavedTeamRoles,
  useUpdateCricketSavedTeam,
} from "../../../api/hooks/cricket/useCricketSavedTeams";
import type { CricketMatch, CricketSavedTeam } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { ListCard } from "../../components/ListCard";
import { Loader } from "../../components/Loader";
import { ModalForm } from "../../components/ModalForm";
import { PageHeader } from "../../components/PageHeader";
import { SubmitButton } from "../../components/SubmitButton";
import InputComp from "../../dms/components/InputComp";
import { avatarColorFor } from "../avatarColor";
import { BottomSheet } from "../BottomSheet";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { teamKeyOf } from "../matches/matchUtils";
import { SettingsMenu } from "../SettingsMenu";
import { teamStats } from "../stats";
import { AddPlayersByMobileSheet } from "../tournaments/AddTeamPlayersSheet";
import { RosterPlayer, TeamStatsView } from "../tournaments/CricketTeamPage";
import { roleTagsFor, rolesOf, TeamRoleChips } from "../tournaments/TeamRoleChips";
import { bannerFor } from "../tournaments/tournamentArt";
import { TeamRecordCard } from "./TeamRecordCard";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

type Tab = "info" | "players" | "matches" | "leaderboard" | "stats";

const TABS: { value: Tab; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "players", label: "Players" },
  { value: "matches", label: "Matches" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "stats", label: "Stats" },
];

const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;

// "Create Team" (the + menu and My Teams): a name now, players on its page.
export function CreateSavedTeamForm({ onSaved }: { onSaved: () => void }) {
  const navigate = useNavigate();
  const createTeam = useCreateCricketSavedTeam();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the team's name");
    const team = await createTeam.mutateAsync(name.trim());
    onSaved();
    navigate(`/teams/saved/${team.id}?tab=players`, { state: { from: "/my-teams" } });
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <p className="admin-hint">A team of your own, outside any tournament. Add its players next, then pick it when you create a match.</p>
      <InputComp
        label="Team Name"
        required
        maxLength={60}
        value={name}
        error={error ?? undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setName(e.target.value);
          setError(null);
        }}
      />
      <SubmitButton loading={createTeam.isPending}>Create Team</SubmitButton>
    </ModalForm>
  );
}

function RenameForm({ team, onSaved }: { team: CricketSavedTeam; onSaved: () => void }) {
  const updateTeam = useUpdateCricketSavedTeam();
  const [name, setName] = useState(team.name);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() && name.trim() !== team.name) await updateTeam.mutateAsync({ id: team.id, name: name.trim() });
    onSaved();
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <InputComp
        label="Team Name"
        required
        maxLength={60}
        value={name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />
      <SubmitButton loading={updateTeam.isPending}>Save</SubmitButton>
    </ModalForm>
  );
}

// A saved team's page, laid out like a tournament team's: Info (record),
// Players (its own roster), and its one-off matches with their leaderboard
// and stats. Its creator, its captain and super admins add and remove
// players, pick its leaders, rename it; the creator can delete it.
export function SavedTeamPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { admin } = useAdminAuth();
  const { data: team, isLoading } = useCricketSavedTeam(id);
  const { data: me } = useCricketMe();
  const { data: players } = useCricketPlayers();
  // Only super admins can list every friendly match; players see the ones
  // they play in, follow or organise.
  const { data: allFriendlies } = useCricketMatches("none", { enabled: Boolean(admin?.isSuperAdmin) });
  const addPlayers = useAddCricketSavedTeamPlayers();
  const updateTeam = useUpdateCricketSavedTeam();
  const setRoles = useSetCricketSavedTeamRoles();
  const deleteTeam = useDeleteCricketSavedTeam();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // Player whose "⋮" sheet is open.
  const [actionsFor, setActionsFor] = useState<number | null>(null);

  const key = team?.teamKey;
  const matches = useMemo(() => {
    if (!key) return [];
    const pool = [
      ...(admin?.isSuperAdmin ? (allFriendlies ?? []) : []),
      ...(me ? [...me.matches, ...me.followedMatches, ...me.followedPlayerMatches, ...me.createdMatches] : []),
    ];
    const byId = new Map(
      pool.filter((m) => m.tournamentId === null && m.teams.some((_, slot) => teamKeyOf(m, slot) === key)).map((m) => [m.id, m]),
    );
    return [...byId.values()].sort((a, b) => when(b).localeCompare(when(a)));
  }, [admin?.isSuperAdmin, allFriendlies, me, key]);

  // teamStats() and the leaderboard pick a side by teamIndex; this team can
  // be either slot, so mark its side as 0 in every match.
  const asTeam = useMemo(
    () => matches.map((m) => ({ ...m, teams: m.teams.map((t, slot) => ({ ...t, teamIndex: teamKeyOf(m, slot) === key ? 0 : 1 })) })),
    [matches, key],
  ) as CricketMatch[];

  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const backTo = "/my-teams";

  if (isLoading || !team) {
    return (
      <>
        <PageHeader title="Team" back={backTo} />
        {isLoading ? (
          <Loader page />
        ) : (
          <ListCard title="Team">
            <p>Team not found.</p>
          </ListCard>
        )}
      </>
    );
  }

  const myPlayerId = me?.player?.id;
  const isCreator = admin ? String(team.createdById) === admin.sub : false;
  const canManage = Boolean(admin?.isSuperAdmin) || isCreator || (myPlayerId != null && team.captainId === myPlayerId);
  const canDelete = Boolean(admin?.isSuperAdmin) || isCreator;
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const completed = matches.filter((m) => m.status === "completed");
  const isMine = (m: CricketMatch, slot: number | null) => slot !== null && teamKeyOf(m, slot) === key;
  const won = completed.filter((m) => isMine(m, m.winner)).length;
  const lost = completed.filter((m) => m.winner !== null && !isMine(m, m.winner)).length;
  const captain = team.captainId != null ? playerById.get(team.captainId) : undefined;

  async function handleRemovePlayer(playerId: number) {
    const name = playerById.get(playerId)?.name ?? "this player";
    if (await confirmAction(`Remove ${name}?`, `They leave ${team!.name}. Matches already made keep them.`, "Yes, remove")) {
      await updateTeam.mutateAsync({ id: team!.id, playerIds: team!.playerIds.filter((pid) => pid !== playerId) });
    }
  }

  async function handleDelete() {
    if (await confirmAction(`Delete ${team!.name}?`, "Its matches stay, as a friendly team.", "Yes, delete")) {
      await deleteTeam.mutateAsync(team!.id);
      navigate(backTo);
    }
  }

  const showAddBar = canManage && tab === "players";
  return (
    <div className={`cricket-page ${showAddBar ? "has-action-bar" : ""}`.trim()}>
      <PageHeader
        title={team.name}
        subtitle="Team"
        back={backTo}
        actions={
          canManage ? (
            <SettingsMenu
              title="Team settings"
              items={[
                { icon: "fa-solid fa-pen", label: "Rename team", onClick: () => setRenaming(true) },
                ...(canDelete
                  ? [
                      {
                        icon: "fa-solid fa-trash",
                        label: "Delete team",
                        description: "Its matches stay, as a friendly team",
                        danger: true,
                        disabled: deleteTeam.isPending,
                        onClick: handleDelete,
                      },
                    ]
                  : []),
              ]}
            />
          ) : undefined
        }
      />
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <div className="cricket-th">
            <div className="cricket-th-cover" style={{ backgroundImage: `url(${bannerFor({ id: team.id, bannerUrl: null })})` }} />
            <div className="cricket-th-identity">
              <span className="cricket-tour-logo" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
                {team.name.charAt(0).toUpperCase()}
              </span>
              <div className="cricket-th-title">
                <h1>{team.name}</h1>
                <div className="cricket-th-meta">
                  <span>
                    <i className="fa-solid fa-users" aria-hidden="true"></i> {team.playerIds.length} players
                  </span>
                  <span>
                    <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> {matches.length}{" "}
                    {matches.length === 1 ? "match" : "matches"}
                  </span>
                  {completed.length > 0 && (
                    <span>
                      W{won} · L{lost}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cricket-match-tabs" role="tablist" aria-label="Team sections">
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
        <ListCard title="">
          <TeamRecordCard
            captain={captain}
            played={completed.length}
            won={won}
            lost={lost}
            tied={completed.length - won - lost}
            tiedLabel="Tied / NR"
            facts={[
              ["Players", team.playerIds.length],
              ["Matches", matches.length],
            ]}
          />
        </ListCard>
      )}

      {tab === "players" && (
        <ListCard>
          {team.playerIds.length === 0 ? (
            <div className="admin-empty-state">
              No players yet{canManage ? " — add them by mobile number." : "."}
            </div>
          ) : (
            <ul className="cricket-roster">
              {team.playerIds.map((playerId) => (
                <li key={playerId}>
                  <RosterPlayer player={playerById.get(playerId)} tags={canManage ? [] : roleTagsFor(team, playerId)} />
                  {canManage && (
                    <>
                      <TeamRoleChips
                        roles={rolesOf(team)}
                        playerId={playerId}
                        playerName={playerById.get(playerId)?.name ?? "Player"}
                        disabled={setRoles.isPending}
                        onChange={(roles) => setRoles.mutate({ id: team.id, ...roles })}
                      />
                      <button
                        type="button"
                        className="cricket-roster-more"
                        onClick={() => setActionsFor(playerId)}
                        aria-label={`More for ${playerById.get(playerId)?.name ?? "player"}`}
                      >
                        <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      )}

      {tab === "matches" && (
        <ListCard>
          <MatchesBoard matches={matches} />
        </ListCard>
      )}

      {tab === "leaderboard" && (
        <ListCard>
          <LeaderboardGrid matches={asTeam} playerIds={team.playerIds} scope="team" />
        </ListCard>
      )}

      {tab === "stats" && (
        <ListCard>
          <TeamStatsView stats={teamStats(asTeam, 0)} />
        </ListCard>
      )}

      {/* Pinned to the bottom while the Players tab is open. */}
      {showAddBar && (
        <div className="cricket-action-bar">
          <Button variant="primary" onClick={() => setAdding(true)}>
            <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add players
          </Button>
        </div>
      )}

      {adding && (
        <AddPlayersByMobileSheet
          title={`Add players to ${team.name}`}
          lookup={lookupCricketPlayer}
          blockedReason={(player) => (team.playerIds.includes(player.id) ? `Already in ${team.name}` : null)}
          saving={addPlayers.isPending}
          onSave={(rows) => addPlayers.mutateAsync({ id: team.id, players: rows })}
          onClose={() => setAdding(false)}
        />
      )}

      {renaming && (
        <BottomSheet title="Rename Team" icon="fa-solid fa-pen" onClose={() => setRenaming(false)}>
          <RenameForm team={team} onSaved={() => setRenaming(false)} />
        </BottomSheet>
      )}

      {actionsFor !== null && (
        <BottomSheet
          title={playerById.get(actionsFor)?.name ?? "Player"}
          icon="fa-solid fa-user"
          onClose={() => setActionsFor(null)}
        >
          <div className="cricket-settings-list">
            <button
              type="button"
              className="cricket-settings-item is-danger"
              disabled={updateTeam.isPending}
              onClick={() => {
                setActionsFor(null);
                handleRemovePlayer(actionsFor);
              }}
            >
              <i className="fa-solid fa-user-minus" aria-hidden="true"></i>
              <span>
                Remove from team
                <small>Matches already made keep them</small>
              </span>
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
