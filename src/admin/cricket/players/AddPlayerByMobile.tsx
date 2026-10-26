import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { lookupCricketPlayer, useCreateCricketPlayer } from "../../../api/hooks/cricket/useCricketPlayers";
import { messageFor } from "../../../api/mutationErrors";
import type { CricketPlayer } from "../../../api/types";
import InputComp from "../../dms/components/InputComp";
import { formatMobile, normalizeMobile } from "../mobile";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "./PlayerAvatar";

// What "Next" found for the entered number.
type Lookup = { kind: "found"; player: CricketPlayer } | { kind: "new"; mobile: string };

// Brings in someone who isn't listed, by mobile number (the whole player list
// is too long to show): enter a number and tap Next — a matching player's
// card shows with "Add"; an unknown number asks for a name and creates the
// player. Not a <form>, so it can sit inside one (e.g. the team form).
export function AddPlayerByMobile({
  blockedReason = () => null,
  onAdded,
}: {
  // Why a found player can't be added here, if they can't.
  blockedReason?: (playerId: number) => string | null;
  onAdded: (player: CricketPlayer) => void;
}) {
  const createPlayer = useCreateCricketPlayer();
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [looking, setLooking] = useState(false);

  function reset() {
    setMobile("");
    setName("");
    setLookup(null);
    setError(null);
  }

  async function next() {
    const number = normalizeMobile(mobile);
    if (!number) return setError("Enter a valid 10-digit mobile number");
    setLooking(true);
    try {
      const found = await lookupCricketPlayer(number);
      setLookup(found ? { kind: "found", player: { ...found, mobile: number } } : { kind: "new", mobile: number });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLooking(false);
    }
  }

  function add(player: CricketPlayer) {
    onAdded(player);
    reset();
  }

  async function create() {
    if (lookup?.kind !== "new") return;
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter the player's name");
    try {
      const created = await createPlayer.mutateAsync({ name: trimmed, role: null, mobile: lookup.mobile });
      // A number that's already on CricDesk keeps its own name.
      if (created.name.trim().toLowerCase() !== trimmed.toLowerCase()) {
        toast.info(`Already on CricDesk as ${created.name} — added as them`);
      }
      add(created);
    } catch {
      // Shown as a toast.
    }
  }

  // Enter moves the step on without submitting a form around this.
  const onEnter = (action: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    action();
  };

  const found = lookup?.kind === "found" ? lookup.player : null;
  const blocked = found && blockedReason(found.id);
  const foundRole = found && roleOf(found.role);

  return (
    <div className="cricket-add-player">
      <div className="cricket-add-player-row">
        <InputComp
          label="Add by mobile number"
          floating
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={mobile}
          error={lookup ? undefined : (error ?? undefined)}
          onKeyDown={onEnter(() => void (lookup ? undefined : next()))}
          // Changing the number starts the lookup over.
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setMobile(e.target.value);
            setLookup(null);
            setName("");
            setError(null);
          }}
        />
        {lookup ? (
          <button type="button" className="cricket-add-player-btn is-ghost" onClick={reset}>
            Change
          </button>
        ) : (
          <button type="button" className="cricket-add-player-btn" disabled={!mobile.trim() || looking} onClick={next}>
            Next <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        )}
      </div>

      {found && (
        <div className="cricket-add-player-card">
          <PlayerAvatar name={found.name} photoUrl={found.photoUrl} className="cricket-roster-avatar" />
          <span className="cricket-roster-who">
            <strong>{found.name}</strong>
            <small>
              {found.mobile && formatMobile(found.mobile)}
              {foundRole && ` · ${foundRole.label}`}
            </small>
            {blocked && <small className="cricket-add-player-blocked">{blocked}</small>}
            {!blocked && <small>Already on CricDesk as {found.name} — added as them</small>}
          </span>
          {!blocked && (
            <button type="button" className="cricket-add-player-btn" onClick={() => add(found)}>
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Add
            </button>
          )}
        </div>
      )}

      {lookup?.kind === "new" && (
        <>
          <p className="cricket-add-player-note">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i> New number — add a name to create the player.
          </p>
          <div className="cricket-add-player-row">
            <InputComp
              label="Player Name"
              floating
              autoFocus
              maxLength={100}
              value={name}
              error={error ?? undefined}
              onKeyDown={onEnter(() => void create())}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <button
              type="button"
              className="cricket-add-player-btn"
              disabled={!name.trim() || createPlayer.isPending}
              onClick={create}
            >
              <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
