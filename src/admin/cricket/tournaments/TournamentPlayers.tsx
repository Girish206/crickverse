import { useMemo, useState } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useTournamentPlayerMobiles } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketPlayer, CricketPlayerJoinedVia, CricketTournament } from "../../../api/types";
import { Loader } from "../../components/Loader";
import { formatMobile } from "../mobile";
import { RosterPlayer } from "./CricketTeamPage";
import { NO_ROLES, roleTagsFor } from "./TeamRoleChips";
import { dateText } from "./TournamentInfo";

const JOINED_LABELS: Record<CricketPlayerJoinedVia, string> = {
  "signed-up": "Signed up themselves",
  invited: "Joined with an organiser's invite code",
  "login-given": "Login set by an admin",
  "not-joined": "No login yet",
};

// The line under a player's name. Super admins' lists carry how they
// registered; organisers and captains get just the number they may see.
function playerDetail(player: CricketPlayer | undefined, mobile: string | undefined) {
  if (!player?.joined) return mobile ? formatMobile(mobile) : undefined;
  const { via, at, hasEmail, addedBy } = player.joined;
  return [
    JOINED_LABELS[via],
    ...(addedBy ? [`Added by ${addedBy}`] : []),
    dateText(at),
    player.mobile ? formatMobile(player.mobile) : "No mobile number",
    ...(via === "not-joined" ? [] : [hasEmail ? "Has email" : "No email"]),
  ].join(" · ");
}

// The Players tab of a tournament: everyone in it, team by team, then anyone
// in the squad who isn't on a team yet. Tapping a player opens their profile.
export function TournamentPlayers({ tournament }: { tournament: CricketTournament }) {
  const { data: players, isLoading } = useCricketPlayers();
  const { data: mobiles } = useTournamentPlayerMobiles(tournament.id);
  const [search, setSearch] = useState("");
  const playerById = useMemo(() => new Map((players ?? []).map((player) => [player.id, player])), [players]);

  if (isLoading) return <Loader />;

  const onTeam = new Set(tournament.teams.flatMap((team) => team.playerIds));
  const groups = [
    ...tournament.teams.map((team) => ({ name: team.name, playerIds: team.playerIds, roles: team })),
    {
      name: "Not on a team yet",
      playerIds: tournament.playerIds.filter((playerId) => !onTeam.has(playerId)),
      roles: NO_ROLES,
    },
  ];
  const total = new Set([...onTeam, ...tournament.playerIds]).size;

  if (total === 0) return <div className="admin-empty-state">No players in this tournament yet.</div>;

  const term = search.trim().toLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      playerIds: group.playerIds.filter((playerId) => playerById.get(playerId)?.name.toLowerCase().includes(term) ?? !term),
    }))
    .filter((group) => group.playerIds.length > 0);

  return (
    <>
      <p className="admin-hint">
        {total} player{total === 1 ? "" : "s"} in this tournament
      </p>
      {total > 6 && (
        <input
          type="search"
          className="cricket-picker-search"
          placeholder="Search players"
          aria-label="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <div className="admin-empty-state">No one matches "{search}".</div>
      ) : (
        shown.map((group, index) => (
          <section key={index} className="cricket-move-team">
            <header>
              <strong>{group.name}</strong>
              <small className="text-muted">{group.playerIds.length}</small>
            </header>
            <ul className="cricket-roster">
              {group.playerIds.map((playerId) => (
                <li key={playerId}>
                  <RosterPlayer
                    player={playerById.get(playerId)}
                    tags={roleTagsFor(group.roles, playerId)}
                    detail={playerDetail(playerById.get(playerId), mobiles?.get(playerId))}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
