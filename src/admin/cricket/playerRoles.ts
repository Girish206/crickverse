import type { CricketBattingStyle, CricketBowlingStyle, CricketPlayerRole } from "../../api/types";

export const PLAYER_ROLES: { value: CricketPlayerRole; label: string }[] = [
  { value: "batter", label: "Batter" },
  { value: "bowler", label: "Bowler" },
  { value: "all-rounder", label: "All-rounder" },
  { value: "wicket-keeper", label: "Wicket-keeper" },
];

export const BATTING_STYLES: {
  value: CricketBattingStyle;
  label: string;
  short: string;
  note: string;
  icon: string;
  flipIcon?: boolean;
}[] = [
  { value: "right-hand", label: "Right-hand bat", short: "RHB", note: "Right-handed batter", icon: "fa-baseball-bat-ball" },
  { value: "left-hand", label: "Left-hand bat", short: "LHB", note: "Left-handed batter", icon: "fa-baseball-bat-ball", flipIcon: true },
];

export const BOWLING_STYLES: {
  value: CricketBowlingStyle;
  label: string;
  short: string;
  arm: "right" | "left";
  kind: "Fast" | "Medium" | "Spin";
  note: string;
  icon: string;
}[] = [
  { value: "right-arm-fast", label: "Right-arm Fast", short: "RAF", arm: "right", kind: "Fast", note: "Fast pace", icon: "fa-bolt" },
  { value: "right-arm-medium", label: "Right-arm Medium", short: "RAM", arm: "right", kind: "Medium", note: "Medium pace", icon: "fa-wind" },
  { value: "right-arm-spin", label: "Right-arm Spin", short: "RAS", arm: "right", kind: "Spin", note: "Off / Leg spin", icon: "fa-arrows-spin" },
  { value: "left-arm-fast", label: "Left-arm Fast", short: "LAF", arm: "left", kind: "Fast", note: "Fast pace", icon: "fa-bolt" },
  { value: "left-arm-medium", label: "Left-arm Medium", short: "LAM", arm: "left", kind: "Medium", note: "Medium pace", icon: "fa-wind" },
  { value: "left-arm-spin", label: "Left-arm Spin", short: "LAS", arm: "left", kind: "Spin", note: "Orthodox / Wrist", icon: "fa-arrows-spin" },
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
