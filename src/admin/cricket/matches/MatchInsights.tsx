import type { CSSProperties, ReactNode } from "react";
import { ballsPerOverOf, type CricketInnings, type CricketMatch } from "../../../api/types";
import { inningsSummary, isFour, isLegal, isSix, isWicket, oversOf, type NameOf } from "../stats";
import { MatchShotMap } from "./ShotMap";
import { Matchups } from "./Matchups";
import { Partnerships } from "./Partnerships";
import { PitchMap } from "./PitchMap";
import { WormChart } from "./WormChart";
import "./analysis.css";

// How an innings' runs came, by ball and by run: dots, singles… boundaries,
// and where the runs came from (running, fours, sixes, extras).
function scoringBreakdown(innings: CricketInnings) {
  const counts = { dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 };
  const source = { running: 0, fours: 0, sixes: 0, extras: 0 };
  let faced = 0;
  for (const ball of innings.balls) {
    source.extras += ball.extras;
    if (ball.extraType === "wide") continue;
    faced += 1;
    // An all-run four counts as four runs run, not a boundary.
    if (isFour(ball)) {
      counts.fours += 1;
      source.fours += ball.runs;
    } else if (isSix(ball)) {
      counts.sixes += 1;
      source.sixes += ball.runs;
    } else {
      source.running += ball.runs;
      if (ball.runs === 0 && isLegal(ball) && ball.extras === 0) counts.dots += 1;
      else if (ball.runs === 1) counts.ones += 1;
      else if (ball.runs === 2) counts.twos += 1;
      else if (ball.runs === 3) counts.threes += 1;
    }
  }
  return { ...counts, source, faced };
}

// "Nice" step for an axis: 1, 2, 5, 10, 20… so there are about `ticks`.
function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);

// One insight panel: an icon chip, a title with a one-line explainer, then
// the body. Matches the panels the other insight components render.
function InsightCard({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        <span className="cricket-insight-heading">
          {title}
          {sub && <small>{sub}</small>}
        </span>
      </h2>
      {children}
    </section>
  );
}

