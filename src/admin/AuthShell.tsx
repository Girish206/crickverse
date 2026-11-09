import type { ReactNode } from "react";
import { useAdminBodyClass } from "./useAdminBodyClass";
import { useAdminTheme } from "./useAdminTheme";
import { AuthBackdrop } from "./components/AuthBackdrop";
import { BrandSignature } from "./components/BrandSignature";
import "./dms/global.css";
import "./dms/css/Login.css";

// The sign-in and sign-up screens' frame: the logo sitting on the card's top
// edge, the badge, heading, subtitle and form inside the card, then the footer
// lines below it.
export function AuthShell({
  heading,
  subtitle,
  children,
  footer,
  longForm = false,
}: {
  heading: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  // Fills a phone's screen, so the background keeps to just the ground.
  longForm?: boolean;
}) {
  useAdminBodyClass();
  useAdminTheme();

  return (
    <div className="admin-login-shell">
      <AuthBackdrop quiet={longForm} />
      <div className="admin-login-stack animated fadeInUp">
        <div className="admin-login-intro">
          <div className="admin-login-logo-ring">
            <img src="/favicon.svg" alt="RunMitra" className="admin-login-logo" />
          </div>
        </div>

        <div className="admin-login-card">
          <div className="admin-login-head">
            <span className="admin-login-badge">RunMitra</span>
            <h1 className="admin-login-heading">{heading}</h1>
            <p className="admin-login-subtitle">{subtitle}</p>
          </div>
          {children}
        </div>

        {footer && <p className="admin-login-switch">{footer}</p>}

        <BrandSignature />
      </div>
    </div>
  );
}
