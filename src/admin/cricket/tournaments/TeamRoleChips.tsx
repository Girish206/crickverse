import type { CricketTeamRoles as TeamRoles } from "../../../api/types";

export type { TeamRoles };
type RoleKey = keyof TeamRoles;

export const NO_ROLES: TeamRoles = { captainId: null, viceCaptainId: null, keeperId: null };

const ROLES: { key: RoleKey; short: string; label: string; icon: string }[] = [
  { key: "captainId", short: "C", label: "Captain", icon: "fa-crown" },
  { key: "viceCaptainId", short: "VC", label: "Vice-captain", icon: "fa-user-shield" },
  { key: "keeperId", short: "WK", label: "Keeper", icon: "fa-mitten" },
];

// The full label and icon behind a C / VC / WK tag.
export const roleTagInfo = (short: string) => ROLES.find((role) => role.short === short);

export const rolesOf = (team: Partial<TeamRoles>): TeamRoles => ({
  captainId: team.captainId ?? null,
  viceCaptainId: team.viceCaptainId ?? null,
  keeperId: team.keeperId ?? null,
});

// The C / VC / WK tags a side gives this player.
export const roleTagsFor = (roles: Partial<TeamRoles>, playerId: number) =>
  ROLES.filter((role) => roles[role.key] === playerId).map((role) => role.short);

// Roles without this player (they left the side).
export const rolesWithout = (roles: TeamRoles, playerId: number): TeamRoles => ({
  captainId: roles.captainId === playerId ? null : roles.captainId,
  viceCaptainId: roles.viceCaptainId === playerId ? null : roles.viceCaptainId,
  keeperId: roles.keeperId === playerId ? null : roles.keeperId,
});

// Tapping a role gives it to this player (taking it from whoever had it), or
// takes it back if they already hold it. Captain and vice-captain can't be
// the same player, so taking one drops the other; the keeper may also lead.
function toggled(roles: TeamRoles, key: RoleKey, playerId: number): TeamRoles {
  if (roles[key] === playerId) return { ...roles, [key]: null };
  const next = { ...roles, [key]: playerId };
  if (key === "captainId" && next.viceCaptainId === playerId) next.viceCaptainId = null;
  if (key === "viceCaptainId" && next.captainId === playerId) next.captainId = null;
  return next;
}

// One player's C / VC / WK toggles.
export function TeamRoleChips({
  roles,
  playerId,
  playerName,
  disabled = false,
  onChange,
}: {
  roles: TeamRoles;
  playerId: number;
  playerName: string;
  disabled?: boolean;
  onChange: (roles: TeamRoles) => void;
}) {
  return (
    <span className="cricket-role-chips" role="group" aria-label={`${playerName}'s role`}>
      {ROLES.map((role) => {
        const on = roles[role.key] === playerId;
        return (
          <button
            key={role.key}
            type="button"
            className={`cricket-role-chip ${on ? "is-on" : ""}`}
            aria-pressed={on}
            title={on ? `Remove as ${role.label.toLowerCase()}` : `Make ${role.label.toLowerCase()}`}
            disabled={disabled}
            onClick={(e) => {
              // Rows are often clickable themselves (pick / squad toggles).
              e.stopPropagation();
              onChange(toggled(roles, role.key, playerId));
            }}
          >
            {role.short}
          </button>
        );
      })}
    </span>
  );
}
