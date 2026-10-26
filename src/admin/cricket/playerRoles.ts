import type { CricketPlayerRole } from "../../api/types";

export const PLAYER_ROLES: { value: CricketPlayerRole; label: string }[] = [
  { value: "batter", label: "Batter" },
  { value: "bowler", label: "Bowler" },
  { value: "all-rounder", label: "All-rounder" },
  { value: "wicket-keeper", label: "Wicket-keeper" },
];

export function roleOf(role: CricketPlayerRole | null) {
  return PLAYER_ROLES.find((r) => r.value === role) ?? null;
}
