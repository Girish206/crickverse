import type { CricketBallType, CricketCategory, CricketMatchType, CricketPitchType } from "../../api/types";

// The choices a tournament (and each of its matches) is described with.

export const CATEGORIES: { value: CricketCategory; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "corporate", label: "Corporate" },
  { value: "community", label: "Community" },
  { value: "school", label: "School" },
  { value: "other", label: "Other" },
  { value: "series", label: "Series" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
];

export const BALL_TYPES: { value: CricketBallType; label: string; color: string }[] = [
  { value: "tennis", label: "Tennis", color: "#a3c93a" },
  { value: "leather", label: "Leather", color: "#d92d20" },
  { value: "other", label: "Other", color: "#f79009" },
];

export const PITCH_TYPES: { value: CricketPitchType; label: string }[] = [
  { value: "rough", label: "Rough" },
  { value: "cement", label: "Cement" },
  { value: "turf", label: "Turf" },
  { value: "astroturf", label: "Astroturf" },
  { value: "matting", label: "Matting" },
];

export const MATCH_TYPES: { value: CricketMatchType; label: string }[] = [
  { value: "limited-overs", label: "Limited Overs" },
  { value: "box", label: "Box/Turf Cricket" },
  { value: "pair", label: "Pair Cricket" },
  { value: "test", label: "Test Match" },
  { value: "hundred", label: "The Hundred" },
];

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null | undefined) =>
  options.find((option) => option.value === value)?.label ?? null;
