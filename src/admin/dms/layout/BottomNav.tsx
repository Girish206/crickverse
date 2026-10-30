import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useSwipeTabs } from "../../useSwipeTabs";
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

    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [hidden, setHidden] = useState(false);

    // Slides away while scrolling down the page, back on scrolling up.
    useEffect(() => {
        setHidden(false);
        let lastY = window.scrollY;
        const onScroll = () => {
            const y = window.scrollY;
            if (Math.abs(y - lastY) < 8) return;
            setHidden(y > lastY && y > 60);
            lastY = y;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [pathname]);

    // A sideways swipe on the page moves to the neighbouring tab.
    // It sits outside the page, so its scope is named.
    const current = tabs.find((t) => (t.to === "/" ? pathname === "/" : pathname === t.to || pathname.startsWith(`${t.to}/`)));
    const swipeRef = useSwipeTabs(tabs, current, (t) => navigate(t!.to), () => document.querySelector(".scrollable-main"));

    return (
        <nav ref={swipeRef} className={`cv-bottom-nav ${hidden ? "is-hidden" : ""}`} aria-label="Main" data-tour="nav">
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
