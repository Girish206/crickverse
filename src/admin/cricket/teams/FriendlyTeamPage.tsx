import { useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAddFriendlyTeamPlayers, useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { lookupCricketPlayer, useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { Button } from "../../components/Button";
import { ListCard } from "../../components/ListCard";
import { Loader } from "../../components/Loader";
import { PageHeader } from "../../components/PageHeader";
import { canManageMatch } from "../canManage";
import { LeaderboardGrid } from "../leaderboard/CricketLeaderboard";
import { MatchesBoard } from "../matches/CricketMatchesList";
import { teamStats } from "../stats";
import { AddPlayersByMobileSheet } from "../tournaments/AddTeamPlayersSheet";
import { RosterPlayer, TeamStatsView } from "../tournaments/CricketTeamPage";
import { roleTagsFor } from "../tournaments/TeamRoleChips";
import { TeamRecordCard } from "./TeamRecordCard";
import { bannerFor } from "../tournaments/tournamentArt";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";
import { TeamMark } from "./TeamMark";

type Tab = "info" | "players" | "matches" | "leaderboard" | "stats";

const TABS: { value: Tab; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "players", label: "Players" },
  { value: "matches", label: "Matches" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "stats", label: "Stats" },
];

const when = (m: CricketMatch) => m.scheduledAt ?? m.createdAt;

// A stable number from the name, so the team keeps the same banner art.
const nameSeed = (name: string) => [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

// A side from one-off (friendly) matches, which have no tournament team:
// everything here is gathered from the matches it played under this name.
// Laid out like the tournament team page, read-only.
export function FriendlyTeamPage() {
  const name = decodeURIComponent(useParams().name ?? "");
  const key = name.trim().toLowerCase();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { admin } = useAdminAuth();
  const { data: me, isLoading } = useCricketMe();
  const { data: players } = useCricketPlayers();
  // Only super admins can list every friendly match; players see the ones
  // they play in, follow or organise.
  const { data: allFriendlies } = useCricketMatches("none", { enabled: Boolean(admin?.isSuperAdmin) });
  const addPlayers = useAddFriendlyTeamPlayers();
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    const pool = [
      ...(admin?.isSuperAdmin ? (allFriendlies ?? []) : []),
      ...(me ? [...me.matches, ...me.followedMatches, ...me.followedPlayerMatches, ...me.createdMatches] : []),
    ];
    const byId = new Map(
      pool
        .filter((m) => m.tournamentId === null && m.teams.some((t) => t.name.trim().toLowerCase() === key))
        .map((m) => [m.id, m]),
    );
    return [...byId.values()].sort((a, b) => when(b).localeCompare(when(a)));
  }, [admin?.isSuperAdmin, allFriendlies, me, key]);

  // teamStats() and the leaderboard pick a side by teamIndex; a friendly
  // side can be either slot, so mark this team's side as 0 in every match.
  const asTeam = useMemo(
    () =>
      matches.map((m) => ({
        ...m,
        teams: m.teams.map((t) => ({ ...t, teamIndex: t.name.trim().toLowerCase() === key ? 0 : 1 })),
      })),
    [matches, key],
  ) as CricketMatch[];

  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.value === requested) ? requested : "info";
  const backTo = admin?.isSuperAdmin ? "/matches" : "/my-teams";

  if (isLoading) {
    return (
      <>
        <PageHeader title="Team" back={backTo} />
        <Loader page />
      </>
    );
  }
  if (matches.length === 0) {
    return (
      <>
        <PageHeader title="Team" back={backTo} />
        <ListCard title={name || "Team"}>
          <div className="admin-empty-state">No matches found for this team.</div>
        </ListCard>
      </>
    );
  }

  const sideOf = (m: CricketMatch) => m.teams.find((t) => t.name.trim().toLowerCase() === key)!;
  const latest = sideOf(matches[0]);
  const displayName = latest.name;
  // Everyone who has played for it, the latest line-up first.
  const playerIds = [...new Set(matches.flatMap((m) => sideOf(m).playerIds))];
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const completed = matches.filter((m) => m.status === "completed");
  const won = completed.filter((m) => m.winner !== null && m.teams[m.winner] === sideOf(m)).length;
  const lost = completed.filter((m) => m.winner !== null && m.teams[m.winner] !== sideOf(m)).length;
  const tied = completed.length - won - lost;
  const captain = latest.captainId != null ? playerById.get(latest.captainId) : undefined;
  // Players are added to its side in the matches it hasn't started yet —
  // by the side's captain there, or whoever manages the match.
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const myPlayerId = me?.player?.id;
  const canAddPlayers = upcoming.some(
    (m) => canManageMatch(admin, m, undefined) || (myPlayerId != null && sideOf(m).captainId === myPlayerId),
  );
  // Who's already in an upcoming squad, on this side or the other one.
  const upcomingSide = new Set(upcoming.flatMap((m) => sideOf(m).playerIds));
  const opponentOf = new Map(
    upcoming.flatMap((m) => m.teams.filter((t) => t !== sideOf(m)).flatMap((t) => t.playerIds.map((id) => [id, t.name]))),
  );

  const showAddBar = canAddPlayers && tab === "players";
  return (
    <div className={`cricket-page ${showAddBar ? "has-action-bar" : ""}`.trim()}>
      <PageHeader title={displayName} subtitle="Team" back={backTo} backLabel="Back" />
      <div className="cricket-th-sticky">
        <div className="card cricket-th-card">
          <div className="cricket-th">
            <div
              className="cricket-th-cover"
              style={{ backgroundImage: `url(${bannerFor({ id: nameSeed(key), bannerUrl: null })})` }}
            />
            <div className="cricket-th-identity">
              <TeamMark className="cricket-tour-logo" name={displayName} logoUrl={latest.logoUrl} />
              <div className="cricket-th-title">
                <h1>{displayName}</h1>
                <div className="cricket-th-meta">
                  <span>
                    <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> {matches.length} {matches.length === 1 ? "match" : "matches"}
                  </span>
                  <span>
                    <i className="fa-solid fa-users" aria-hidden="true"></i> {playerIds.length} players
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
            tied={tied}
            tiedLabel="Tied / NR"
            facts={[
              ["Players", playerIds.length],
              ["Matches", matches.length],
            ]}
          />
        </ListCard>
      )}

      {tab === "players" && (
        <ListCard>
          <ul className="cricket-roster">
            {playerIds.map((playerId) => (
              <li key={playerId}>
                <RosterPlayer player={playerById.get(playerId)} tags={roleTagsFor(latest, playerId)} />
              </li>
            ))}
          </ul>
        </ListCard>
      )}

      {tab === "matches" && (
        <ListCard>
          <MatchesBoard matches={matches} />
        </ListCard>
      )}

      {tab === "leaderboard" && (
        <ListCard>
          <LeaderboardGrid matches={asTeam} playerIds={playerIds} scope="team" />
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
          title={`Add players to ${displayName}`}
          note={`They join ${displayName}'s squad in its ${upcoming.length} upcoming match${upcoming.length === 1 ? "" : "es"}.`}
          lookup={lookupCricketPlayer}
          blockedReason={(player) =>
            upcomingSide.has(player.id)
              ? `Already in ${displayName}`
              : opponentOf.has(player.id)
                ? `Plays for ${opponentOf.get(player.id)} in an upcoming match`
                : null
          }
          saving={addPlayers.isPending}
          onSave={(players) => addPlayers.mutateAsync({ teamName: displayName, teamKey: latest.teamKey ?? undefined, players })}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
