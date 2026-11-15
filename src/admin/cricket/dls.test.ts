import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chaseStartBalls, dlsPar, dlsResources, minResultBalls, resourceAt, type Interruption } from "./dls";
import { DLS_RESOURCES } from "./dlsTable";

// The worked examples from the ICC playing conditions' D/L Standard Edition
// appendix (the same ones the API's cricket-dls.test.ts checks), then this
// copy against the API's own, so the two can't drift apart.

const cut = (innings: number, overs: number, wickets: number, leftBefore: number, leftAfter: number): Interruption => ({
  innings,
  balls: overs * 6,
  wickets,
  ballsLeftBefore: leftBefore * 6,
  ballsLeftAfter: leftAfter * 6,
});

describe("D/L Standard Edition", () => {
  it("reads the table", () => {
    assert.equal(resourceAt(300, 0), 1000);
    assert.equal(resourceAt(38 * 6, 1), 820);
    assert.equal(resourceAt(17, 8), 69);
    // Out of range clamps rather than throwing.
    assert.equal(resourceAt(400, -1), resourceAt(300, 0));
  });

  it("example 1: first innings cut, chasing side has more resources (G50 245)", () => {
    const interruptions = [cut(0, 20, 3, 30, 20)];
    const { r1, r2 } = dlsResources(50, 40 * 6, interruptions);
    assert.equal(r1, 875);
    assert.equal(r2, 893);
    assert.equal(dlsPar(180, r1, r2, 245) + 1, 185);
  });

  it("example 2: chase delayed and shortened", () => {
    const { r1, r2 } = dlsResources(45, 35 * 6, []);
    assert.equal(dlsPar(212, r1, r2) + 1, 185);
  });

  it("example 3: suspension during the chase", () => {
    const interruptions = [cut(1, 12, 1, 38, 28)];
    const { r1, r2 } = dlsResources(50, chaseStartBalls(interruptions, 40), interruptions);
    assert.equal(r2, 868);
    assert.equal(dlsPar(250, r1, r2) + 1, 218);
  });

  it("example 5: first innings ended early mid-over, chase shortened", () => {
    const interruptions = [{ innings: 0, balls: 283, wickets: 8, ballsLeftBefore: 17, ballsLeftAfter: 0 }];
    const { r1, r2 } = dlsResources(50, 33 * 6, interruptions);
    assert.equal(r1, 931);
    assert.equal(r2, 798);
    assert.equal(dlsPar(226, r1, r2) + 1, 194);
  });

  it("needs a quarter of the overs (20 of 50, 5 of 20) for a result", () => {
    assert.equal(minResultBalls(50), 120);
    assert.equal(minResultBalls(20), 30);
    assert.equal(minResultBalls(10), 18);
  });
});

// The API sits next to this app in the workspace; skipped where it doesn't.
const apiDir = new URL("../../../../runmitra-api/src/modules/cricket/", import.meta.url);
const apiHere = existsSync(fileURLToPath(new URL("cricket-dls.ts", apiDir)));

describe("in step with the API's DLS", { skip: !apiHere && "runmitra-api isn't next to this app" }, () => {
  it("has the same resource table", async () => {
    const api = (await import(new URL("dls-table.ts", apiDir).href)) as { DLS_RESOURCES: readonly (readonly number[])[] };
    assert.deepEqual(DLS_RESOURCES, api.DLS_RESOURCES);
  });

  it("works out the same par scores", async () => {
    const api = (await import(new URL("cricket-dls.ts", apiDir).href)) as typeof import("./dls");
    const cases: [number, number, Interruption[]][] = [
      [50, 300, []],
      [50, 240, [cut(0, 20, 3, 30, 20)]],
      [50, 240, [cut(1, 12, 1, 38, 28)]],
      [20, 120, [cut(1, 8, 4, 12, 6)]],
      [10, 60, [cut(0, 5, 2, 5, 3), cut(1, 2, 0, 6, 4)]],
    ];
    for (const [overs, chaseBalls, interruptions] of cases) {
      const ours = dlsResources(overs, chaseBalls, interruptions);
      assert.deepEqual(ours, api.dlsResources(overs, chaseBalls, interruptions));
      for (const first of [80, 150, 260]) assert.equal(dlsPar(first, ours.r1, ours.r2), api.dlsPar(first, ours.r1, ours.r2));
    }
    for (const overs of [5, 10, 20, 50]) assert.equal(minResultBalls(overs), api.minResultBalls(overs));
  });
});
