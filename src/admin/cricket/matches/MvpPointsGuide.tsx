import { useState } from "react";
import { BottomSheet } from "../BottomSheet";
import { MVP_POINTS } from "../stats";

// What each thing a player does is worth, grouped the way the MVP rows
// split their points.
const GROUPS: { title: string; tone: string; icon: string; items: { label: string; icon: string; points: number }[] }[] = [
  {
    title: "Batting",
    tone: "is-batting",
    icon: "fa-baseball-bat-ball",
    items: [
      { label: "Four", icon: "fa-4", points: MVP_POINTS.four },
      { label: "Six", icon: "fa-6", points: MVP_POINTS.six },
    ],
  },
  {
    title: "Bowling",
    tone: "is-bowling",
    icon: "fa-baseball",
    items: [
      { label: "Wicket", icon: "fa-crosshairs", points: MVP_POINTS.wicket },
      { label: "Dot ball", icon: "fa-circle", points: MVP_POINTS.dot },
    ],
  },
  {
    title: "Fielding",
    tone: "is-fielding",
    icon: "fa-hands",
    items: [
      { label: "Catch", icon: "fa-hand", points: MVP_POINTS.catch },
      { label: "Stumping", icon: "fa-bolt", points: MVP_POINTS.stumping },
    ],
  },
];

// The scoring itself, as cards: used inside the sheet below.
export function MvpPointsTable() {
  return (
    <div className="cricket-mvp-guide">
      <p className="cricket-mvp-guide-lead">
        MVP points follow the IPL's Most Valuable Player tally: the boundaries, wickets, dot balls and dismissals that
        swing a match. Every match counts the same.
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
                <strong>
                  +{item.points}
                  <small> pts</small>
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="cricket-mvp-guide-notes">
        <li>
          <i className="fa-solid fa-medal" aria-hidden="true"></i>
          Player of the match is the winning side's top scorer on MVP points, unless the organiser picks someone.
        </li>
        <li>
          <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i>
          Level on points? The winning side goes first, then more runs and wickets.
        </li>
        <li>
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          Runs on their own and run-outs aren't scored, as in the IPL tally. Best batter and bowler go by runs and wickets.
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
