import type { ReactNode } from "react";
import type { CricketBall, CricketInnings, CricketMatch } from "../../../api/types";
import {
  ballChipClass,
  ballLabel,
  battingCard,
  bowlingCard,
  dismissalText,
  inningsSummary,
  isLegal,
  isWicket,
  oversOf,
  oversText,
  type NameOf,
} from "../stats";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One of a few phrasings, picked by the ball's place so the same ball
// always reads the same.
const pick = <T,>(seed: number, lines: T[]) => lines[seed % lines.length];

// What happened off a ball, to end its "Bowler to Batter, …" sentence: the
// result in a word ("SIX!", "2 runs", "OUT!") and a line on it (after "!"
// a new sentence, otherwise carrying on after a comma), from what
// was recorded (runs, extras, how out, where it went). And how its row is
// styled.
function describe(ball: CricketBall, nameOf: NameOf, seed: number): { lead: string; line: string; kind: string } {
  const batter = nameOf(ball.batterId);
  const zone = ball.shotZone?.toLowerCase() ?? null;
  const fielder = ball.fielderId === null ? null : nameOf(ball.fielderId);

  // Leaving without being out.
  if (ball.wicketType === "retired-hurt") {
    return { lead: "Retired hurt", line: `${nameOf(ball.dismissedId)} has to leave the field`, kind: "extra" };
  }
  if (ball.wicketType === "retired") {
    return { lead: "Retired", line: `${nameOf(ball.dismissedId)} walks off, not out`, kind: "extra" };
  }
  if (ball.wicketType === "absent-hurt") {
    return { lead: "Absent hurt", line: `${nameOf(ball.dismissedId)} is unable to bat`, kind: "extra" };
  }
  if (isWicket(ball)) {
    const out = nameOf(ball.dismissedId);
    const lines: Record<string, string> = {
      bowled: pick(seed, [`Bowled! ${out} misses and the stumps are rattled`, `Clean bowled! ${out} has to go`]),
      caught:
        ball.fielderId === ball.bowlerId
          ? `Caught and bowled! ${nameOf(ball.bowlerId)} takes the return catch`
          : `Caught by ${fielder ?? "the fielder"}${zone ? ` at ${zone}` : ""}. ${out} has to walk back`,
      lbw: `Trapped in front! ${out} is given out LBW`,
      "caught-behind": `Caught behind! ${fielder ?? "The keeper"} takes it, ${out} has to go`,
      "run-out": ball.noDelivery
        ? `Run out at the non-striker's end! ${nameOf(ball.bowlerId)} whips the bails off before bowling, ${out} was out of the crease`
        : `Run out! ${
        fielder && ball.secondFielderId
          ? `${fielder} throws, ${nameOf(ball.secondFielderId)} breaks the stumps`
          : fielder
            ? `Direct hit from ${fielder}`
            : "Beaten to the crease"
      }, ${out} is short of the crease`,
      stumped: `Stumped! ${fielder ?? "The keeper"} whips the bails off, ${out} is out of the crease`,
      "hit-wicket": `Hit wicket! ${out} disturbs the stumps`,
      "hit-ball-twice": `Hit the ball twice! ${out} is given out`,
      "obstructing-field": `Obstructing the field! ${out} is given out`,
      "retired-out": `${out} retires out`,
      "timed-out": `Timed out! ${out} didn't reach the crease in time`,
    };
    const completed = ball.runs > 0 ? ` (${plural(ball.runs, "run")} completed)` : "";
    return { lead: "OUT!", line: `${lines[ball.wicketType ?? ""] ?? `${out} ${dismissalText(ball, nameOf)}`}${completed}`, kind: "wicket" };
  }
  if (ball.extraType === "wide") {
    const ran = ball.extras - 1;
    return { lead: "Wide", kind: "wide", line: ran > 0 ? `and they run ${plural(ran, "more")}` : pick(seed, ["the umpire stretches out the arms", "strays too far, an extra to the total"]) };
  }
  if (ball.extraType === "bye") {
    return { lead: plural(ball.extras, "bye"), line: "the ball beats the keeper and they run", kind: "extra" };
  }
  if (ball.extraType === "leg-bye") {
    return { lead: plural(ball.extras, "leg bye"), line: "off the pads and they scamper through", kind: "extra" };
  }

  const where = zone ? ` to ${zone}` : "";
  let lead: string;
  let line: string;
  let kind: string;
  if (ball.runs === 6) {
    lead = "SIX!";
    kind = "six";
    line = zone
      ? pick(seed, [`Launched over ${zone}`, `${batter} sends it sailing over ${zone}`, `Massive hit, into the crowd at ${zone}`])
      : pick(seed, [`${batter} clears the rope`, "Out of the ground!"]);
  } else if (ball.runs === 4) {
    lead = "FOUR!";
    kind = "four";
    line = zone
      ? pick(seed, [`Races away to the ${zone} boundary`, `${batter} finds the gap at ${zone}`, `Too good, past ${zone} for four`])
      : pick(seed, [`${batter} finds the boundary`, "Beats the field and runs away to the rope"]);
  } else if (ball.runs === 0) {
    lead = "No run";
    kind = "dot";
    line = pick(seed, ["dot ball", `${batter} can't get it away`, "well bowled, nothing off it"]);
  } else {
    lead = plural(ball.runs, "run");
    kind = "run";
    line =
      ball.runs === 1
        ? pick(seed, [`pushed${where} for a single`, `worked${where}, they take one`, `nudged${where} and away for one`])
        : ball.runs === 2
          ? pick(seed, [`placed${where} and they come back for two`, `good running, two${where}`])
          : `played${where}, they run hard for three`;
  }
  if (ball.extraType === "no-ball") {
    return {
      lead: "No ball!",
      line: ball.runs > 0 ? `And ${lead === "SIX!" ? "a six" : lead === "FOUR!" ? "a four" : lead} off the bat${where}` : "An extra run",
      kind: ball.runs >= 4 ? kind : "no-ball",
    };
  }
  return { lead, line, kind };
}

