import type { CricketMatch, CricketResultMethod } from "../../../../api/types";
import { isKnockoutStage } from "../../stats";

export type ResultOutcome = "win" | "tie" | "no-result";

// How a result entered by hand was decided, as the organiser picks it.
export const RESULT_METHODS: { value: CricketResultMethod; label: string }[] = [
  { value: "super-over", label: "Super over" },
  { value: "walkover", label: "Walkover" },
  { value: "forfeit", label: "Opponent forfeited" },
  { value: "concede", label: "Opponent conceded" },
  { value: "dls", label: "DLS / rain" },
  { value: "bowl-out", label: "Bowl-out" },
  { value: "other", label: "Other" },
];

// The ways each outcome can come about: a tie is a tie whatever, and a
// no result needs no "how".
export const METHODS_FOR: Record<ResultOutcome, CricketResultMethod[]> = {
  win: RESULT_METHODS.map((method) => method.value),
  tie: ["dls", "other"],
  "no-result": ["other"],
};

// What follows "No balls were bowled — " when a result was entered before
// a ball (a walkover, say).
const NO_PLAY_REASON: Record<CricketResultMethod, string> = {
  "super-over": "decided by a super over",
  walkover: "walkover",
  forfeit: "the opponent forfeited",
  concede: "the opponent conceded",
  dls: "decided by DLS",
  "bowl-out": "decided by a bowl-out",
  other: "result entered by the organiser",
};

export const noPlayText = (method: CricketResultMethod) => `No balls were bowled — ${NO_PLAY_REASON[method]}`;

// The result line the API will write (mirrors declareResult()), to preview
// it before saving.
const METHOD_TEXT: Record<CricketResultMethod, string> = {
  "super-over": " (super over)",
  walkover: " (walkover)",
  forfeit: " (opponent forfeited)",
  concede: " (opponent conceded)",
  dls: " (DLS)",
  "bowl-out": " (bowl-out)",
  other: "",
};

export function previewResult(
  match: CricketMatch,
  outcome: ResultOutcome,
  winner: number | null,
  method: CricketResultMethod,
  margin: string,
) {
  const extra = margin.trim();
  if (outcome === "win") {
    if (winner === null) return null;
    const name = match.teams[winner].name;
    if (method === "super-over") return `${name} won the super over`;
    return `${name} won${extra ? ` ${extra}` : ""}${METHOD_TEXT[method]}`;
  }
  if (outcome === "tie") return `Match tied${METHOD_TEXT[method]}`;
  return extra ? `No result (${extra})` : "No result";
}

// Whether any ball was bowled.
export const hasBalls = (match: CricketMatch) => match.innings.some((innings) => innings.balls.length > 0);

// A knockout can't end level: a tied or abandoned one still needs a winner
// to go through.
export const needsKnockoutWinner = (match: CricketMatch) =>
  isKnockoutStage(match.stage) &&
  match.winner === null &&
  (match.status === "completed" || match.status === "abandoned");
