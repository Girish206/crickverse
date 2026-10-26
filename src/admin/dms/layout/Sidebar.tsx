import { useState, useRef } from "react";
import { MenuItem } from "./MenuItem";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { Link, useNavigate } from "react-router-dom";
import { BrandSignature } from "../../components/BrandSignature";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import { formatMobile } from "../../cricket/mobile";
import { PlayerAvatar } from "../../cricket/players/PlayerAvatar";

const Sidebar = ({
    activeSubItem,
    activeItem,
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
    onShareApp,
    onShowQr,
    showSignature = false,
}: {
    activeSubItem: string;
    activeItem: string;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    onShareApp: () => void;
    // The player's own QR code (also under My Profile → settings).
    onShowQr: () => void;
    // The phone menu drawer ends with the Girish Creations signature.
    showSignature?: boolean;
}) => {
    const { logout, admin } = useAdminAuth();
    const { data: me } = useCricketMe();
    const profileName = admin?.name || me?.player?.name || admin?.email || "My account";
    const navigate = useNavigate();

    const sidebarRef = useRef<HTMLDivElement | null>(null);

    // "My Cricket" for everyone with cricket access; super admins also manage it.
    const cricketMenuGroups = [
        {
            label: "My Cricket",
            items: [
                ...(admin?.isSuperAdmin
                    ? []
                    : [{ id: "cricket-home", label: "Home", icon: "fa-solid fa-house", link: "/", submenu: [] }]),
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
                    id: "cricket-my-teams",
                    label: "My Teams",
                    icon: "fa-solid fa-people-group",
                    link: "/my-teams",
                    submenu: [],
                },
                {
                    id: "cricket-following",
                    label: "Following",
                    icon: "fa-solid fa-star",
                    link: "/following",
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
                          {
                              id: "cricket-database",
                              label: "Database",
                              icon: "fa-solid fa-database",
                              link: "/database",
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

            {/* Phones only: the drawer's own header, in place of the
                floating collapse button. */}
            <div className="sidebar-mobile-head">
                <div className="navbar-logo-box">
                    <img src="/favicon.svg" alt="" className="img-fluid" />
                </div>
                <div className="sidebar-mobile-who">
                    <span className="cv-wordmark">
                        Cric<em>Desk</em>
                    </span>
                </div>
                <button
                    type="button"
                    className="sidebar-mobile-close"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close menu"
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            </div>
            <div className="sidebar-mobile-divider" aria-hidden="true"></div>

            {/* Who's signed in — photo, name, mobile, email — with their QR
                code on the right (My Profile is in the navbar's user menu). */}
            <div
                className={`sidebar-profile ${!isSidebarOpen ? "is-collapsed" : ""}`.trim()}
                title={!isSidebarOpen ? profileName : undefined}
            >
                <PlayerAvatar
                    name={profileName}
                    photoUrl={me?.player?.photoUrl}
                    className="sidebar-profile-avatar"
                    viewable={false}
                />
                {isSidebarOpen && (
                    <>
                        <span className="sidebar-profile-who">
                            <strong>{profileName}</strong>
                            {me?.accountMobile && (
                                <small>
                                    <i className="fa-solid fa-phone" aria-hidden="true"></i>
                                    {formatMobile(me.accountMobile)}
                                </small>
                            )}
                            {admin?.email && (
                                <small>
                                    <i className="fa-solid fa-envelope" aria-hidden="true"></i>
                                    {admin.email}
                                </small>
                            )}
                        </span>
                        {me?.player && (
                            <button
                                type="button"
                                className="sidebar-profile-qr"
                                onClick={onShowQr}
                                aria-label="My QR code"
                                title="My QR code"
                            >
                                <i className="fa-solid fa-qrcode" aria-hidden="true"></i>
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="scrollable-content pt-2">
                <ul className="nav nav-pills flex-column mb-auto">
                    {menuGroups.map((group, groupIndex) => {
                        return (
                            <div key={groupIndex} className="menu-group">
                                {/* Labels only tell groups apart, so a lone
                                    group (players) goes without one. */}
                                {menuGroups.length > 1 && (
                                    <div className="menu-group-label">
                                        <span>{group.label}</span>
                                        {isSidebarOpen && (
                                            <div className="menu-group-line"></div>
                                        )}
                                    </div>
                                )}
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
                <button
                    type="button"
                    onClick={onShareApp}
                    className={`share-app-btn nav-link ${!isSidebarOpen ? "justify-content-center" : ""}`}
                    title={!isSidebarOpen ? "Share CricDesk" : undefined}
                >
                    <i className="fa-solid fa-share-nodes icon"></i>
                    {isSidebarOpen && <span>Share CricDesk</span>}
                </button>
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
                {showSignature && <BrandSignature small />}
            </div>
        </div>
    );
};

export default Sidebar;
