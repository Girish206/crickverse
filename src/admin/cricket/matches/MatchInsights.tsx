import { ballsPerOverOf, type CricketInnings, type CricketMatch } from "../../../api/types";
import { inningsSummary, isFour, isLegal, isSix, isWicket, oversOf, type NameOf } from "../stats";
import { MatchAwards } from "./MatchAwards";
import { MatchShotMap } from "./ShotMap";

// How an innings' runs came: dots, singles… boundaries, extras.
function scoringBreakdown(innings: CricketInnings) {
  const counts = { dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 };
  let boundaryRuns = 0;
  let extras = 0;
  for (const ball of innings.balls) {
    extras += ball.extras;
    if (ball.extraType === "wide") continue;
    if (ball.runs === 0 && isLegal(ball) && ball.extras === 0) counts.dots += 1;
    else if (ball.runs === 1) counts.ones += 1;
    else if (ball.runs === 2) counts.twos += 1;
    else if (ball.runs === 3) counts.threes += 1;
    // An all-run four counts as four runs, not a boundary.
    else if (isFour(ball)) counts.fours += 1;
    else if (isSix(ball)) counts.sixes += 1;
    if (isFour(ball) || isSix(ball)) boundaryRuns += ball.runs;
  }
  return { ...counts, boundaryRuns, extras };
}

// The "Insights" tab: awards and impact points, runs per over side by side,
// how each side scored and (when shots were marked) the shot map.
export function MatchInsights({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  if (!match.innings.some((innings) => innings.balls.length > 0)) {
    return <div className="admin-empty-state">Insights appear once the first ball is bowled.</div>;
  }
  const perInnings = match.innings.map((innings) => ({
    innings,
    name: match.teams[innings.battingTeam].name,
    summary: inningsSummary(innings, ballsPerOverOf(match)),
    overs: oversOf(innings, ballsPerOverOf(match)).map((over) => ({ ...over, wickets: over.balls.filter(isWicket).length })),
    breakdown: scoringBreakdown(innings),
  }));
  const overCount = Math.max(match.overs, ...perInnings.map((p) => p.overs.length));
  const maxRuns = Math.max(1, ...perInnings.flatMap((p) => p.overs.map((over) => over.runs)));

  return (
    <div className="cricket-insights">
      <MatchAwards match={match} nameOf={nameOf} />

      <section className="cricket-awards">
        <h2 className="cricket-section-title">
          <i className="fa-solid fa-chart-column" aria-hidden="true"></i> Runs per over
        </h2>
        <div className="cricket-insight-legend">
          {perInnings.map((p, index) => (
            <span key={index} className={`is-inn-${index}`}>
              <span className="cricket-insight-swatch"></span> {p.name}
            </span>
          ))}
          <span>
            <span className="cricket-insight-wicket"></span> Wicket
          </span>
        </div>
        <div className="cricket-overs-chart" role="img" aria-label="Runs scored in each over by each side">
          {Array.from({ length: overCount }, (_, overIndex) => (
            <div key={overIndex} className="cricket-overs-group">
              <div className="cricket-overs-bars">
                {perInnings.map((p, index) => {
                  const over = p.overs.find((o) => o.number === overIndex);
                  return (
                    <span
                      key={index}
                      className={`cricket-overs-bar is-inn-${index}`}
                      style={{ height: `${((over?.runs ?? 0) / maxRuns) * 100}%` }}
                      title={over ? `${p.name}: ${over.runs} run${over.runs === 1 ? "" : "s"}, ${over.wickets} wkt` : undefined}
                    >
                      {over && over.wickets > 0 && <span className="cricket-overs-wkt">{over.wickets > 1 ? over.wickets : ""}</span>}
                    </span>
                  );
                })}
              </div>
              <span className="cricket-overs-label">{overIndex + 1}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cricket-awards">
        <h2 className="cricket-section-title">
          <i className="fa-solid fa-chart-pie" aria-hidden="true"></i> Scoring breakdown
        </h2>
        <div className="admin-table-wrap">
          <table className="cricket-table cricket-impact-table">
            <thead>
              <tr>
                <th>Team</th>
                <th title="Dot balls">0s</th>
                <th>1s</th>
                <th>2s</th>
                <th>4s</th>
                <th>6s</th>
                <th>Extras</th>
                <th title="Share of runs from boundaries">Bdry %</th>
              </tr>
            </thead>
            <tbody>
              {perInnings.map((p, index) => (
                <tr key={index}>
                  <td>
                    <span className="fw-semibold">{p.name}</span>
                    <small className="cricket-impact-team">
                      {p.summary.runs}/{p.summary.wickets} ({p.summary.overs})
                    </small>
                  </td>
                  <td>{p.breakdown.dots}</td>
                  <td>{p.breakdown.ones}</td>
                  <td>{p.breakdown.twos}</td>
                  <td>{p.breakdown.fours}</td>
                  <td>{p.breakdown.sixes}</td>
                  <td>{p.breakdown.extras}</td>
                  <td>{p.summary.runs ? Math.round((p.breakdown.boundaryRuns * 100) / p.summary.runs) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <MatchShotMap match={match} nameOf={nameOf} />
    </div>
  );
}
