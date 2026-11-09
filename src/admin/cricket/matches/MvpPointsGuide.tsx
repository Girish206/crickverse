import { useState } from "react";
import { BottomSheet } from "../BottomSheet";
// Add pressureWeight here when pressure is turned back on.
import { MVP_POINTS, MVP_WICKET_VALUES, mvpRules, wicketPoints } from "../stats";

// Wicket values change with the match's length, so the guide shows a T20's.
const T20 = mvpRules({ matchType: "limited-overs", overs: 20 });
const num = (n: number) => Number(n.toFixed(2));
const shown = (n: number) => `+${num(n)}`;
const haul = (wickets: number) => MVP_POINTS.hauls.find((tier) => tier.wickets === wickets)?.points ?? 0;
const runPoints = (runs: number) => runs / MVP_POINTS.runsPerPoint;
const fourPoints = runPoints(4) + MVP_POINTS.fourBonus;
const sixPoints = runPoints(6) + MVP_POINTS.sixBonus;
// A run above or below par in a T20.
const parRun = Number((T20.paceWeight / MVP_POINTS.runsPerPoint).toFixed(3));
const catchPoints = (rules: typeof T20, position: number) => num(wicketPoints(rules, position) * MVP_POINTS.fielderShare);

interface GuideItem {
  label: string;
  icon: string;
  // On the row itself: points, or words where they depend on the match.
  points?: string;
  note?: string;
  // Shown when the row is opened.
  detail: string;
  example: string;
}

// One row of "By match length": what a top-order wicket is worth, then the rest.
const lengthRow = (label: string, rules: typeof T20): GuideItem => ({
  label,
  icon: "fa-ruler",
  points: shown(wicketPoints(rules)),
  detail: `${rules.maidensPerWicket} maiden${rules.maidensPerWicket === 1 ? " is" : "s are"} worth a wicket. Each run more or fewer than the match average is worth ${Number((rules.paceWeight / MVP_POINTS.runsPerPoint).toFixed(4))}.`,
  example: `Dismissing batter 2 earns ${num(wicketPoints(rules, 2))}, batter 6 earns ${num(wicketPoints(rules, 6))} and batter 10 earns ${num(wicketPoints(rules, 10))}. A maiden earns ${num(wicketPoints(rules) / rules.maidensPerWicket)}.`,
});
const LENGTH_ROWS = [
  ...MVP_WICKET_VALUES.map((row, i) => {
    const from = i === 0 ? 1 : MVP_WICKET_VALUES[i - 1].upTo + 1;
    const label = row.upTo === Infinity ? `${from}+ overs` : `${from} to ${row.upTo} overs`;
    return lengthRow(label, mvpRules({ matchType: "limited-overs", overs: row.upTo }));
  }),
  lengthRow("Test match", mvpRules({ matchType: "test", overs: 90 })),
];

/* Pressure is turned off for now (see matchImpact in stats.ts).
// A band of the Pressure Index (`from` to `to`, kept off the screen), with how
// much it changes a ball's points.
const pressureRow = (label: string, from: number, to: number, meaning: string, situation: string): GuideItem => {
  const middle = pressureWeight((from + to) / 2);
  const change = Math.round((Math.abs(middle - 1) * 100) / 5) * 5;
  return {
    label,
    icon: "fa-gauge-high",
    note: `About ${change}% ${middle < 1 ? "fewer" : "more"} points`,
    detail: `${meaning} For example: ${situation}`,
    example: `A four normally earns ${num(fourPoints)}. Here it earns about ${num(fourPoints * middle)}.\nA top-order wicket in a T20 normally earns ${wicketPoints(T20)}. Here it earns about ${num(wicketPoints(T20) * middle)}.`,
  };
};
*/

