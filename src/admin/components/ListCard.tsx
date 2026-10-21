import type { ReactNode } from "react";

export interface ListCardProps {
  // Left out (or "") when a tab already names the section; the header row
  // then shows only the action, or nothing.
  title?: string;
  // Main menu pages: a Font Awesome icon shown in a brand tile beside the
  // title, and a short line under it saying what the page is for.
  icon?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  // Extra class on the outer .card — e.g. constraining it to viewport
  // height for a page with its own internal scroll area.
  className?: string;
  // Extra class on the padded body — e.g. a page-specific density override
  // without touching the shared .admin-card-body padding everywhere else.
  bodyClassName?: string;
  // Straight on the page with no .card around it — for pages that are a
  // grid of their own cards (match lists), so they aren't cards in a card.
  plain?: boolean;
}

// The .card wrapper + .admin-page-header (title + optional "+ New" button)
// used at the top of every admin list page.
export function ListCard({ title, icon, subtitle, action, children, className, bodyClassName, plain }: ListCardProps) {
  const body = (
    <>
      {(title || action) && (
        <div className={`admin-page-header ${title ? "" : "is-action-only"}`.trim()}>
          {title &&
            (icon || subtitle ? (
              <div className="admin-page-title">
                {icon && (
                  <span className="admin-page-title-icon" aria-hidden="true">
                    <i className={icon}></i>
                  </span>
                )}
                <div className="admin-page-title-text">
                  <h1>{title}</h1>
                  {subtitle && <p>{subtitle}</p>}
                </div>
              </div>
            ) : (
              <h1>{title}</h1>
            ))}
          {action}
        </div>
      )}
      {children}
    </>
  );
  if (plain) return <div className={className}>{body}</div>;
  return (
    <div className={`card ${className ?? ""}`.trim()}>
      <div className={`admin-card-body ${bodyClassName ?? ""}`.trim()}>{body}</div>
    </div>
  );
}
