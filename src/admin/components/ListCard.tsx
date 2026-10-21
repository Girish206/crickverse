import type { ReactNode } from "react";

export interface ListCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  // Extra class on the outer .card — e.g. constraining it to viewport
  // height for a page with its own internal scroll area.
  className?: string;
  // Extra class on the padded body — e.g. a page-specific density override
  // without touching the shared .admin-card-body padding everywhere else.
  bodyClassName?: string;
}

// The .card wrapper + .admin-page-header (title + optional "+ New" button)
// used at the top of every admin list page.
export function ListCard({ title, action, children, className, bodyClassName }: ListCardProps) {
  return (
    <div className={`card ${className ?? ""}`.trim()}>
      <div className={`admin-card-body ${bodyClassName ?? ""}`.trim()}>
        <div className="admin-page-header">
          <h1>{title}</h1>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}
