import { useState } from "react";
import { Link } from "react-router-dom";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useSetCricketSquad } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketTournament } from "../../../api/types";
import { confirmAction } from "../../components/confirmDelete";
import { AddPlayerByMobile } from "../players/AddPlayerByMobile";
import { PlayerCard } from "../players/PlayerCard";

// The tournament's squad. Players join by mobile number (the whole player
// list is too long to show); a new number joins the shared list too. Each
// tick saves straight away.
export function CricketSquadPicker({ tournament, busy }: { tournament: CricketTournament; busy: boolean }) {
  const { data: players } = useCricketPlayers();
  const setSquad = useSetCricketSquad();
  const [search, setSearch] = useState("");
  // Taken out this visit: still listed (unticked) so they can be ticked back.
  const [dropped, setDropped] = useState<number[]>([]);

  const squad = new Set(tournament.playerIds);
  const matched = new Set(tournament.matchSets.flatMap((set) => set.playerIds));
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const listed = [...tournament.playerIds, ...dropped.filter((id) => !squad.has(id))].flatMap((id) => {
    const player = playerById.get(id);
    return player ? [player] : [];
  });
  const visible = listed.filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()));
  const saving = busy || setSquad.isPending;

  function save(playerIds: number[]) {
    setSquad.mutate({ id: tournament.id, playerIds });
  }

  // Dropping matched players also takes them out of their sets — check first.
  async function remove(ids: number[]) {
    const matchedCount = ids.filter((id) => matched.has(id)).length;
    if (
      matchedCount > 0 &&
      !(await confirmAction(
        "Remove from the squad?",
        `${matchedCount === 1 ? "This player is" : `${matchedCount} of these players are`} in a matched set and will be taken out of it.`,
        "Yes, remove",
      ))
    ) {
      return;
    }
    const drop = new Set(ids);
    save(tournament.playerIds.filter((id) => !drop.has(id)));
    setDropped((current) => [...current, ...ids]);
  }

  function toggle(playerId: number) {
    if (squad.has(playerId)) {
      void remove([playerId]);
    } else {
      save([...tournament.playerIds, playerId]);
    }
  }

  return (
    <>
      <p className="admin-hint">
        Add the players taking part by mobile number. Someone not in the shared{" "}
        <Link to="/players" className="admin-link">
          player list
        </Link>{" "}
        yet joins it too. Untick to take a player out.
      </p>

      <AddPlayerByMobile
        blockedReason={(id) => (squad.has(id) ? "Already in the squad" : null)}
        onAdded={(player) => save([...tournament.playerIds, player.id])}
      />

      <div className="cricket-squad-toolbar">
        <input
          type="search"
          className="form-control shadow-none"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="admin-filter-count">
          {tournament.playerIds.length} in squad
        </span>
      </div>

      {listed.length === 0 ? (
        <div className="admin-empty-state">No players in the squad yet — add them by mobile number above.</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty-state">No players match "{search}".</div>
      ) : (
        <div className="cricket-player-card-list is-grid">
          {visible.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              selected={squad.has(player.id)}
              disabled={saving}
              tag={matched.has(player.id) ? "Matched" : undefined}
              onClick={() => toggle(player.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
