import type { ReactNode } from "react";
import { useAdminBodyClass } from "./useAdminBodyClass";
import { useAdminTheme } from "./useAdminTheme";
import "./dms/global.css";
import "./dms/css/Login.css";

// The sign-in and sign-up screens' frame: glowing backdrop, a card with the
// logo, badge, heading and subtitle, then the form and a footer line.
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

      <div className="admin-login-card animated fadeInUp">
        <div className="admin-login-logo-ring">
          <img src="/favicon.svg" alt="Namma Aaata" className="admin-login-logo" />
        </div>

        <span className="admin-login-badge">
          Namma Aaata <span className="cv-kannada" lang="kn">· ನಮ್ಮ ಆಟ</span>
        </span>
        <h1 className="admin-login-heading">{heading}</h1>
        <p className="admin-login-subtitle">{subtitle}</p>

        {children}

        {footer && <p className="admin-login-switch">{footer}</p>}

        <p className="admin-login-footnote">
          <i className="fa-solid fa-baseball-bat-ball"></i> A Girish Creations project
        </p>
      </div>
    </div>
  );
}
