import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import {
  useCricketTournament,
  useMoveCricketPlayer,
  useRemoveCricketTeam,
  useSwapCricketPlayers,
} from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketPlayer } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ListCard } from "../../components/ListCard";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { avatarColorFor } from "../avatarColor";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { roleOf } from "../playerRoles";
import { StatTiles, type StatGroup } from "../StatTiles";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { oversText, pointsTable, rate, strikeRate, teamStats, type TeamStats } from "../stats";
import { TeamForm } from "./CricketTeamTools";
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
  const [editing, setEditing] = useState(false);
  // Player whose "Move / swap" sheet is open.
  const [moving, setMoving] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const { admin } = useAdminAuth();
  const canManage = Boolean(admin?.isSuperAdmin);
  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);

  const team = tournament?.teams[teamIndex];
  if (isLoading || !tournament || !team) {
    return (
      <ListCard title="Team">
        <p>{isLoading ? "Loading..." : "Team not found."}</p>
      </ListCard>
    );
  }

  const backTo = `/tournaments/${id}?tab=teams`;
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

  return (
    <div className="cricket-page">
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <div className="cricket-th">
            <div
              className={`cricket-th-cover ${tournament.bannerUrl ? "" : "is-empty"}`}
              style={tournament.bannerUrl ? { backgroundImage: `url(${tournament.bannerUrl})` } : undefined}
            >
              <div className="cricket-th-bar">
                <Link to={backTo} className="cricket-th-glass">
                  <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                  <span>All teams</span>
                </Link>
                {canManage && (
                  <div className="cricket-th-actions">
                    <button type="button" className="cricket-th-glass" onClick={() => setEditing(true)}>
                      <i className="fa-solid fa-pen" aria-hidden="true"></i>
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="cricket-th-glass"
                      disabled={removeTeam.isPending}
                      onClick={handleRemove}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true"></i>
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="cricket-th-identity">
              <span className="cricket-tour-logo" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
                {team.name.charAt(0).toUpperCase()}
              </span>
              <div className="cricket-th-title">
                <h1>{team.name}</h1>
                <div className="cricket-th-meta">
                  <span>
                    <i className="fa-solid fa-trophy" aria-hidden="true"></i> {tournament.name}
                  </span>
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

        <div className="cricket-match-tabs" role="tablist" aria-label="Team sections">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? "active" : ""}
              onClick={() => setParams({ tab: t.value }, { replace: true })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "info" && (
        <ListCard title="">
          <div className="cricket-info">
            <h2 className="cricket-info-title">Team details</h2>
            <dl className="cricket-info-card">
              {(
                [
                  [
                    "Tournament",
                    <Link key="tournament" to={`/tournaments/${id}`} className="cricket-info-link">
                      {tournament.name} <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                    </Link>,
                  ],
                  ["Players", team.playerIds.length],
                  ["Position", record && record.played > 0 ? `${position + 1} of ${standings.length}` : "—"],
                  ["Played", record?.played ?? 0],
                  ["Won", record?.won ?? 0],
                  ["Lost", record?.lost ?? 0],
                  ["Tied", record?.tied ?? 0],
                  ["No result", record?.noResult ?? 0],
                  ["Points", record?.points ?? 0],
                  ["Net run rate", record ? (record.nrr >= 0 ? "+" : "") + record.nrr.toFixed(3) : "—"],
                ] as [string, ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="cricket-info-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </ListCard>
      )}

      {tab === "players" && (
        <ListCard title={`Players (${team.playerIds.length})`}>
          {team.playerIds.length === 0 ? (
            <div className="admin-empty-state">No players in this team yet.</div>
          ) : (
            <ul className="cricket-roster">
              {team.playerIds.map((playerId) => (
                <li key={playerId}>
                  <RosterPlayer player={playerById.get(playerId)} />
                  {canManage && tournament.teams.length > 1 && (
                    <button
                      type="button"
                      className="cricket-roster-action"
                      onClick={() => setMoving(playerId)}
                      aria-label={`Move or swap ${playerById.get(playerId)?.name ?? "player"}`}
                    >
                      <i className="fa-solid fa-right-left" aria-hidden="true"></i> Move
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      )}

      {tab === "matches" && (
        <ListCard title="Matches">
          <MatchesBoard matches={teamMatches} />
        </ListCard>
      )}

      {tab === "leaderboard" && (
        <ListCard title="Leaderboard">
          <LeaderboardGrid matches={teamMatches} playerIds={team.playerIds} scope="team" />
        </ListCard>
      )}

      {tab === "stats" && (
        <ListCard title="Team Stats">
          <TeamStatsView stats={teamStats(teamMatches, teamIndex)} />
        </ListCard>
      )}

      {editing && (
        <BottomSheet title="Edit Team" onClose={() => setEditing(false)} wide>
          <TeamForm tournament={tournament} index={teamIndex} onSaved={() => setEditing(false)} />
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
function TeamStatsView({ stats: t }: { stats: TeamStats }) {
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

function RosterPlayer({ player }: { player: CricketPlayer | undefined }) {
  const name = player?.name ?? "Removed player";
  const role = roleOf(player?.role ?? null);
  return (
    <>
      <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-roster-avatar" />
      <span className="cricket-roster-who">
        <strong>{name}</strong>
        {role && (
          <small>
            <i className={`fa-solid ${role.icon}`} aria-hidden="true"></i> {role.label}
          </small>
        )}
      </span>
    </>
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
                    <RosterPlayer player={playerById.get(otherId)} />
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
