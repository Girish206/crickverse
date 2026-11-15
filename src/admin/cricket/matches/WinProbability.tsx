import type { CricketMatch } from "../../../api/types";
import { winProbability } from "../analytics";
import "./analysis.css";

// The chase's win probability as a two-sided bar (see winProbability for how
// it's worked out). Only while a limited-overs chase is on.
export function WinProbability({ match }: { match: CricketMatch }) {
  const odds = winProbability(match);
  if (!odds) return null;
  const chasing = match.teams[odds.chasing].name;
  const defending = match.teams[1 - odds.chasing].name;
  return (
    <section className="cricket-winprob" aria-label={`Win probability: ${chasing} ${odds.percent}%, ${defending} ${100 - odds.percent}%`}>
      <div className="cricket-winprob-head">
        <span>
          <strong>{chasing}</strong> {odds.percent}%
        </span>
        <small>
          <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i> Win probability
        </small>
        <span>
          {100 - odds.percent}% <strong>{defending}</strong>
        </span>
      </div>
      <div className="cricket-winprob-bar" aria-hidden="true">
        <span className="is-chasing" style={{ width: `${odds.percent}%` }}></span>
        <span className="is-defending" style={{ width: `${100 - odds.percent}%` }}></span>
      </div>
    </section>
  );
}
