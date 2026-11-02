import { useState } from "react";
import { BottomSheet } from "../BottomSheet";
import { MVP_POINTS, mvpRules, wicketPoints } from "../stats";

// Wicket values change with the match's length, so the guide shows a T20's.
const T20 = mvpRules({ matchType: "limited-overs", overs: 20 });
const shown = (n: number) => `+${Number(n.toFixed(2))}`;
const haul = (wickets: number) => MVP_POINTS.hauls.find((tier) => tier.wickets === wickets)?.points ?? 0;

// What each thing a player does is worth, grouped the way the MVP rows
// split their points. `points` is left out where it depends on the match.
const GROUPS: {
  title: string;
  tone: string;
  icon: string;
  items: { label: string; icon: string; points?: string; note?: string }[];
}[] = [
  {
    title: "Batting",
    tone: "is-batting",
    icon: "fa-baseball-bat-ball",
    items: [
      { label: `Every ${MVP_POINTS.runsPerPoint} runs`, icon: "fa-person-running", points: "+1" },
      { label: "Scoring as fast as the team or faster", icon: "fa-gauge-high", note: "Bonus" },
    ],
  },
  {
    title: "Bowling (T20)",
    tone: "is-bowling",
    icon: "fa-baseball",
    items: [
      { label: "Wicket of batters 1 to 4", icon: "fa-crosshairs", points: shown(wicketPoints(T20, 1)) },
      { label: "Wicket of batters 5 to 8", icon: "fa-crosshairs", points: shown(wicketPoints(T20, 5)) },
      { label: "Wicket of batters 9 to 11", icon: "fa-crosshairs", points: shown(wicketPoints(T20, 9)) },
      { label: "3 wickets in an innings", icon: "fa-layer-group", points: shown(haul(3)) },
      { label: "5 wickets in an innings", icon: "fa-layer-group", points: shown(haul(5)) },
      { label: "10 wickets in an innings", icon: "fa-layer-group", points: shown(haul(10)) },
      { label: "Maiden over", icon: "fa-circle", points: shown(wicketPoints(T20) / T20.maidensPerWicket) },
      { label: "Conceding as slowly as the team or slower", icon: "fa-gauge-high", note: "Bonus" },
    ],
  },
  {
    title: "Fielding",
    tone: "is-fielding",
    icon: "fa-hands",
    items: [
      { label: "Catch or stumping", icon: "fa-hand", note: `${MVP_POINTS.fielderShare * 100}% of the wicket` },
      { label: "Direct-hit run-out", icon: "fa-bolt", note: "The whole wicket" },
      { label: "Run-out by two fielders", icon: "fa-people-arrows", note: "Half each" },
    ],
  },
];

// The scoring itself, as cards: used inside the sheet below.
export function MvpPointsTable() {
  return (
    <div className="cricket-mvp-guide">
      <p className="cricket-mvp-guide-lead">
        MVP points follow the CricHeroes method: every run counts, and a wicket is worth more in a longer match and for a
        higher batter in the order.
      </p>
      {GROUPS.map((group) => (
        <section key={group.title} className={`cricket-mvp-guide-group ${group.tone}`}>
          <h3>
            <i className={`fa-solid ${group.icon}`} aria-hidden="true"></i> {group.title}
          </h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.label}>
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
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="cricket-mvp-guide-notes">
        <li>
          <i className="fa-solid fa-ruler" aria-hidden="true"></i>
          An opener's wicket is worth 12 runs in a match of up to 7 overs, rising to 27 in a 51 to 99 over match, and 25 in
          a Test. In a T20 it's 18.
        </li>
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
          Best batter and bowler go by runs and wickets.
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
