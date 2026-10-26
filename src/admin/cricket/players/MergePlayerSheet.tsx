import { useState } from "react";
import { toast } from "sonner";
import { useCricketPlayers, useMergeCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketPlayer } from "../../../api/types";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { formatMobile } from "../mobile";
import { PlayerAvatar } from "./PlayerAvatar";

// For a person added twice (super admins): pick the record to keep and
// everything recorded for `player` moves onto it; `player` is deleted.
export function MergePlayerSheet({ player, onClose }: { player: CricketPlayer; onClose: () => void }) {
  const { data: players } = useCricketPlayers();
  const merge = useMergeCricketPlayers();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const options = (players ?? [])
    .filter((p) => p.id !== player.id)
    .filter((p) => !term || p.name.toLowerCase().includes(term) || (digits.length > 2 && p.mobile?.includes(digits)))
    .slice(0, 30);

  async function pick(target: CricketPlayer) {
    const ok = await confirmAction(
      `Merge ${player.name} into ${target.name}?`,
      `Everything recorded for ${player.name} moves to ${target.name} and ${player.name} is deleted. This can't be undone.`,
      "Yes, merge",
    );
    if (!ok) return;
    try {
      await merge.mutateAsync({ id: player.id, intoId: target.id });
      toast.success(`${player.name} merged into ${target.name}`);
      onClose();
    } catch {
      // Shown as a toast.
    }
  }

  return (
    <BottomSheet title={`Merge ${player.name} into…`} icon="fa-solid fa-code-merge" onClose={onClose} fullScreen>
      <p className="admin-hint">Pick the player to keep. Search by name or mobile number.</p>
      <input
        type="search"
        className="form-control shadow-none mb-2"
        placeholder="Search by name or mobile"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="cricket-roster">
        {options.map((p) => (
          <li key={p.id}>
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="cricket-roster-avatar" />
            <span className="cricket-roster-who">
              <strong>{p.name}</strong>
              <small>{p.mobile ? formatMobile(p.mobile) : "No mobile"}</small>
            </span>
            <button type="button" className="cricket-add-player-btn" disabled={merge.isPending} onClick={() => pick(p)}>
              Merge into
            </button>
          </li>
        ))}
      </ul>
      {options.length === 0 && <div className="admin-empty-state">No players match.</div>}
    </BottomSheet>
  );
}
