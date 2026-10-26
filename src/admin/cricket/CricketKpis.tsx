import type { ReactNode } from "react";

export interface CricketKpi {
  label: string;
  value: ReactNode;
  icon: string;
  // Tile colour, from the Admin Accounts stat tiles (admin.css).
  tone: "total" | "active" | "login" | "guest";
  hint?: string;
}

// A row of stat tiles at the top of a cricket page. "strip" packs them into
// one slim bar of columns, for headers that are already busy; "hero" puts
// them on the player Home's gradient banner (the admin pages).
export function CricketKpis({
  items,
  variant = "tiles",
}: {
  items: CricketKpi[];
  variant?: "tiles" | "strip" | "hero";
}) {
  if (variant === "hero") {
    return (
      <section className="cricket-home-hero cricket-kpi-hero">
        <div className="cricket-home-hero-stats">
          {items.map((item) => (
            <div key={item.label} title={item.hint}>
              <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
              <strong>{item.value}</strong>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (variant === "strip") {
    return (
      <div className="cricket-kpi-strip">
        {items.map((item) => (
          <div className={`cricket-kpi-cell admin-user-stat-${item.tone}`} key={item.label} title={item.hint}>
            <strong>
              <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
              {item.value}
            </strong>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="cricket-kpis">
      {items.map((item) => (
        <div className={`admin-user-stat admin-user-stat-${item.tone}`} key={item.label} title={item.hint}>
          <span className="admin-user-stat-icon">
            <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
          </span>
          <span>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
