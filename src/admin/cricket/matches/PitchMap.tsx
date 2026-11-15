import { useState, type CSSProperties } from "react";
import type { CricketMatch } from "../../../api/types";
import { PITCH_LENGTHS, PITCH_LINES, pitchGrid } from "../analytics";
import { bowlingCard, type NameOf } from "../stats";
import { PillSelect } from "../PillSelect";
import "./analysis.css";

// Where the bowlers pitched it, when the scorer had the pitch map on: a
// grid of line by length, each cell shaded by how many balls landed there,
// with the runs and wickets off them. Filter to one innings or one bowler.
export function PitchMap({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const [inningsIndex, setInningsIndex] = useState(0);
  const [bowlerId, setBowlerId] = useState<number | null>(null);
  const marked = match.innings.some((inn) => inn.balls.some((b) => b.pitchLength && b.pitchLine));
  if (!marked) return null;
  const innings = match.innings[Math.min(inningsIndex, match.innings.length - 1)];
  const bowlers = bowlingCard(innings).map((row) => row.playerId);
  const balls = innings.balls.filter((b) => bowlerId === null || b.bowlerId === bowlerId);
  const { cells, marked: count } = pitchGrid(balls);
  const most = Math.max(1, ...cells.flat().map((c) => c.balls));

  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-table-cells" aria-hidden="true"></i>
        <span className="cricket-insight-heading">
          Pitch map
          <small>Line and length, shaded by balls bowled</small>
        </span>
      </h2>
      <div className="cricket-shot-filters">
        {match.innings.length > 1 && (
          <PillSelect
            label="Innings"
            value={String(inningsIndex)}
            options={match.innings.map((inn, i) => ({ value: String(i), label: `${match.teams[1 - inn.battingTeam].name} bowling` }))}
            onChange={(value) => {
              setInningsIndex(Number(value));
              setBowlerId(null);
            }}
          />
        )}
        <PillSelect
          label="Bowler"
          value={bowlerId === null ? "all" : String(bowlerId)}
          options={[{ value: "all", label: "All bowlers" }, ...bowlers.map((id) => ({ value: String(id), label: nameOf(id) }))]}
          onChange={(value) => setBowlerId(value === "all" ? null : Number(value))}
        />
      </div>
      {count === 0 ? (
        <p className="cricket-worm-caption">No balls marked on the pitch map here.</p>
      ) : (
        <div className="cricket-pitchmap" role="table" aria-label="Balls by line and length">
          <div role="row" className="cricket-pitchmap-row is-head">
            <span role="columnheader"></span>
            {PITCH_LINES.map((line) => (
              <span role="columnheader" key={line.value}>
                {line.label}
              </span>
            ))}
          </div>
          {PITCH_LENGTHS.map((length, r) => (
            <div role="row" key={length.value} className="cricket-pitchmap-row">
              <span role="rowheader">{length.label}</span>
              {PITCH_LINES.map((line, c) => {
                const cell = cells[r][c];
                return (
                  <span
                    role="cell"
                    key={line.value}
                    className="cricket-pitchmap-cell"
                    style={{ "--heat": cell.balls / most } as CSSProperties}
                    title={`${length.label}, ${line.label}: ${cell.balls} balls, ${cell.runs} runs, ${cell.wickets} wkts`}
                  >
                    {cell.balls > 0 && (
                      <>
                        <strong>{cell.balls}</strong>
                        <small>
                          {cell.runs}r{cell.wickets > 0 && <b> · {cell.wickets}W</b>}
                        </small>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <p className="cricket-worm-caption">
        {count} ball{count === 1 ? "" : "s"} marked. The batter's end is at the top; lines are for a right-hander.
      </p>
    </section>
  );
}
