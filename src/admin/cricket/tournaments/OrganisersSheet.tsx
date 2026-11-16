import { toast } from "sonner";
import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { lookupCricketPlayer, useCricketMe, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useSetCricketTournamentOrganisers } from "../../../api/hooks/cricket/useCricketTournaments";
import { messageFor } from "../../../api/mutationErrors";
import type { CricketPlayer, CricketTournament } from "../../../api/types";
import InputComp from "../../dms/components/InputComp";
import { BottomSheet } from "../BottomSheet";
import { normalizeMobile } from "../mobile";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { useSwipeTabs } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";

// Co-organisers picked while creating a tournament, in a sheet of their own
// (no squads yet, so by mobile number only). The list is the form's: each
// change goes straight back to it, and Done closes. The sheet sits inside
// the create form, so it isn't a <form>: Enter and the buttons do the lookup.
export function CoOrganisersSheet({
  value,
  onChange,
  onClose,
}: {
  value: CricketPlayer[];
  onChange: (players: CricketPlayer[]) => void;
  onClose: () => void;
}) {
  const { data: me } = useCricketMe();
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  // A number on RunMitra goes straight onto the list, no second tap.
  async function add() {
    const number = normalizeMobile(mobile);
    if (!number) return setError("Enter a valid 10-digit mobile number");
    setLooking(true);
    try {
      const player = await lookupCricketPlayer(number);
      if (!player) setError("No player has this number — they need to sign up first");
      else if (player.id === me?.player?.id) setError("That's you — you're already the organiser");
      else if (value.some((p) => p.id === player.id)) setError(`${player.name} is already added`);
      else {
        onChange([...value, player]);
        setMobile("");
        toast.success(`${player.name} added`);
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLooking(false);
    }
  }

  return (
    <BottomSheet
      title="Co-organisers"
      icon="fa-solid fa-user-tie"
      onClose={onClose}
      footer={
        <button type="button" className="cricket-sheet-submit" onClick={onClose}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> Done
        </button>
      }
    >
      <p className="admin-hint mb-1">They manage the tournament with you. You can change this later in its settings.</p>
      <div className="cricket-add-player-row">
        <InputComp
          label="Co-organiser's mobile number"
          floating
          type="tel"
          inputMode="tel"
          autoComplete="off"
          autoFocus
          value={mobile}
          error={error ?? undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setMobile(e.target.value);
            setError(null);
          }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            // Enter looks the number up instead of submitting the form behind.
            if (e.key === "Enter") {
              e.preventDefault();
              if (mobile.trim() && !looking) void add();
            }
          }}
        />
        <button type="button" className="cricket-add-player-btn" disabled={!mobile.trim() || looking} onClick={add}>
          {looking ? "Finding..." : "Add"}
        </button>
      </div>

      {value.length > 0 && (
        <section className="mt-2">
          <h3 className="cricket-add-player-title">Added ({value.length})</h3>
          <div className="cricket-scorer-chips">
            {value.map((player) => (
              <span key={player.id} className="cricket-scorer-chip is-removable">
                <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="cricket-scorer-chip-avatar" />
                <span className="cricket-scorer-chip-name">{player.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${player.name}`}
                  title={`Remove ${player.name}`}
                  onClick={() => onChange(value.filter((p) => p.id !== player.id))}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
    </BottomSheet>
  );
}

// Co-organisers: players who run the tournament alongside its creator —
// edit it, its teams, format and matches. The sibling of ScorersSheet:
// picked from the teams' squads or found by mobile number (names repeat),
// and nothing is saved until "Save".
export function OrganisersSheet({ tournament, onClose }: { tournament: CricketTournament; onClose: () => void }) {
  const { data: players } = useCricketPlayers();
  const setOrganisers = useSetCricketTournamentOrganisers();
  const [ids, setIds] = useState<number[]>(tournament.organiserIds ?? []);
  const squads = tournament.teams.filter((team) => team.playerIds.length > 0);
  type Mode = "squad" | "mobile";
  const [mode, setMode] = useState<Mode>(squads.length > 0 ? "squad" : "mobile");
  const modes: { value: Mode; label: string; icon: string }[] = [
    ...(squads.length > 0 ? [{ value: "squad" as const, label: "From squads", icon: "fa-people-group" }] : []),
    { value: "mobile", label: "Mobile number", icon: "fa-mobile-screen" },
  ];
  const swipeRef = useSwipeTabs(modes.map((m) => m.value), mode, setMode);
  const [mobile, setMobile] = useState("");
  const [found, setFound] = useState<CricketPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));

  const toggle = (playerId: number) =>
    setIds((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]));

  function reset() {
    setMobile("");
    setFound(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (found) {
      toggle(found.id);
      return reset();
    }
    const number = normalizeMobile(mobile);
    if (!number) return setError("Enter a valid 10-digit mobile number");
    setLooking(true);
    try {
      const player = await lookupCricketPlayer(number);
      if (!player) setError("No player has this number — they need to sign up first");
      else if (ids.includes(player.id)) setError(`${player.name} is already an organiser`);
      else {
        // Found: straight onto the list, no second tap.
        toggle(player.id);
        reset();
        toast.success(`${player.name} added`);
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    try {
      await setOrganisers.mutateAsync({ id: tournament.id, playerIds: ids });
      onClose();
    } catch {
      // Shown as a toast.
    }
  }

  const foundRole = found && roleOf(found.role);

  return (
    <BottomSheet
      title="Co-organisers"
      icon="fa-solid fa-user-tie"
      onClose={onClose}
      fullScreen
      footer={
        <button type="button" className="cricket-sheet-submit" disabled={setOrganisers.isPending} onClick={save}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> Save
        </button>
      }
    >
      <p className="admin-hint">
        Co-organisers run this tournament with you: they can edit it, its teams, format and matches, and pick its scorers.
      </p>
      <section className="cricket-scorer-current">
        <h3 className="cricket-add-player-title">Co-organisers ({ids.length})</h3>
        {ids.length === 0 ? (
          <p className="admin-hint">None yet. Add them from the squads or by mobile number below.</p>
        ) : (
          <div className="cricket-scorer-chips">
            {ids.map((id) => {
              const player = playerById.get(id);
              const name = player?.name ?? "Player";
              return (
                <span key={id} className="cricket-scorer-chip is-removable">
                  <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-scorer-chip-avatar" />
                  <span className="cricket-scorer-chip-name">{name}</span>
                  <button type="button" aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={() => toggle(id)}>
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {modes.length > 1 && (
        <div ref={swipeRef} className="admin-segmented cricket-tabs cricket-scorer-mode" role="tablist" aria-label="Add a co-organiser by">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              className={mode === m.value ? "active" : ""}
              onClick={() => setMode(m.value)}
            >
              <i className={`fa-solid ${m.icon}`} aria-hidden="true"></i> {m.label}
            </button>
          ))}
        </div>
      )}

      <SwipePanels swipe={swipeRef} values={modes.map((m) => m.value)} current={mode}>
        {(mode) =>
          mode === "squad" ? (
            squads.map((squad) => (
              <section key={squad.name} className="cricket-scorer-squad">
                <h3 className="cricket-add-player-title">{squad.name}</h3>
                <ul className="cricket-roster">
                  {squad.playerIds.map((playerId) => {
                    const player = playerById.get(playerId);
                    const name = player?.name ?? "Player";
                    const added = ids.includes(playerId);
                    const role = roleOf(player?.role ?? null);
                    return (
                      <li key={playerId}>
                        <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-roster-avatar" />
                        <span className="cricket-roster-who">
                          <strong>{name}</strong>
                          {role && <small>{role.label}</small>}
                        </span>
                        <button
                          type="button"
                          className={`cricket-add-player-btn ${added ? "is-ghost" : ""}`.trim()}
                          aria-pressed={added}
                          onClick={() => toggle(playerId)}
                        >
                          <i className={`fa-solid ${added ? "fa-check" : "fa-plus"}`} aria-hidden="true"></i> {added ? "Added" : "Add"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          ) : (
            <form onSubmit={onSubmit} className="cricket-add-player">
              <div className="cricket-add-player-row">
                <InputComp
                  label="Co-organiser's Mobile Number"
                  floating
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={mobile}
                  error={error ?? undefined}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setMobile(e.target.value);
                    setFound(null);
                    setError(null);
                  }}
                />
                {found ? (
                  <button type="button" className="cricket-add-player-btn is-ghost" onClick={reset}>
                    Change
                  </button>
                ) : (
                  <button type="submit" className="cricket-add-player-btn" disabled={!mobile.trim() || looking}>
                    Next <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                  </button>
                )}
              </div>
    
              {found && (
                <div className="cricket-add-player-card">
                  <PlayerAvatar name={found.name} photoUrl={found.photoUrl} className="cricket-roster-avatar" />
                  <span className="cricket-roster-who">
                    <strong>{found.name}</strong>
                    {foundRole && <small>{foundRole.label}</small>}
                  </span>
                  <button type="submit" className="cricket-add-player-btn">
                    <i className="fa-solid fa-plus" aria-hidden="true"></i> Add
                  </button>
                </div>
              )}
            </form>
          )
        }
      </SwipePanels>
    </BottomSheet>
  );
}
