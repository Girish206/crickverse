import type { ReactNode } from "react";
import type { CricketPlayer } from "../../../api/types";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerCardProps {
  player: CricketPlayer | undefined;
  // Used when the player isn't in the list (e.g. since removed).
  fallbackName?: string;
  selected?: boolean;
  disabled?: boolean;
  // A second line after the batting role, e.g. figures so far.
  note?: string;
  // A small label on the right, e.g. "Squad" or "Retired hurt".
  tag?: string;
  // Tooltip, e.g. why it can't be picked.
  title?: string;
  onClick: () => void;
  // Shown at the row's right end while selected, e.g. the C / VC / WK
  // chips. Kept outside the row's button so tapping it doesn't toggle the pick.
  children?: ReactNode;
}

// The one selectable player card every pick list uses: photo, name, role
// and a tick that fills in when picked.
export function PlayerCard({
  player,
  fallbackName = "Removed player",
  selected = false,
  disabled = false,
  note,
  tag,
  title,
  onClick,
  children,
}: PlayerCardProps) {
  const name = player?.name ?? fallbackName;
  const role = roleOf(player?.role ?? null);
  return (
    <div className={`cricket-player-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}>
      <button
        type="button"
        className="cricket-player-card-main"
        aria-pressed={selected}
        disabled={disabled}
        title={title}
        onClick={onClick}
      >
        <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-player-card-avatar" />
        <span className="cricket-player-card-text">
          <strong>{name}</strong>
          {(role || note) && (
            <small>
              {role?.label}
              {role && note ? " · " : ""}
              {note}
            </small>
          )}
        </span>
        {tag && <span className="cricket-player-card-tag">{tag}</span>}
      </button>
      {selected && children && <span className="cricket-player-card-extra">{children}</span>}
      {/* Outside the button so the chips can sit before it; the button
          already toggles for keyboard and screen-reader users. */}
      <span className="cricket-player-card-tick" aria-hidden="true" onClick={disabled ? undefined : onClick}>
        <i className="fa-solid fa-check"></i>
      </span>
    </div>
  );
}
