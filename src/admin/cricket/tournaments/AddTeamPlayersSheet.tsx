import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { lookupCricketTeamPlayer, useAddCricketTeamPlayers } from "../../../api/hooks/cricket/useCricketTournaments";
import { messageFor } from "../../../api/mutationErrors";
import type { CricketPlayer, CricketTournament, NewTeamPlayer } from "../../../api/types";
import InputComp from "../../dms/components/InputComp";
import { BottomSheet } from "../BottomSheet";
import { formatMobile, normalizeMobile } from "../mobile";
import { roleOf } from "../playerRoles";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { QrScannerSheet, type ScanReply } from "../qr/QrScannerSheet";
import type { QrTarget } from "../qr/qrLinks";

// What "Next" found for the entered number.
type Lookup = { kind: "found"; player: CricketPlayer; blocked: string | null } | { kind: "new"; mobile: string };

// One player waiting to join: a known player (found by number, or scanned
// from their QR code — no number, its signed token instead), or a new
// number with a name.
type Queued = { key: string; mobile: string | null; qr?: string; name: string; player: CricketPlayer | null };

// A tournament team's sheet: super admins, its organiser and its captain.
export function AddTeamPlayersSheet({
  tournament,
  teamIndex,
  onClose,
}: {
  tournament: CricketTournament;
  teamIndex: number;
  onClose: () => void;
}) {
  const addPlayers = useAddCricketTeamPlayers();
  const team = tournament.teams[teamIndex];
  const teamOf = useMemo(
    () => new Map(tournament.teams.flatMap((t, index) => t.playerIds.map((id) => [id, index] as const))),
    [tournament.teams],
  );

  // Why a found player can't be added here, if they can't.
  function blockedReason(player: CricketPlayer) {
    const onTeam = teamOf.get(player.id);
    if (onTeam === teamIndex) return `Already in ${team.name}`;
    if (onTeam !== undefined) return `On ${tournament.teams[onTeam].name} — use Move on that team to bring them here`;
    return null;
  }

  return (
    <AddPlayersByMobileSheet
      title={`Add players to ${team.name}`}
      lookup={(mobile) => lookupCricketTeamPlayer(tournament.id, teamIndex, mobile)}
      blockedReason={blockedReason}
      saving={addPlayers.isPending}
      onSave={(players) => addPlayers.mutateAsync({ id: tournament.id, index: teamIndex, players })}
      onClose={onClose}
    />
  );
}