// A line of text with the player names picked out.
type Note = ReactNode;

// Who came in before each ball: the openers and opening bowler before the
// first, then each new batter (or one back after retiring) and each change
// of bowler. `pending` is for players already in for the ball yet to be
// bowled (the next batter or bowler, just picked; or, before the first
// ball, the openers and opening bowler). `opening` starts the innings (the
// chase's target).
function arrivals(innings: CricketInnings, nameOf: NameOf, live: boolean, opening: Note | null): { byBall: Note[][]; pending: Note[] } {
  const batted = new Set<number>();
  const bowled = new Set<number>();
  let crease: number[] = [];
  let bowler: number | null = null;
  let legal = 0;
  const name = (id: number) => <strong>{nameOf(id)}</strong>;
  const batterNote = (id: number): Note => {
    if (batted.has(id)) return <>{name(id)} comes back out to resume the innings</>;
    batted.add(id);
    return <>{name(id)} walks out to bat at No. {batted.size}</>;
  };
  const bowlerNote = (id: number, upTo: number): Note => {
    const wasIn = bowled.has(id);
    bowled.add(id);
    if (legal % 6 !== 0) return <>{name(id)} takes over to finish the over</>;
    if (!wasIn) return <>{name(id)} comes into the attack</>;
    const row = bowlingCard({ ...innings, balls: innings.balls.slice(0, upTo) }).find((r) => r.playerId === id);
    return (
      <>
        {name(id)} is back into the attack
        {row && ` (${oversText(row.legalBalls).replace(/\.0$/, "")}-${row.maidens}-${row.runs}-${row.wickets})`}
      </>
    );
  };

  // The openers walking out, and who bowls to them: one of a few
  // phrasings, picked by who they are so it reads the same before and after
  // the first ball.
  const openersNote = (striker: number, nonStriker: number, by: number | null): Note => {
    const seed = striker + nonStriker * 7 + (by ?? 0) * 13;
    if (by === null) {
      return pick(seed, [
        <>
          {name(striker)} takes strike, with {name(nonStriker)} at the non-striker&apos;s end
        </>,
        <>
          {name(striker)} and {name(nonStriker)} walk out to open the batting, {name(striker)} on strike
        </>,
        <>
          {name(striker)} takes guard, {name(nonStriker)} ready at the other end
        </>,
      ]);
    }
    return pick(seed, [
      <>
        {name(striker)} takes strike and {name(nonStriker)} is at the non-striker&apos;s end, ready to face {name(by)}
      </>,
      <>
        {name(striker)} and {name(nonStriker)} walk out to open the batting. {name(striker)} on strike, {name(by)} to bowl the
        first ball
      </>,
      <>
        {name(by)} has the new ball in hand. {name(striker)} takes guard on strike, {name(nonStriker)} backing up at the other
        end
      </>,
    ]);
  };

  const byBall = innings.balls.map((ball, i) => {
    const notes: Note[] = [];
    if (i === 0) {
      if (opening) notes.push(opening);
      batted.add(ball.batterId);
      batted.add(ball.nonStrikerId);
      // A first "ball" between deliveries (a batter timed out) has no bowler yet.
      const by = ball.noDelivery ? null : ball.bowlerId;
      notes.push(openersNote(ball.batterId, ball.nonStrikerId, by));
      if (by !== null) {
        bowled.add(by);
        bowler = by;
      }
    } else {
      for (const id of [ball.batterId, ball.nonStrikerId]) if (!crease.includes(id)) notes.push(batterNote(id));
    }
    // An event between deliveries (a retirement) isn't the bowler's.
    if (!ball.noDelivery && ball.bowlerId !== bowler) {
      if (bowler === null) {
        bowled.add(ball.bowlerId);
        notes.push(<>{name(ball.bowlerId)} opens the bowling</>);
      } else notes.push(bowlerNote(ball.bowlerId, i));
      bowler = ball.bowlerId;
    }
    crease = [ball.batterId, ball.nonStrikerId].filter((id) => id !== ball.dismissedId);
    if (isLegal(ball)) legal += 1;
    return notes;
  });

  const pending: Note[] = [];
  if (live && innings.balls.length === 0) {
    if (opening) pending.push(opening);
    const [striker, nonStriker] = [innings.strikerId, innings.nonStrikerId];
    if (striker !== null && nonStriker !== null) {
      pending.push(openersNote(striker, nonStriker, innings.bowlerId));
    } else {
      for (const id of [striker, nonStriker]) if (id !== null) pending.push(<>{name(id)} walks out to open the batting</>);
      if (innings.bowlerId !== null) pending.push(<>{name(innings.bowlerId)} opens the bowling</>);
    }
  } else if (live) {
    for (const id of [innings.strikerId, innings.nonStrikerId]) if (id !== null && !crease.includes(id)) pending.push(batterNote(id));
    if (innings.bowlerId !== null && innings.bowlerId !== bowler) pending.push(bowlerNote(innings.bowlerId, innings.balls.length));
  }
  return { byBall, pending };
}

