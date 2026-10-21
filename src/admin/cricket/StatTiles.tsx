import type { ReactNode } from "react";

// [label, figure, optional share shown beside the figure (e.g. "33%"),
// optional who it belongs to shown under the label (e.g. a team)].
export type StatTile = [string, ReactNode, string?, string?];

export interface StatGroup {
  title: string;
  icon: string;
  tiles: StatTile[];
}

// Totals as small tiles grouped under headings (Batting, Bowling…): the
// Stats tab of a team and of a tournament.
export function StatTiles({ groups }: { groups: StatGroup[] }) {
  return (
    <div className="cricket-team-stats">
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="cricket-section-title">
            <i className={`fa-solid ${group.icon}`} aria-hidden="true"></i> {group.title}
          </h2>
          <dl className="cricket-team-stat-grid">
            {group.tiles.map(([label, value, share, owner]) => (
              <div key={label} className="cricket-team-stat">
                {owner && (
                  <span className="cricket-team-stat-owner" title={owner}>
                    {owner}
                  </span>
                )}
                <dt>{label}</dt>
                <dd>
                  {value}
                  {share && <small>({share})</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
