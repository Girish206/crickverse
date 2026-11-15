import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CricketBall, CricketMatch } from "../../types";
import type { CricketBallInput } from "./useCricketMatches";
import { canQueueBowler, isSaved, whyNotQueued, withQueued, type QueuedItem } from "./ballQueue";

// Balls scored offline are shown by playing them onto the server's copy of
// the match. These check that it plays them out as the API's addBall does,
// and that anything it can't play out is refused rather than guessed.

const input = (over: Partial<CricketBallInput> = {}): CricketBallInput => ({
  runs: 0,
  extraType: null,
  extras: 0,
  wicketType: null,
  dismissedId: null,
  fielderId: null,
  ...over,
});

const bowled = (bowlerId: number, over: Partial<CricketBall> = {}): CricketBall => ({
  batterId: 1,
  nonStrikerId: 2,
  bowlerId,
  ...input(),
  ...over,
});

// A live T2 (2 overs, 6 balls each): batters 1 (on strike) and 2, bowler 10.
function match(balls: CricketBall[] = [], over: Partial<CricketMatch> = {}, crease = {}): CricketMatch {
  return {
    id: 7,
    status: "live",
    overs: 2,
    matchType: "t20",
    teams: [
      { name: "A", playerIds: [1, 2, 3, 4] },
      { name: "B", playerIds: [10, 11, 12] },
    ],
    innings: [{ battingTeam: 0, strikerId: 1, nonStrikerId: 2, bowlerId: 10, closed: false, balls, ...crease }],
    ...over,
  } as unknown as CricketMatch;
}

let n = 0;
const ballItem = (m: CricketMatch, over: Partial<CricketBallInput> = {}): QueuedItem => ({
  kind: "ball",
  ball: input(over),
  inningsIndex: m.innings.length - 1,
  expectedBalls: m.innings.at(-1)!.balls.length + n,
});
// Items scored one after another: each expects the balls before it.
function scored(m: CricketMatch, ...balls: Partial<CricketBallInput>[]): QueuedItem[] {
  return balls.map((ball, i) => {
    n = i;
    const item = ballItem(m, ball);
    n = 0;
    return item;
  });
}

describe("playing waiting balls onto the match", () => {
  it("adds the balls and changes ends on odd runs", () => {
    const m = match();
    const { match: shown, waiting, blocked } = withQueued(m, scored(m, { runs: 1 }, { runs: 2 }, { runs: 4 }));
    const innings = shown!.innings[0];
    assert.equal(waiting, 3);
    assert.equal(blocked, false);
    assert.deepEqual(
      innings.balls.map((b) => [b.batterId, b.runs]),
      [[1, 1], [2, 2], [2, 4]],
    );
    assert.equal(innings.strikerId, 2);
    assert.equal(innings.nonStrikerId, 1);
  });

  it("counts runs run, not the wide's or no-ball's penalty", () => {
    const m = match();
    // A wide they ran one off (2 extras): ends change. A no-ball, nothing run: they don't.
    const shown = withQueued(m, scored(m, { extraType: "wide", extras: 2 }, { extraType: "no-ball", extras: 1 })).match!;
    assert.equal(shown.innings[0].strikerId, 2);
    // A short run was still run.
    const short = withQueued(m, scored(m, { runs: 1, shortRuns: 1 })).match!;
    assert.equal(short.innings[0].strikerId, 1);
  });

  it("ends the over after six legal balls: ends change and a bowler is needed", () => {
    const m = match();
    const shown = withQueued(m, scored(m, {}, {}, { extraType: "wide", extras: 1 }, {}, {}, {}, {})).match!;
    const innings = shown.innings[0];
    assert.equal(innings.balls.length, 7);
    assert.equal(innings.bowlerId, null);
    assert.equal(innings.strikerId, 2);
  });

  it("puts the next bowler on, and carries on into their over", () => {
    const sixDots = Array.from({ length: 6 }, () => bowled(10));
    const m = match(sixDots, {}, { strikerId: 2, nonStrikerId: 1, bowlerId: null });
    const items: QueuedItem[] = [
      { kind: "bowler", bowlerId: 11, inningsIndex: 0, expectedBalls: 6 },
      { kind: "ball", ball: input({ runs: 1 }), inningsIndex: 0, expectedBalls: 6 },
    ];
    const { match: shown, blocked } = withQueued(m, items);
    assert.equal(blocked, false);
    assert.equal(shown!.innings[0].balls[6].bowlerId, 11);
    assert.equal(shown!.innings[0].balls[6].batterId, 2);
  });

  it("stops at one it can't play out, and says so", () => {
    const m = match();
    const items = scored(m, { runs: 1 }, { wicketType: "bowled", dismissedId: 2 });
    const { match: shown, waiting, blocked } = withQueued(m, items);
    assert.equal(blocked, true);
    assert.equal(waiting, 2);
    assert.equal(shown!.innings[0].balls.length, 1);
  });

  it("skips what the server already has", () => {
    const m = match([bowled(10, { runs: 1 })]);
    const first: QueuedItem = { kind: "ball", ball: input({ runs: 1 }), inningsIndex: 0, expectedBalls: 0 };
    const second: QueuedItem = { kind: "ball", ball: input({ runs: 2 }), inningsIndex: 0, expectedBalls: 1 };
    assert.equal(isSaved(m, first), true);
    assert.equal(isSaved(m, second), false);
    const { match: shown, waiting } = withQueued(m, [first, second]);
    assert.equal(waiting, 1);
    assert.equal(shown!.innings[0].balls.length, 2);
  });
});

