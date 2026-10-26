import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// Each home section's own colour (tinted panel and icon badge), so they're
// easy to tell apart at a glance. The player Home and the admin dashboard
// share them.
export type SectionTone = "live" | "next" | "last" | "tournaments" | "following";

export function HomeSection({
  title,
  icon,
  tone,
  badge,
  link,
  tour,
  children,
}: {
  title: string;
  icon: string;
  tone: SectionTone;
  badge?: ReactNode;
  link?: { to: string; label: string };
  // What the tips point at (TipsTour).
  tour?: string;
  children: ReactNode;
}) {
  return (
    <section className={`cricket-home-section is-${tone}`} data-tour={tour}>
      <div className="cricket-home-head">
        <h2 className="cricket-section-title cricket-home-heading">
          <span className="cricket-home-icon" aria-hidden="true">
            <i className={icon}></i>
          </span>
          {title}
          {badge}
        </h2>
        {link && (
          <Link to={link.to} className="admin-link">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// A row of cards to swipe through sideways. With more than one, each card is
// a little narrower than the row so the next one peeks in on the right.
export function HomeRail({ children }: { children: ReactNode[] }) {
  return <div className={`cricket-home-rail ${children.length > 1 ? "is-peek" : ""}`.trim()}>{children}</div>;
}

// The red "● 3" beside Live now.
export function LiveCount({ count }: { count: number }) {
  return (
    <span className="cricket-home-live">
      <span className="cricket-live-dot" aria-hidden="true"></span>
      {count}
    </span>
  );
}
