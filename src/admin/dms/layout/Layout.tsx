import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import CricketBackdrop from "./CricketBackdrop";
import { ShareAppSheet } from "../../cricket/ShareMenu";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useAdminBodyClass } from "../../useAdminBodyClass";
import { useAdminTheme } from "../../useAdminTheme";
import "../global.css";
import "../css/components/Layout.css";

const Layout = ({
    activeItem,
    activeSubItem,
    isMainScreen,
    children,
}: {
    activeItem: string;
    activeSubItem: string;
    isMainScreen: boolean;
    children: React.ReactNode;
}) => {
    useAdminBodyClass();
    // Here rather than in the Navbar, which sub-pages don't render, so the
    // theme stays applied on every screen.
    const { isDark, toggle: toggleTheme } = useAdminTheme();
    const [isSidebarOpen, setisSidebarOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [sharingApp, setSharingApp] = useState(false);
    const { mainBg } = useAdminAuth();

    const toggleSidebar = () => {
        if (window.innerWidth < 768) {
            if (isSidebarOpen) {
                if (closing) return;
                setClosing(true);
                setTimeout(() => {
                    setisSidebarOpen(false);
                    setClosing(false);
                }, 300);
            } else {
                setisSidebarOpen(true);
                setClosing(false);
            }
        } else {
            setisSidebarOpen((prev) => !prev);
            setClosing(false);
        }
    };

    const setSidebarOpen = (open: boolean) => {
        if (open === isSidebarOpen) return;

        if (open) {
            setisSidebarOpen(true);
            setClosing(false);
        } else {
            if (window.innerWidth < 768) {
                if (closing) return;
                setClosing(true);
                setTimeout(() => {
                    setisSidebarOpen(false);
                    setClosing(false);
                }, 300);
            } else {
                setisSidebarOpen(false);
                setClosing(false);
            }
        }
    };

    // The phone drawer sits above sheets, so it closes first.
    const shareApp = () => {
        setSidebarOpen(false);
        setSharingApp(true);
    };

    return (
        <div
            className={`layout-wrapper ${mainBg} ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"} ${
                isMainScreen ? "" : "is-subpage"
            }`}
        >
            <div className="admin-bg-shape admin-bg-shape-1" aria-hidden="true" />
            <div className="admin-bg-shape admin-bg-shape-2" aria-hidden="true" />
            <CricketBackdrop />

            {isMainScreen && (
                <Navbar
                    toggleSidebar={toggleSidebar}
                    isSidebarOpen={isSidebarOpen}
                    isDark={isDark}
                    toggleTheme={toggleTheme}
                    onShareApp={shareApp}
                />
            )}

            {isMainScreen && isSidebarOpen && (
                <div
                    className={`sidebar-mobile-overlay ${
                        closing ? "fade-out" : "fade-in"
                    }`}
                    onClick={toggleSidebar}
                >
                    <div
                        className={`sidebar-mobile ${
                            closing ? "slide-out-left" : "slide-in-left"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Sidebar
                            activeItem={activeItem}
                            activeSubItem={activeSubItem}
                            isSidebarOpen={isSidebarOpen}
                            toggleSidebar={toggleSidebar}
                            setSidebarOpen={setSidebarOpen}
                            onShareApp={shareApp}
                        />
                    </div>
                </div>
            )}

            {isMainScreen && (
                <div className="fixed-sidebar sidebar-desktop d-none d-md-block" data-tour="nav">
                    <Sidebar
                        activeItem={activeItem}
                        activeSubItem={activeSubItem}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        setSidebarOpen={setSidebarOpen}
                        onShareApp={shareApp}
                    />
                </div>
            )}

            {sharingApp && <ShareAppSheet onClose={() => setSharingApp(false)} />}

            {isMainScreen && <BottomNav onMore={() => setSidebarOpen(true)} />}

            <main
                className={`scrollable-main ${
                    isSidebarOpen ? "sidebar-open" : "sidebar-closed"
                } ${isMainScreen ? "" : "is-subpage"}`}
            >
                {children}
            </main>
        </div>
    );
};

export default Layout;
