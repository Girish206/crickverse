import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import {
  useCricketTournament,
  useMoveCricketPlayer,
  useRemoveCricketTeam,
  useSetCricketSquad,
  useSetCricketTeamRoles,
  useSwapCricketPlayers,
  useUpdateCricketTeam,
} from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketPlayer } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { canManageTournament } from "../canManage";
import { Button } from "../../components/Button";
import { ListCard } from "../../components/ListCard";
import { PageHeader, PageHeaderAction } from "../../components/PageHeader";
import { useFollowMenuItem } from "../follow/FollowButton";
import { TeamInviteSheet } from "../qr/ShowQrSheets";
import { SettingsMenu } from "../SettingsMenu";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { roleOf } from "../playerRoles";
import { StatTiles, type StatGroup } from "../StatTiles";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { oversText, pointsTable, rate, strikeRate, teamStats, type TeamStats } from "../stats";
import { AddTeamPlayersSheet } from "./AddTeamPlayersSheet";
import { ShareSquadSheet } from "./ShareSquadSheet";
import { ShareMenu } from "../ShareMenu";
import { useTips, type TipStep } from "../TipsTour";
import { TeamForm } from "./CricketTeamTools";
import { bannerFor } from "./tournamentArt";
import { TeamBadge } from "../teams/TeamLogoField";
import { TeamRecordCard } from "../teams/TeamRecordCard";
import { roleTagInfo, roleTagsFor, rolesOf, TeamRoleChips } from "./TeamRoleChips";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type Tab = "info" | "players" | "matches" | "leaderboard" | "stats";

const TABS: { value: Tab; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "players", label: "Players" },
  { value: "matches", label: "Matches" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "stats", label: "Stats" },
];

const TEAM_TIPS: TipStep[] = [
  {
    target: "tabs",
    title: "All about the team",
    text: "See the team's record, its players, its matches and how its players rank on the Leaderboard and Stats tabs.",
  },
  {
    target: "share",
    title: "Share the squad",
    text: "Send the team's link, or share the squad as a picture with every player's photo and role.",
  },
  {
    target: "settings",
    title: "Follow the team",
    text: "Follow the team to get its matches on your Home. Show these tips again from here.",
  },
];