// A note row between balls (newest first, so a ball's notes are reversed).
function noteRows(notes: Note[], key: string) {
  return [...notes].reverse().map((note, i) => (
    <li key={`${key}-${i}`} className="is-note">
      <p className="cricket-commentary-text">{note}</p>
    </li>
  ));
}

// The Live tab's ball-by-ball commentary, newest first: the last 1.3 overs
// (nine legal balls, and any wides or no balls among them) of the innings
// in play. Once the chase is under way (its openers or bowler picked), the
// end of the first innings carries on below it, after an innings-break line.
// Each over opens with a card (bowler, runs, the score after it, its balls)
// over its balls, with boundaries and wickets picked out.
export function Commentary({ match, nameOf, legalBalls = 9 }: { match: CricketMatch; nameOf: NameOf; legalBalls?: number }) {
  const current = match.innings[match.innings.length - 1];
  if (!current) return null;
  const live = !current.closed && match.status === "live";
  const started =
    current.balls.length > 0 || (live && [current.strikerId, current.nonStrikerId, current.bowlerId].some((id) => id !== null));
  const shown = started ? [...match.innings].reverse() : match.innings.slice(0, -1).reverse();
  const blocks = shown.flatMap((innings) => {
    const block = inningsCommentary(match, innings, nameOf, legalBalls, innings === current && live);
    return block ? [{ innings, block }] : [];
  });
  if (blocks.length === 0) return null;
  const only = blocks.length === 1 ? blocks[0].innings : null;

  return (
    <section className="cricket-commentary">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> Commentary
        {only && only !== current && <small> · {match.teams[only.battingTeam].name}&apos;s innings</small>}
      </h2>
      {blocks.map(({ innings, block }, i) => {
        const summary = inningsSummary(innings);
        return (
          <div key={innings.battingTeam} className="cricket-commentary-innings">
            {i > 0 && (
              <div className="cricket-commentary-break">
                <span>
                  <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> End of {match.teams[innings.battingTeam].name}&apos;s
                  innings
                </span>
                <strong>
                  {summary.runs}/{summary.wickets} <small>({summary.overs} ov)</small>
                </strong>
              </div>
            )}
            {block}
          </div>
        );
      })}
    </section>
  );
}

