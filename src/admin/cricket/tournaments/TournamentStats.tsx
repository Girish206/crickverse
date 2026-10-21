import type { CricketMatch } from "../../../api/types";
import { oversText, rate, tournamentStats, type InningsTotal } from "../stats";
import { StatTiles, type StatGroup } from "../StatTiles";

const pct = (part: number, whole: number) => (whole ? `${Math.round((part * 100) / whole)}%` : "–");
const totalText = (total: InningsTotal | null) => (total ? `${total.runs}/${total.wickets}` : "–");

// The tournament's Stats tab: totals over all its scored matches — runs,
// boundaries, dots, extras, how wickets fell and how matches were won.
export function TournamentStats({ matches }: { matches: CricketMatch[] }) {
  const t = tournamentStats(matches);
  if (t.matches === 0) return <div className="admin-empty-state">Stats appear once matches are scored.</div>;
  const decided = t.wonBattingFirst + t.wonChasing;
  const groups: StatGroup[] = [
    {
      title: "Overview",
      icon: "fa-chart-simple",
      tiles: [
        ["Matches", t.matches],
        ["Completed", t.completed],
        ["Won batting first", t.wonBattingFirst, pct(t.wonBattingFirst, decided)],
        ["Won chasing", t.wonChasing, pct(t.wonChasing, decided)],
        ["Tied / no result", t.tiedOrNoResult],
      ],
    },
    {
      title: "Batting",
      icon: "fa-baseball-bat-ball",
      tiles: [
        ["Runs", t.runs],
        ["Run rate", rate(t.runs, t.balls)],
        ["Overs", oversText(t.balls)],
        ["Runs per match", Math.round(t.runs / t.matches)],
        ["Fours", t.fours],
        ["Sixes", t.sixes],
        ["Boundary runs", t.fours * 4 + t.sixes * 6, pct(t.fours * 4 + t.sixes * 6, t.runs)],
        ["Dot balls", t.dots, pct(t.dots, t.balls)],
        ["Fifties", t.fifties],
        ["Hundreds", t.hundreds],
        ["Ducks", t.ducks],
        ["Avg 1st innings", t.firstInnings ? Math.round(t.firstInningsRuns / t.firstInnings) : "–"],
        ["Highest total", totalText(t.highest), undefined, t.highest?.teamName],
        ["Lowest total", totalText(t.lowest), undefined, t.lowest?.teamName],
      ],
    },
    {
      title: "Bowling",
      icon: "fa-baseball",
      tiles: [
        ["Wickets", t.wickets],
        ["Maidens", t.maidens],
        ["Extras", t.extras],
        ["Wides", t.wides],
        ["No-balls", t.noBalls],
        ["Bowled", t.bowled],
        ["LBW", t.lbw],
      ],
    },
    {
      title: "Fielding",
      icon: "fa-hands",
      tiles: [
        ["Catches", t.caught],
        ["Run-outs", t.runOuts],
        ["Stumpings", t.stumpings],
      ],
    },
  ];
  return <StatTiles groups={groups} />;
}
