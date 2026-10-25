import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { QuickCreate } from "../../cricket/QuickCreate";
import { formatMobile } from "../../cricket/mobile";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import "../css/Navbar.css";

interface NavbarProps {
    toggleSidebar: () => void;
    isSidebarOpen: boolean;
    isDark: boolean;
    toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, isDark, toggleTheme }) => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const { logout, admin } = useAdminAuth();
    // The token has no mobile number; /me (cached, shared with My Profile) does.
    const { data: me } = useCricketMe();
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close the account menu on an outside click or Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [menuOpen]);

    const initial = (admin?.name || admin?.email || "U").charAt(0).toUpperCase();

    const handleLogout = () => {
        setMenuOpen(false);
        logout();
        navigate("/login", { replace: true });
    };

    return (
        <>
            <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
                <div className="container-fluid d-flex justify-content-between align-items-center">
                    {/* Left side: Menu Toggle + Logo */}
                    <div className="d-flex align-items-center">
                        {/* Sidebar toggle for mobile */}
                        <Link
                            className="text-danger d-md-none me-3"
                            to="#"
                            onClick={toggleSidebar}
                        >
                            <i className="fa-solid fa-bars fs-4"></i>
                        </Link>

                        <div className="navbar-brand-container d-flex align-items-center">
                            <div className="navbar-logo-box">
                                <img src="/favicon.svg" alt="CricDesk" className="img-fluid" />
                            </div>
                            <div className="navbar-brand-info ms-2 d-none d-sm-flex" style={{ flexDirection: "column", lineHeight: 1.3 }}>
                                <span style={{ fontSize: "var(--fs-md)", whiteSpace: "nowrap" }}>
                                    <span className="cv-wordmark">
                                        Cric<em>Desk</em>
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right side: quick create, theme, and the account menu
                        (profile + sign out) */}
                    <div className="d-flex align-items-center gap-2">
                    {/* Anyone can create a match or tournament (and then manage it). */}
                    <QuickCreate />
                    <button
                        type="button"
                        className="navbar-theme-btn"
                        onClick={toggleTheme}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        <i className={`fa-solid ${isDark ? "fa-sun" : "fa-moon"}`} aria-hidden="true"></i>
                    </button>
                    <div className="navbar-user-menu" ref={menuRef} data-tour="account">
                        <button
                            type="button"
                            className="navbar-user-chip"
                            onClick={() => setMenuOpen((open) => !open)}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            title="Account"
                        >
                            <div
                                className="user-avatar text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                                style={{ width: "36px", height: "36px", fontSize: "var(--fs-sm)", flexShrink: 0 }}
                            >
                                {initial}
                            </div>
                            <span className="navbar-user-email d-none d-sm-inline">{admin?.name || admin?.email}</span>
                            <i className={`fa-solid fa-chevron-${menuOpen ? "up" : "down"} navbar-user-caret d-none d-sm-inline`} aria-hidden="true"></i>
                        </button>
                        {menuOpen && (
                            <div className="navbar-user-dropdown" role="menu">
                                <div className="navbar-user-dropdown-head">
                                    <div className="navbar-user-dropdown-avatar">{initial}</div>
                                    <div className="navbar-user-dropdown-who">
                                        <strong>{admin?.name || admin?.email || "My account"}</strong>
                                        {me?.accountMobile && <small>{formatMobile(me.accountMobile)}</small>}
                                        {admin?.name && admin?.email && <small>{admin.email}</small>}
                                        <small>{admin?.isSuperAdmin ? "Organiser" : "Player"}</small>
                                    </div>
                                </div>
                                <Link to="/profile" className="navbar-user-dropdown-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                                    <span className="navbar-user-dropdown-icon">
                                        <i className="fa-solid fa-user" aria-hidden="true"></i>
                                    </span>
                                    <span className="navbar-user-dropdown-label">My Profile</span>
                                    <i className="fa-solid fa-chevron-right navbar-user-dropdown-chevron" aria-hidden="true"></i>
                                </Link>
                                <div className="navbar-user-dropdown-divider"></div>
                                <button type="button" className="navbar-user-dropdown-item is-danger" role="menuitem" onClick={handleLogout}>
                                    <span className="navbar-user-dropdown-icon">
                                        <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
                                    </span>
                                    <span className="navbar-user-dropdown-label">Sign Out</span>
                                </button>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </nav>

        </>
    );
};

export default Navbar;
