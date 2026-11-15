import { ballsPerOverOf, type CricketMatch } from "../../../api/types";
import { wormOf } from "../analytics";
import "./analysis.css";

const W = 320;
const H = 180;
const PAD = { left: 30, right: 10, top: 10, bottom: 22 };

// "Nice" step for an axis: 1, 2, 5, 10, 20, 50... so there are about `ticks`.
function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

// The worm: each side's running total ball by ball on one chart, with a dot
// where each wicket fell, so a chase can be read against the first innings
// at the same point. Super overs are left out (they'd squash the rest).
export function WormChart({ match }: { match: CricketMatch }) {
  const perOver = ballsPerOverOf(match);
  const innings = match.innings.slice(0, 2).filter((inn) => inn.balls.length > 0);
  if (innings.length === 0) return null;
  const series = innings.map((inn) => ({ team: match.teams[inn.battingTeam].name, points: wormOf(inn) }));
  const maxBall = Math.max(match.overs * perOver, ...series.map((s) => s.points[s.points.length - 1].ball), 1);
  const maxRuns = Math.max(10, ...series.map((s) => s.points[s.points.length - 1].runs));
  const runStep = niceStep(maxRuns, 4);
  const top = Math.ceil(maxRuns / runStep) * runStep;
  const overStep = niceStep(maxBall / perOver, 5);
  const x = (ball: number) => PAD.left + (ball / maxBall) * (W - PAD.left - PAD.right);
  const y = (runs: number) => H - PAD.bottom - (runs / top) * (H - PAD.top - PAD.bottom);
  const runTicks = Array.from({ length: Math.round(top / runStep) + 1 }, (_, i) => i * runStep);
  const overTicks = Array.from({ length: Math.floor(maxBall / perOver / overStep) + 1 }, (_, i) => i * overStep);

  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-chart-line" aria-hidden="true"></i>
        <span className="cricket-insight-heading">
          Worm
          <small>Running total, over by over</small>
        </span>
      </h2>
      <div className="cricket-insight-legend">
        {series.map((s, index) => (
          <span key={index} className={`is-inn-${index}`}>
            <span className="cricket-insight-swatch"></span> {s.team}
          </span>
        ))}
        <span>
          <span className="cricket-insight-wicket"></span> Wicket
        </span>
      </div>
      <svg
        className="cricket-worm"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={series.map((s) => `${s.team} ${s.points[s.points.length - 1].runs}`).join(", ")}
      >
        {runTicks.map((runs) => (
          <g key={`r${runs}`}>
            <line className="cricket-worm-grid" x1={PAD.left} x2={W - PAD.right} y1={y(runs)} y2={y(runs)} />
            <text className="cricket-worm-axis" x={PAD.left - 5} y={y(runs) + 3} textAnchor="end">
              {runs}
            </text>
          </g>
        ))}
        {overTicks.map((over) => (
          <text key={`o${over}`} className="cricket-worm-axis" x={x(over * perOver)} y={H - 6} textAnchor="middle">
            {over}
          </text>
        ))}
        {series.map((s, index) => (
          <g key={index} className={`cricket-worm-series is-inn-${index}`}>
            <polyline points={s.points.map((p) => `${x(p.ball).toFixed(1)},${y(p.runs).toFixed(1)}`).join(" ")} />
            {s.points
              .filter((p) => p.wicket)
              .map((p, i) => (
                <circle key={i} className="cricket-worm-wkt" cx={x(p.ball)} cy={y(p.runs)} r={3.5}>
                  <title>{`${s.team}: wicket at ${p.runs} (${Math.floor(p.ball / perOver)}.${p.ball % perOver})`}</title>
                </circle>
              ))}
          </g>
        ))}
      </svg>
    </section>
  );
}
