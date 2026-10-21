import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch, CricketPlayerRole, CricketTournament } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { roleOf } from "../playerRoles";
import type { NameOf } from "../stats";

// Batters first, then keepers, all-rounders and bowlers; no role set last.
const ROLE_ORDER: CricketPlayerRole[] = ["batter", "wicket-keeper", "all-rounder", "bowler"];

// The "Squads" tab: both sides facing each other, the playing XI first and
// (once the match has started) anyone in the team who sat out.
export function MatchSquads({
  match,
  tournament,
  nameOf,
}: {
  match: CricketMatch;
  tournament?: CricketTournament;
  nameOf: NameOf;
}) {
  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const started = match.status !== "scheduled";

  const rolePosition = (playerId: number) => {
    const role = playerById.get(playerId)?.role;
    const index = role ? ROLE_ORDER.indexOf(role) : -1;
    return index === -1 ? ROLE_ORDER.length : index;
  };
  const byRole = (ids: number[]) =>
    [...ids].sort((a, b) => rolePosition(a) - rolePosition(b) || nameOf(a).localeCompare(nameOf(b)));

  // Before the toss: the team's current roster (the match keeps a copy from
  // when it was scheduled, which goes stale if the team changes). After it:
  // the XI picked at the toss, and the rest of the roster on the bench.
  const roster = (slot: number) => tournament?.teams[match.teams[slot].teamIndex]?.playerIds ?? match.teams[slot].playerIds;
  const xi = match.teams.map((team, slot) => byRole(started ? team.playerIds : roster(slot)));
  const bench = match.teams.map((team, slot) =>
    started ? byRole(roster(slot).filter((id) => !team.playerIds.includes(id))) : [],
  );

  const cell = (playerId: number | undefined, side: "left" | "right", benched: boolean) => {
    if (playerId === undefined) return <div className={`cricket-squad-cell is-${side}`}></div>;
    const name = nameOf(playerId);
    const player = playerById.get(playerId);
    return (
      <div className={`cricket-squad-cell is-${side} ${benched ? "is-bench" : ""}`}>
        <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-squad-avatar" />
        <span className="cricket-squad-name">
          <strong title={name}>
            <PlayerLink playerId={playerId}>{name}</PlayerLink>
          </strong>
          <small>{roleOf(player?.role ?? null)?.label ?? "Role not set"}</small>
        </span>
      </div>
    );
  };

  // Header with each side's count, e.g. "11 · PLAYING XI · 11".
  const section = (title: string, lists: number[][], benched = false) => {
    const length = Math.max(lists[0].length, lists[1].length);
    if (length === 0) return null;
    return (
      <>
        <div className={`cricket-squad-section ${benched ? "is-bench" : ""}`}>
          <span>{lists[0].length}</span>
          {title}
          <span>{lists[1].length}</span>
        </div>
        {Array.from({ length }, (_, i) => (
          <div key={i} className="cricket-squad-row">
            {cell(lists[0][i], "left", benched)}
            {cell(lists[1][i], "right", benched)}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="cricket-squad-board">
      <div className="cricket-squad-row is-head">
        {match.teams.map((team, slot) => (
          <div key={slot} className={`cricket-squad-cell is-${slot === 0 ? "left" : "right"}`}>
            <span className="cricket-squad-badge" style={{ background: avatarColorFor(team.name) }}>
              {monogram(team.name)}
            </span>
            <span className="cricket-squad-team" title={team.name}>
              {team.name}
            </span>
          </div>
        ))}
      </div>
      {xi[0].length + xi[1].length === 0 ? (
        <p className="admin-hint m-3">No players in these teams yet.</p>
      ) : (
        <>
          {section(started ? "Playing XI" : "Squad", xi)}
          {section("Bench · not playing", bench, true)}
        </>
      )}
    </div>
  );
}
