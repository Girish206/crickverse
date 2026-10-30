import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useSwipeTabs } from "../../useSwipeTabs";
import { AppIcon, type AppIconName } from "../../AppIcon";
import "../css/BottomNav.css";

interface Tab {
    to: string;
    label: string;
    icon: AppIconName;
}

// Phones only (BottomNav.css): the main screens a thumb reaches most, as a
// tab bar along the bottom. The sidebar (via the navbar's menu button) still
// has everything.
const BottomNav = ({ onMore }: { onMore: () => void }) => {
    const { admin } = useAdminAuth();

    const tabs: Tab[] = admin?.isSuperAdmin
        ? [
              { to: "/dashboard", label: "Home", icon: "dashboard" },
              { to: "/tournaments", label: "Tournaments", icon: "tournaments" },
              { to: "/matches", label: "Matches", icon: "fixtures" },
              { to: "/players", label: "Players", icon: "players" },
          ]
        : [
              { to: "/", label: "Home", icon: "home" },
              { to: "/my-matches", label: "Matches", icon: "matches" },
              { to: "/my-tournaments", label: "Tournaments", icon: "tournaments" },
              { to: "/my-teams", label: "My Teams", icon: "teams" },
              { to: "/me", label: "My Stats", icon: "stats" },
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
                    <AppIcon name={tab.icon} />
                    <span>{tab.label}</span>
                </NavLink>
            ))}
            {admin?.isSuperAdmin && (
                <button type="button" className="cv-bottom-tab" onClick={onMore}>
                    <AppIcon name="more" />
                    <span>More</span>
                </button>
            )}
        </nav>
    );
};

export default BottomNav;
