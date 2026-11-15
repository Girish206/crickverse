import { useState } from "react";
import { ballsPerOverOf, type CricketMatch } from "../../../api/types";
import { partnershipsOf } from "../analytics";
import { strikeRate, type NameOf } from "../stats";
import "./analysis.css";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

// One innings' stands at a time, broadcast style: the two batters either
// side, the stand's runs (balls) in the middle, and each batter's share
// drawn out from the centre, scaled to the innings' biggest stand. The
// biggest stand is called out on top.
export function Partnerships({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const all = match.innings
    .map((innings, index) => ({ index, team: match.teams[innings.battingTeam].name, stands: partnershipsOf(innings) }))
    .filter((inn) => inn.stands.length > 0);
  const [picked, setPicked] = useState<number | null>(null);
  if (all.length === 0) return null;
  // The latest innings until one is picked, so a live match shows the stand in progress.
  const inn = all.find((i) => i.index === picked) ?? all[all.length - 1];
  const perOver = ballsPerOverOf(match);
  const best = inn.stands.reduce((top, s) => (s.runs > top.runs ? s : top), inn.stands[0]);
  const scale = Math.max(1, ...inn.stands.flatMap((s) => s.shares.map((share) => share.runs)));
  const rate = (runs: number, balls: number) => (balls ? ((runs * perOver) / balls).toFixed(2) : "–");

  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-people-arrows" aria-hidden="true"></i>
        <span className="cricket-insight-heading">
          Partnerships
          <small>Each stand, split between the two batters</small>
        </span>
      </h2>

      {all.length > 1 && (
        <div className="cricket-stands-tabs" role="tablist" aria-label="Innings">
          {all.map((i) => (
            <button
              key={i.index}
              type="button"
              role="tab"
              aria-selected={i.index === inn.index}
              className={`is-inn-${i.index}${i.index === inn.index ? " active" : ""}`}
              onClick={() => setPicked(i.index)}
            >
              <span className="cricket-insight-swatch"></span> {i.team}
            </button>
          ))}
        </div>
      )}

      {best.runs > 0 && (
        <div className={`cricket-stand-best${best.unbroken ? " is-unbroken" : ""}`}>
          <i className="fa-solid fa-trophy" aria-hidden="true"></i>
          <div className="cricket-stand-best-text">
            <small>
              Best stand · {ordinal(best.wicket)} wkt{best.unbroken ? " · batting" : ""}
            </small>
            <strong>
              {nameOf(best.batters[0])} & {nameOf(best.batters[1])}
            </strong>
          </div>
          <div className="cricket-stand-best-runs">
            <strong>
              {best.runs}
              {best.unbroken ? "*" : ""}
            </strong>
            <small>
              {best.balls} balls · RR {rate(best.runs, best.balls)}
            </small>
          </div>
        </div>
      )}

      <ol className="cricket-stands-list">
        {inn.stands.map((s, i) => (
          <li key={i} className={`cricket-stand${s.unbroken ? " is-unbroken" : ""}${s === best && best.runs > 0 ? " is-best" : ""}`}>
            {[0, 1].map((slot) => (
              <div key={slot} className={`cricket-stand-side is-${slot === 0 ? "a" : "b"}`}>
                <span className="cricket-stand-name" title={nameOf(s.batters[slot])}>
                  {nameOf(s.batters[slot])}
                </span>
                <span className="cricket-stand-fig" title={`Strike rate ${strikeRate(s.shares[slot].runs, s.shares[slot].balls)}`}>
                  <strong>{s.shares[slot].runs}</strong>
                  <small>({s.shares[slot].balls})</small>
                </span>
                <span className="cricket-stand-track" aria-hidden="true">
                  <span style={{ width: `${(s.shares[slot].runs / scale) * 100}%` }}></span>
                </span>
              </div>
            ))}
            {s.retired && (
              <div className="cricket-stand-retired">
                <i className="fa-solid fa-user-clock" aria-hidden="true"></i> {nameOf(s.retired.playerId)}{" "}
                {s.retired.how === "retired-hurt" ? "retired hurt" : s.retired.how === "absent-hurt" ? "absent hurt" : "retired"}
                {" · same wicket continues"}
              </div>
            )}
            <div className="cricket-stand-mid" title={s.extras > 0 ? `Includes ${s.extras} extras` : undefined}>
              <span className="cricket-stand-wkt">{ordinal(s.wicket)}</span>
              <strong>
                {s.runs}
                {s.unbroken ? "*" : ""}
              </strong>
              <small>{s.balls}b</small>
            </div>
          </li>
        ))}
      </ol>
      <p className="cricket-worm-caption">
        Runs (balls) each; the middle is the stand's total with extras. * still batting.
      </p>
    </section>
  );
}
