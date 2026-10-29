import type { CricketBattingStyle, CricketBowlingStyle, CricketPlayerRole } from "../../api/types";

export const PLAYER_ROLES: { value: CricketPlayerRole; label: string }[] = [
  { value: "batter", label: "Batter" },
  { value: "bowler", label: "Bowler" },
  { value: "all-rounder", label: "All-rounder" },
  { value: "wicket-keeper", label: "Wicket-keeper" },
];

export const BATTING_STYLES: { value: CricketBattingStyle; label: string; short: string }[] = [
  { value: "right-hand", label: "Right-hand bat", short: "RHB" },
  { value: "left-hand", label: "Left-hand bat", short: "LHB" },
];

export const BOWLING_STYLES: { value: CricketBowlingStyle; label: string; short: string }[] = [
  { value: "right-arm-fast", label: "Right-arm Fast", short: "RAF" },
  { value: "right-arm-medium", label: "Right-arm Medium", short: "RAM" },
  { value: "right-arm-spin", label: "Right-arm Spin", short: "RAS" },
  { value: "left-arm-fast", label: "Left-arm Fast", short: "LAF" },
  { value: "left-arm-medium", label: "Left-arm Medium", short: "LAM" },
  { value: "left-arm-spin", label: "Left-arm Spin", short: "LAS" },
];

export function roleOf(role: CricketPlayerRole | null) {
  return PLAYER_ROLES.find((r) => r.value === role) ?? null;
}

export function battingStyleOf(style: CricketBattingStyle | null | undefined) {
  return BATTING_STYLES.find((s) => s.value === style) ?? null;
}

export function bowlingStyleOf(style: CricketBowlingStyle | null | undefined) {
  return BOWLING_STYLES.find((s) => s.value === style) ?? null;
}
