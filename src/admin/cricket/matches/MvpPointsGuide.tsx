import { useState } from "react";
import { BottomSheet } from "../BottomSheet";
import { MVP_POINTS, MVP_WICKET_VALUES, mvpRules, wicketPoints } from "../stats";

// Wicket values change with the match's length, so the guide shows a T20's.
const T20 = mvpRules({ matchType: "limited-overs", overs: 20 });
const shown = (n: number) => `+${Number(n.toFixed(2))}`;
const haul = (wickets: number) => MVP_POINTS.hauls.find((tier) => tier.wickets === wickets)?.points ?? 0;
// One row of "By match length": a top-order wicket, maidens to a wicket, pace bonus.
const lengthRow = (label: string, rules: ReturnType<typeof mvpRules>) => ({
  label,
  icon: "fa-ruler",
  note: `${Number(wicketPoints(rules).toFixed(2))} · ${rules.maidensPerWicket} · ${Math.round(rules.strikeRateBonus * 100)}%`,
});
const LENGTH_ROWS = [
  ...MVP_WICKET_VALUES.map((row, i) => {
    const from = i === 0 ? 1 : MVP_WICKET_VALUES[i - 1].upTo + 1;
    const label = row.upTo === Infinity ? `${from}+ overs` : `${from} to ${row.upTo} overs`;
    return lengthRow(label, mvpRules({ matchType: "limited-overs", overs: row.upTo }));
  }),
  lengthRow("Test match", mvpRules({ matchType: "test", overs: 90 })),
];

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
      { label: "Four, counted as 4 runs (no extra)", icon: "fa-4", points: shown(4 / MVP_POINTS.runsPerPoint) },
      { label: "Six, counted as 6 runs (no extra)", icon: "fa-6", points: shown(6 / MVP_POINTS.runsPerPoint) },
      {
        label: "Scoring as fast as the team or faster",
        icon: "fa-gauge-high",
        note: `Run points × their rate ÷ team's × ${T20.strikeRateBonus * 100}%`,
      },
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
      {
        label: "Conceding no faster than the team",
        icon: "fa-gauge-high",
        note: `Team's rate ÷ theirs × ${T20.strikeRateBonus * 100}%`,
      },
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
  {
    title: "By match length: wicket pts · maidens to a wicket · pace %",
    tone: "is-bowling",
    icon: "fa-ruler",
    items: LENGTH_ROWS,
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
