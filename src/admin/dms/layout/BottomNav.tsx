import { NavLink } from "react-router-dom";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import "../css/BottomNav.css";

interface Tab {
    to: string;
    label: string;
    icon: string;
}

// Phones only (BottomNav.css): the main screens a thumb reaches most, as a
// tab bar along the bottom. The sidebar (via the navbar's menu button) still
// has everything.
const BottomNav = ({ onMore }: { onMore: () => void }) => {
    const { admin } = useAdminAuth();

    const tabs: Tab[] = admin?.isSuperAdmin
        ? [
              { to: "/dashboard", label: "Home", icon: "fa-solid fa-chart-pie" },
              { to: "/tournaments", label: "Tournaments", icon: "fa-solid fa-trophy" },
              { to: "/matches", label: "Matches", icon: "fa-solid fa-calendar-days" },
              { to: "/players", label: "Players", icon: "fa-solid fa-users" },
          ]
        : [
              { to: "/", label: "Home", icon: "fa-solid fa-house" },
              { to: "/my-matches", label: "Matches", icon: "fa-solid fa-baseball-bat-ball" },
              { to: "/my-tournaments", label: "Tournaments", icon: "fa-solid fa-medal" },
              { to: "/my-teams", label: "My Teams", icon: "fa-solid fa-people-group" },
              { to: "/me", label: "My Stats", icon: "fa-solid fa-chart-simple" },
          ];

    return (
        <nav className="cv-bottom-nav" aria-label="Main" data-tour="nav">
            {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className={({ isActive }) => `cv-bottom-tab ${isActive ? "is-active" : ""}`}>
                    <i className={tab.icon} aria-hidden="true"></i>
                    <span>{tab.label}</span>
                </NavLink>
            ))}
            {admin?.isSuperAdmin && (
                <button type="button" className="cv-bottom-tab" onClick={onMore}>
                    <i className="fa-solid fa-bars" aria-hidden="true"></i>
                    <span>More</span>
                </button>
            )}
        </nav>
    );
};

export default BottomNav;
