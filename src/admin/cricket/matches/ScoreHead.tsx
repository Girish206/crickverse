import { avatarColorFor } from "../avatarColor";
import { TeamMark } from "../teams/TeamMark";

export type ScoreHeadData = {
  team: string;
  logoUrl?: string | null;
  inningsTag: string;
  score: string;
  // Overs bowled ("19.4") of the innings' maximum.
  overs: string;
  maxOvers: number;
  crr: string;
  chase: { target: number; requiredRate: string } | null;
  // The chase's bottom line: runs still needed from the balls left.
  need: { runs: number; balls: number } | null;
};

// The live score card (the scorer and the Live tab), broadcast style: the
// batting side and score, a strip of rates, then what the chase needs.
export function ScoreHead({ data }: { data: ScoreHeadData }) {
  return (
    <div className="cricket-scorer-head">
      <div className="cricket-scorer-head-top">
        <TeamMark
          className="cricket-scorer-team-logo"
          name={data.team}
          logoUrl={data.logoUrl}
          color={avatarColorFor(data.team)}
        />
        <span className="cricket-scorer-team" title={data.team}>
          {data.team}
        </span>
        <span className="cricket-scorer-innings-tag">{data.inningsTag}</span>
      </div>
      <div className="cricket-scorer-score-row">
        <strong className="cricket-scorer-score">{data.score}</strong>
        <span className="cricket-scorer-overs">
          <strong>{data.overs}</strong> / {data.maxOvers} ov
        </span>
      </div>
      <div className="cricket-scorer-stats">
        <span className="cricket-scorer-stat">
          <small>CRR</small>
          <strong>{data.crr}</strong>
        </span>
        {data.chase && (
          <>
            <span className="cricket-scorer-stat is-target">
              <small>Target</small>
              <strong>{data.chase.target}</strong>
            </span>
            <span className="cricket-scorer-stat">
              <small>RRR</small>
              <strong>{data.chase.requiredRate}</strong>
            </span>
          </>
        )}
      </div>
      {data.need && (
        <div className="cricket-scorer-need">
          <i className="fa-solid fa-bullseye" aria-hidden="true"></i>
          <span>
            Need <strong>{Math.max(data.need.runs, 0)}</strong> run{data.need.runs === 1 ? "" : "s"} from{" "}
            <strong>{data.need.balls}</strong> ball{data.need.balls === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}
