import { ballsPerOverOf, type CricketMatch } from "../../../api/types";
import { matchHeroes, oversText, points, rate, strikeRate, type ImpactRow, type NameOf } from "../stats";
import { AwardCard } from "./AwardCard";
import { HeroFigures } from "./MatchAwards";
import { MvpPointsButton } from "./MvpBreakdown";
import { usePlayerPhotos } from "./matchUtils";

interface Hero {
  title: string;
  icon: string;
  row: ImpactRow | null;
  label: string;
  // Points open their breakdown; a stat like sixes is just the stat.
  points?: number;
  stat?: string | number;
  line?: string;
  note?: string;
  featured?: boolean;
}

// The "Heroes" tab: the best of the match at each thing, on the same cards as
// the Summary tab's. One with no one to show (no fighter in a tie, say) is left out.
export function MatchHeroes({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const photoOf = usePlayerPhotos();
  const heroes = matchHeroes(match);
  if (heroes.rows.length === 0) return <div className="admin-empty-state">The heroes appear once the first ball is bowled.</div>;
  const perOver = ballsPerOverOf(match);
  const {
    playerOfMatch,
    autoPicked,
    mvp,
    bestBatter,
    bestBowler,
    bestFielder,
    fighterOfMatch,
    mostRuns,
    bestFigures,
    mostCatches,
    mostSixes,
    mostFours,
    bestStrikeRate,
    bestEconomy,
  } = heroes;
  const cards: Hero[] = [
    {
      title: "Player of the match",
      icon: "fa-medal",
      row: playerOfMatch,
      label: "MVP",
      points: playerOfMatch?.total,
      note: autoPicked ? "Top MVP points" : "Picked by admin",
      featured: true,
    },
    { title: "MVP", icon: "fa-star", row: mvp, label: "MVP", points: mvp?.total, featured: true },
    { title: "Best batter", icon: "fa-baseball-bat-ball", row: bestBatter, label: "Pts", points: bestBatter?.batting },
    { title: "Best bowler", icon: "fa-baseball", row: bestBowler, label: "Pts", points: bestBowler?.bowling },
    { title: "Best fielder", icon: "fa-hands", row: bestFielder, label: "Pts", points: bestFielder?.fielding },
    { title: "Fighter of the match", icon: "fa-shield-halved", row: fighterOfMatch, label: "Pts", points: fighterOfMatch?.total },
    { title: "Most runs", icon: "fa-arrow-trend-up", row: mostRuns, label: "Runs", stat: mostRuns?.bat?.runs },
    {
      title: "Best bowling",
      icon: "fa-bullseye",
      row: bestFigures,
      label: "Figures",
      stat: bestFigures?.bowl ? `${bestFigures.bowl.wickets}/${bestFigures.bowl.runs}` : undefined,
    },
    { title: "Most catches", icon: "fa-hand", row: mostCatches, label: "Ct", stat: mostCatches?.catches },
    { title: "Most sixes", icon: "fa-6", row: mostSixes, label: "6s", stat: mostSixes?.bat?.sixes },
    { title: "Most fours", icon: "fa-4", row: mostFours, label: "4s", stat: mostFours?.bat?.fours },
    {
      title: "Best strike rate",
      icon: "fa-bolt",
      row: bestStrikeRate,
      label: "SR",
      stat: bestStrikeRate?.bat ? strikeRate(bestStrikeRate.bat.runs, bestStrikeRate.bat.balls) : undefined,
      line: bestStrikeRate?.bat ? `${bestStrikeRate.bat.runs} off ${bestStrikeRate.bat.balls} (min ${heroes.minBallsFaced} balls)` : undefined,
    },
    {
      title: "Best economy",
      icon: "fa-gauge-high",
      row: bestEconomy,
      label: "Econ",
      stat: bestEconomy?.bowl ? rate(bestEconomy.bowl.runs, bestEconomy.bowl.legalBalls, perOver) : undefined,
      line: bestEconomy?.bowl
        ? `${bestEconomy.bowl.runs} runs in ${oversText(bestEconomy.bowl.legalBalls, perOver)} ov (min ${heroes.minOversBowled})`
        : undefined,
    },
  ];

  return (
    <div className="cricket-award-grid cricket-heroes-grid">
      {cards
        .filter((card) => card.row)
        .map((card) => (
          <AwardCard
            key={card.title}
            title={card.title}
            icon={card.icon}
            playerId={card.row!.playerId}
            name={nameOf(card.row!.playerId)}
            photoUrl={photoOf(card.row!.playerId)}
            team={match.teams[card.row!.team]?.name}
            line={card.line ?? <HeroFigures row={card.row!} perOver={perOver} />}
            pointsLabel={card.label}
            points={
              card.points !== undefined ? (
                <MvpPointsButton row={card.row!} name={nameOf(card.row!.playerId)}>
                  {points(card.points)}
                </MvpPointsButton>
              ) : (
                card.stat
              )
            }
            note={card.note}
            featured={card.featured}
          />
        ))}
    </div>
  );
}
