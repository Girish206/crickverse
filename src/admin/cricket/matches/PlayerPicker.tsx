import { useState, type ReactNode } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { avatarColorFor } from "../avatarColor";
import { BottomSheet } from "../BottomSheet";
import { roleOf } from "../playerRoles";
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
}

// Full-screen list for choosing a batter or bowler, with search.
export function PlayerPicker({ title, icon, items, nameOf, selectedId, onPick, onClose, footer }: PlayerPickerProps) {
  const { data: players } = useCricketPlayers();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = items.filter((item) => nameOf(item.id).toLowerCase().includes(term));

  return (
    <BottomSheet title={title} icon={icon} onClose={onClose} footer={footer} fullScreen>
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
        <ul className="cricket-picker-list">
          {shown.map((item) => {
            const name = nameOf(item.id);
            const role = roleOf(players?.find((p) => p.id === item.id)?.role ?? null);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`cricket-picker-item ${selectedId === item.id ? "is-selected" : ""}`}
                  disabled={item.disabled}
                  onClick={() => onPick(item.id)}
                >
                  <span className="cricket-picker-avatar" style={{ background: avatarColorFor(name) }}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="cricket-picker-text">
                    <strong>{name}</strong>
                    <small>
                      {role && (
                        <>
                          <i className={`fa-solid ${role.icon}`} aria-hidden="true"></i> {role.label}
                        </>
                      )}
                      {role && item.note ? " · " : ""}
                      {item.note}
                    </small>
                  </span>
                  {item.tag && <span className="cricket-picker-tag">{item.tag}</span>}
                  {selectedId === item.id && <i className="fa-solid fa-circle-check cricket-picker-check" aria-hidden="true"></i>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
