import { useState, useMemo } from "react";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { pointsTable, type PointsRow } from "../stats";
import { BottomSheet } from "../BottomSheet";
import InputComp from "../../dms/components/InputComp";
import { PillSelect } from "../PillSelect";
import { useSwipeTabs } from "../../useSwipeTabs";
import { SwipePanels } from "../../SwipePanels";

// Cricket overs to decimal overs (e.g. 18.2 overs = 18 + 2/6 = 18.333)
export function parseOversToDecimal(oversVal: number | string): number {
  const str = String(oversVal).trim();
  if (!str) return 0;
  const parts = str.split(".");
  const completed = parseInt(parts[0], 10) || 0;
  const balls = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  return completed + Math.min(balls, 5) / 6;
}

const signed = (n: number) => (n >= 0 ? `+${n.toFixed(3)}` : n.toFixed(3));
const oversFromBalls = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

// The answer card under each calculator: one big figure, what it means, and
// the numbers behind it.
function NrrResult({
  good,
  kicker,
  chip,
  label,
  value,
  unit,
  sub,
  stats,
}: {
  good: boolean;
  kicker?: string;
  chip?: string;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  stats: [string, string][];
}) {
  return (
    <section className={`cricket-nrr-result ${good ? "is-good" : "is-warn"}`} aria-live="polite">
      {(kicker || chip) && (
        <header className="cricket-nrr-result-head">
          {kicker && (
            <span className="cricket-nrr-result-kicker">
              <i className={`fa-solid ${good ? "fa-arrow-trend-up" : "fa-circle-exclamation"}`} aria-hidden="true"></i>
              {kicker}
            </span>
          )}
          {chip && <span className="cricket-nrr-result-chip">{chip}</span>}
        </header>
      )}
      <div className="cricket-nrr-result-hero">
        <span className="cricket-nrr-result-label">{label}</span>
        <strong className="cricket-nrr-result-value">
          {value}
          {unit && <small> {unit}</small>}
        </strong>
        <span className="cricket-nrr-result-sub">{sub}</span>
      </div>
      <dl className="cricket-nrr-result-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function NrrCalculatorSheet({
  tournament,
  matches = [],
  onClose,
}: {
  tournament?: CricketTournament;
  matches?: CricketMatch[];
  onClose: () => void;
}) {
  const standings: PointsRow[] = useMemo(() => {
    if (!tournament) return [];
    return pointsTable(tournament, matches);
  }, [tournament, matches]);

  const hasTournament = tournament && tournament.teams.length >= 2;
  const [tab, setTab] = useState<"tournament" | "custom">(hasTournament ? "tournament" : "custom");
  const swipeRef = useSwipeTabs(hasTournament ? (["tournament", "custom"] as const) : (["custom"] as const), tab, setTab);

  // Tournament simulator state
  const [teamAIdx, setTeamAIdx] = useState<number>(0);
  const [teamBIdx, setTeamBIdx] = useState<number>(() => (standings.length > 1 ? 1 : 0));
  const [scenarioOvers, setScenarioOvers] = useState<string>(String(tournament?.overs ?? 20));
  const [targetScore, setTargetScore] = useState<string>("150");
  const [mode, setMode] = useState<"chasing" | "defending">("chasing");

  // Custom standalone calculator state
  const [customRunsFor, setCustomRunsFor] = useState<string>("180");
  const [customOversFor, setCustomOversFor] = useState<string>("20");
  const [customRunsAgainst, setCustomRunsAgainst] = useState<string>("150");
  const [customOversAgainst, setCustomOversAgainst] = useState<string>("20");

  // Calculate standalone NRR
  const customNrr = useMemo(() => {
    const rf = parseFloat(customRunsFor) || 0;
    const ofDec = parseOversToDecimal(customOversFor);
    const ra = parseFloat(customRunsAgainst) || 0;
    const oaDec = parseOversToDecimal(customOversAgainst);

    const forRate = ofDec > 0 ? rf / ofDec : 0;
    const againstRate = oaDec > 0 ? ra / oaDec : 0;
    const nrr = forRate - againstRate;

    return {
      forRate,
      againstRate,
      nrr,
    };
  }, [customRunsFor, customOversFor, customRunsAgainst, customOversAgainst]);

  // Tournament standings details for Team A and Team B
  const teamARow = standings.find((r) => r.teamIndex === teamAIdx);
  const teamBRow = standings.find((r) => r.teamIndex === teamBIdx);

  // Scenario Simulator Calculation
  const simulation = useMemo(() => {
    if (!teamARow || !teamBRow) return null;

    const baseRfA = teamARow.runsFor;
    const baseOfA = teamARow.ballsFor / 6;
    const baseRaA = teamARow.runsAgainst;
    const baseOaA = teamARow.ballsAgainst / 6;

    const targetNrrB = teamBRow.nrr; // target NRR to beat
    const maxOvers = parseFloat(scenarioOvers) || 20;
    const runs = parseFloat(targetScore) || 0;

    if (mode === "chasing") {
      // Team A is chasing `runs` + 1 to win.
      // Opponent batted first and scored `runs` in `maxOvers`.
      // Team A needs to chase in `X` overs such that:
      // (baseRfA + runs + 1) / (baseOfA + X) - (baseRaA + runs) / (baseOaA + maxOvers) > targetNrrB
      const newRunsFor = baseRfA + runs + 1;
      const newRunsAgainst = baseRaA + runs;
      const newOversAgainst = baseOaA + maxOvers;
      const newAgainstRate = newOversAgainst > 0 ? newRunsAgainst / newOversAgainst : 0;

      // Required (newRunsFor / (baseOfA + X)) > targetNrrB + newAgainstRate
      // NRR has to finish strictly above the target, so the chase must end a
      // whole ball inside the break-even point (rounding could tip it over).
      const reqForRate = targetNrrB + newAgainstRate;
      const reqBalls = reqForRate > 0 ? Math.ceil((newRunsFor / reqForRate - baseOfA) * 6) - 1 : 0;
      const maxBalls = Math.round(maxOvers * 6);
      const balls = Math.min(reqBalls, maxBalls);

      return {
        type: "chasing" as const,
        targetRuns: runs + 1,
        maxOvers,
        reqBalls: balls,
        anyWin: reqBalls >= maxBalls,
        // Chasing faster than the overs allow is always fine; it only fails
        // when even the very first ball would be too late.
        canAchieve: balls > 0,
        targetNrrB,
      };
    } else {
      // Team A scored `runs` in `maxOvers`.
      // Team A bowls to opponent. Opponent must be restricted to under `Y` runs in `maxOvers`.
      // (baseRfA + runs) / (baseOfA + maxOvers) - (baseRaA + Y) / (baseOaA + maxOvers) > targetNrrB
      const newRunsFor = baseRfA + runs;
      const newOversFor = baseOfA + maxOvers;
      const newForRate = newOversFor > 0 ? newRunsFor / newOversFor : 0;
      const newOversAgainst = baseOaA + maxOvers;

      // (baseRaA + Y) / newOversAgainst < newForRate - targetNrrB
      const maxAllowedAgainstRate = newForRate - targetNrrB;
      const maxAllowedRuns = Math.floor(maxAllowedAgainstRate * newOversAgainst - baseRaA);

      // They still have to win, so the cap is never above one short of the total.
      return {
        type: "defending" as const,
        scoredRuns: runs,
        maxOvers,
        maxAllowedRuns: Math.max(0, Math.min(maxAllowedRuns, runs - 1)),
        anyWin: maxAllowedRuns >= runs - 1,
        canAchieve: maxAllowedRuns >= 0 && runs > 0,
        targetNrrB,
      };
    }
  }, [teamARow, teamBRow, scenarioOvers, targetScore, mode]);

  return (
    <BottomSheet title="Net Run Rate (NRR) Calculator" icon="fa-solid fa-calculator" onClose={onClose} wide>
      <div className="cricket-squad-toolbar mb-3">
        <div ref={swipeRef} className="admin-segmented cricket-tabs is-justified" role="tablist">
          {hasTournament && (
            <button
              type="button"
              className={tab === "tournament" ? "active" : ""}
              onClick={() => setTab("tournament")}
            >
              Tournament Simulator
            </button>
          )}
          <button type="button" className={tab === "custom" ? "active" : ""} onClick={() => setTab("custom")}>
            Custom Calculator
          </button>
        </div>
      </div>

      <SwipePanels swipe={swipeRef} values={hasTournament ? (["tournament", "custom"] as const) : (["custom"] as const)} current={tab}>
        {(tab) => (
          <>
            {tab === "tournament" && hasTournament && (
              <div className="cricket-nrr-simulator d-flex flex-column gap-3">
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label className="cricket-sheet-label mb-1">Your Team</label>
                    <PillSelect
                      label="Your Team"
                      value={String(teamAIdx)}
                      options={tournament.teams.map((team, idx) => {
                        const row = standings.find((r) => r.teamIndex === idx);
                        return {
                          value: String(idx),
                          label: `${team.name} (NRR: ${row ? (row.nrr >= 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)) : "0.000"})`,
                        };
                      })}
                      onChange={(val) => setTeamAIdx(Number(val))}
                      className="w-100"
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="cricket-sheet-label mb-1">Target Team to Surpass</label>
                    <PillSelect
                      label="Target Team to Surpass"
                      value={String(teamBIdx)}
                      options={tournament.teams.map((team, idx) => {
                        const row = standings.find((r) => r.teamIndex === idx);
                        return {
                          value: String(idx),
                          label: `${team.name} (NRR: ${row ? (row.nrr >= 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)) : "0.000"})`,
                        };
                      })}
                      onChange={(val) => setTeamBIdx(Number(val))}
                      className="w-100"
                    />
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className={`cricket-nrr-mode-btn flex-fill ${mode === "chasing" ? "is-active" : ""}`}
                    onClick={() => setMode("chasing")}
                  >
                    <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> Chasing Target
                  </button>
                  <button
                    type="button"
                    className={`cricket-nrr-mode-btn flex-fill ${mode === "defending" ? "is-active" : ""}`}
                    onClick={() => setMode("defending")}
                  >
                    <i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Defending Total
                  </button>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <InputComp
                      label={mode === "chasing" ? "Opponent Score" : "Your 1st Innings Total"}
                      type="number"
                      value={targetScore}
                      onChange={(e) => setTargetScore(e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <InputComp
                      label="Match Overs"
                      type="number"
                      value={scenarioOvers}
                      onChange={(e) => setScenarioOvers(e.target.value)}
                    />
                  </div>
                </div>

                {simulation && (
                  <NrrResult
                    good={simulation.canAchieve}
                    kicker={`To go above ${tournament.teams[teamBIdx]?.name ?? "them"}`}
                    chip={`NRR to beat ${signed(simulation.targetNrrB)}`}
                    {...(simulation.type === "chasing"
                      ? simulation.canAchieve
                        ? {
                            label: `${tournament.teams[teamAIdx]?.name} must chase ${simulation.targetRuns} within`,
                            value: oversFromBalls(simulation.reqBalls),
                            unit: "ov",
                            sub: simulation.anyWin ? "Any win in the overs is enough" : `${simulation.reqBalls} balls or fewer`,
                          }
                        : {
                            label: `Chasing ${simulation.targetRuns}`,
                            value: "Not enough",
                            sub: `Even the quickest possible chase leaves the NRR below ${signed(simulation.targetNrrB)}.`,
                          }
                      : simulation.canAchieve
                        ? {
                            label: `After ${simulation.scoredRuns} in ${simulation.maxOvers} ov, hold the opponent to`,
                            value: String(simulation.maxAllowedRuns),
                            unit: "runs",
                            sub: simulation.anyWin
                              ? "Any win is enough"
                              : `Win by ${simulation.scoredRuns - simulation.maxAllowedRuns} runs or more`,
                          }
                        : {
                            label: `Defending ${simulation.scoredRuns}`,
                            value: "Not enough",
                            sub: `Even bowling the opponent out for 0 leaves the NRR below ${signed(simulation.targetNrrB)}.`,
                          })}
                    stats={[
                      [`${tournament.teams[teamAIdx]?.name} now`, signed(teamARow?.nrr ?? 0)],
                      ...(simulation.type === "chasing"
                        ? ([
                            ["Target", String(simulation.targetRuns)],
                            [
                              "Req. run rate",
                              simulation.canAchieve ? ((simulation.targetRuns * 6) / simulation.reqBalls).toFixed(2) : "–",
                            ],
                          ] as [string, string][])
                        : ([
                            ["Total", String(simulation.scoredRuns)],
                            [
                              "Max opp. RR",
                              simulation.canAchieve ? (simulation.maxAllowedRuns / simulation.maxOvers).toFixed(2) : "–",
                            ],
                          ] as [string, string][])),
                    ]}
                  />
                )}
              </div>
            )}

            {tab === "custom" && (
              <div className="cricket-custom-nrr d-flex flex-column gap-3">
                <div className="row g-2">
                  <div className="col-12 col-sm-6 border rounded-3 p-3">
                    <h5 className="fs-6 fw-bold text-success mb-2">Batting (Runs For)</h5>
                    <div className="row g-2">
                      <div className="col-6">
                        <InputComp
                          label="Total Runs"
                          type="number"
                          value={customRunsFor}
                          onChange={(e) => setCustomRunsFor(e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <InputComp
                          label="Overs (e.g. 20 or 18.3)"
                          type="text"
                          value={customOversFor}
                          onChange={(e) => setCustomOversFor(e.target.value)}
                        />
                      </div>
                    </div>
                    <small className="text-muted d-block mt-2">
                      Run Rate: <strong>{customNrr.forRate.toFixed(3)}</strong>
                    </small>
                  </div>

                  <div className="col-12 col-sm-6 border rounded-3 p-3">
                    <h5 className="fs-6 fw-bold text-danger mb-2">Bowling (Runs Against)</h5>
                    <div className="row g-2">
                      <div className="col-6">
                        <InputComp
                          label="Runs Conceded"
                          type="number"
                          value={customRunsAgainst}
                          onChange={(e) => setCustomRunsAgainst(e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <InputComp
                          label="Overs Bowled"
                          type="text"
                          value={customOversAgainst}
                          onChange={(e) => setCustomOversAgainst(e.target.value)}
                        />
                      </div>
                    </div>
                    <small className="text-muted d-block mt-2">
                      Against Rate: <strong>{customNrr.againstRate.toFixed(3)}</strong>
                    </small>
                  </div>
                </div>

                <NrrResult
                  good={customNrr.nrr >= 0}
                  label="Net run rate"
                  value={signed(customNrr.nrr)}
                  sub="Batting run rate minus bowling run rate"
                  stats={[
                    ["Batting RR", customNrr.forRate.toFixed(3)],
                    ["Bowling RR", customNrr.againstRate.toFixed(3)],
                  ]}
                />
              </div>
            )}
          </>
        )}
      </SwipePanels>
    </BottomSheet>
  );
}
