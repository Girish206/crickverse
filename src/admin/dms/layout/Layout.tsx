import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { useAdminBodyClass } from "../../useAdminBodyClass";
import "../global.css";
import "../css/components/Layout.css";

const Layout = ({
    activeItem,
    activeSubItem,
    children,
}: {
    activeItem: string;
    activeSubItem: string;
    children: React.ReactNode;
}) => {
    useAdminBodyClass();
    const [isSidebarOpen, setisSidebarOpen] = useState(false);
    const [closing, setClosing] = useState(false);
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

    return (
        <div
            className={`layout-wrapper ${mainBg} ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
        >
            <div className="admin-bg-shape admin-bg-shape-1" aria-hidden="true" />
            <div className="admin-bg-shape admin-bg-shape-2" aria-hidden="true" />

            <Navbar
                toggleSidebar={toggleSidebar}
                isSidebarOpen={isSidebarOpen}
            />

            {isSidebarOpen && (
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
                        />
                    </div>
                </div>
            )}

            <div className="fixed-sidebar sidebar-desktop d-none d-md-block">
                <Sidebar
                    activeItem={activeItem}
                    activeSubItem={activeSubItem}
                    isSidebarOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                    setSidebarOpen={setSidebarOpen}
                />
            </div>

            <main
                className={`scrollable-main ${
                    isSidebarOpen ? "sidebar-open" : "sidebar-closed"
                }`}
            >
                {children}
            </main>
        </div>
    );
};

export default Layout;