// Add players to a team by mobile number, several in one go: enter a number
// and tap Next — a matching player's card shows with "Add"; an unknown number
// asks for a name. Or scan players' QR codes (My Profile → My QR code), one
// after another. Nothing is saved until "Done", which creates the new
// players and adds everyone (through onSave).
export function AddPlayersByMobileSheet({
  title,
  note,
  lookup: lookupPlayer,
  blockedReason,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  // A line above the form, e.g. what the players are added to.
  note?: string;
  lookup: (mobile: string) => Promise<CricketPlayer | null>;
  blockedReason: (player: CricketPlayer) => string | null;
  saving: boolean;
  onSave: (players: NewTeamPlayer[]) => Promise<unknown>;
  onClose: () => void;
}) {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [queued, setQueued] = useState<Queued[]>([]);
  const [scanning, setScanning] = useState(false);
  const { data: players } = useCricketPlayers();

  function reset() {
    setMobile("");
    setName("");
    setLookup(null);
    setError(null);
  }

  function queue(entry: Queued) {
    setQueued((current) => [...current, entry]);
    reset();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lookup) {
      const number = normalizeMobile(mobile);
      if (!number) return setError("Enter a valid 10-digit mobile number");
      if (queued.some((entry) => entry.mobile === number)) return setError("Already in the list below");
      setLooking(true);
      try {
        const found = await lookupPlayer(number);
        setLookup(
          found
            ? { kind: "found", player: { ...found, mobile: number }, blocked: blockedReason(found) }
            : { kind: "new", mobile: number },
        );
      } catch (err) {
        setError(messageFor(err));
      } finally {
        setLooking(false);
      }
      return;
    }
    if (lookup.kind === "found") {
      if (queued.some((entry) => entry.player?.id === lookup.player.id)) return setError("Already in the list below");
      const number = lookup.player.mobile!;
      if (!lookup.blocked) queue({ key: number, mobile: number, name: lookup.player.name, player: lookup.player });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter the player's name");
    queue({ key: lookup.mobile, mobile: lookup.mobile, name: trimmed, player: null });
  }

  function onScan(target: QrTarget): ScanReply {
    if (target.kind !== "player") return;
    const player = players?.find((p) => p.id === target.playerId);
    if (!player) return { tone: "error", text: "No player has this QR code" };
    // A code from before tokens, or a link typed in, carries none.
    if (!target.token) return { tone: "error", text: `Ask ${player.name} to open My QR code again and scan that` };
    const qr = target.token;
    if (queued.some((entry) => entry.player?.id === player.id)) return { tone: "info", text: `${player.name} is already in the list` };
    const blocked = blockedReason(player);
    if (blocked) return { tone: "error", text: `${player.name}: ${blocked}` };
    setQueued((current) => [...current, { key: `id:${player.id}`, mobile: null, qr, name: player.name, player }]);
    return { tone: "success", text: `${player.name} added to the list — scan the next one, or close` };
  }

  async function done() {
    if (queued.length === 0) return onClose();
    try {
      await onSave(
        queued.map((entry): NewTeamPlayer => {
          if (entry.mobile === null) return { playerQr: entry.qr! };
          return entry.player ? { mobile: entry.mobile } : { mobile: entry.mobile, name: entry.name };
        }),
      );
      onClose();
    } catch {
      // Shown as a toast.
    }
  }

  const found = lookup?.kind === "found" ? lookup : null;
  const foundRole = found && roleOf(found.player.role);

  return (
    <BottomSheet
      title={title}
      icon="fa-solid fa-user-plus"
      onClose={onClose}
      fullScreen
      footer={
        <button type="button" className="cricket-sheet-submit" disabled={saving} onClick={done}>
          <i className="fa-solid fa-check" aria-hidden="true"></i>{" "}
          {queued.length ? `Done — add ${queued.length} player${queued.length === 1 ? "" : "s"}` : "Done"}
        </button>
      }
    >
      {note && <p className="admin-hint">{note}</p>}
      <button type="button" className="cricket-qr-scan-btn" onClick={() => setScanning(true)}>
        <i className="fa-solid fa-qrcode" aria-hidden="true"></i> Scan a player's QR code
      </button>
      <form onSubmit={onSubmit} className="cricket-add-player">
        <div className="cricket-add-player-row">
          <InputComp
            label="Mobile Number"
            floating
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            value={mobile}
            error={lookup ? undefined : (error ?? undefined)}
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
            <button type="submit" className="cricket-add-player-btn" disabled={!mobile.trim() || looking}>
              Next <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
          )}
        </div>

        {found && (
          <div className="cricket-add-player-card">
            <PlayerAvatar name={found.player.name} photoUrl={found.player.photoUrl} className="cricket-roster-avatar" />
            <span className="cricket-roster-who">
              <strong>{found.player.name}</strong>
              <small>
                {found.player.mobile && formatMobile(found.player.mobile)}
                {foundRole && ` · ${foundRole.label}`}
              </small>
              {found.blocked && <small className="cricket-add-player-blocked">{found.blocked}</small>}
              {!found.blocked && <small>Already on RunMitra as {found.player.name} — added as them</small>}
            </span>
            {!found.blocked && (
              <button type="submit" className="cricket-add-player-btn">
                <i className="fa-solid fa-plus" aria-hidden="true"></i> Add
              </button>
            )}
          </div>
        )}

        {lookup?.kind === "new" && (
          <>
            <p className="cricket-add-player-note">
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i> New number — add a name to create the
              player.
            </p>
            <div className="cricket-add-player-row">
              <InputComp
                label="Player Name"
                floating
                required
                autoFocus
                maxLength={100}
                value={name}
                error={error ?? undefined}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
              <button type="submit" className="cricket-add-player-btn" disabled={!name.trim()}>
                <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add
              </button>
            </div>
          </>
        )}
      </form>

      <h3 className="cricket-add-player-title">To add ({queued.length})</h3>
      {queued.length === 0 ? (
        <div className="admin-empty-state">Players you add show up here.</div>
      ) : (
        <ul className="cricket-roster cricket-add-player-queue">
          {queued.map((entry) => {
            const role = roleOf(entry.player?.role ?? null);
            return (
              <li key={entry.key}>
                <PlayerAvatar name={entry.name} photoUrl={entry.player?.photoUrl} className="cricket-roster-avatar" />
                <span className="cricket-roster-who">
                  <strong>
                    {entry.name}
                    {!entry.player && <span className="cricket-role-tag">New</span>}
                  </strong>
                  <small>
                    {entry.mobile ? formatMobile(entry.mobile) : "From their QR code"}
                    {role && ` · ${role.label}`}
                  </small>
                </span>
                <button
                  type="button"
                  className="cricket-sheet-close"
                  aria-label={`Remove ${entry.name}`}
                  onClick={() => setQueued((current) => current.filter((e) => e.key !== entry.key))}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {scanning && (
        <QrScannerSheet
          title="Scan Players"
          hint="Point the camera at a player's QR code (their My Profile → My QR code)"
          accept={["player"]}
          onScan={onScan}
          onClose={() => setScanning(false)}
        />
      )}
    </BottomSheet>
  );
}