// What each thing a player does is worth, grouped the way the MVP rows
// split their points. `points` is left out where it depends on the match.
const GROUPS: { title: string; tone: string; icon: string; intro?: string; items: GuideItem[] }[] = [
  {
    title: "Batting",
    tone: "is-batting",
    icon: "fa-baseball-bat-ball",
    items: [
      {
        label: `Every ${MVP_POINTS.runsPerPoint} runs`,
        icon: "fa-person-running",
        points: "+1",
        detail: `Every run counts, including singles and doubles: 1 run is worth ${runPoints(1)}. Extras like wides and byes don't count for the batter.`,
        example: `Scoring 45 runs earns ${num(runPoints(45))} points.`,
      },
      {
        label: "Four",
        icon: "fa-4",
        points: shown(fourPoints),
        detail: `${shown(runPoints(4))} for the 4 runs and a bonus of ${shown(MVP_POINTS.fourBonus)} for hitting the boundary. Fours that are all run earn no bonus.`,
        example: `5 fours earn 5 × ${num(fourPoints)} = ${num(5 * fourPoints)} points.`,
      },
      {
        label: "Six",
        icon: "fa-6",
        points: shown(sixPoints),
        detail: `${shown(runPoints(6))} for the 6 runs and a bonus of ${shown(MVP_POINTS.sixBonus)} for clearing the rope.`,
        example: `3 sixes earn 3 × ${num(sixPoints)} = ${num(3 * sixPoints)} points.`,
      },
      {
        label: "Scoring faster or slower than average",
        icon: "fa-gauge-high",
        points: `± ${parRun}`,
        detail: `We work out how many runs an average batter in this match would score from the balls you faced. This is called par. In a T20, each run you score above it earns ${parRun}, and each run you fall short loses ${parRun}.`,
        example: `Say this match is going at 1 run a ball, and you face 20 balls. An average batter would score 20.\nYou score 30: that's 10 more, so you gain ${num(10 * parRun)}.\nYou score 10: that's 10 fewer, so you lose ${num(10 * parRun)}.`,
      },
    ],
  },
  {
    title: "Bowling (T20)",
    tone: "is-bowling",
    icon: "fa-baseball",
    items: [
      {
        label: "Wicket of batters 1 to 4",
        icon: "fa-crosshairs",
        points: shown(wicketPoints(T20, 1)),
        detail: "The top order is the hardest to get out, so this is a wicket's full value. The bowler gets it all, even if a fielder takes a catch.",
        example: `Bowl the opener and you earn ${wicketPoints(T20, 1)}. Have the opener caught and you still earn ${wicketPoints(T20, 1)}, and the catcher earns ${catchPoints(T20, 1)} as well.`,
      },
      {
        label: "Wicket of batters 5 to 8",
        icon: "fa-crosshairs",
        points: shown(wicketPoints(T20, 5)),
        detail: "80% of the full value, as the middle order is expected to score less.",
        example: `Getting the number 6 out earns ${wicketPoints(T20, 6)}.`,
      },
      {
        label: "Wicket of batters 9 to 11",
        icon: "fa-crosshairs",
        points: shown(wicketPoints(T20, 9)),
        detail: "60% of the full value, as the lower order is expected to score least.",
        example: `Getting the number 10 out earns ${num(wicketPoints(T20, 10))}.`,
      },
      {
        label: "3 wickets in an innings",
        icon: "fa-layer-group",
        points: shown(haul(3)),
        detail: "A bonus on top of the wickets themselves. Only the biggest haul in an innings counts.",
        example: `3 top-order wickets earn ${num(3 * wicketPoints(T20))} for the wickets and ${shown(haul(3))} for the haul: ${num(3 * wicketPoints(T20) + haul(3))} in all.`,
      },
      {
        label: "5 wickets in an innings",
        icon: "fa-layer-group",
        points: shown(haul(5)),
        detail: "Replaces the 3-wicket bonus rather than adding to it.",
        example: `A 5-wicket innings earns a bonus of ${shown(haul(5))}, not ${shown(haul(3) + haul(5))}.`,
      },
      {
        label: "10 wickets in an innings",
        icon: "fa-layer-group",
        points: shown(haul(10)),
        detail: "Replaces the smaller bonuses in the same way.",
        example: `All 10 wickets earn a bonus of ${shown(haul(10))}, on top of the wickets themselves.`,
      },
      {
        label: "Maiden over",
        icon: "fa-circle",
        points: shown(wicketPoints(T20) / T20.maidensPerWicket),
        detail: "A full over with no runs charged to the bowler. Byes and leg-byes don't spoil it.",
        example: `In a T20, ${T20.maidensPerWicket} maidens earn ${wicketPoints(T20)}, the same as a top-order wicket.`,
      },
      {
        label: "Conceding fewer or more runs than average",
        icon: "fa-gauge-high",
        points: `± ${parRun}`,
        detail: `We work out how many runs an average bowler in this match would give away from the balls you bowled. This is called par. In a T20, each run you save earns ${parRun}, and each extra run you give away loses ${parRun}.`,
        example: `Say this match is going at 1 run a ball, and you bowl 4 overs (24 balls). An average bowler would give away 24.\nYou give away 14: that's 10 fewer, so you gain ${num(10 * parRun)}.\nYou give away 34: that's 10 more, so you lose ${num(10 * parRun)}.`,
      },
    ],
  },
  {
    title: "Fielding",
    tone: "is-fielding",
    icon: "fa-hands",
    items: [
      {
        label: "Catch or stumping",
        icon: "fa-hand",
        note: `${MVP_POINTS.fielderShare * 100}% of the wicket`,
        detail: "On top of the bowler's points. A bowler who catches their own ball gets this as well as the wicket.",
        example: `Catching an opener in a T20 earns ${catchPoints(T20, 1)}. Catching the number 6 earns ${catchPoints(T20, 6)}.`,
      },
      {
        label: "Direct-hit run-out",
        icon: "fa-bolt",
        note: "The whole wicket",
        detail: "No bowler is involved, so the fielder gets it all. A bowler's run-out at the non-striker's end counts as their wicket instead.",
        example: `Running out an opener in a T20 earns ${wicketPoints(T20)}.`,
      },
      {
        label: "Run-out by two fielders",
        icon: "fa-people-arrows",
        note: "Half each",
        detail: "The two fielders split the wicket's value.",
        example: `Running out an opener in a T20 earns ${wicketPoints(T20) / 2} each.`,
      },
      {
        label: "Excellent catch",
        icon: "fa-hand-sparkles",
        points: shown(MVP_POINTS.excellentCatchBonus),
        detail: "A bonus on top of the catch's own points, when the scorer marks the catch as excellent.",
        example: `An excellent catch of an opener in a T20 earns ${catchPoints(T20, 1)} + ${MVP_POINTS.excellentCatchBonus} = ${num(catchPoints(T20, 1) + MVP_POINTS.excellentCatchBonus)}.`,
      },
      {
        label: "Dropped catch",
        icon: "fa-circle-xmark",
        points: `−${MVP_POINTS.droppedCatchPenalty}`,
        detail: "Taken off the points of the fielder the scorer names. It's the same whichever batter was let off.",
        example: `A fielder with 1 catch of an opener in a T20 and 1 dropped catch ends on ${num(catchPoints(T20, 1) - MVP_POINTS.droppedCatchPenalty)} fielding points.`,
      },
      {
        label: "Misfield",
        icon: "fa-triangle-exclamation",
        points: `−${MVP_POINTS.misfieldPenalty}`,
        detail: "Taken off the points of the fielder the scorer names, however many runs it cost.",
        example: `2 misfields cost ${num(2 * MVP_POINTS.misfieldPenalty)} points.`,
      },
    ],
  },
  {
    title: "What a top-order wicket is worth, by match length",
    tone: "is-bowling",
    icon: "fa-ruler",
    intro: "Longer matches make wickets worth more and scoring rate matter less.",
    items: LENGTH_ROWS,
  },
  /* Pressure is turned off for now (see matchImpact in stats.ts).
  {
    title: "How hard the moment is",
    tone: "is-batting",
    icon: "fa-gauge-high",
    intro:
      "Before every ball we work out how hard the situation is for the batting team, from the runs still needed, the balls left and the wickets lost. In a hard moment that ball earns more points, and in an easy moment it earns fewer. So the same 40 runs are worth more when your team is 52/5 in a chase than when it's cruising at 120/1.",
    items: [
      pressureRow("Very easy", 0, 19, "The batting team is cruising, so points go down.", "120/1 after 10 overs of a T20."),
      pressureRow("Easy", 20, 39, "The batting team is doing fine, so points go down a little.", "70/0 after 10 overs of a T20."),
      pressureRow("Tight", 40, 64, "The match is getting close, so points go up slightly.", "20 needed from 9 balls with 4 wickets left."),
      pressureRow("Hard", 65, 79, "The batting team is struggling, so points go up.", "35 needed from 15 balls with 4 wickets left."),
      pressureRow("Very hard", 80, 100, "The match could be decided on this ball, so points go up the most.", "20 needed from 8 balls with 3 wickets left."),
    ],
  },
  */
];

