import { useState } from "react";
import type { CricketPlayer, CricketTeamRoles } from "../../../api/types";
import { AddPlayerByMobile } from "../players/AddPlayerByMobile";
import { PlayerCard } from "../players/PlayerCard";
import type { NameOf } from "../stats";
import { TeamRoleChips } from "../tournaments/TeamRoleChips";

export interface SquadGroup {
  label: string;
  playerIds: number[];
  // A label on each card, e.g. where they're brought in from.
  tag?: string;
}

// Who a side can pick from: its roster (plus anyone brought in by mobile
// number), then the rest of the tournament's squad. The whole player list
// is too long to show. Anyone already picked by the other side is left out.
export function squadGroups({
  name,
  roster,
  otherRoster,
  tournamentPlayerIds,
  selected,
  otherSelected,
}: {
  name: string;
  roster: number[];
  otherRoster: number[];
  tournamentPlayerIds: number[];
  selected: number[];
  otherSelected: number[];
}): SquadGroup[] {
  const free = (ids: number[]) => ids.filter((id) => !otherSelected.includes(id));
  const squad = tournamentPlayerIds.filter((id) => !roster.includes(id) && !otherRoster.includes(id));
  const brought = selected.filter((id) => !roster.includes(id) && !squad.includes(id));
  return [
    { label: name, playerIds: free([...roster, ...brought]) },
    { label: "Tournament squad", playerIds: free(squad), tag: "Squad" },
  ];
}

interface SquadChecklistProps {
  groups: SquadGroup[];
  selected: number[];
  roles: CricketTeamRoles;
  playerById: Map<number, CricketPlayer>;
  nameOf: NameOf;
  onToggle: (playerId: number) => void;
  // A group's "Select all" / "Clear": these players in (true) or out.
  onSetMany: (playerIds: number[], selected: boolean) => void;
  onRoles: (roles: CricketTeamRoles) => void;
  // C / VC / WK toggles on each card (off where the roles are asked for
  // in steps of their own).
  showRoles?: boolean;
  blockedReason: (playerId: number) => string | null;
  // Someone brought in by mobile number (found, or just created).
  onAdded: (playerId: number) => void;
}

// Anyone else is brought in by mobile number at the top; below, the side's
// own roster and the tournament squad. Picked players get C / VC / WK
// toggles for this match.
export function SquadChecklist({
  groups,
  selected,
  roles,
  playerById,
  nameOf,
  onToggle,
  onSetMany,
  onRoles,
  showRoles = true,
  blockedReason,
  onAdded,
}: SquadChecklistProps) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const total = groups.reduce((sum, group) => sum + group.playerIds.length, 0);
  const shown = groups
    .map((group) => ({ ...group, playerIds: group.playerIds.filter((id) => nameOf(id).toLowerCase().includes(term)) }))
    .filter((group) => group.playerIds.length > 0);

  return (
    <>
      <AddPlayerByMobile blockedReason={blockedReason} onAdded={(player) => onAdded(player.id)} />
      {total > 6 && (
        <input
          type="search"
          className="cricket-picker-search"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <div className="admin-empty-state">
          {total === 0 ? "No players yet — add them by mobile number above." : `No one matches "${search}".`}
        </div>
      ) : (
        shown.map((group) => {
          // Covers whoever the search is showing.
          const allIn = group.playerIds.every((id) => selected.includes(id));
          return (
            <section key={group.label} className="cricket-player-card-group">
              <h3 className="cricket-player-card-group-title">
                {group.label} <span>{group.playerIds.length}</span>
                {group.playerIds.length > 1 && (
                  <button
                    type="button"
                    className="cricket-select-all"
                    onClick={() => onSetMany(group.playerIds, !allIn)}
                  >
                    <i className={`fa-${allIn ? "regular fa-square-minus" : "solid fa-square-check"}`} aria-hidden="true"></i>
                    {allIn ? "Clear" : "Select all"}
                  </button>
                )}
              </h3>
              <div className="cricket-player-card-list">
                {group.playerIds.map((playerId) => (
                  <PlayerCard
                    key={playerId}
                    player={playerById.get(playerId)}
                    fallbackName={nameOf(playerId)}
                    selected={selected.includes(playerId)}
                    tag={group.tag}
                    onClick={() => onToggle(playerId)}
                  >
                    {showRoles && (
                      <TeamRoleChips roles={roles} playerId={playerId} playerName={nameOf(playerId)} onChange={onRoles} />
                    )}
                  </PlayerCard>
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
