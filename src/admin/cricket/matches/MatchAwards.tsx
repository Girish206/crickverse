import { ballsPerOverOf, type CricketMatch } from "../../../api/types";
import { impactLine, matchAwards, oversText, points, type ImpactRow, type NameOf } from "../stats";
import { AwardCard } from "./AwardCard";
import { usePlayerPhotos } from "./matchUtils";

interface Award {
  title: string;
  icon: string;
  row: ImpactRow | null;
  score: (row: ImpactRow) => number;
  note?: string;
  featured?: boolean;
}

// The scorecard-style figures: 23(15) 2·4s 1·6s | 3.0-1-10-3, then any
// fielding. Falls back to the plain impact line when the player did neither.
function HeroFigures({ row, perOver }: { row: ImpactRow; perOver: number }) {
  const { bat, bowl } = row;
  const bowled = bowl && bowl.legalBalls > 0;
  const fielding = [
    row.catches && `${row.catches} ct`,
    row.stumpings && `${row.stumpings} st`,
    row.runOuts && `${row.runOuts} ro`,
  ].filter(Boolean);
  if (!bat && !bowled) return <>{impactLine(row) || "—"}</>;
  return (
    <>
      {bat && (
        <span className="cricket-award-fig">
          {bat.runs}
          {bat.out ? "" : "*"}
          <small>({bat.balls})</small> {bat.fours}
          <small>4s</small> {bat.sixes}
          <small>6s</small>
        </span>
      )}
      {bowled && (
        <span className="cricket-award-fig">
          {oversText(bowl.legalBalls, perOver)}-{bowl.maidens}-{bowl.runs}-{bowl.wickets}
        </span>
      )}
      {fielding.length > 0 && <span className="cricket-award-fig">{fielding.join(" · ")}</span>}
    </>
  );
}

// Player of the match and best batter / bowler / fielder, picked from the
// impact points (see matchImpact in stats.ts). The full ranking is the MVP tab.
export function MatchAwards({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const photoOf = usePlayerPhotos();
  const awards = matchAwards(match);
  if (awards.rows.length === 0) return null;
  const finished = match.status === "completed";

  const cards: Award[] = [
    ...(awards.playerOfMatch
      ? [
          {
            title: "Player of the match",
            icon: "fa-medal",
            row: awards.playerOfMatch,
            score: (row: ImpactRow) => row.total,
            note: awards.autoPicked ? "Top impact" : "Picked by admin",
            featured: true,
          },
        ]
      : !finished
        ? [{ title: "MVP so far", icon: "fa-star", row: awards.rows[0], score: (row: ImpactRow) => row.total, featured: true }]
        : []),
    { title: "Best batter", icon: "fa-baseball-bat-ball", row: awards.bestBatter, score: (row) => row.batting },
    { title: "Best bowler", icon: "fa-baseball", row: awards.bestBowler, score: (row) => row.bowling },
    { title: "Best fielder", icon: "fa-hands", row: awards.bestFielder, score: (row) => row.fielding },
  ];

  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-award" aria-hidden="true"></i> {finished ? "Heroes of the match" : "Top performers"}
      </h2>
      <div className="cricket-award-grid">
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
              line={<HeroFigures row={card.row!} perOver={ballsPerOverOf(match)} />}
              pointsLabel={card.featured ? "MVP" : "Pts"}
              points={points(card.score(card.row!))}
              note={card.note}
              featured={card.featured}
            />
          ))}
      </div>
    </section>
  );
}