// The scoring itself, as cards of rows that open to explain themselves: used
// inside the sheet below.
export function MvpPointsTable() {
  return (
    <div className="cricket-mvp-guide">
      <p className="cricket-mvp-guide-lead">
        Every run counts, and a wicket is worth
        more in a longer match and for a higher batter. Tap any row to see how it works, with an example.
        {/* With pressure back on, add: The points below are normal values: they go up in a hard moment and down in an easy
            one (see How hard the moment is). */}
      </p>
      {GROUPS.map((group) => (
        <section key={group.title} className={`cricket-mvp-guide-group ${group.tone}`}>
          <h3>
            <i className={`fa-solid ${group.icon}`} aria-hidden="true"></i> {group.title}
          </h3>
          {group.intro && <p className="cricket-mvp-guide-intro">{group.intro}</p>}
          <ul>
            {group.items.map((item) => (
              <li key={item.label}>
                <details className="cricket-mvp-guide-item">
                  <summary>
                    <span className="cricket-mvp-guide-icon" aria-hidden="true">
                      <i className={`fa-solid ${item.icon}`}></i>
                    </span>
                    <span className="cricket-mvp-guide-label">{item.label}</span>
                    {item.points ? (
                      <strong>
                        {item.points}
                        <small> pts</small>
                      </strong>
                    ) : (
                      <strong>
                        <small>{item.note}</small>
                      </strong>
                    )}
                    <i className="fa-solid fa-chevron-down cricket-mvp-guide-chevron" aria-hidden="true"></i>
                  </summary>
                  <div className="cricket-mvp-guide-more">
                    <p>{item.detail}</p>
                    <p className="cricket-mvp-guide-example">
                      <b>Example:</b> {item.example}
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="cricket-mvp-guide-notes">
        <li>
          <i className="fa-solid fa-medal" aria-hidden="true"></i>
          Player of the match is the winning side's best if they're in the top three on MVP points, otherwise the top
          scorer from either side, unless the organiser picks someone.
        </li>
        <li>
          <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
          Fighter of the match is the losing side's best if they're in the top three and not already player of the match.
        </li>
        <li>
          <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i>
          Level on points? The winning side goes first, then more runs and wickets.
        </li>
        <li>
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          Batting and bowling points can't go below 0, but they can drop during a live match. Best batter and bowler go by
          batting and bowling points. Fielding points can go below 0 after a dropped catch or misfield.
          {/* With pressure back on, add: Maidens and wicket hauls aren't multiplied by pressure. */}
        </li>
        <li>
          <i className="fa-solid fa-lock" aria-hidden="true"></i>
          Once a match is finished its points are locked, so later changes to these rules don't affect it or its tournament.
          Correcting a ball or reopening the match works them out again.
        </li>
        <li>
          <i className="fa-solid fa-hand-pointer" aria-hidden="true"></i>
          Tap a player on the MVP tab or a tournament's MVP list, or the points on a hero card, to see where they came from.
        </li>
      </ul>
    </div>
  );
}

// A small "How MVP points work" button that opens the table in a sheet.
export function MvpPointsHelp({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`cricket-mvp-help-btn ${className}`.trim()} onClick={() => setOpen(true)}>
        <i className="fa-solid fa-circle-question" aria-hidden="true"></i> How MVP points work
      </button>
      {open && (
        <BottomSheet title="MVP points" icon="fa-solid fa-star" onClose={() => setOpen(false)}>
          <MvpPointsTable />
        </BottomSheet>
      )}
    </>
  );
}
