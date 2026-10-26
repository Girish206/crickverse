import { useState, type ChangeEvent, type FormEvent } from "react";
import { lookupCricketPlayer, useCricketPlayers } from "../../api/hooks/cricket/useCricketPlayers";
import { messageFor } from "../../api/mutationErrors";
import type { CricketPlayer } from "../../api/types";
import InputComp from "../dms/components/InputComp";
import { BottomSheet } from "./BottomSheet";
import { normalizeMobile } from "./mobile";
import { roleOf } from "./playerRoles";
import { PlayerAvatar } from "./players/PlayerAvatar";
import { QrScannerSheet, type ScanReply } from "./qr/QrScannerSheet";
import type { QrTarget } from "./qr/qrLinks";

// Who else may score (and edit) a match, or every match of a tournament.
// Scorers are players, found by mobile number (names repeat) or picked
// from the sides' squads, or scanned from their QR code; they score from
// their own account. Nothing is saved until "Save". With `handOver` it picks just one person — the next
// scorer — straight from the same squads / mobile number.
export function ScorersSheet({
  title,
  note,
  scorerIds,
  squads = [],
  saving,
  onSave,
  onClose,
  handOver,
}: {
  title: string;
  note: string;
  scorerIds: number[];
  // The teams whose players can be picked straight from their squad.
  squads?: { name: string; playerIds: number[] }[];
  saving: boolean;
  onSave: (playerIds: number[]) => Promise<unknown>;
  onClose: () => void;
  handOver?: { excludeIds: number[]; onPick: (playerId: number) => Promise<unknown> };
}) {
  const { data: players } = useCricketPlayers();
  const [ids, setIds] = useState(scorerIds);
  const pickable = squads
    .map((squad) => ({ ...squad, playerIds: squad.playerIds.filter((id) => !handOver?.excludeIds.includes(id)) }))
    .filter((squad) => squad.playerIds.length > 0);
  // Picked from the squads (already added ones show as Added), or found
  // by mobile number; everyone added is listed at the top.
  type Mode = "squad" | "mobile";
  const [mode, setMode] = useState<Mode>(pickable.length > 0 ? "squad" : "mobile");
  const modes: { value: Mode; label: string; icon: string }[] = [
    ...(pickable.length > 0 ? [{ value: "squad" as const, label: "From squads", icon: "fa-people-group" }] : []),
    { value: "mobile", label: "Mobile number", icon: "fa-mobile-screen" },
  ];
  const toggle = (playerId: number) =>
    handOver
      ? void handOver.onPick(playerId).catch(() => undefined) // a failure shows its own toast
      : setIds((current) =>
          current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId],
        );
  const [mobile, setMobile] = useState("");
  const [found, setFound] = useState<CricketPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));

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
      else if (handOver?.excludeIds.includes(player.id)) setError("That's you");
      else if (!handOver && ids.includes(player.id)) setError(`${player.name} is already a scorer`);
      else setFound(player);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    try {
      await onSave(ids);
      onClose();
    } catch {
      // Shown as a toast.
    }
  }

  const foundRole = found && roleOf(found.role);

  function onScan(target: QrTarget): ScanReply {
    if (target.kind !== "player") return;
    const player = playerById.get(target.playerId);
    if (!player) return { tone: "error", text: "No player has this QR code" };
    if (handOver) {
      if (handOver.excludeIds.includes(player.id)) return { tone: "error", text: "That's you" };
      setScanning(false);
      toggle(player.id);
      return;
    }
    if (ids.includes(player.id)) return { tone: "info", text: `${player.name} is already a scorer` };
    toggle(player.id);
    return { tone: "success", text: `${player.name} added — scan another, or close and Save` };
  }

  return (
    <BottomSheet
      title={title}
      icon={handOver ? "fa-solid fa-people-arrows" : "fa-solid fa-clipboard-user"}
      onClose={onClose}
      fullScreen
      footer={
        handOver ? undefined : (
          <button type="button" className="cricket-sheet-submit" disabled={saving} onClick={save}>
            <i className="fa-solid fa-check" aria-hidden="true"></i> Save
          </button>
        )
      }
    >
      <p className="admin-hint">{note}</p>
      {!handOver && (
        <section className="cricket-scorer-current">
          <h3 className="cricket-add-player-title">Scorers ({ids.length})</h3>
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
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      title={`Remove ${name}`}
                      onClick={() => setIds((current) => current.filter((other) => other !== id))}
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </section>
      )}
      <button type="button" className="cricket-qr-scan-btn" onClick={() => setScanning(true)}>
        <i className="fa-solid fa-qrcode" aria-hidden="true"></i> Scan a player's QR code
      </button>
      {modes.length > 1 && (
        <div className="admin-segmented cricket-tabs cricket-scorer-mode" role="tablist" aria-label="Add a scorer by">
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

      {mode === "squad" ? (
        pickable.map((squad) => (
          <section key={squad.name} className="cricket-scorer-squad">
            <h3 className="cricket-add-player-title">{squad.name}</h3>
            <ul className="cricket-roster">
              {squad.playerIds.map((playerId) => {
                const player = playerById.get(playerId);
                const name = player?.name ?? "Player";
                const added = !handOver && ids.includes(playerId);
                return (
                  <li key={playerId}>
                    <PlayerAvatar name={name} photoUrl={player?.photoUrl} className="cricket-roster-avatar" />
                    <span className="cricket-roster-who">
                      <strong>{name}</strong>
                      {roleOf(player?.role ?? null) && <small>{roleOf(player?.role ?? null)!.label}</small>}
                    </span>
                    <button
                      type="button"
                      className={`cricket-add-player-btn ${added ? "is-ghost" : ""}`.trim()}
                      aria-pressed={added}
                      onClick={() => toggle(playerId)}
                    >
                      {handOver ? (
                        <>
                          <i className="fa-solid fa-people-arrows" aria-hidden="true"></i> Hand over
                        </>
                      ) : added ? (
                        <>
                          <i className="fa-solid fa-check" aria-hidden="true"></i> Added
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-plus" aria-hidden="true"></i> Add
                        </>
                      )}
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
              label="Scorer's Mobile Number"
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
                {handOver ? (
                  <>
                    <i className="fa-solid fa-people-arrows" aria-hidden="true"></i> Hand over
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus" aria-hidden="true"></i> Add
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}

      {scanning && (
        <QrScannerSheet
          title={handOver ? "Scan Next Scorer" : "Scan Scorers"}
          hint="Point the camera at the player's QR code (their My Profile → My QR code)"
          accept={["player"]}
          onScan={onScan}
          onClose={() => setScanning(false)}
        />
      )}
    </BottomSheet>
  );
}
