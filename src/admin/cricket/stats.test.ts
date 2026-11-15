import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CricketBall, CricketInnings } from "../../api/types";
import { battingCard, bowlingCard, inningsSummary, isFour, isLegal, isSix, isWicket, oversText, rate } from "./stats";
import { roundRobinRounds } from "./format/formatEngine";

// Scorecard maths: what every scorecard, points table and leaderboard is
// built from.

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

describe("balls", () => {
  it("counts wides, no-balls and between-ball events as not legal", () => {
    assert.equal(isLegal(ball()), true);
    assert.equal(isLegal(ball({ extraType: "wide", extras: 1 })), false);
    assert.equal(isLegal(ball({ extraType: "no-ball", extras: 1 })), false);
    assert.equal(isLegal(ball({ extraType: "bye", extras: 2 })), true);
    assert.equal(isLegal(ball({ noDelivery: true, wicketType: "retired-hurt", dismissedId: 1 })), false);
  });

  it("doesn't count retiring hurt as a wicket", () => {
    assert.equal(isWicket(ball({ wicketType: "bowled", dismissedId: 1 })), true);
    assert.equal(isWicket(ball({ wicketType: "retired-hurt", dismissedId: 1 })), false);
  });

  it("doesn't count an all-run four or six as a boundary", () => {
    assert.equal(isFour(ball({ runs: 4 })), true);
    assert.equal(isFour(ball({ runs: 4, boundary: false })), false);
    assert.equal(isSix(ball({ runs: 6, boundary: true })), true);
  });

  it("writes overs and run rates", () => {
    assert.equal(oversText(27), "4.3");
    assert.equal(oversText(10, 5), "2.0");
    assert.equal(rate(30, 18), "10.00");
    assert.equal(rate(0, 0), "0.00");
  });
});

describe("an innings", () => {
  // Over 1 (bowler 10): 1, wide, 4, no-ball + 2 byes, 0, 6, bowled (1 out),
  // then a dot to the new batter.
  // Over 2 (bowler 11): six dots, a maiden.
  const first = [
    ball({ runs: 1 }),
    ball({ batterId: 2, nonStrikerId: 1, extraType: "wide", extras: 1 }),
    ball({ batterId: 2, nonStrikerId: 1, runs: 4 }),
    ball({ batterId: 2, nonStrikerId: 1, extraType: "no-ball", extras: 3, byeType: "bye" }),
    ball({ batterId: 2, nonStrikerId: 1 }),
    ball({ batterId: 2, nonStrikerId: 1, runs: 6 }),
    ball({ wicketType: "bowled", dismissedId: 1 }),
    ball({ batterId: 3, nonStrikerId: 2 }),
  ];
  const second = Array.from({ length: 6 }, () => ball({ batterId: 2, nonStrikerId: 3, bowlerId: 11 }));
  const played = innings([...first, ...second], { strikerId: 2, nonStrikerId: 3, bowlerId: 12 });

  it("adds up the total, extras and overs", () => {
    const summary = inningsSummary(played);
    assert.equal(summary.runs, 15);
    assert.equal(summary.wickets, 1);
    assert.equal(summary.overs, "2.0");
    assert.deepEqual(summary.extras, { wides: 1, noBalls: 1, byes: 2, legByes: 0, penalty: 0, total: 4 });
  });

  it("builds the batting card in order of coming in", () => {
    const card = battingCard(played);
    assert.deepEqual(
      card.map(({ playerId, runs, balls, fours, sixes, outBall }) => ({ playerId, runs, balls, fours, sixes, out: outBall !== null })),
      [
        { playerId: 1, runs: 1, balls: 2, fours: 0, sixes: 0, out: true },
        // The no-ball is a ball faced; the wide isn't.
        { playerId: 2, runs: 10, balls: 10, fours: 1, sixes: 1, out: false },
        { playerId: 3, runs: 0, balls: 1, fours: 0, sixes: 0, out: false },
      ],
    );
  });

  it("charges the bowler wides and no-balls but not byes, and finds the maiden", () => {
    const [ten, eleven] = bowlingCard(played);
    assert.deepEqual(
      { ...ten },
      { playerId: 10, legalBalls: 6, maidens: 0, runs: 13, wickets: 1, dots: 3, wides: 1, noBalls: 1 },
    );
    assert.equal(eleven.maidens, 1);
    assert.equal(eleven.runs, 0);
  });
});

describe("round-robin fixtures", () => {
  for (const count of [2, 3, 4, 5, 6, 7, 8]) {
    it(`has every pair of ${count} teams meet once a leg, nobody twice in a round`, () => {
      const teams = Array.from({ length: count }, (_, i) => i);
      const rounds = roundRobinRounds(teams, 2);
      const met = new Map<string, number>();
      for (const round of rounds) {
        const busy = round.flat();
        assert.equal(new Set(busy).size, busy.length);
        for (const [a, b] of round) {
          const key = [a, b].sort().join("-");
          met.set(key, (met.get(key) ?? 0) + 1);
        }
      }
      assert.equal(met.size, (count * (count - 1)) / 2);
      assert.ok([...met.values()].every((n) => n === 2));
    });
  }
});
