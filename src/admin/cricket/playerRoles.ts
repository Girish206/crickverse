import type { CricketPlayerRole } from "../../api/types";

export const PLAYER_ROLES: { value: CricketPlayerRole; label: string; icon: string }[] = [
  { value: "batter", label: "Batter", icon: "fa-baseball-bat-ball" },
  { value: "bowler", label: "Bowler", icon: "fa-baseball" },
  { value: "all-rounder", label: "All-rounder", icon: "fa-star" },
  { value: "wicket-keeper", label: "Wicket-keeper", icon: "fa-mitten" },
];

export function roleOf(role: CricketPlayerRole | null) {
  return PLAYER_ROLES.find((r) => r.value === role) ?? null;
}
