import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CricketMatch, CricketMatchEvent } from "../../../api/types";
import { closedSpells, originalEndOf, playedMs, reopenableNow } from "./matchTiming";

// A reopened match's playing time leaves out the spells it sat finished, and
// it can only be reopened within a day of when it first ended.

const MIN = 60_000;
const t0 = Date.parse("2026-10-27T11:56:00Z");
const iso = (minutes: number) => new Date(t0 + minutes * MIN).toISOString();
const event = (kind: CricketMatchEvent["kind"], minutes: number): CricketMatchEvent => ({
  kind,
  at: iso(minutes),
  by: null,
  innings: 0,
  balls: null,
  fromId: null,
  toId: null,
  fromName: null,
  toName: null,
  overs: null,
});
const matchOf = (ballMinutes: number[], events: CricketMatchEvent[], completedAt: number | null) =>
  ({
    status: "completed",
    completedAt: completedAt === null ? null : iso(completedAt),
    events,
    innings: [{ balls: ballMinutes.map((m) => ({ at: iso(m) })), closed: true, closedAt: iso(ballMinutes.at(-1)!) }],
  }) as unknown as CricketMatch;

describe("reopened match timing", () => {
  it("leaves out each spell it sat finished, however many reopens", () => {
    // Played 0–40, finished; reopened at 100, finished 110; reopened 200, finished 205.
    const match = matchOf(
      [0, 40, 105, 203],
      [event("finished", 40), event("reopened", 100), event("finished", 110), event("reopened", 200), event("finished", 205)],
      205,
    );
    const spells = closedSpells(match, 0);
    assert.deepEqual(spells, [
      [t0 + 40 * MIN, t0 + 100 * MIN],
      [t0 + 110 * MIN, t0 + 200 * MIN],
    ]);
    assert.equal(playedMs(t0, t0 + 205 * MIN, spells), (40 + 10 + 5) * MIN);
    assert.equal(originalEndOf(match), t0 + 40 * MIN);
  });

  it("an older match with no 'finished' line closes at its last ball before the reopen", () => {
    // Like the 27153-minute one: last ball at 40, reopened ~19 days later, closed 2 minutes on.
    const reopenAt = 27150;
    const match = matchOf([0, 40], [event("reopened", reopenAt)], reopenAt + 2);
    const spells = closedSpells(match, 0);
    assert.deepEqual(spells, [[t0 + 40 * MIN, t0 + reopenAt * MIN]]);
    assert.equal(playedMs(t0, t0 + (reopenAt + 2) * MIN, spells), 42 * MIN);
    assert.equal(originalEndOf(match), t0 + 40 * MIN);
  });

  it("reopens only within a day of the first end, not the latest", () => {
    const match = matchOf([0, 40], [event("finished", 40), event("reopened", 60), event("finished", 1400)], 1400);
    assert.equal(reopenableNow(match, t0 + (40 + 23 * 60) * MIN), true);
    assert.equal(reopenableNow(match, t0 + (40 + 25 * 60) * MIN), false);
  });
});
