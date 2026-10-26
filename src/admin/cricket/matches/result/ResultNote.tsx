import type { CricketMatch } from "../../../../api/types";
import { hasBalls, noPlayText } from "./resultText";

// In place of an empty scorecard: a result entered before a ball was
// bowled (a walkover, a forfeit…).
export function NoPlayNote({ match }: { match: CricketMatch }) {
  return (
    <div className="cricket-noplay">
      <i className="fa-solid fa-flag" aria-hidden="true"></i>
      <span>
        {match.resultText && <strong>{match.resultText}</strong>}
        <small>{match.resultMethod ? noPlayText(match.resultMethod) : "No balls were bowled"}</small>
      </span>
    </div>
  );
}

// The result on the Summary tab. A result entered by hand says so, and one
// entered before any ball says no balls were bowled.
export function ResultBanner({ match }: { match: CricketMatch }) {
  if (!match.resultText) return null;
  if (match.resultMethod && !hasBalls(match)) return <NoPlayNote match={match} />;
  return (
    <div className="admin-banner admin-banner-success mb-3">
      {match.resultText}
      {match.resultMethod && <small className="cricket-result-by-hand">Result entered by the organiser</small>}
    </div>
  );
}

export function KnockoutPrompt({ match, onEnter }: { match: CricketMatch; onEnter: () => void }) {
  return (
    <div className="cricket-knockout-prompt mb-3" role="status">
      <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i>
      <span>
        <strong>A knockout needs a winner</strong>
        <small>
          {match.status === "abandoned"
            ? "Decide who goes through — a super over, a bowl-out or however your rules say."
            : "It's a tie — enter the super over, or decide who goes through."}
        </small>
      </span>
      <button type="button" className="btn btn-custom-primary btn-sm" onClick={onEnter}>
        Enter result
      </button>
    </div>
  );
}