// One innings' part of the commentary: who's just come in, then its last
// `legalBalls` legal deliveries by over. Null when there's nothing to say.
function inningsCommentary(match: CricketMatch, innings: CricketInnings, nameOf: NameOf, legalBalls: number, live: boolean) {
  const team = match.teams[innings.battingTeam].name;
  // The chase opens with what it needs.
  const target = innings === match.innings[1] ? inningsSummary(match.innings[0]).runs + 1 : null;
  const opening =
    target === null ? null : (
      <>
        <strong>{team}</strong> need <strong>{target}</strong> run{target === 1 ? "" : "s"} from {match.overs * 6} balls to win
      </>
    );
  const notes = arrivals(innings, nameOf, live, opening);
  if (innings.balls.length === 0 && notes.pending.length === 0) return null;

  // The score at the end of each over (so far, for the one in play), its
  // bowler's figures by then (overs-maidens-runs-wickets) and the batters
  // left at the crease, with their scores.
  const all = oversOf(innings);
  let runs = 0;
  let wickets = 0;
  let ballsSoFar = 0;
  const scoreAfter = all.map((over) => {
    runs += over.runs;
    wickets += over.balls.filter(isWicket).length;
    return `${runs}/${wickets}`;
  });
  const afterOver = all.map((over) => {
    ballsSoFar += over.balls.length;
    const sofar = { ...innings, balls: innings.balls.slice(0, ballsSoFar) };
    const row = bowlingCard(sofar).find((r) => r.playerId === over.bowlerId);
    const last = over.balls[over.balls.length - 1];
    const batting = battingCard(sofar);
    const batters = [...new Set([last.batterId, last.nonStrikerId])]
      .filter((id) => id !== last.dismissedId)
      .flatMap((id) => batting.filter((r) => r.playerId === id));
    return {
      // Whole overs as scorecards write them: "4", not "4.0".
      spell: row ? `${oversText(row.legalBalls).replace(/\.0$/, "")}-${row.maidens}-${row.runs}-${row.wickets}` : null,
      batters,
    };
  });
  // The first ball shown: going back from the latest, the one that makes
  // up `legalBalls` legal deliveries (or the innings' first).
  let from = innings.balls.length;
  for (let legalSeen = 0; from > 0 && legalSeen < legalBalls; ) {
    from -= 1;
    if (isLegal(innings.balls[from])) legalSeen += 1;
  }
  // Where each over starts in the innings, so its balls can be cut there.
  const startOf: number[] = [];
  let start = 0;
  for (const over of all) {
    startOf.push(start);
    start += over.balls.length;
  }
  const shown = all.filter((over, i) => startOf[i] + over.balls.length > from).reverse();

  return (
    <>
      {notes.pending.length > 0 && (
        <ol className="cricket-commentary-balls cricket-commentary-pending">{noteRows(notes.pending, "pending")}</ol>
      )}
      {shown.map((over) => {
        // Ball numbers as scorecards show them: 4.3 is the third legal ball
        // of the fifth over; a wide or no ball keeps the number of the next.
        let legal = 0;
        const start = startOf[all.indexOf(over)];
        const numbered = over.balls
          .map((ball, i) => {
            const number = Math.min(legal + 1, 6);
            if (isLegal(ball)) legal += 1;
            return { ball, number: `${over.number}.${number}`, at: start + i };
          })
          .filter(({ at }) => at >= from);
        const complete = legal >= 6;
        return (
          <div key={over.number} className="cricket-commentary-over">
            <header className="cricket-commentary-head">
              <div className="cricket-commentary-head-top">
                <strong>{complete ? `End of over ${over.number + 1}` : `Over ${over.number + 1}`}</strong>
                {complete ? (
                  <span>{plural(over.runs, "run")}</span>
                ) : (
                  <span className="cricket-commentary-live">In play</span>
                )}
                <span className="cricket-commentary-head-score">
                  {team} <b>{scoreAfter[all.indexOf(over)]}</b>
                </span>
              </div>
              <div className="cricket-commentary-chips">
                {over.balls.map((ball, i) => (
                  <span key={i} className={ballChipClass(ball)}>
                    {ballLabel(ball)}
                  </span>
                ))}
              </div>
              {/* After a finished over: the batters at the crease and the
                  bowler, each with their figures so far. */}
              {complete && (
                <dl className="cricket-commentary-stats">
                  {afterOver[all.indexOf(over)].batters.map((row) => (
                    <div key={row.playerId}>
                      <dt>{nameOf(row.playerId)}</dt>
                      <dd>
                        {row.runs} <small>({row.balls})</small>
                      </dd>
                    </div>
                  ))}
                  <div className="is-bowler">
                    <dt>
                      <i className="fa-solid fa-baseball" aria-hidden="true"></i> {nameOf(over.bowlerId)}
                    </dt>
                    <dd title="Overs-maidens-runs-wickets">{afterOver[all.indexOf(over)].spell}</dd>
                  </div>
                </dl>
              )}
            </header>
            <ol className="cricket-commentary-balls">
              {numbered.reverse().flatMap(({ ball, number, at }, i) => {
                const { lead, line, kind } = describe(ball, nameOf, over.number * 7 + i);
                return [
                  <li key={at} className={`is-${kind}`}>
                    <div className="cricket-commentary-ball">
                      <span className={ballChipClass(ball)}>{ballLabel(ball)}</span>
                      <span className="cricket-commentary-no">{number}</span>
                    </div>
                    <p className="cricket-commentary-text">
                      {nameOf(ball.bowlerId)} to {nameOf(ball.batterId)}, <strong>{lead}</strong>
                      {lead.endsWith("!") ? " " : ", "}
                      {line}
                    </p>
                  </li>,
                  ...noteRows(notes.byBall[at], `n${at}`),
                ];
              })}
            </ol>
          </div>
        );
      })}
    </>
  );
}
