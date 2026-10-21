import { useState, type ReactNode } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { BottomSheet } from "../BottomSheet";
import { PlayerCard } from "../players/PlayerCard";
import type { NameOf } from "../stats";

export interface PickItem {
  id: number;
  // A second line under the name, e.g. figures so far.
  note?: string;
  // Shown but not choosable (e.g. bowled the previous over).
  disabled?: boolean;
  // A small label on the right, e.g. "Retired hurt".
  tag?: string;
}

interface PlayerPickerProps {
  title: string;
  icon: string;
  items: PickItem[];
  nameOf: NameOf;
  selectedId: number | null;
  onPick: (id: number) => void;
  onClose: () => void;
  footer?: ReactNode;
  // A line above the list saying what the pick does.
  hint?: ReactNode;
}

// Full-screen list for choosing a batter or bowler, with search.
export function PlayerPicker({ title, icon, items, nameOf, selectedId, onPick, onClose, footer, hint }: PlayerPickerProps) {
  const { data: players } = useCricketPlayers();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const shown = items.filter((item) => nameOf(item.id).toLowerCase().includes(term));

  return (
    <BottomSheet title={title} icon={icon} onClose={onClose} footer={footer} fullScreen>
      {hint && <p className="cricket-sheet-context">{hint}</p>}
      {items.length > 6 && (
        <input
          type="search"
          className="cricket-picker-search"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <div className="admin-empty-state">{items.length === 0 ? "No one available." : `No one matches "${search}".`}</div>
      ) : (
        <div className="cricket-player-card-list">
          {shown.map((item) => (
            <PlayerCard
              key={item.id}
              player={playerById.get(item.id)}
              fallbackName={nameOf(item.id)}
              selected={selectedId === item.id}
              disabled={item.disabled}
              note={item.note}
              tag={item.tag}
              onClick={() => onPick(item.id)}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
