import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ballsPerOverOf, type CricketInnings, type CricketMatch } from "../../../api/types";
import { PlayerLink } from "../players/PlayerProfileSheet";
import {
  ballChipClass,
  ballLabel,
  battingCard,
  bowlingCard,
  dismissalText,
  fallOfWickets,
  inningsSummary,
  isLegal,
  isWicket,
  oversOf,
  oversText,
  rate,
  type NameOf,
} from "../stats";
import { NoPlayNote } from "./result/ResultNote";

export function ScrollableOverBalls({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const isScrollable = el.scrollWidth > el.clientWidth + 2;
    const left = isScrollable && el.scrollLeft > 2;
    const right = isScrollable && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const timer = setTimeout(update, 120);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [update, children]);

  return (
    <div
      className={`cricket-this-over-balls-wrap ${className}${overflow.left ? " has-left-shadow" : ""}${overflow.right ? " has-right-shadow" : ""}`.trim()}
    >
      <div className="cricket-this-over-balls" ref={ref} onScroll={update}>
        {children}
      </div>
    </div>
  );
}

// Per-innings scorecard in the CricHeroes style: a coloured bar with the
// team and score (tap to collapse), batters with how they got out under
// their name, then extras, total, fall of wickets and the bowlers.
export function Scorecard({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  // The innings in progress (or the last one) starts open.
  const [open, setOpen] = useState<Set<number>>(() => new Set([match.innings.length - 1]));
  const perOver = ballsPerOverOf(match);
  // A walkover (or a result entered before a ball) has no scorecard to show.
  if (!match.innings.some((innings) => innings.balls.length > 0) && match.resultMethod) {
    return <NoPlayNote match={match} />;
  }
  if (match.innings.length === 0) return <div className="admin-empty-state">The match hasn't started yet.</div>;
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  return (
    <div className="cricket-scorecard">
      {match.innings.map((innings, index) => {
        const summary = inningsSummary(innings, perOver);
        const batting = battingCard(innings);
        const batted = new Set(batting.map((row) => row.playerId));
        const didNotBat = match.teams[innings.battingTeam].playerIds.filter((id) => !batted.has(id));
        const fow = fallOfWickets(innings, perOver);
        const isOpen = open.has(index);
        return (
          <section className="cricket-innings" key={index}>
            <button
              type="button"
              className="cricket-innings-bar"
              aria-expanded={isOpen}
              onClick={() => toggle(index)}
            >
              <span className="cricket-innings-team">{match.teams[innings.battingTeam].name}</span>
              <span className="cricket-innings-score">
                <strong>
                  {summary.runs}/{summary.wickets}
                </strong>{" "}
                <small>({summary.overs} Ov)</small>
              </span>
              <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"}`} aria-hidden="true"></i>
            </button>
            {isOpen && (
              <div className="cricket-innings-body">
                <table className="cricket-table">
                  <thead>
                    <tr>
                      <th>Batters</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batting.map((row) => (
                      <tr key={row.playerId}>
                        <td className="cricket-bat-cell">
                          <span className="cricket-bat-name">
                            <PlayerLink playerId={row.playerId}>{nameOf(row.playerId)}</PlayerLink>
                            {row.outBall === null ? "*" : ""}
                          </span>
                          <small className="cricket-dismissal">
                            {row.outBall ? dismissalText(row.outBall, nameOf) : "not out"}
                          </small>
                        </td>
                        <td className="fw-bold">{row.runs}</td>
                        <td>{row.balls}</td>
                        <td>{row.fours}</td>
                        <td>{row.sixes}</td>
                        <td>{row.balls ? Math.round((row.runs * 100) / row.balls) : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="cricket-innings-row">
                  <span>Extras</span>
                  <span>
                    <strong>{summary.extras.total}</strong>{" "}
                    <small>
                      (wd {summary.extras.wides}, nb {summary.extras.noBalls}, b {summary.extras.byes}, lb{" "}
                      {summary.extras.legByes}
                      {summary.extras.penalty > 0 && `, pen ${summary.extras.penalty}`})
                    </small>
                  </span>
                </div>
                <div className="cricket-innings-row is-total">
                  <span>Total</span>
                  <span>
                    <strong>
                      {summary.runs}/{summary.wickets}
                    </strong>{" "}
                    <small>
                      ({summary.overs} Ov, RR {rate(summary.runs, summary.legalBalls, perOver)})
                    </small>
                  </span>
                </div>
                {didNotBat.length > 0 && (
                  <p className="cricket-innings-note">
                    <span>Yet to bat / did not bat</span>
                    {didNotBat.map((id, i) => (
                      <Fragment key={id}>
                        {i > 0 && ", "}
                        <PlayerLink playerId={id}>{nameOf(id)}</PlayerLink>
                      </Fragment>
                    ))}
                  </p>
                )}
                <table className="cricket-table">
                  <thead>
                    <tr>
                      <th>Bowlers</th>
                      <th>O</th>
                      <th>M</th>
                      <th>R</th>
                      <th>W</th>
                      <th>Eco</th>
                      <th>0s</th>
                      <th>NB</th>
                      <th>WD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bowlingCard(innings, perOver).map((row) => (
                      <tr key={row.playerId}>
                        <td className="cricket-bat-cell">
                          <span className="cricket-bat-name">
                            <PlayerLink playerId={row.playerId}>{nameOf(row.playerId)}</PlayerLink>
                          </span>
                        </td>
                        <td>{row.legalBalls % perOver === 0 ? row.legalBalls / perOver : oversText(row.legalBalls, perOver)}</td>
                        <td>{row.maidens}</td>
                        <td>{row.runs}</td>
                        <td className="fw-bold">{row.wickets}</td>
                        <td>{rate(row.runs, row.legalBalls, perOver)}</td>
                        <td>{row.dots}</td>
                        <td>{row.noBalls}</td>
                        <td>{row.wides}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fow.length > 0 && (
                  <table className="cricket-table cricket-fow">
                    <thead>
                      <tr>
                        <th>Fall of wickets</th>
                        <th>Score (over)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fow.map((w) => (
                        <tr key={w.wicket}>
                          <td>
                            <span className="cricket-bat-name">
                              {w.wicket}. <PlayerLink playerId={w.playerId}>{nameOf(w.playerId)}</PlayerLink>
                            </span>
                          </td>
                          <td>
                            <strong>{w.score}</strong> <small className="text-muted">({w.overs} Ov)</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Over-by-over log for one side at a time, latest first: the score after
// each over, who bowled to whom, every ball and the runs it cost.
export function BallByBall({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const bowled = match.innings.filter((innings) => innings.balls.length > 0);
  // A side (0 or 1), both, or until one's picked the side batting last.
  const [picked, setPicked] = useState<number | "both" | null>(null);
  if (bowled.length === 0) {
    return match.resultMethod ? <NoPlayNote match={match} /> : <div className="admin-empty-state">No balls bowled yet.</div>;
  }
  const side = picked ?? bowled[bowled.length - 1].battingTeam;
  // Newest first; a super over gives each side a second innings.
  const shown = [...bowled].reverse().filter((innings) => side === "both" || innings.battingTeam === side);
  const perOver = ballsPerOverOf(match);
  const options: { value: number | "both"; label: string }[] = [
    { value: 0, label: match.teams[0].name },
    { value: 1, label: match.teams[1].name },
    { value: "both", label: "Both" },
  ];

  return (
    <div className="cricket-overs-log">
      {bowled.length > 1 && (
        <div className="admin-segmented cricket-tabs cricket-overs-sides" role="group" aria-label="Batting side">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={side === option.value ? "active" : ""}
              aria-pressed={side === option.value}
              title={option.label}
              onClick={() => setPicked(option.value)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
      {shown.map((innings) => {
        const summary = inningsSummary(innings, perOver);
        return (
          <section key={match.innings.indexOf(innings)} className="cricket-overs-innings">
            {shown.length > 1 && (
              <h3 className="cricket-overs-innings-head">
                <span>{match.teams[innings.battingTeam].name}</span>
                <strong>
                  {summary.runs}/{summary.wickets} <small>({summary.overs} ov)</small>
                </strong>
              </h3>
            )}
            <InningsOvers match={match} innings={innings} nameOf={nameOf} />
          </section>
        );
      })}
    </div>
  );
}

// One innings' overs, newest first, each with the score at the end of it.
function InningsOvers({ match, innings, nameOf }: { match: CricketMatch; innings: CricketInnings; nameOf: NameOf }) {
  const perOver = ballsPerOverOf(match);
  const overs: (ReturnType<typeof oversOf>[number] & { score: string; batters: number[] })[] = [];
  let runs = 0;
  let wickets = 0;
  for (const over of oversOf(innings, perOver)) {
    runs += over.runs;
    wickets += over.balls.filter(isWicket).length;
    overs.push({ ...over, score: `${runs}/${wickets}`, batters: [...new Set(over.balls.map((ball) => ball.batterId))] });
  }

  return (
    <ol className="cricket-over-cards">
      {[...overs].reverse().map((over) => {
        const legalBalls = over.balls.filter(isLegal).length;
        const isLastOver = over.number === overs.length - 1;
        const isIncomplete = legalBalls < perOver;
        const isLiveOver =
          isIncomplete &&
          isLastOver &&
          match.status === "live" &&
          innings === match.innings[match.innings.length - 1] &&
          !innings.closed;
        const remainingBalls = isIncomplete ? Math.max(0, perOver - legalBalls) : 0;

        return (
          <li
            key={over.number}
            className={`cricket-over-card${isIncomplete ? " is-incomplete" : ""}${isLiveOver ? " is-live-over" : ""}`}
          >
            <div className="cricket-over-card-num">
              <strong>Ov {over.number + 1}</strong>
              <small>{over.score}</small>
              {isIncomplete && (
                <span className={`cricket-over-card-sub-badge${isLiveOver ? " is-live" : ""}`}>
                  {over.number}.{legalBalls} ov
                </span>
              )}
            </div>
            <div className="cricket-over-card-body">
              <div className="cricket-over-card-top">
                <span className="cricket-over-card-who">
                  <PlayerLink playerId={over.bowlerId}>{nameOf(over.bowlerId)}</PlayerLink> to{" "}
                  {over.batters.map((id, i) => (
                    <Fragment key={id}>
                      {i > 0 && ", "}
                      <PlayerLink playerId={id}>{nameOf(id)}</PlayerLink>
                    </Fragment>
                  ))}
                </span>
              </div>
              <div className="cricket-over-card-balls-row">
                <ScrollableOverBalls className="cricket-over-card-balls-wrap">
                  {over.balls.map((ball, i) => (
                    <span
                      key={i}
                      className={ballChipClass(ball)}
                      title={`${nameOf(ball.bowlerId)} to ${nameOf(ball.batterId)}${ball.wicketType ? ` — ${nameOf(ball.dismissedId)} ${dismissalText(ball, nameOf)}` : ""
                        }`}
                    >
                      {ballLabel(ball) === "0" ? "•" : ballLabel(ball)}
                    </span>
                  ))}
                  {remainingBalls > 0 &&
                    Array.from({ length: remainingBalls }, (_, i) => (
                      <span
                        key={`empty-${i}`}
                        className="cricket-ball-slot-empty"
                        title="Remaining delivery in this over"
                        aria-hidden="true"
                      />
                    ))}
                </ScrollableOverBalls>
                {isIncomplete && (
                  <span className={`cricket-over-incomplete-badge${isLiveOver ? " is-live" : ""}`}>
                    {isLiveOver && <span className="cricket-over-live-dot" aria-hidden="true" />}
                    {isLiveOver ? `In progress · ${remainingBalls}b left` : `${legalBalls}/${perOver} balls`}
                  </span>
                )}
              </div>
            </div>
            <div className="cricket-over-card-runs">
              <strong>{over.runs}</strong>
              <small>Run{over.runs === 1 ? "" : "s"}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
