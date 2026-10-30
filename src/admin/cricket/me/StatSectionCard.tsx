import "./me.css";

// A part of a bar: its label, its size (negatives count as nothing) and
// colour, and the figure shown in the legend.
export interface SharePart {
  label: string;
  value: number;
  color: string;
  shown?: string | number;
}

// One section of a player's career (Batting, Bowling...): every figure in
// order, which ones lead the card, and an optional bar of how a total splits.
export interface StatSection {
  tone: "batting" | "bowling" | "fielding" | "impact";
  title: string;
  icon: string;
  items: [string, string | number][];
  lead: string[];
  share?: { title: string; summary: string; parts: SharePart[] };
}

// My Stats' card for a section: the lead figures big in the section's
// colour, the split bar, then the rest as a two-column sheet.
export function StatSectionCard({ section }: { section: StatSection }) {
  const lead = section.lead.flatMap((label) => section.items.filter(([l]) => l === label));
  const share = section.share;
  // What the bar's legend already shows isn't listed again.
  const rest = section.items.filter(
    ([label]) => !section.lead.includes(label) && !share?.parts.some((part) => part.label === label),
  );
  const total = share ? share.parts.reduce((n, part) => n + Math.max(0, part.value), 0) : 0;
  return (
    <section className={`cv-stat-card is-${section.tone}`}>
      {/* The section's icon, big and faint in the corner. */}
      <i className={`fa-solid ${section.icon} cv-stat-card-mark`} aria-hidden="true"></i>
      <h2 className="cv-stat-card-head">
        <span aria-hidden="true">
          <i className={`fa-solid ${section.icon}`}></i>
        </span>
        {section.title}
      </h2>
      <dl className="cv-stat-lead">
        {lead.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {share && total > 0 && (
        <div className="cv-share">
          <div className="cv-share-title">
            <span>{share.title}</span>
            <strong>{share.summary}</strong>
          </div>
          <div className="cv-share-bar" aria-hidden="true">
            {share.parts.map((part) =>
              part.value > 0 ? (
                <span key={part.label} style={{ width: `${(part.value / total) * 100}%`, background: part.color }}></span>
              ) : null,
            )}
          </div>
          <ul className="cv-share-legend">
            {/* Only what made up some of it. */}
            {share.parts.filter((part) => part.value > 0).map((part) => (
              <li key={part.label}>
                <i style={{ background: part.color }} aria-hidden="true"></i>
                {part.label} <strong>{part.shown ?? part.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rest.length > 0 && (
        <dl className="cv-stat-list">
          {rest.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
