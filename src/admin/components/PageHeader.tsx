import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./PageHeader.css";

export interface PageHeaderProps {
  title: ReactNode;
  // A smaller line above the title (the tournament, "Step 1 of 2"…).
  subtitle?: ReactNode;
  // Where the back button goes: a path, or a handler for in-page steps.
  // Defaults to the previous screen (home when there isn't one).
  back?: string | (() => void);
  backLabel?: string;
  // Icon buttons on the right (PageHeaderAction).
  actions?: ReactNode;
}

// The header every screen outside the main menu uses (a tournament, team,
// match, setup, profile): fixed to the top with a back button, the title and
// the screen's own actions. Layout leaves the navbar out on these screens
// and pads the page for it.
export function PageHeader({ title, subtitle, back, backLabel = "Back", actions }: PageHeaderProps) {
  const navigate = useNavigate();

  function goBack() {
    if (typeof back === "function") back();
    else if (back) navigate(back);
    // history.state.idx is react-router's position in this tab's history.
    else if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/");
  }

  return (
    <header className="cv-page-header">
      <button type="button" className="cv-page-header-btn" onClick={goBack} aria-label={backLabel} title={backLabel}>
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
      </button>
      <div className="cv-page-header-title">
        {subtitle && <small>{subtitle}</small>}
        <h1>{title}</h1>
      </div>
      {actions && <div className="cv-page-header-actions">{actions}</div>}
    </header>
  );
}

// A round icon button for PageHeader's actions.
export function PageHeaderAction({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cv-page-header-btn ${danger ? "is-danger" : ""}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <i className={icon} aria-hidden="true"></i>
    </button>
  );
}
