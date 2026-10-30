import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import CricketBackdrop from "./CricketBackdrop";
import { PullToRefresh } from "./PullToRefresh";
import { BrandSignature } from "../../components/BrandSignature";
import { ShareAppSheet } from "../../cricket/ShareMenu";
import { PlayerQrSheet } from "../../cricket/qr/ShowQrSheets";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
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
    const [showingQr, setShowingQr] = useState(false);
    const { data: me } = useCricketMe();
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

    // While the phone drawer is open the page behind it stays put; only the
    // drawer's own menu scrolls. Same breakpoint as the drawer's CSS.
    const drawerOpen = isMainScreen && isSidebarOpen;
    useEffect(() => {
        if (!drawerOpen || !window.matchMedia("(max-width: 769px)").matches) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [drawerOpen]);

    // The phone drawer sits above sheets, so it closes first.
    const shareApp = () => {
        setSidebarOpen(false);
        setSharingApp(true);
    };

    // The sidebar's "My QR Code": on phones the drawer closes first, as above.
    const showQr = () => {
        if (window.innerWidth < 768) setSidebarOpen(false);
        setShowingQr(true);
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
                            onShowQr={showQr}
                            showSignature
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
                        onShowQr={showQr}
                    />
                </div>
            )}

            {sharingApp && <ShareAppSheet onClose={() => setSharingApp(false)} />}
            {showingQr && me?.player && <PlayerQrSheet player={me.player} onClose={() => setShowingQr(false)} />}

            {isMainScreen && <BottomNav onMore={() => setSidebarOpen(true)} />}

            <main
                className={`scrollable-main ${
                    isSidebarOpen ? "sidebar-open" : "sidebar-closed"
                } ${isMainScreen ? "" : "is-subpage"}`}
            >
                <PullToRefresh />
                {children}
                {/* Desktop only; phones show it in the menu drawer instead. */}
                <div className="main-signature">
                    <BrandSignature small />
                </div>
            </main>
        </div>
    );
};

export default Layout;
