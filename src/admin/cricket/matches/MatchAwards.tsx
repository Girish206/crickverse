import type { CricketMatch } from "../../../api/types";
import { impactLine, matchAwards, points, type ImpactRow, type NameOf } from "../stats";

interface Award {
  title: string;
  icon: string;
  row: ImpactRow | null;
  score: (row: ImpactRow) => number;
  note?: string;
  featured?: boolean;
}

// Player of the match and best batter / bowler / fielder, picked from the
// impact points (see matchImpact in stats.ts). The full ranking is the MVP tab.
export function MatchAwards({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
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
        <i className="fa-solid fa-award" aria-hidden="true"></i> {finished ? "Match awards" : "Top performers"}
      </h2>
      <div className="cricket-award-grid">
        {cards
          .filter((card) => card.row)
          .map((card) => (
            <div key={card.title} className={`cricket-award ${card.featured ? "is-featured" : ""}`}>
              <span className="cricket-award-title">
                <i className={`fa-solid ${card.icon}`} aria-hidden="true"></i> {card.title}
              </span>
              <strong className="cricket-award-name">{nameOf(card.row!.playerId)}</strong>
              <span className="cricket-award-line">{impactLine(card.row!)}</span>
              <span className="cricket-award-points">
                {points(card.score(card.row!))} pts
                {card.note && <small> · {card.note}</small>}
              </span>
            </div>
          ))}
      </div>
    </section>
  );
}
