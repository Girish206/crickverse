import type { ReactNode } from "react";
import { useAdminBodyClass } from "./useAdminBodyClass";
import { useAdminTheme } from "./useAdminTheme";
import "./dms/global.css";
import "./dms/css/Login.css";

// The sign-in and sign-up screens' frame: a dark glowing backdrop with the
// logo, badge, heading and subtitle on it, a white card holding only the
// form, then the footer lines below the card.
export function AuthShell({
  heading,
  subtitle,
  children,
  footer,
}: {
  heading: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useAdminBodyClass();
  useAdminTheme();

  return (
    <div className="admin-login-shell">
      <div className="admin-login-ash admin-login-ash-1" aria-hidden="true" />
      <div className="admin-login-ash admin-login-ash-2" aria-hidden="true" />

      <div className="admin-login-stack animated fadeInUp">
        <div className="admin-login-intro">
          <div className="admin-login-logo-ring">
            <img src="/favicon.svg" alt="CricDesk" className="admin-login-logo" />
          </div>

          <span className="admin-login-badge">
            CricDesk
          </span>
          <h1 className="admin-login-heading">{heading}</h1>
          <p className="admin-login-subtitle">{subtitle}</p>
        </div>

        <div className="admin-login-card">{children}</div>

        {footer && <p className="admin-login-switch">{footer}</p>}

        <p className="admin-login-footnote">
          <i className="fa-solid fa-baseball-bat-ball"></i> A Girish Creations project
        </p>
      </div>
    </div>
  );
}
