import { useState, useMemo } from "react";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { pointsTable, type PointsRow } from "../stats";
import { BottomSheet } from "../BottomSheet";
import InputComp from "../../dms/components/InputComp";
import { PillSelect } from "../PillSelect";

// Cricket overs to decimal overs (e.g. 18.2 overs = 18 + 2/6 = 18.333)
export function parseOversToDecimal(oversVal: number | string): number {
  const str = String(oversVal).trim();
  if (!str) return 0;
  const parts = str.split(".");
  const completed = parseInt(parts[0], 10) || 0;
  const balls = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  return completed + Math.min(balls, 5) / 6;
}

// Decimal overs back to cricket overs string (e.g. 18.3333 -> "18.2")
export function decimalToOvers(dec: number): string {
  if (dec <= 0 || !isFinite(dec)) return "0.0";
  const completed = Math.floor(dec);
  const fraction = dec - completed;
  const balls = Math.round(fraction * 6);
  if (balls >= 6) return `${completed + 1}.0`;
  return `${completed}.${balls}`;
}

// Total balls from decimal overs
export function oversToTotalBalls(dec: number): number {
  const completed = Math.floor(dec);
  const balls = Math.round((dec - completed) * 6);
  return completed * 6 + balls;
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
      const reqForRate = targetNrrB + newAgainstRate;
      let reqOvers = 0;
      let canAchieve = false;

      if (reqForRate > 0) {
        reqOvers = newRunsFor / reqForRate - baseOfA;
        if (reqOvers > 0 && reqOvers <= maxOvers) {
          canAchieve = true;
        }
      }

      return {
        type: "chasing" as const,
        targetRuns: runs + 1,
        maxOvers,
        reqOversFormatted: canAchieve ? decimalToOvers(reqOvers) : null,
        canAchieve,
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

      return {
        type: "defending" as const,
        scoredRuns: runs,
        maxOvers,
        maxAllowedRuns: Math.max(0, maxAllowedRuns),
        canAchieve: maxAllowedRuns >= 0 && maxAllowedRuns < runs,
        targetNrrB,
      };
    }
  }, [teamARow, teamBRow, scenarioOvers, targetScore, mode]);

  return (
    <BottomSheet title="Net Run Rate (NRR) Calculator" icon="fa-solid fa-calculator" onClose={onClose} wide>
      <div className="cricket-squad-toolbar mb-3">
        <div className="admin-segmented cricket-tabs is-justified" role="tablist">
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
            <div className="cricket-nrr-result-card">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge rounded-pill bg-danger-subtle text-danger fw-bold px-2 py-1">
                    <i className="fa-solid fa-bullseye me-1"></i> Target Scenario
                  </span>
                  <span className="fw-bold fs-6">{tournament.teams[teamAIdx]?.name}</span>
                </div>
                <span className="badge bg-secondary-subtle text-secondary font-monospace">
                  Beat NRR: {simulation.targetNrrB >= 0 ? `+${simulation.targetNrrB.toFixed(3)}` : simulation.targetNrrB.toFixed(3)}
                </span>
              </div>

              {simulation.type === "chasing" ? (
                simulation.canAchieve ? (
                  <div className="cricket-nrr-result-hero">
                    <div className="small text-muted mb-1">
                      To overtake <strong>{tournament.teams[teamBIdx]?.name}</strong>:
                    </div>
                    <div className="cricket-nrr-big-target mb-2">
                      <span>Chase {simulation.targetRuns} in at most</span>
                      <span className="cricket-nrr-big-pill">
                        {simulation.reqOversFormatted} ov
                      </span>
                      <span className="fs-6 fw-bold text-muted">
                        ({oversToTotalBalls(parseOversToDecimal(simulation.reqOversFormatted!))} balls)
                      </span>
                    </div>
                    <div className="d-flex gap-2 flex-wrap small text-muted">
                      <span><i className="fa-solid fa-gauge-high text-danger me-1"></i>Min RRR: <strong>{(simulation.targetRuns / Math.max(0.1, parseOversToDecimal(simulation.reqOversFormatted!))).toFixed(2)} RPO</strong></span>
                      <span>• Target total: <strong>{simulation.targetRuns} runs</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="cricket-nrr-result-hero is-warning">
                    <div className="fw-bold text-warning-emphasis mb-1">
                      <i className="fa-solid fa-circle-exclamation me-1"></i> Target unreachable in single game
                    </div>
                    <small className="text-muted">
                      A chase of {simulation.targetRuns} in {simulation.maxOvers} overs cannot overtake the target NRR
                      given the tournament overs and previous runs.
                    </small>
                  </div>
                )
              ) : simulation.canAchieve ? (
                <div className="cricket-nrr-result-hero">
                  <div className="small text-muted mb-1">
                    After setting <strong>{simulation.scoredRuns} runs</strong> in {simulation.maxOvers} ov:
                  </div>
                  <div className="cricket-nrr-big-target mb-2">
                    <span>Restrict {tournament.teams[teamBIdx]?.name} to</span>
                    <span className="cricket-nrr-big-pill">
                      &le; {simulation.maxAllowedRuns} runs
                    </span>
                    <span className="fs-6 fw-bold text-muted">
                      (in {simulation.maxOvers} ov)
                    </span>
                  </div>
                  <div className="d-flex gap-2 flex-wrap small text-muted">
                    <span><i className="fa-solid fa-shield text-success me-1"></i>Win by at least: <strong>{simulation.scoredRuns - simulation.maxAllowedRuns} runs</strong></span>
                    <span>• Max Allowed RR: <strong>{(simulation.maxAllowedRuns / simulation.maxOvers).toFixed(2)} RPO</strong></span>
                  </div>
                </div>
              ) : (
                <div className="cricket-nrr-result-hero is-warning">
                  <div className="fw-bold text-warning-emphasis mb-1">
                    <i className="fa-solid fa-circle-exclamation me-1"></i> Target unreachable in single game
                  </div>
                  <small className="text-muted">
                    Defending {simulation.scoredRuns} in {simulation.maxOvers} overs cannot overtake the target NRR
                    even with a maximum margin victory.
                  </small>
                </div>
              )}
            </div>
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

          <div className="card text-center p-3 bg-body-tertiary border">
            <span className="text-muted small text-uppercase fw-bold">Net Run Rate (NRR)</span>
            <div className={`fs-2 fw-black my-1 ${customNrr.nrr >= 0 ? "text-success" : "text-danger"}`}>
              {customNrr.nrr >= 0 ? `+${customNrr.nrr.toFixed(3)}` : customNrr.nrr.toFixed(3)}
            </div>
            <small className="text-muted">
              {customNrr.forRate.toFixed(3)} (Batting RR) - {customNrr.againstRate.toFixed(3)} (Bowling RR) ={" "}
              {customNrr.nrr.toFixed(3)}
            </small>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