// One team of a tournament, laid out like the tournament page: a banner
// header, then Info (record and standing), Players, Matches, Leaderboard
// (its players' boards) and Stats (team totals: runs, 4s, 6s, dots…) tabs.
// Organisers can edit or remove the team and move / swap its players here.
export function CricketTeamPage() {
  const id = Number(useParams().id);
  const teamIndex = Number(useParams().team);
  const navigate = useNavigate();
  const { data: tournament, isLoading } = useCricketTournament(id);
  const { data: matches } = useCricketMatches(id);
  const { data: players } = useCricketPlayers();
  const removeTeam = useRemoveCricketTeam();
  const setRoles = useSetCricketTeamRoles();
  const updateTeam = useUpdateCricketTeam();
  const setSquad = useSetCricketSquad();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  // The team's join link and QR code, for players to add themselves.
  const [inviting, setInviting] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Player whose "Move / swap" sheet is open.
  const [moving, setMoving] = useState<number | null>(null);
  // Player whose "⋮" sheet (move / swap, remove) is open.
  const [actionsFor, setActionsFor] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // Opened from My Teams: the team stands on its own there, so the header
  // leaves out the tournament (the Info tab still links to it).
  const fromMyTeams = (location.state as { from?: string } | null)?.from === "/my-teams";
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const { admin } = useAdminAuth();
  const { data: me } = useCricketMe();
  const canManage = canManageTournament(admin, tournament, me?.player?.id);
  const followItem = useFollowMenuItem({ kind: "team", targetId: id, teamIndex });
  const tips = useTips("team", TEAM_TIPS, Boolean(tournament?.teams[teamIndex]));
  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);

  const team = tournament?.teams[teamIndex];
  const backTo = `/tournaments/${id}?tab=teams`;
  if (isLoading || !tournament || !team) {
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

  // The team's captain can add players too (but not move, swap or edit).
  const canAddPlayers = canManage || (me?.player != null && team.captainId === me.player.id);
  const teamMatches = (matches ?? []).filter((match) => match.teams.some((t) => t.teamIndex === teamIndex));
  const standings = pointsTable(tournament, matches ?? []);
  const position = standings.findIndex((row) => row.teamIndex === teamIndex);
  const record = standings[position];

  async function handleRemove() {
    if (
      await confirmAction(
        `Remove ${team!.name}?`,
        team!.playerIds.length
          ? `Its ${team!.playerIds.length} player${team!.playerIds.length === 1 ? "" : "s"} stay in the squad.`
          : "It has no players yet.",
        "Yes, remove",
      )
    ) {
      await removeTeam.mutateAsync({ id, index: teamIndex });
      navigate(backTo);
    }
  }

  // Takes the player off this team (the server clears any captain /
  // vice-captain / keeper role they held) and out of the tournament's squad.
  async function handleRemovePlayer(playerId: number) {
    const name = playerById.get(playerId)?.name ?? "this player";
    if (
      await confirmAction(
        `Remove ${name}?`,
        `They leave ${team!.name} and the ${tournament!.name} tournament.`,
        "Yes, remove",
      )
    ) {
      await updateTeam.mutateAsync({
        id,
        index: teamIndex,
        name: team!.name,
        playerIds: team!.playerIds.filter((pid) => pid !== playerId),
      });
      await setSquad.mutateAsync({ id, playerIds: tournament!.playerIds.filter((pid) => pid !== playerId) });
    }
  }

  const showAddBar = canAddPlayers && tab === "players";
  return (
    <div className={`cricket-page ${showAddBar ? "has-action-bar" : ""}`.trim()}>
      {tips.element}
      <PageHeader
        title={team.name}
        subtitle={fromMyTeams ? undefined : tournament.name}
        back={backTo}
        backLabel="All teams"
        actions={
          <>
            <ShareMenu
              heading="Share team"
              path={`/tournaments/${id}/teams/${teamIndex}`}
              title={team.name}
              text={`${team.name} · ${tournament.name} on CricDesk`}
              items={
                team.playerIds.length > 0
                  ? [{
                      icon: "fa-solid fa-users",
                      label: "Squad card",
                      description: "The players with their photos and roles as a picture",
                      onClick: () => setSharing(true),
                    }]
                  : []
              }
            />
            {/* The team's join QR code and link, for players to add themselves. */}
            {canAddPlayers && (
              <PageHeaderAction
                icon="fa-solid fa-qrcode"
                label="Team QR code"
                active={inviting}
                onClick={() => setInviting(true)}
              />
            )}
            <SettingsMenu
              title="Team settings"
              items={[
                ...(followItem ? [followItem] : []),
                { icon: "fa-solid fa-lightbulb", label: "Show tips", onClick: tips.start },
                ...(canManage
                  ? [
                      { icon: "fa-solid fa-pen", label: "Edit team", onClick: () => setEditing(true) },
                      {
                        icon: "fa-solid fa-trash",
                        label: "Remove team",
                        description: "Takes it out of the tournament",
                        danger: true,
                        disabled: removeTeam.isPending,
                        onClick: handleRemove,
                      },
                    ]
                  : []),
              ]}
            />
          </>
        }
      />
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <div className="cricket-th">
            <div className="cricket-th-cover" style={{ backgroundImage: `url(${bannerFor(tournament)})` }} />
            <div className="cricket-th-identity">
              <TeamBadge name={team.name} logoUrl={team.logoUrl} />
              <div className="cricket-th-title">
                <h1>{team.name}</h1>
                <div className="cricket-th-meta">
                  {!fromMyTeams && (
                    <span>
                      <i className="fa-solid fa-trophy" aria-hidden="true"></i> {tournament.name}
                    </span>
                  )}
                  <span>
                    <i className="fa-solid fa-users" aria-hidden="true"></i> {team.playerIds.length} players
                  </span>
                  {record && record.played > 0 && (
                    <span>
                      W{record.won} · L{record.lost}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cricket-match-tabs" role="tablist" aria-label="Team sections" data-tour="tabs">
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
            captain={team.captainId != null ? playerById.get(team.captainId) : undefined}
            played={record?.played ?? 0}
            won={record?.won ?? 0}
            lost={record?.lost ?? 0}
            tied={(record?.tied ?? 0) + (record?.noResult ?? 0)}
            tiedLabel="Tied / NR"
            facts={[
              [
                "Tournament",
                <Link key="tournament" to={`/tournaments/${id}`} className="cricket-info-link">
                  {tournament.name} <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </Link>,
              ],
              ["Position", record && record.played > 0 ? `${position + 1} of ${standings.length}` : "—"],
              ["Points", record?.points ?? 0],
              ["Net run rate", record ? (record.nrr >= 0 ? "+" : "") + record.nrr.toFixed(3) : "—"],
              ["Players", team.playerIds.length],
            ]}
          />
        </ListCard>
      )}

      {tab === "players" && (
        <ListCard>
          {team.playerIds.length === 0 ? (
            <div className="admin-empty-state">No players in this team yet.</div>
          ) : (
            <ul className="cricket-roster">
              {team.playerIds.map((playerId) => (
                <li key={playerId}>
                  <RosterPlayer player={playerById.get(playerId)} tags={canManage ? [] : roleTagsFor(team, playerId)} />
                  {canManage && (
                    <TeamRoleChips
                      roles={rolesOf(team)}
                      playerId={playerId}
                      playerName={playerById.get(playerId)?.name ?? "Player"}
                      disabled={setRoles.isPending}
                      onChange={(roles) => setRoles.mutate({ id, index: teamIndex, ...roles })}
                    />
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="cricket-roster-more"
                      onClick={() => setActionsFor(playerId)}
                      aria-label={`More for ${playerById.get(playerId)?.name ?? "player"}`}
                    >
                      <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      )}

      {tab === "matches" && (
        <ListCard>
          <MatchesBoard matches={teamMatches} />
        </ListCard>
      )}

      {tab === "leaderboard" && (
        <ListCard>
          <LeaderboardGrid matches={teamMatches} playerIds={team.playerIds} scope="team" />
        </ListCard>
      )}

      {tab === "stats" && (
        <ListCard>
          <TeamStatsView stats={teamStats(teamMatches, teamIndex)} />
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

      {editing && (
        <BottomSheet title="Edit Team" onClose={() => setEditing(false)} wide>
          <TeamForm tournament={tournament} index={teamIndex} onSaved={() => setEditing(false)} />
        </BottomSheet>
      )}

      {sharing && (
        <ShareSquadSheet tournament={tournament} team={team} playerById={playerById} onClose={() => setSharing(false)} />
      )}

      {inviting && (
        <TeamInviteSheet team={{ tournamentId: id, teamIndex }} name={team.name} onClose={() => setInviting(false)} />
      )}

      {adding && <AddTeamPlayersSheet tournament={tournament} teamIndex={teamIndex} onClose={() => setAdding(false)} />}

      {actionsFor !== null && (
        <BottomSheet
          title={playerById.get(actionsFor)?.name ?? "Player"}
          icon="fa-solid fa-user"
          onClose={() => setActionsFor(null)}
        >
          <div className="cricket-settings-list">
            {tournament.teams.length > 1 && (
              <button
                type="button"
                className="cricket-settings-item"
                onClick={() => {
                  setMoving(actionsFor);
                  setActionsFor(null);
                }}
              >
                <i className="fa-solid fa-right-left" aria-hidden="true"></i>
                <span>
                  Move or swap
                  <small>Send to another team, or trade with one of its players</small>
                </span>
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            )}
            <button
              type="button"
              className="cricket-settings-item is-danger"
              disabled={updateTeam.isPending || setSquad.isPending}
              onClick={() => {
                setActionsFor(null);
                handleRemovePlayer(actionsFor);
              }}
            >
              <i className="fa-solid fa-user-minus" aria-hidden="true"></i>
              <span>
                Remove player
                <small>Takes them off the team and out of the tournament</small>
              </span>
            </button>
          </div>
        </BottomSheet>
      )}

      {moving !== null && (
        <MoveSheet
          tournamentId={id}
          teams={tournament.teams}
          fromTeam={teamIndex}
          playerId={moving}
          playerById={playerById}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
}

// Team totals as tiles, grouped into batting, bowling and fielding.
export function TeamStatsView({ stats: t }: { stats: TeamStats }) {
  if (t.matches === 0) return <div className="admin-empty-state">Stats appear once the team's matches are scored.</div>;
  const groups: StatGroup[] = [
    {
      title: "Overview",
      icon: "fa-chart-simple",
      tiles: [
        ["Matches", t.matches],
        ["Won", t.won],
        ["Lost", t.lost],
        ["Win %", t.won + t.lost ? `${Math.round((t.won * 100) / (t.won + t.lost))}%` : "–"],
      ],
    },
    {
      title: "Batting",
      icon: "fa-baseball-bat-ball",
      tiles: [
        ["Runs", t.runs],
        ["Run rate", rate(t.runs, t.ballsFaced)],
        ["Overs faced", oversText(t.ballsFaced)],
        ["Wickets lost", t.wicketsLost],
        ["Fours", t.fours],
        ["Sixes", t.sixes],
        ["Dot balls", t.dotsFaced],
        ["Dot %", t.ballsFaced ? `${Math.round((t.dotsFaced * 100) / t.ballsFaced)}%` : "–"],
        ["Boundary runs", t.fours * 4 + t.sixes * 6],
        ["Extras received", t.extrasReceived],
        ["Highest total", t.highest ?? "–"],
        ["Lowest total", t.lowest ?? "–"],
        ["Strike rate", strikeRate(t.runs, t.ballsFaced)],
        ["Avg per innings", t.innings ? Math.round(t.runs / t.innings) : "–"],
      ],
    },
    {
      title: "Bowling",
      icon: "fa-baseball",
      tiles: [
        ["Wickets", t.wickets],
        ["Economy", rate(t.runsConceded, t.ballsBowled)],
        ["Overs bowled", oversText(t.ballsBowled)],
        ["Runs conceded", t.runsConceded],
        ["Dot balls", t.dotsBowled],
        ["Maidens", t.maidens],
        ["Wides", t.wides],
        ["No-balls", t.noBalls],
        ["Fours conceded", t.foursConceded],
        ["Sixes conceded", t.sixesConceded],
      ],
    },
    {
      title: "Fielding",
      icon: "fa-hands",
      tiles: [
        ["Catches", t.catches],
        ["Run-outs", t.runOuts],
        ["Stumpings", t.stumpings],
      ],
    },
  ];
  return <StatTiles groups={groups} />;
}

// `linked` = tapping the player (photo or name) opens their profile (off
// inside buttons).
export function RosterPlayer({
  player,
  tags = [],
  linked = true,
}: {
  player: CricketPlayer | undefined;
  tags?: string[];
  linked?: boolean;
}) {
  const name = player?.name ?? "Removed player";
  const role = roleOf(player?.role ?? null);
  // C / VC / WK are marked on the avatar only, side by side at its
  // bottom-right.
  const lead = tags.find((tag) => tag === "C" || tag === "VC");
  const keeper = tags.includes("WK");
  const roleNames = tags.map((tag) => roleTagInfo(tag)?.label ?? tag).join(", ");
  const content = (
    <>
      <span
        className={`cricket-roster-avatar-wrap${lead ? ` is-lead-${lead.toLowerCase()}` : ""}`}
        title={roleNames || undefined}
      >
        <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-roster-avatar" />
        {(lead || keeper) && (
          <span className="cricket-roster-leads" aria-hidden="true">
            {lead && <span className="cricket-roster-lead">{lead}</span>}
            {keeper && <span className="cricket-roster-lead is-wk">WK</span>}
          </span>
        )}
      </span>
      <span className="cricket-roster-who">
        <strong>
          {name}
        </strong>
        {(role || roleNames) && (
          <small className="cricket-roster-meta">
            {role && <span>{role.label}</span>}
            {roleNames && <span className="visually-hidden">{roleNames}</span>}
          </small>
        )}
      </span>
    </>
  );
  return (
    <PlayerLink playerId={linked ? player?.id : null} className="cricket-roster-pick">
      {content}
    </PlayerLink>
  );
}

// Send a player to another team: straight in ("Move here"), or in exchange
// for one of that team's players.
function MoveSheet({
  tournamentId,
  teams,
  fromTeam,
  playerId,
  playerById,
  onClose,
}: {
  tournamentId: number;
  teams: { name: string; playerIds: number[] }[];
  fromTeam: number;
  playerId: number;
  playerById: Map<number, CricketPlayer>;
  onClose: () => void;
}) {
  const movePlayer = useMoveCricketPlayer();
  const swapPlayers = useSwapCricketPlayers();
  const busy = movePlayer.isPending || swapPlayers.isPending;
  const name = playerById.get(playerId)?.name ?? "Player";

  return (
    <BottomSheet title={`Move ${name}`} icon="fa-solid fa-right-left" onClose={onClose} fullScreen>
      {teams.map((team, index) =>
        index === fromTeam ? null : (
          <section key={index} className="cricket-move-team">
            <header>
              <strong>{team.name}</strong>
              <button
                type="button"
                className="cricket-roster-action"
                disabled={busy}
                onClick={() =>
                  movePlayer.mutate({ id: tournamentId, playerId, toTeamIndex: index }, { onSuccess: onClose })
                }
              >
                <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> Move here
              </button>
            </header>
            {team.playerIds.length > 0 && <small className="text-muted">Or swap with:</small>}
            <ul className="cricket-roster">
              {team.playerIds.map((otherId) => (
                <li key={otherId}>
                  <button
                    type="button"
                    className="cricket-roster-pick"
                    disabled={busy}
                    onClick={() =>
                      swapPlayers.mutate({ id: tournamentId, playerA: playerId, playerB: otherId }, { onSuccess: onClose })
                    }
                  >
                    <RosterPlayer player={playerById.get(otherId)} linked={false} />
                    <i className="fa-solid fa-right-left cricket-roster-swap" aria-hidden="true"></i>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </BottomSheet>
  );
}