// The "Insights" tab: the sides compared at a glance, runs per over side by
// side (the Manhattan), the worm, how each side scored, partnerships, batter
// v bowler, and (when marked) the shot map and pitch map. The awards live on
// the Summary and Heroes tabs.
export function MatchInsights({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  if (!match.innings.some((innings) => innings.balls.length > 0)) {
    return (
      <div className="cricket-insight-empty">
        <i className="fa-solid fa-chart-simple" aria-hidden="true"></i>
        <strong>No insights yet</strong>
        <span>Charts and match-ups appear once the first ball is bowled.</span>
      </div>
    );
  }
  const perOver = ballsPerOverOf(match);
  const perInnings = match.innings
    .filter((innings) => innings.balls.length > 0)
    .map((innings, index) => {
      const summary = inningsSummary(innings, perOver);
      const overs = oversOf(innings, perOver).map((over) => ({ ...over, wickets: over.balls.filter(isWicket).length }));
      const best = overs.reduce<(typeof overs)[number] | null>((top, over) => (!top || over.runs > top.runs ? over : top), null);
      return {
        index,
        name: match.teams[innings.battingTeam].name,
        summary,
        overs,
        best,
        rate: summary.legalBalls ? ((summary.runs * perOver) / summary.legalBalls).toFixed(2) : "0.00",
        breakdown: scoringBreakdown(innings),
      };
    });
  const overCount = Math.max(match.overs, ...perInnings.map((p) => p.overs.length));
  const maxRuns = Math.max(6, ...perInnings.flatMap((p) => p.overs.map((over) => over.runs)));
  const step = niceStep(maxRuns, 4);
  const steps = Math.ceil(maxRuns / step);
  const top = steps * step;

  const glance: { label: string; value: (p: (typeof perInnings)[number]) => number; show?: (p: (typeof perInnings)[number]) => string }[] = [
    { label: "Run rate", value: (p) => Number(p.rate), show: (p) => p.rate },
    { label: "Boundaries", value: (p) => p.breakdown.fours + p.breakdown.sixes, show: (p) => `${p.breakdown.fours}×4 · ${p.breakdown.sixes}×6` },
    { label: "Dot balls", value: (p) => p.breakdown.dots, show: (p) => `${p.breakdown.dots} (${pct(p.breakdown.dots, p.breakdown.faced)}%)` },
    { label: "Extras", value: (p) => p.summary.extras.total },
    { label: "Best over", value: (p) => p.best?.runs ?? 0, show: (p) => (p.best ? `${p.best.runs} (ov ${p.best.number + 1})` : "—") },
  ];

  return (
    <div className="cricket-insights">
      <InsightCard icon="fa-scale-balanced" title="At a glance" sub={perInnings.length > 1 ? "The two sides compared" : "This innings so far"}>
        <div className={`cricket-glance${perInnings.length > 1 ? " is-pair" : ""}`}>
          <div className="cricket-glance-teams">
            {perInnings.slice(0, 2).map((p) => (
              <div key={p.index} className={`cricket-glance-team is-inn-${p.index}`}>
                <span className="cricket-glance-name">
                  <span className="cricket-insight-swatch"></span> {p.name}
                </span>
                <strong>
                  {p.summary.runs}/{p.summary.wickets}
                </strong>
                <small>{p.summary.overs} ov</small>
              </div>
            ))}
          </div>
          <dl className="cricket-glance-rows">
            {glance.map((row) => {
              const sides = perInnings.slice(0, 2);
              const total = sides.reduce((sum, p) => sum + row.value(p), 0);
              return (
                <div key={row.label} className="cricket-glance-row">
                  <dt>{row.label}</dt>
                  {sides.map((p) => (
                    <dd key={p.index} className={`is-inn-${p.index}`}>
                      {row.show ? row.show(p) : row.value(p)}
                    </dd>
                  ))}
                  {sides.length > 1 && (
                    <div className="cricket-glance-bar" aria-hidden="true">
                      {sides.map((p) => (
                        <span key={p.index} className={`is-inn-${p.index}`} style={{ flexGrow: total ? row.value(p) : 1 }}></span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      </InsightCard>

      <InsightCard icon="fa-chart-column" title="Runs per over" sub="The Manhattan · a red dot marks a wicket">
        <div className="cricket-insight-legend">
          {perInnings.map((p) => (
            <span key={p.index} className={`is-inn-${p.index}`}>
              <span className="cricket-insight-swatch"></span> {p.name}
            </span>
          ))}
          <span>
            <span className="cricket-insight-wicket"></span> Wicket
          </span>
        </div>
        <div className="cricket-manhattan" style={{ "--steps": steps } as CSSProperties}>
          <div className="cricket-manhattan-axis" aria-hidden="true">
            {Array.from({ length: steps + 1 }, (_, i) => (
              <span key={i} style={{ bottom: `${(i / steps) * 100}%` }}>
                {i * step}
              </span>
            ))}
          </div>
          <div className="cricket-manhattan-scroll">
            <div className="cricket-manhattan-plot" role="img" aria-label="Runs scored in each over by each side">
              {Array.from({ length: overCount }, (_, overIndex) => (
                <div key={overIndex} className="cricket-manhattan-group">
                  <div className="cricket-manhattan-bars">
                    {perInnings.map((p) => {
                      const over = p.overs.find((o) => o.number === overIndex);
                      return (
                        <span
                          key={p.index}
                          className={`cricket-manhattan-bar is-inn-${p.index}${over ? "" : " is-empty"}`}
                          style={{ height: `${((over?.runs ?? 0) / top) * 100}%` }}
                          title={over ? `${p.name}, over ${overIndex + 1}: ${over.runs} run${over.runs === 1 ? "" : "s"}, ${over.wickets} wkt` : undefined}
                        >
                          {over && over.wickets > 0 && <span className="cricket-manhattan-wkt">{over.wickets > 1 ? over.wickets : ""}</span>}
                        </span>
                      );
                    })}
                  </div>
                  <span className="cricket-manhattan-label">{overIndex + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </InsightCard>

      <WormChart match={match} />

      <InsightCard icon="fa-chart-pie" title="How the runs came" sub="Runs by source, then every ball faced">
        <div className="cricket-sources">
          {perInnings.map((p) => {
            const { source } = p.breakdown;
            const parts = [
              { key: "running", label: "Running", runs: source.running },
              { key: "fours", label: "Fours", runs: source.fours },
              { key: "sixes", label: "Sixes", runs: source.sixes },
              { key: "extras", label: "Extras", runs: source.extras },
            ];
            const counts = [
              { label: "0s", value: p.breakdown.dots },
              { label: "1s", value: p.breakdown.ones },
              { label: "2s", value: p.breakdown.twos },
              { label: "3s", value: p.breakdown.threes },
              { label: "4s", value: p.breakdown.fours },
              { label: "6s", value: p.breakdown.sixes },
            ];
            return (
              <div key={p.index} className="cricket-source">
                <div className="cricket-source-head">
                  <span className={`cricket-glance-name is-inn-${p.index}`}>
                    <span className="cricket-insight-swatch"></span> {p.name}
                  </span>
                  <small>
                    {p.summary.runs}/{p.summary.wickets} ({p.summary.overs}) · {pct(source.fours + source.sixes, p.summary.runs)}% in boundaries
                  </small>
                </div>
                <div className="cricket-source-bar" role="img" aria-label={parts.map((part) => `${part.label} ${part.runs}`).join(", ")}>
                  {parts.map((part) =>
                    part.runs > 0 ? (
                      <span key={part.key} className={`is-${part.key}`} style={{ flexGrow: part.runs }} title={`${part.label}: ${part.runs} runs`}>
                        {pct(part.runs, p.summary.runs) >= 12 && `${pct(part.runs, p.summary.runs)}%`}
                      </span>
                    ) : null,
                  )}
                </div>
                <ul className="cricket-source-key">
                  {parts.map((part) => (
                    <li key={part.key}>
                      <span className={`cricket-source-dot is-${part.key}`}></span>
                      {part.label} <strong>{part.runs}</strong>
                    </li>
                  ))}
                </ul>
                <div className="cricket-source-counts">
                  {counts.map((c) => (
                    <div key={c.label}>
                      <strong>{c.value}</strong>
                      <small>{c.label}</small>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </InsightCard>

      <Partnerships match={match} nameOf={nameOf} />
      <Matchups match={match} nameOf={nameOf} />
      <MatchShotMap match={match} nameOf={nameOf} />
      <PitchMap match={match} nameOf={nameOf} />
    </div>
  );
}
