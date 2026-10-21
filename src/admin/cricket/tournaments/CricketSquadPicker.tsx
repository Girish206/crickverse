import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCreateCricketPlayer, useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useSetCricketSquad } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketTournament } from "../../../api/types";
import { confirmAction } from "../../components/confirmDelete";
import { roleOf } from "../playerRoles";
import { normalizeMobile } from "../mobile";

// Same normalisation the server applies, so a quick-added name that's
// already in the shared list picks that player instead of failing.
const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// Picks the tournament's squad from the shared player list. Each tick saves
// straight away; a brand-new name typed here joins the shared list too.
export function CricketSquadPicker({ tournament, busy }: { tournament: CricketTournament; busy: boolean }) {
  const { data: players } = useCricketPlayers();
  const setSquad = useSetCricketSquad();
  const createPlayer = useCreateCricketPlayer();
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const squad = new Set(tournament.playerIds);
  const matched = new Set(tournament.matchSets.flatMap((set) => set.playerIds));
  const all = players ?? [];
  const visible = all.filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()));
  const allVisibleIn = visible.length > 0 && visible.every((player) => squad.has(player.id));
  const saving = busy || setSquad.isPending || createPlayer.isPending;

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
  }

  function toggle(playerId: number) {
    if (squad.has(playerId)) {
      void remove([playerId]);
    } else {
      save([...tournament.playerIds, playerId]);
    }
  }

  // "Select all" works on what the search shows, so a filtered list can be
  // added (or removed) in one go.
  function toggleAllVisible() {
    if (allVisibleIn) {
      void remove(visible.map((player) => player.id));
    } else {
      save([...new Set([...tournament.playerIds, ...visible.map((player) => player.id)])]);
    }
  }

  // An existing player (same name or number) is just picked; anyone new
  // needs a mobile number to join the shared list.
  async function quickAdd(e: FormEvent) {
    e.preventDefault();
    const key = nameKey(newName);
    if (!key) return;
    const mobile = normalizeMobile(newMobile);
    const existing = all.find((player) => nameKey(player.name) === key || (mobile && player.mobile === mobile));
    if (!existing && !mobile) {
      setAddError("Add their 10-digit mobile number too.");
      return;
    }
    const id = existing?.id ?? (await createPlayer.mutateAsync({ name: newName, role: null, mobile: mobile! })).id;
    if (!squad.has(id)) save([...tournament.playerIds, id]);
    setNewName("");
    setNewMobile("");
    setAddError(null);
  }

  return (
    <>
      <p className="admin-hint">
        Tick the players taking part. They come from the shared{" "}
        <Link to="/players" className="admin-link">
          player list
        </Link>
        ; a new name added here joins that list too.
      </p>

      <form className="cricket-quick-add" onSubmit={quickAdd}>
        <input
          className="form-control shadow-none"
          placeholder="New player's name"
          value={newName}
          maxLength={100}
          onChange={(e) => {
            setNewName(e.target.value);
            setAddError(null);
          }}
        />
        <input
          className="form-control shadow-none"
          type="tel"
          inputMode="tel"
          placeholder="Mobile number"
          value={newMobile}
          maxLength={20}
          onChange={(e) => {
            setNewMobile(e.target.value);
            setAddError(null);
          }}
        />
        <button type="submit" className="btn btn-outline-primary" disabled={saving || !newName.trim()}>
          <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add
        </button>
      </form>
      {addError && <p className="text-danger small mt-n2">{addError}</p>}

      <div className="cricket-squad-toolbar">
        <label className="cricket-check">
          <input
            type="checkbox"
            checked={allVisibleIn}
            disabled={saving || visible.length === 0}
            onChange={toggleAllVisible}
          />
          <span>{search.trim() ? "Select all shown" : "Select all"}</span>
        </label>
        <input
          type="search"
          className="form-control shadow-none"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="admin-filter-count">
          {tournament.playerIds.length} of {all.length} in squad
        </span>
      </div>

      {all.length === 0 ? (
        <div className="admin-empty-state">No players in the list yet — add one above.</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty-state">No players match "{search}".</div>
      ) : (
        <div className="cricket-squad-grid">
          {visible.map((player) => {
            const role = roleOf(player.role);
            return (
              <label key={player.id} className={`cricket-check cricket-squad-item ${squad.has(player.id) ? "is-in" : ""}`}>
                <input
                  type="checkbox"
                  checked={squad.has(player.id)}
                  disabled={saving}
                  onChange={() => toggle(player.id)}
                />
                <span className="cricket-player-name">{player.name}</span>
                {role && <i className={`fa-solid ${role.icon} cricket-role-icon`} title={role.label}></i>}
                {matched.has(player.id) && <small className="cricket-set-tag">matched</small>}
              </label>
            );
          })}
        </div>
      )}
    </>
  );
}
