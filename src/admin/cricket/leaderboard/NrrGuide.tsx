import { useState, type ReactNode } from "react";
import type { CricketMatch } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import { PillSelect } from "../PillSelect";
import { ballsPerOverOf } from "../../../api/types";
import { nrrLine, oversText, runsPerOver, type PointsRow } from "../stats";

const RULES: { icon: string; title: string; text: string }[] = [
  {
    icon: "fa-calculator",
    title: "The formula",
    text: "Runs scored ÷ overs faced, minus runs conceded ÷ overs bowled, over all the team's matches. Part overs count by the ball: 18.3 overs is 18.5.",
  },
  {
    icon: "fa-user-slash",
    title: "All out",
    text: "A side bowled out counts as having faced its full quota of overs (the overs it was due, after any rain cut).",
  },
  {
    icon: "fa-cloud-rain",
    title: "Rain (DLS)",
    text: "With a revised target, the side batting first is credited with the target less one, off the overs the chase was given. If rain ends the chase, it's the par score off the overs the chase faced.",
  },
  {
    icon: "fa-ban",
    title: "Left out",
    text: "No results, and matches awarded as a walkover, forfeit or conceded, don't count towards NRR.",
  },
];

const signed = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(3);

// "How NRR is worked out": the rules, then one team's NRR match by match
// with the sum at the end — the same figures the table uses (see nrrLine).
// `button` draws the opener (a header button, say); else a small help link.
export function NrrGuide({
  rows,
  matches,
  button,
}: {
  rows: PointsRow[];
  matches: CricketMatch[];
  button?: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [teamIndex, setTeamIndex] = useState(rows[0]?.teamIndex ?? 0);
  if (rows.length === 0) return null;
  const row = rows.find((r) => r.teamIndex === teamIndex) ?? rows[0];
  const lines = matches.flatMap((match) => {
    const slot = match.teams.findIndex((team) => team.teamIndex === row.teamIndex);
    if (slot === -1) return [];
    const line = nrrLine(match);
    return line ? [{ match, perOver: ballsPerOverOf(match), us: line.sides[slot], them: line.sides[1 - slot], opponent: match.teams[1 - slot].name }] : [];
  });
  const forRate = runsPerOver(row.runsFor, row.ballsFor);
  const againstRate = runsPerOver(row.runsAgainst, row.ballsAgainst);

  return (
    <>
      {button ? (
        button(() => setOpen(true))
      ) : (
        <button type="button" className="cricket-mvp-help-btn mt-2" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-circle-question" aria-hidden="true"></i> How NRR is worked out
        </button>
      )}
      {open && (
        <BottomSheet title="Net run rate" icon="fa-solid fa-chart-line" onClose={() => setOpen(false)}>
          <div className="cricket-mvp-guide">
            <ul className="cricket-nrr-rules">
              {RULES.map((rule) => (
                <li key={rule.title}>
                  <span className="cricket-mvp-guide-icon" aria-hidden="true">
                    <i className={`fa-solid ${rule.icon}`}></i>
                  </span>
                  <span>
                    <strong>{rule.title}</strong>
                    <small>{rule.text}</small>
                  </span>
                </li>
              ))}
            </ul>

            <div className="cricket-nrr-team-head">
              <h3 className="cricket-sheet-label mb-0">Match by match</h3>
              <PillSelect
                label="Team"
                value={String(row.teamIndex)}
                options={rows.map((r) => ({ value: String(r.teamIndex), label: r.name }))}
                onChange={(value) => setTeamIndex(Number(value))}
              />
            </div>

            {lines.length === 0 ? (
              <p className="admin-hint mb-0">No finished matches count towards {row.name}'s NRR yet.</p>
            ) : (
              <div className="cricket-standings-scroll">
                <table className="cricket-nrr-breakdown">
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Scored</th>
                      <th>Conceded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(({ match, perOver, us, them, opponent }) => (
                      <tr key={match.id}>
                        <td>
                          vs {opponent}
                          {(us.note || them.note) && (
                            <small className="cricket-nrr-note">
                              {[us.note && `${row.name}: ${us.note}`, them.note && `${opponent}: ${them.note}`]
                                .filter(Boolean)
                                .join(". ")}
                            </small>
                          )}
                        </td>
                        <td>
                          {us.runs} <small>in {oversText(us.balls, perOver)}</small>
                        </td>
                        <td>
                          {them.runs} <small>in {oversText(them.balls, perOver)}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>
                        {row.runsFor} <small>in {oversText(row.ballsFor)}</small>
                      </td>
                      <td>
                        {row.runsAgainst} <small>in {oversText(row.ballsAgainst)}</small>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="cricket-nrr-sum">
              <span>
                {row.runsFor} ÷ {(row.ballsFor / 6).toFixed(3)} = <strong>{forRate.toFixed(3)}</strong>
                <small>scoring rate</small>
              </span>
              <span className="cricket-nrr-sum-op">−</span>
              <span>
                {row.runsAgainst} ÷ {(row.ballsAgainst / 6).toFixed(3)} = <strong>{againstRate.toFixed(3)}</strong>
                <small>conceding rate</small>
              </span>
              <span className="cricket-nrr-sum-op">=</span>
              <span className={row.nrr >= 0 ? "is-up" : "is-down"}>
                <strong>{signed(row.nrr)}</strong>
                <small>NRR</small>
              </span>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
