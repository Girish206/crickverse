import type { CSSProperties, ReactNode } from "react";
import "./me.css";

// One figure on a scoreline: its label, the value and an optional tooltip.
export type ScoreStat = { label: string; value: ReactNode; title?: string };

// A row of figures split by thin rules, like a broadcast scoreline — the
// hero banners' numbers (Home, My Stats, My Matches, My Tournaments, My Teams).
export function Scoreline({ stats }: { stats: ScoreStat[] }) {
  return (
    <dl className="cv-scoreline" style={{ "--cols": stats.length } as CSSProperties}>
      {stats.map((stat) => (
        <div key={stat.label} title={stat.title}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The win rate as a ring ("–" before any completed match).
export function WinRing({ won, played, label = "won" }: { won: number; played: number; label?: string }) {
  const rate = played > 0 ? Math.round((won / played) * 100) : null;
  return (
    <span
      className="cv-win-ring"
      style={{ "--win": `${rate ?? 0}%` } as CSSProperties}
      role="img"
      aria-label={rate === null ? "No completed matches yet" : `Won ${rate}% of completed matches`}
    >
      <strong>{rate === null ? "–" : `${rate}%`}</strong>
      <small>{label}</small>
    </span>
  );
}

// A big count with its label, the lead of a banner without a win rate.
export function BannerCount({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="cv-banner-count">
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

export type FormResult = "W" | "L" | "T";

// The last few results as chips, newest first.
export function FormLine({ form, label = "Recent form" }: { form: FormResult[]; label?: string }) {
  return (
    <div className="cv-form-line">
      <small>{label}</small>
      {form.length === 0 ? (
        <span className="cv-form-empty">No results yet</span>
      ) : (
        <span className="cv-form" aria-label={`Last ${form.length} results, newest first: ${form.join(" ")}`}>
          {form.map((result, i) => (
            <span key={i} className={`cv-form-chip is-${result}`} aria-hidden="true">
              {result}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

// A page's summary on the hero gradient: a lead (ring or count), the
// scoreline beside it and anything below (recent form).
export function SummaryBanner({ lead, stats, children }: { lead: ReactNode; stats: ScoreStat[]; children?: ReactNode }) {
  return (
    <section className="cricket-home-hero cv-banner">
      <div className="cv-banner-top">
        {lead}
        <Scoreline stats={stats} />
      </div>
      {children}
    </section>
  );
}
