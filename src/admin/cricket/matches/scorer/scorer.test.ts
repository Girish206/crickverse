import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CricketMatch } from "../../../../api/types";
import { allowedOnFreeHit, blankWicket, FREE_HIT_OUTS, OUT_KINDS, outEndOf, outKind } from "./wicket";
import { EXTRA_ICONS, EXTRA_LABELS } from "./extras";
import { METHODS_FOR, needsKnockoutWinner, previewResult } from "../result/resultText";

// The scorer's own rules: which outs it offers and how, what a free hit
// allows, and the result line it previews before an organiser saves it.

describe("the wicket sheet's out types", () => {
  it("has each tile once", () => {
    const keys = OUT_KINDS.map((kind) => kind.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("stores caught & bowled as a catch and a Mankad as a run-out", () => {
    assert.equal(outKind("caught-and-bowled").stored, "caught");
    assert.equal(outKind("mankad").stored, "run-out");
    assert.equal(outKind("mankad").who, "non-striker");
  });

  it("has the keeper field a stumping and a catch behind", () => {
    assert.equal(outKind("stumped").keeper, true);
    assert.equal(outKind("caught-behind").keeper, true);
    assert.notEqual(outKind("caught").keeper, true);
  });

  it("only lets a stumping, run-out, hit wicket and the like come off a wide", () => {
    const offExtras = OUT_KINDS.filter((kind) => kind.offExtras).map((kind) => kind.key);
    for (const key of ["run-out", "stumped", "hit-wicket"] as const) assert.ok(offExtras.includes(key), key);
    for (const key of ["bowled", "caught", "lbw"] as const) assert.ok(!offExtras.includes(key), key);
  });

  it("asks for the runs completed on a run-out and an obstruction only", () => {
    const withRuns = OUT_KINDS.filter((kind) => kind.runs).map((kind) => kind.key);
    assert.deepEqual(withRuns.sort(), ["obstructing-field", "run-out"]);
  });

  it("bowls no ball for outs between deliveries", () => {
    for (const key of ["mankad", "timed-out", "absent-hurt", "retired", "retired-out"] as const) {
      assert.equal(outKind(key).noDelivery, "always", key);
    }
    assert.equal(outKind("retired-hurt").noDelivery, "choice");
    assert.equal(outKind("bowled").noDelivery, undefined);
  });
});

describe("a free hit", () => {
  it("can't get a batter out bowled, caught, LBW or stumped", () => {
    for (const key of ["bowled", "caught", "caught-behind", "caught-and-bowled", "lbw", "stumped", "hit-wicket"] as const) {
      assert.equal(allowedOnFreeHit(outKind(key)), false, key);
    }
  });

  it("still allows a run-out and the outs between deliveries", () => {
    for (const key of ["run-out", "obstructing-field", "hit-ball-twice", "mankad", "timed-out", "retired-hurt"] as const) {
      assert.equal(allowedOnFreeHit(outKind(key)), true, key);
    }
  });

  it("lists only stored wicket types the sheet offers", () => {
    const stored = new Set(OUT_KINDS.map((kind) => kind.stored));
    for (const type of FREE_HIT_OUTS) assert.ok(stored.has(type), type);
  });
});

describe("where a run-out happened", () => {
  it("defaults to the out batter's own end", () => {
    assert.equal(outEndOf({ ...blankWicket, key: "run-out", dismissedId: 1 }, 2), "striker");
    assert.equal(outEndOf({ ...blankWicket, key: "run-out", dismissedId: 2 }, 2), "non-striker");
  });

  it("goes by the end the scorer picked", () => {
    assert.equal(outEndOf({ ...blankWicket, key: "run-out", dismissedId: 1, outEnd: "non-striker" }, 2), "non-striker");
  });

  it("is the striker's end before a batter is picked", () => {
    assert.equal(outEndOf(blankWicket, 2), "striker");
  });
});

describe("extras", () => {
  it("has a label and an icon for every extra", () => {
    assert.deepEqual(Object.keys(EXTRA_LABELS).sort(), Object.keys(EXTRA_ICONS).sort());
    for (const label of Object.values(EXTRA_LABELS)) assert.ok(label.length > 0);
  });
});

// Just what the result helpers read.
const match = (over: Partial<CricketMatch> = {}) =>
  ({
    teams: [{ name: "Jolly Boys" }, { name: "Takki Boys" }],
    innings: [],
    stage: "league",
    winner: null,
    status: "completed",
    ...over,
  }) as unknown as CricketMatch;

describe("the result preview", () => {
  it("names the winner with the margin and how it was decided", () => {
    assert.equal(previewResult(match(), "win", 0, "other", "by 12 runs"), "Jolly Boys won by 12 runs");
    assert.equal(previewResult(match(), "win", 1, "dls", "by 4 runs"), "Takki Boys won by 4 runs (DLS)");
    assert.equal(previewResult(match(), "win", 1, "walkover", ""), "Takki Boys won (walkover)");
  });

  it("says a super over was won, without a margin", () => {
    assert.equal(previewResult(match(), "win", 0, "super-over", "by 5 runs"), "Jolly Boys won the super over");
  });

  it("waits for a winner to be picked", () => {
    assert.equal(previewResult(match(), "win", null, "other", ""), null);
  });

  it("writes ties and no results", () => {
    assert.equal(previewResult(match(), "tie", null, "other", ""), "Match tied");
    assert.equal(previewResult(match(), "tie", null, "dls", ""), "Match tied (DLS)");
    assert.equal(previewResult(match(), "no-result", null, "other", "rain"), "No result (rain)");
    assert.equal(previewResult(match(), "no-result", null, "other", "  "), "No result");
  });

  it("offers only sensible methods for a tie or no result", () => {
    assert.ok(!METHODS_FOR.tie.includes("walkover"));
    assert.deepEqual(METHODS_FOR["no-result"], ["other"]);
  });
});

describe("a knockout without a winner", () => {
  it("needs one when tied or abandoned", () => {
    assert.equal(needsKnockoutWinner(match({ stage: "final" })), true);
    assert.equal(needsKnockoutWinner(match({ stage: "semi-final", status: "abandoned" })), true);
  });

  it("doesn't once there's a winner, in a league, or while it's live", () => {
    assert.equal(needsKnockoutWinner(match({ stage: "final", winner: 0 })), false);
    assert.equal(needsKnockoutWinner(match({ stage: "league" })), false);
    assert.equal(needsKnockoutWinner(match({ stage: "final", status: "live" })), false);
  });
});
