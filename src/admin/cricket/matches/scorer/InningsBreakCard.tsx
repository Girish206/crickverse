import type { CricketMatch } from "../../../../api/types";
import { avatarColorFor } from "../../avatarColor";
import { battingCard, bowlingCard, chaseInfo, inningsSummary, oversText, rate, type NameOf } from "../../stats";
import { TeamMark } from "../../teams/TeamMark";

// Between the innings: the first side's total, then the target as the one
// big figure over some cricket art, and who stood out so far. It wears the
// live score card's look (ScoreHead), so the break reads as the same
// scoreboard.
export function InningsBreakCard({
  match,
  chase,
  perOver,
  nameOf,
}: {
  match: CricketMatch;
  chase: NonNullable<ReturnType<typeof chaseInfo>>;
  perOver: number;
  nameOf: NameOf;
}) {
  const first = match.innings[0];
  const firstTeam = match.teams[first.battingTeam];
  const chasingTeam = match.teams[match.innings[1].battingTeam];
  const summary = inningsSummary(first, perOver);

  // Most runs, the quicker innings on a tie; a side all out for nothing has no top scorer.
  const topBatter = battingCard(first)
    .filter((row) => row.runs > 0)
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  // Most wickets, the fewest runs on a tie.
  const bestBowler = bowlingCard(first, perOver)
    .filter((row) => row.legalBalls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  const revisedBy = chase.revised ? (match.interruptions?.length ? "DLS" : "Revised") : null;

  return (
    <section className="cricket-scorer-head cricket-break">
      <span className="cricket-scorer-innings-tag cricket-break-tag">
        <i className="fa-solid fa-mug-hot" aria-hidden="true"></i> Break
      </span>
      <div className="cricket-scorer-head-top">
        <TeamMark
          className="cricket-scorer-team-logo"
          name={firstTeam.name}
          logoUrl={firstTeam.logoUrl}
          color={avatarColorFor(firstTeam.name)}
        />
        <span className="cricket-scorer-team" title={firstTeam.name}>
          {firstTeam.name}
        </span>
        <span className="cricket-break-total">
          <strong>
            {summary.runs}/{summary.wickets}
          </strong>{" "}
          ({summary.overs} ov)
        </span>
      </div>

      <div className="cricket-break-target">
        <small title={chasingTeam.name}>{chasingTeam.name} need</small>
        <strong>{chase.target}</strong>
        <small>
          run{chase.target === 1 ? "" : "s"} to win from {chase.ballsLeft} ball{chase.ballsLeft === 1 ? "" : "s"}
          {revisedBy && ` · ${revisedBy}`}
        </small>
      </div>

      {(topBatter || bestBowler) && (
        <div className="cricket-break-stars">
          {topBatter && (
            <div className="cricket-break-star">
              <small>
                <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> Top scorer
              </small>
              <span>
                <span className="cricket-break-star-name" title={nameOf(topBatter.playerId)}>
                  {nameOf(topBatter.playerId)}
                </span>
                <b>
                  {topBatter.runs}
                  {topBatter.outBall === null ? "*" : ""} ({topBatter.balls})
                </b>
              </span>
            </div>
          )}
          {bestBowler && (
            <div className="cricket-break-star">
              <small>
                <i className="fa-solid fa-baseball" aria-hidden="true"></i> Best bowler
              </small>
              <span>
                <span className="cricket-break-star-name" title={nameOf(bestBowler.playerId)}>
                  {nameOf(bestBowler.playerId)}
                </span>
                <b>
                  {bestBowler.wickets}/{bestBowler.runs} ({oversText(bestBowler.legalBalls, perOver)})
                </b>
              </span>
            </div>
          )}
        </div>
      )}

      <div className="cricket-scorer-stats">
        <span className="cricket-scorer-stat">
          <small>Overs</small>
          <strong>{oversText(chase.ballsLeft, perOver)}</strong>
        </span>
        <span className="cricket-scorer-stat">
          <small>1st RR</small>
          <strong>{rate(summary.runs, summary.legalBalls, perOver)}</strong>
        </span>
        <span className="cricket-scorer-stat is-target">
          <small>RRR</small>
          <strong>{chase.requiredRate}</strong>
        </span>
      </div>
    </section>
  );
}
