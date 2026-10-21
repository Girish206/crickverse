import { useState, useRef } from "react";
import { MenuItem } from "./MenuItem";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { Link, useNavigate } from "react-router-dom";

const Sidebar = ({
    activeSubItem,
    activeItem,
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
}: {
    activeSubItem: string;
    activeItem: string;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
}) => {
    const { logout, admin } = useAdminAuth();
    const navigate = useNavigate();

    const sidebarRef = useRef<HTMLDivElement | null>(null);

    // "Me" for everyone with cricket access; super admins also manage it.
    const cricketMenuGroups = [
        {
            label: "Me",
            items: [
                { id: "cricket-me", label: "My Stats", icon: "fa-solid fa-id-card", link: "/me", submenu: [] },
                {
                    id: "cricket-my-matches",
                    label: "My Matches",
                    icon: "fa-solid fa-baseball-bat-ball",
                    link: "/my-matches",
                    submenu: [],
                },
                {
                    id: "cricket-my-tournaments",
                    label: "My Tournaments",
                    icon: "fa-solid fa-medal",
                    link: "/my-tournaments",
                    submenu: [],
                },
                {
                    id: "cricket-profile",
                    label: "My Profile",
                    icon: "fa-solid fa-user-gear",
                    link: "/profile",
                    submenu: [],
                },
            ],
        },
        ...(admin?.isSuperAdmin
            ? [
                  {
                      label: "Manage",
                      items: [
                          {
                              id: "cricket-dashboard",
                              label: "Dashboard",
                              icon: "fa-solid fa-chart-pie",
                              link: "/dashboard",
                              submenu: [],
                          },
                          {
                              id: "cricket-tournaments",
                              label: "Tournaments",
                              icon: "fa-solid fa-trophy",
                              link: "/tournaments",
                              submenu: [],
                          },
                          {
                              id: "cricket-matches",
                              label: "Matches",
                              icon: "fa-solid fa-calendar-days",
                              link: "/matches",
                              submenu: [],
                          },
                          {
                              id: "cricket-players",
                              label: "Players",
                              icon: "fa-solid fa-users",
                              link: "/players",
                              submenu: [],
                          },
                          {
                              id: "cricket-leaderboard",
                              label: "Leaderboard",
                              icon: "fa-solid fa-ranking-star",
                              link: "/leaderboard",
                              submenu: [],
                          },
                      ],
                  },
              ]
            : []),
    ];

    const menuGroups = cricketMenuGroups.filter(
        (group) => group.items.length > 0,
    );

    const [isSubMenuOpenItems, setIsSubMenuOpenItems] = useState<{
        [key: string]: boolean;
    }>(() => {
        const initialState: { [key: string]: boolean } = {};
        menuGroups.forEach((group) => {
            group.items.forEach((item) => {
                if (
                    item.submenu &&
                    item.submenu.some((sub: any) => sub.id === activeSubItem)
                ) {
                    initialState[item.id] = true;
                }
            });
        });
        return initialState;
    });

    const toggleSubmenu = (id: string) => {
        setIsSubMenuOpenItems((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const handleNavigate = () => {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    return (
        <div
            ref={sidebarRef}
            className={`sidebar ${isSidebarOpen ? "sidebar-open" : "sidebar-close"}`}
        >
            <button
                className="sidebar-toggle-btn"
                onClick={toggleSidebar}
                title={isSidebarOpen ? "Collapse" : "Expand"}
            >
                <i
                    className={`fa-solid fa-chevron-${isSidebarOpen ? "left" : "right"}`}
                ></i>
            </button>

            <div className="scrollable-content pt-2">
                <ul className="nav nav-pills flex-column mb-auto">
                    {menuGroups.map((group, groupIndex) => {
                        return (
                            <div key={groupIndex} className="menu-group">
                                <div className="menu-group-label">
                                    <span>{group.label}</span>
                                    {isSidebarOpen && (
                                        <div className="menu-group-line"></div>
                                    )}
                                </div>
                                {group.items.map((item, index) => (
                                    <MenuItem
                                        key={index}
                                        activeItem={activeItem}
                                        activeSubItem={activeSubItem}
                                        isSidebarOpen={isSidebarOpen}
                                        mainItem={item}
                                        isSubMenuOpen={
                                            !!isSubMenuOpenItems[item.id]
                                        }
                                        toggleSubmenu={() =>
                                            toggleSubmenu(item.id)
                                        }
                                        onNavigate={handleNavigate}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </ul>
            </div>

            <div className="sidebar-footer">
                <Link
                    to="#"
                    onClick={(e) => {
                        e.preventDefault();
                        handleLogout();
                    }}
                    className={`logout-btn nav-link ${!isSidebarOpen ? "justify-content-center" : ""}`}
                    title={!isSidebarOpen ? "Logout" : undefined}
                >
                    <i className="fa-solid fa-right-from-bracket icon"></i>
                    {isSidebarOpen && <span>Logout</span>}
                </Link>
            </div>
        </div>
    );
};

export default Sidebar;
