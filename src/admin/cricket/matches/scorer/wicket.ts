import type { CricketWicketType } from "../../../../api/types";

// The scorer's wicket sheet: the out types it offers, what each asks for,
// and the draft it fills in before recording (see WicketSheet).

// The wicket sheet's out types. Caught & bowled and a Mankad are tiles of
// their own but stored as a catch (the bowler the fielder) and a run-out
// between deliveries.
export type OutKey = CricketWicketType | "caught-and-bowled" | "mankad";

export interface OutKind {
  key: OutKey;
  label: string;
  stored: CricketWicketType;
  // Who's out: the striker, the non-striker, either one at the crease, or
  // the next batter before they come in.
  who: "striker" | "non-striker" | "either" | "incoming";
  // What records it: the tile; picking the batter; or Record, after the
  // fielder (or, for a run-out, everything; for a hit wicket, the delivery)
  // is picked.
  step: "instant" | "batter" | "fielder" | "run-out" | "delivery";
  // No ball is bowled: always, or as the scorer says (retired hurt).
  noDelivery?: "always" | "choice";
  // Can come off a wide (and, unless stumped, a no ball).
  offExtras?: boolean;
  // The wicket-keeper is the fielder, unless the scorer changes it.
  keeper?: boolean;
  // Asks where the ball went afterwards.
  shot?: boolean;
  // Runs completed before it count (a run-out, an obstruction), so it's
  // asked for and recorded with Record rather than on the batter's tap.
  runs?: boolean;
  // Under "Show more".
  more?: boolean;
}

export const OUT_KINDS: OutKind[] = [
  { key: "bowled", label: "Bowled", stored: "bowled", who: "striker", step: "instant" },
  { key: "caught", label: "Caught", stored: "caught", who: "striker", step: "fielder", shot: true },
  { key: "caught-behind", label: "Caught behind", stored: "caught-behind", who: "striker", step: "fielder", keeper: true },
  { key: "caught-and-bowled", label: "Caught & bowled", stored: "caught", who: "striker", step: "instant", shot: true },
  { key: "run-out", label: "Run out", stored: "run-out", who: "either", step: "run-out", offExtras: true, shot: true, runs: true },
  { key: "lbw", label: "LBW", stored: "lbw", who: "striker", step: "instant" },
  { key: "stumped", label: "Stumped", stored: "stumped", who: "striker", step: "fielder", offExtras: true, keeper: true },
  { key: "retired-hurt", label: "Retired hurt", stored: "retired-hurt", who: "either", step: "batter", noDelivery: "choice", offExtras: true },
  { key: "mankad", label: "Run out (Mankad)", stored: "run-out", who: "non-striker", step: "instant", noDelivery: "always", more: true },
  { key: "hit-wicket", label: "Hit wicket", stored: "hit-wicket", who: "striker", step: "delivery", offExtras: true, more: true },
  { key: "absent-hurt", label: "Absent hurt", stored: "absent-hurt", who: "incoming", step: "batter", noDelivery: "always", more: true },
  { key: "retired-out", label: "Retired out", stored: "retired-out", who: "either", step: "batter", noDelivery: "always", more: true },
  { key: "hit-ball-twice", label: "Hit the ball twice", stored: "hit-ball-twice", who: "striker", step: "instant", more: true },
  { key: "obstructing-field", label: "Obstructing the field", stored: "obstructing-field", who: "either", step: "batter", offExtras: true, runs: true, more: true },
  { key: "timed-out", label: "Timed out", stored: "timed-out", who: "incoming", step: "batter", noDelivery: "always", more: true },
  { key: "retired", label: "Retired", stored: "retired", who: "either", step: "batter", noDelivery: "always", more: true },
];
export const outKind = (key: OutKey) => OUT_KINDS.find((kind) => kind.key === key)!;

// On a free hit only these get a batter out (as the server rules); anything
// between deliveries (a Mankad, timed out...) still can.
export const FREE_HIT_OUTS: CricketWicketType[] = ["run-out", "obstructing-field", "hit-ball-twice", "retired-hurt", "retired", "retired-out"];
export const allowedOnFreeHit = (kind: OutKind) => FREE_HIT_OUTS.includes(kind.stored) || kind.noDelivery === "always";

// What a wicket came off. Byes and leg-byes only for a run-out (the runs
// completed are then extras, not the batter's).
export const DELIVERIES = [
  { value: "normal", label: "Legal ball", icon: "fa-circle-check" },
  { value: "wide", label: "Wide", icon: "fa-arrows-left-right" },
  { value: "no-ball", label: "No ball", icon: "fa-ban" },
  { value: "bye", label: "Bye", icon: "fa-person-running" },
  { value: "leg-bye", label: "Leg bye", icon: "fa-shoe-prints" },
] as const;
export type Delivery = (typeof DELIVERIES)[number]["value"];

// What the wicket sheet has filled in so far.
export type WicketDraft = {
  // Null until a tile is tapped.
  key: OutKey | null;
  dismissedId: number | null;
  fielderId: number | null;
  // A run-out's second fielder, when two were involved; none on a direct hit.
  secondFielderId: number | null;
  directHit: boolean;
  excellentCatch: boolean;
  runs: number;
  delivery: Delivery;
  // A run-out: the end where the wicket was broken; null = the out
  // batter's own end.
  outEnd: "striker" | "non-striker" | null;
  // Retired hurt: whether it happened on a ball that counts.
  countBall: boolean;
};

export const blankWicket: WicketDraft = {
  key: null,
  dismissedId: null,
  fielderId: null,
  secondFielderId: null,
  directHit: false,
  excellentCatch: false,
  runs: 0,
  delivery: "normal",
  outEnd: null,
  countBall: false,
};

// Where a run-out happened: as chosen, or the out batter's own end.
export const outEndOf = (draft: WicketDraft, nonStrikerId: number | null) =>
  draft.outEnd ?? (draft.dismissedId !== null && draft.dismissedId === nonStrikerId ? "non-striker" : "striker");
