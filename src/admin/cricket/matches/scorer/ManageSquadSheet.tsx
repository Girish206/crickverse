import { useState } from "react";
import { toast } from "sonner";
import { useMoveCricketPlayer, useRemoveCricketPlayer } from "../../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch } from "../../../../api/types";
import { confirmAction } from "../../../components/confirmDelete";
import { BottomSheet } from "../../BottomSheet";
import { PlayerAvatar } from "../../players/PlayerAvatar";
import { roleOf } from "../../playerRoles";
import { inningsSummary, type NameOf } from "../../stats";
import { hasPlayed } from "../matchUtils";
import { AddPlayerSheet } from "./AddPlayerSheet";

// A side's size sets how many wickets end its innings, so a change can't
// make or unmake an all-out (the API refuses it too).
function changesAllOut(match: CricketMatch, team: number, size: number) {
  const spare = match.lastManStands ? 0 : 1;
  const current = match.teams[team].playerIds.length;
  return match.innings.some((innings) => {
    if (innings.battingTeam !== team) return false;
    const { wickets } = inningsSummary(innings);
    return wickets >= current - spare !== wickets >= size - spare;
  });
}

// Why this player has to stay on their side, if they do.
function mustStay(match: CricketMatch, team: number, playerId: number) {
  if (hasPlayed(match, playerId)) return "Has batted, bowled or fielded";
  const size = match.teams[team].playerIds.length;
  if (size <= 2) return "A side needs at least 2 players";
  return changesAllOut(match, team, size - 1) ? "Needed as the next batter" : null;
}

// The scorer's changes to a live match's sides: add someone, take out
// someone who hasn't played, or send them to the other side.
export function ManageSquadSheet({ match, nameOf, onClose }: { match: CricketMatch; nameOf: NameOf; onClose: () => void }) {
  const remove = useRemoveCricketPlayer();
  const move = useMoveCricketPlayer();
  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const [team, setTeam] = useState<0 | 1>(0);
  const [adding, setAdding] = useState(false);

  if (adding) return <AddPlayerSheet match={match} nameOf={nameOf} initialTeam={team} onClose={() => setAdding(false)} />;

  const side = match.teams[team];
  const other = match.teams[1 - team];
  const otherFull = changesAllOut(match, 1 - team, other.playerIds.length + 1);
  const busy = remove.isPending || move.isPending;

  async function removePlayer(playerId: number) {
    const name = nameOf(playerId);
    const ok = await confirmAction(`Remove ${name}?`, `${name} will no longer play for ${side.name} in this match.`, "Yes, remove", "fa-solid fa-user-minus");
    if (ok) remove.mutate({ id: match.id, playerId }, { onSuccess: () => toast.success(`${name} removed from ${side.name}`) });
  }

  async function movePlayer(playerId: number) {
    const name = nameOf(playerId);
    const ok = await confirmAction(`Move ${name}?`, `${name} will play for ${other.name} instead of ${side.name}.`, "Yes, move", "fa-solid fa-right-left");
    if (ok) move.mutate({ id: match.id, playerId }, { onSuccess: () => toast.success(`${name} now plays for ${other.name}`) });
  }

  return (
    <BottomSheet title="Manage squads" icon="fa-solid fa-users-gear" onClose={onClose} fullScreen>
      <div className="cricket-manage-sides" role="radiogroup" aria-label="Side">
        {match.teams.map((item, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={team === i}
            className={team === i ? "active" : ""}
            onClick={() => setTeam(i as 0 | 1)}
          >
            <span>{item.name}</span> <small>{item.playerIds.length}</small>
          </button>
        ))}
      </div>

      <ul className="cricket-manage-list">
        {side.playerIds.map((playerId) => {
          const name = nameOf(playerId);
          const player = playerById.get(playerId);
          const stay = mustStay(match, team, playerId);
          return (
            <li key={playerId} className="cricket-manage-row">
              <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-player-card-avatar" />
              <span className="cricket-manage-name">
                <strong title={name}>{name}</strong>
                <small>{stay ?? roleOf(player?.role ?? null)?.label ?? "Yet to play"}</small>
              </span>
              {stay === null && (
                <span className="cricket-manage-actions">
                  <button
                    type="button"
                    disabled={busy || otherFull}
                    title={otherFull ? `${other.name} have been bowled out` : `Move to ${other.name}`}
                    aria-label={`Move ${name} to ${other.name}`}
                    onClick={() => movePlayer(playerId)}
                  >
                    <i className="fa-solid fa-right-left" aria-hidden="true"></i> Move
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={busy}
                    aria-label={`Remove ${name} from ${side.name}`}
                    onClick={() => removePlayer(playerId)}
                  >
                    <i className="fa-solid fa-user-minus" aria-hidden="true"></i> Remove
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className="cricket-manage-add" disabled={busy} onClick={() => setAdding(true)}>
        <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add a player to {side.name}
      </button>

      <p className="cricket-manage-hint">
        <i className="fa-solid fa-circle-info" aria-hidden="true"></i> Players who've batted, bowled or fielded can't be
        moved or removed.
      </p>
    </BottomSheet>
  );
}
