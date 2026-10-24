import { useState } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useSetCricketSquad } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketTournament } from "../../../api/types";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { AddPlayerByMobile } from "../players/AddPlayerByMobile";
import { PlayerCard } from "../players/PlayerCard";

// The tournament's squad. There can be many players, so they aren't listed
// here: players join by mobile number right in this card (a new number joins
// the shared player list too) and show up under Match Players; the squad
// opens in its own sheet to search or take players out.
export function CricketSquadPicker({ tournament, busy }: { tournament: CricketTournament; busy: boolean }) {
  const setSquad = useSetCricketSquad();
  const [viewing, setViewing] = useState(false);
  const count = tournament.playerIds.length;

  return (
    <>
      <p className="admin-hint">
        Add the players taking part by mobile number — they show up under Match Players to be matched.
      </p>
      <AddPlayerByMobile
        blockedReason={(id) => (tournament.playerIds.includes(id) ? "Already in the squad" : null)}
        onAdded={(player) => setSquad.mutate({ id: tournament.id, playerIds: [...tournament.playerIds, player.id] })}
      />
      <Button variant="outline" className="mt-2" disabled={count === 0} onClick={() => setViewing(true)}>
        <i className="fa-solid fa-users" aria-hidden="true"></i> View squad ({count})
      </Button>
      {viewing && <SquadSheet tournament={tournament} busy={busy} onClose={() => setViewing(false)} />}
    </>
  );
}

// The squad, searchable; tapping a player takes them out (and back in, for
// anyone taken out while the sheet is open). Each tap saves straight away.
function SquadSheet({
  tournament,
  busy,
  onClose,
}: {
  tournament: CricketTournament;
  busy: boolean;
  onClose: () => void;
}) {
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

  // Dropping a matched player also takes them out of their set — check first.
  async function toggle(playerId: number) {
    if (!squad.has(playerId)) return save([...tournament.playerIds, playerId]);
    if (
      matched.has(playerId) &&
      !(await confirmAction(
        "Remove from the squad?",
        "This player is in a matched set and will be taken out of it.",
        "Yes, remove",
      ))
    ) {
      return;
    }
    save(tournament.playerIds.filter((id) => id !== playerId));
    setDropped((current) => [...current, playerId]);
  }

  return (
    <BottomSheet title={`Squad (${tournament.playerIds.length})`} icon="fa-solid fa-users" onClose={onClose} fullScreen>
      <p className="admin-hint">Untick a player to take them out of the squad.</p>
      <input
        type="search"
        className="form-control shadow-none mb-3"
        placeholder="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {visible.length === 0 ? (
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
              onClick={() => void toggle(player.id)}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