describe("what can wait for the connection", () => {
  it("refuses wickets, penalties and events between balls", () => {
    const m = match();
    assert.ok(whyNotQueued(m, input({ wicketType: "caught", dismissedId: 1, fielderId: 10 })));
    assert.ok(whyNotQueued(m, input({ extraType: "penalty", extras: 5 })));
    assert.equal(whyNotQueued(m, input({ runs: 3 })), null);
  });

  it("refuses the innings' last ball, but not a wide in the last over", () => {
    const eleven = Array.from({ length: 11 }, () => bowled(10));
    const m = match(eleven);
    assert.ok(whyNotQueued(m, input()));
    assert.equal(whyNotQueued(m, input({ extraType: "wide", extras: 1 })), null);
  });

  it("refuses the winning runs", () => {
    const first = { battingTeam: 1, strikerId: null, nonStrikerId: null, bowlerId: null, closed: true, balls: [bowled(1, { runs: 6 })] };
    const m = match([], {});
    const chase = { ...m, innings: [first, { ...m.innings[0], battingTeam: 0 }] } as CricketMatch;
    // Target 7: 6 to tie can wait, 7 can't.
    assert.equal(whyNotQueued(chase, input({ runs: 6 })), null);
    assert.ok(whyNotQueued({ ...chase, innings: [first, { ...chase.innings[1], balls: [bowled(10, { runs: 1 })] }] } as CricketMatch, input({ runs: 6 })));
  });

  it("refuses when a batter or the bowler is still to be picked, or in a Test", () => {
    assert.ok(whyNotQueued(match([], {}, { bowlerId: null }), input()));
    assert.ok(whyNotQueued(match([], {}, { nonStrikerId: null }), input()));
    assert.ok(whyNotQueued(match([], { matchType: "test" }), input()));
    assert.ok(whyNotQueued(match([], { status: "completed" }), input()));
  });

  it("lets a bowler wait only at an over's end, and only one the API would take", () => {
    const sixDots = Array.from({ length: 6 }, () => bowled(10));
    const ended = match(sixDots, {}, { bowlerId: null });
    assert.equal(canQueueBowler(ended, 11), true);
    // Not two in a row, unless it's The Hundred.
    assert.equal(canQueueBowler(ended, 10), false);
    assert.equal(canQueueBowler(match(sixDots, { matchType: "hundred", ballsPerOver: 6 }, { bowlerId: null }), 10), true);
    // Not a batter, nor mid-over.
    assert.equal(canQueueBowler(ended, 1), false);
    assert.equal(canQueueBowler(match(sixDots.slice(0, 3), {}, { bowlerId: null }), 11), false);
    // Not past the over limit.
    assert.equal(canQueueBowler(match(sixDots, { bowlerOverLimit: 1 }, { bowlerId: null }), 11), true);
    const twelve = [...sixDots, ...Array.from({ length: 6 }, () => bowled(11))];
    assert.equal(canQueueBowler(match(twelve, { overs: 4, bowlerOverLimit: 1 }, { bowlerId: null }), 10), false);
  });
});
