import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CricketBall, CricketInnings, CricketMatch } from "../../api/types";
import { headToHead, matchupsOf, milestonesOf, partnershipsOf, pitchGrid, winProbability, wormOf } from "./analytics";

const ball = (over: Partial<CricketBall> = {}): CricketBall => ({
  batterId: 1,
  nonStrikerId: 2,
  bowlerId: 10,
  runs: 0,
  extraType: null,
  extras: 0,
  wicketType: null,
  dismissedId: null,
  fielderId: null,
  ...over,
});

const innings = (balls: CricketBall[], crease: Partial<CricketInnings> = {}): CricketInnings => ({
  battingTeam: 0,
  strikerId: 1,
  nonStrikerId: 2,
  bowlerId: 10,
  closed: false,
  balls,
  ...crease,
});

const team = (name: string, teamIndex: number) => ({ teamIndex, name, playerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12] });

const match = (over: Partial<CricketMatch> = {}): CricketMatch =>
  ({
    id: 1,
    tournamentId: 7,
    teams: [team("Lions", 0), team("Tigers", 1)],
    overs: 20,
    scheduledAt: null,
    venue: null,
    stage: null,
    city: null,
    matchType: "limited-overs",
    ballType: null,
    pitchType: null,
    status: "live",
    tossWinner: null,
    tossDecision: null,
    innings: [],
    winner: null,
    resultText: null,
    ...over,
  }) as CricketMatch;

const out = (dismissedId = 1) => ball({ wicketType: "bowled", dismissedId, batterId: dismissedId });

describe("worm", () => {
  it("has a point per legal ball, with wickets marked", () => {
    const worm = wormOf(innings([ball({ runs: 4 }), ball({ extraType: "wide", extras: 1 }), out(), ball({ runs: 1, batterId: 3 })]));
    assert.deepEqual(worm, [
      { ball: 0, runs: 0, wicket: false },
      { ball: 1, runs: 4, wicket: false },
      { ball: 2, runs: 5, wicket: true },
      { ball: 3, runs: 6, wicket: false },
    ]);
  });
});

describe("partnerships", () => {
  it("starts a new stand when the pair changes, and splits each batter's share", () => {
    const stands = partnershipsOf(
      innings(
        [ball({ runs: 4 }), ball({ runs: 1, batterId: 2, nonStrikerId: 1 }), ball({ extraType: "bye", extras: 2 }), out(1), ball({ runs: 6, batterId: 3 })],
        { strikerId: 3, nonStrikerId: 2 },
      ),
    );
    assert.equal(stands.length, 2);
    assert.deepEqual([stands[0].runs, stands[0].balls, stands[0].extras, stands[0].unbroken], [7, 4, 2, false]);
    assert.deepEqual(stands[0].shares, [
      { runs: 4, balls: 3 },
      { runs: 1, balls: 1 },
    ]);
    assert.deepEqual([stands[1].wicket, stands[1].runs, stands[1].unbroken], [2, 6, true]);
  });
});

describe("win probability", () => {
  const chase = (runs: number, legalBalls: number, wickets: number) => {
    const balls = [
      ...Array.from({ length: wickets }, (_, i) => out(i + 1)),
      ...Array.from({ length: legalBalls - wickets }, (_, i) => ball({ runs: i < runs ? 1 : 0 })),
    ];
    return match({
      innings: [innings(Array.from({ length: 120 }, () => ball({ runs: 1 })), { closed: true }), innings(balls, { battingTeam: 1 })],
    });
  };

  it("is close to even for a side going at par, and swings with wickets", () => {
    const even = winProbability(chase(60, 60, 2))!;
    const collapse = winProbability(chase(60, 60, 7))!;
    assert.equal(even.chasing, 1);
    assert.ok(even.percent > 35 && even.percent < 75, `even ${even.percent}`);
    assert.ok(collapse.percent < even.percent - 20, `collapse ${collapse.percent}`);
  });

  it("is only for a live limited-overs chase", () => {
    assert.equal(winProbability(match({ innings: [innings([ball()])] })), null);
    assert.equal(winProbability({ ...chase(10, 10, 0), matchType: "test" }), null);
  });
});

describe("match-ups", () => {
  it("counts each batter against each bowler, and who got whom", () => {
    const rows = matchupsOf(match({ innings: [innings([ball({ runs: 4, boundary: true }), ball(), out(1)])] }));
    assert.deepEqual(rows[0], { battingTeam: 0, batterId: 1, bowlerId: 10, runs: 4, balls: 3, dots: 2, fours: 1, sixes: 0, out: true, otherOut: null });
  });

  it("names a run out, which isn't the bowler's wicket, on that bowler's row", () => {
    const rows = matchupsOf(match({ innings: [innings([ball(), ball({ wicketType: "run-out", dismissedId: 1 })])] }));
    assert.equal(rows[0].out, false);
    assert.equal(rows[0].otherOut, "Run out");
  });
});

describe("head to head", () => {
  it("counts earlier finished meetings, from either side", () => {
    const now = match({ id: 5 });
    const earlier = [
      match({ id: 1, status: "completed", winner: 0 }),
      match({ id: 2, status: "completed", winner: 1, teams: [team("Tigers", 1), team("Lions", 0)] }),
      match({ id: 3, status: "abandoned" }),
      match({ id: 4, status: "completed", winner: 0, teams: [team("Lions", 0), team("Bears", 2)] }),
      match({ id: 6, status: "live" }),
    ];
    const h2h = headToHead(now, earlier);
    assert.deepEqual(h2h.wins, [2, 0]);
    assert.equal(h2h.noResult, 1);
    assert.equal(h2h.matches.length, 3);
  });
});

describe("pitch map", () => {
  it("adds up the balls marked in each cell", () => {
    const { cells, marked } = pitchGrid([
      ball({ pitchLine: "off", pitchLength: "good", runs: 4 }),
      ball({ pitchLine: "off", pitchLength: "good" }),
      ball({ pitchLine: "stumps", pitchLength: "yorker", wicketType: "bowled", dismissedId: 1 }),
      ball({ runs: 1 }),
    ]);
    assert.equal(marked, 3);
    assert.deepEqual(cells[3][1], { balls: 2, runs: 4, wickets: 0, dots: 1 });
    assert.deepEqual(cells[1][2], { balls: 1, runs: 0, wickets: 1, dots: 1 });
  });
});

describe("milestones", () => {
  it("brings up a fifty and the side's hundred", () => {
    // 48 for the opener, 48 for the other, then a four: 52 and the side's 100.
    const balls = [
      ...Array.from({ length: 12 }, () => ball({ runs: 4, boundary: true })),
      ...Array.from({ length: 8 }, () => ball({ batterId: 2, nonStrikerId: 1, runs: 6, boundary: true })),
      ball({ runs: 4, boundary: true }),
    ];
    assert.deepEqual(milestonesOf(innings(balls)), [
      { kind: "fifty", playerId: 1, runs: 52, balls: 13 },
      { kind: "team", runs: 100 },
    ]);
  });

  it("calls a hat-trick ball, then the hat-trick", () => {
    assert.deepEqual(milestonesOf(innings([out(1), out(3)])), [{ kind: "on-a-hat-trick", playerId: 10 }]);
    assert.deepEqual(milestonesOf(innings([out(1), out(3), out(4)])), [
      { kind: "three-wickets", playerId: 10, wickets: 3 },
      { kind: "hat-trick", playerId: 10 },
    ]);
  });
});
