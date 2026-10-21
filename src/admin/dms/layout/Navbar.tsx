import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useAdminTheme } from "../../useAdminTheme";
import "../css/Navbar.css";

interface NavbarProps {
    toggleSidebar: () => void;
    isSidebarOpen: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar }) => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const { isDark, toggle: toggleTheme } = useAdminTheme();

    const { logout, admin } = useAdminAuth();
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleLogout = () => {
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
                                <img src="/favicon.svg" alt="CrickVerse" className="img-fluid" />
                            </div>
                            <div className="navbar-brand-info ms-2 d-none d-sm-flex" style={{ flexDirection: "column", lineHeight: 1.3 }}>
                                <span style={{ fontSize: "1rem", whiteSpace: "nowrap" }}>
                                    <span className="cv-wordmark">
                                        Crick<em>Verse</em>
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right side: admin identity + direct sign-out (profile
                        sidebar is commented out below for now) */}
                    <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        className="navbar-theme-btn"
                        onClick={toggleTheme}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        <i className={`fa-solid ${isDark ? "fa-sun" : "fa-moon"}`} aria-hidden="true"></i>
                    </button>
                    <div className="navbar-user-chip">
                        <div
                            className="user-avatar text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: "36px", height: "36px", fontSize: "0.85rem", flexShrink: 0 }}
                        >
                            {(admin?.name || admin?.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <span className="navbar-user-email d-none d-sm-inline">{admin?.name || admin?.email}</span>
                        <button className="navbar-signout-btn" onClick={handleLogout} title="Sign out">
                            <i className="fa-solid fa-right-from-bracket"></i>
                            <span className="d-none d-md-inline">Sign Out</span>
                        </button>
                    </div>
                    </div>
                </div>
            </nav>

        </>
    );
};

export default Navbar;
