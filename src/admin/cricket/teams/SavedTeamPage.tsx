import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { lookupCricketPlayer, useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import {
  useAddCricketSavedTeamPlayers,
  useCreateCricketSavedTeam,
  useCricketSavedTeam,
  useDeleteCricketSavedTeam,
  useSetCricketSavedTeamLogo,
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
import { PageHeader, PageHeaderAction } from "../../components/PageHeader";
import { SubmitButton } from "../../components/SubmitButton";
import InputComp from "../../dms/components/InputComp";
import { BottomSheet } from "../BottomSheet";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { teamKeyOf } from "../matches/matchUtils";
import { TeamInviteSheet } from "../qr/ShowQrSheets";
import { SettingsMenu } from "../SettingsMenu";
import { ShareMenu } from "../ShareMenu";
import { teamStats } from "../stats";
import { AddPlayersByMobileSheet } from "../tournaments/AddTeamPlayersSheet";
import { RosterPlayer, TeamStatsView } from "../tournaments/CricketTeamPage";
import { NO_ROLES, roleTagsFor, rolesOf, rolesWithout, TeamRoleChips, type TeamRoles } from "../tournaments/TeamRoleChips";
import { AddPlayerByMobile } from "../players/AddPlayerByMobile";
import { PlayerCard } from "../players/PlayerCard";
import { useImagePick } from "../tournaments/CricketTournamentForm";
import { bannerFor } from "../tournaments/tournamentArt";
import { TeamBadge, TeamLogoField } from "./TeamLogoField";
import { TeamRecordCard } from "./TeamRecordCard";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { useSwipeTabs } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";

type Tab = "info" | "players" | "matches" | "leaderboard" | "stats";

const TABS: { value: Tab; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "players", label: "Players" },
  { value: "matches", label: "Matches" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "stats", label: "Stats" },
];

const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;

// "Create Team" (the + menu and My Teams): a name and logo now, players on
// its page.
export function CreateSavedTeamForm({ onSaved }: { onSaved: () => void }) {
  const navigate = useNavigate();
  const createTeam = useCreateCricketSavedTeam();
  const setLogo = useSetCricketSavedTeamLogo();
  const logo = useImagePick(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the team's name");
    const team = await createTeam.mutateAsync(name.trim());
    if (logo.file) await setLogo.mutateAsync({ id: team.id, logo: logo.file });
    onSaved();
    navigate(`/teams/saved/${team.id}?tab=players`, { state: { from: "/my-teams" } });
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <p className="admin-hint">A team of your own, outside any tournament. Add its players next, then pick it when you create a match.</p>
      <TeamLogoField pick={logo} />
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
      <SubmitButton loading={createTeam.isPending || setLogo.isPending}>Create Team</SubmitButton>
    </ModalForm>
  );
}

// "Edit team", like a tournament team's: its logo, name, and players picked
// (or added by mobile number) with their leaders.
function EditTeamForm({ team, onSaved }: { team: CricketSavedTeam; onSaved: () => void }) {
  const { data: players } = useCricketPlayers();
  const updateTeam = useUpdateCricketSavedTeam();
  const setTeamRoles = useSetCricketSavedTeamRoles();
  const setLogo = useSetCricketSavedTeamLogo();
  const logo = useImagePick(team.logoUrl);
  const [name, setName] = useState(team.name);
  const [picked, setPicked] = useState<number[]>(team.playerIds);
  const [roles, setRoles] = useState<TeamRoles>(rolesOf(team));
  const [search, setSearch] = useState("");

  // The team's players plus anyone added by mobile number; unpicking keeps
  // them listed so they can be picked again.
  const listedIds = [...new Set([...team.playerIds, ...picked])];
  const visible = (players ?? []).filter(
    (player) => listedIds.includes(player.id) && player.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const saving = updateTeam.isPending || setTeamRoles.isPending || setLogo.isPending;

  function toggle(playerId: number) {
    if (picked.includes(playerId)) {
      setPicked(picked.filter((id) => id !== playerId));
      setRoles(rolesWithout(roles, playerId));
    } else {
      setPicked([...picked, playerId]);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const playersChanged = picked.length !== team.playerIds.length || picked.some((id) => !team.playerIds.includes(id));
    if ((trimmed && trimmed !== team.name) || playersChanged) {
      await updateTeam.mutateAsync({ id: team.id, name: trimmed || team.name, playerIds: picked });
    }
    const before = rolesOf(team);
    if ((Object.keys(roles) as (keyof TeamRoles)[]).some((key) => roles[key] !== before[key])) {
      await setTeamRoles.mutateAsync({ id: team.id, ...roles });
    }
    // undefined = untouched; null = removed (only if there was one).
    if (logo.file || (logo.file === null && team.logoUrl)) await setLogo.mutateAsync({ id: team.id, logo: logo.file });
    onSaved();
  }

  return (
    <ModalForm onSubmit={onSubmit}>
      <TeamLogoField pick={logo} />
      <InputComp
        label="Team Name"
        required
        maxLength={60}
        value={name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label m-0">
          Players ({picked.length})
          {picked.length > 0 && <small className="text-muted fw-normal"> · tap C, VC or WK to pick leaders</small>}
        </label>
        {picked.length > 0 && (
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => {
              setPicked([]);
              setRoles(NO_ROLES);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <AddPlayerByMobile
        blockedReason={(playerId) => (picked.includes(playerId) ? "Already in this team" : null)}
        onAdded={(player) => setPicked((current) => [...current, player.id])}
      />
      <input
        type="search"
        className="form-control shadow-none my-2"
        placeholder="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="cricket-player-card-list cricket-team-pick-list">
        {visible.length === 0 ? (
          <div className="admin-empty-state">
            {listedIds.length ? "No players match." : "No players yet — add them by mobile number above."}
          </div>
        ) : (
          visible.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              selected={picked.includes(player.id)}
              onClick={() => toggle(player.id)}
            >
              <TeamRoleChips roles={roles} playerId={player.id} playerName={player.name} onChange={setRoles} />
            </PlayerCard>
          ))
        )}
      </div>
      <SubmitButton loading={saving}>Save</SubmitButton>
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
  // The team's join link and QR code, for players to add themselves.
  const [inviting, setInviting] = useState(false);
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
  const swipeRef = useSwipeTabs(TABS.map((t) => t.value), tab, (value) =>
    setParams({ tab: value }, { replace: true, state: location.state })
  );
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
          <>
            <ShareMenu
              heading="Share team"
              path={`/teams/saved/${team.id}`}
              title={team.name}
              image={team.logoUrl ?? undefined}
              text={`${team.name} on CricDesk`}
            />
            {canManage && (
              <>
                {/* The team's join QR code and link, for players to add themselves. */}
                <PageHeaderAction
                  icon="fa-solid fa-qrcode"
                  label="Team QR code"
                  active={inviting}
                  onClick={() => setInviting(true)}
                />
                <SettingsMenu
                  title="Team settings"
                  items={[
                    { icon: "fa-solid fa-pen", label: "Edit team", onClick: () => setRenaming(true) },
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
              </>
            )}
          </>
        }
      />
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <div className="cricket-th">
            <div className="cricket-th-cover" style={{ backgroundImage: `url(${bannerFor({ id: team.id, bannerUrl: null })})` }} />
            <div className="cricket-th-identity">
              <TeamBadge name={team.name} logoUrl={team.logoUrl} />
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

        <div ref={swipeRef} className="cricket-match-tabs" role="tablist" aria-label="Team sections">
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
                    No players yet{canManage ? " — add them by mobile number or QR code, or send them the invite link." : "."}
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
          </>
        )}
      </SwipePanels>

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

      {inviting && (
        <TeamInviteSheet team={{ savedTeamId: team.id }} name={team.name} onClose={() => setInviting(false)} />
      )}

      {renaming && (
        <BottomSheet title="Edit Team" icon="fa-solid fa-pen" onClose={() => setRenaming(false)} wide>
          <EditTeamForm team={team} onSaved={() => setRenaming(false)} />
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
