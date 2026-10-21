import type { ReactNode } from "react";

export interface CricketKpi {
  label: string;
  value: ReactNode;
  icon: string;
  // Tile colour, from the Admin Accounts stat tiles (admin.css).
  tone: "total" | "active" | "login" | "guest";
  hint?: string;
}

// A row of stat tiles at the top of a cricket page.
export function CricketKpis({ items }: { items: CricketKpi[] }) {
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
