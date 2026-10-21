import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

type SubItem = {
    id: string;
    label: string;
    link: string;
};

type MenuItemProps = {
    activeItem: string;
    activeSubItem: string;
    isSidebarOpen: boolean;
    isSubMenuOpen: boolean;
    mainItem: {
        id: string;
        label: string;
        icon: string;
        link: string;
        submenu?: SubItem[];
    };
    toggleSubmenu: () => void;
    onNavigate?: () => void; // Called when navigating in mini-sidebar mode
};

const TooltipPortal = ({
    label,
    icon,
    anchorRef,
    visible,
}: {
    label: string;
    icon: string;
    anchorRef: React.RefObject<HTMLAnchorElement | null>;
    visible: boolean;
}) => {
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (visible && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top + rect.height / 2,
                left: rect.right + 4, // tight gap
            });
            // Tiny delay for slide-in animation
            requestAnimationFrame(() => setShow(true));
        } else {
            setShow(false);
        }
    }, [visible, anchorRef]);

    if (!visible) return null;

    return ReactDOM.createPortal(
        <div
            style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                transform: show
                    ? "translateY(-50%) translateX(0px)"
                    : "translateY(-50%) translateX(-6px)",
                opacity: show ? 1 : 0,
                transition: "opacity 0.18s ease, transform 0.18s cubic-bezier(0.16,1,0.3,1)",
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                color: "#1e293b",
                borderRadius: "10px",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 20px -4px rgba(0,0,0,0.12)",
                border: "1px solid rgba(0,0,0,0.06)",
                zIndex: 99999,
                pointerEvents: "none",
                display: "flex",
                alignItems: "stretch",
                overflow: "visible", // allow arrow to stick out
            }}
        >
            {/* Left-pointing arrow */}
            <div style={{
                position: "absolute",
                left: "-6px",
                top: "50%",
                transform: "translateY(-50%)",
                width: 0,
                height: 0,
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
                borderRight: "6px solid rgba(255,255,255,0.97)",
                filter: "drop-shadow(-1px 0 0 rgba(0,0,0,0.06))",
                zIndex: 1,
            }} />
            {/* Left brand accent panel with icon */}
            <div style={{
                width: "34px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(160deg, var(--primary) 0%, var(--primary-dark-1) 100%)",
                flexShrink: 0,
                borderRadius: "9px 0 0 9px",
            }}>
                <i className={`${icon}`} style={{ color: "rgba(255,255,255,0.9)", fontSize: "var(--fs-sm)" }} />
            </div>
            {/* Label */}
            <div style={{
                padding: "9px 14px",
                letterSpacing: "0.01em",
                borderRadius: "0 9px 9px 0",
            }}>
                {label}
            </div>
        </div>,
        document.body
    );
};

export const MenuItem = ({
    activeItem,
    activeSubItem,
    isSidebarOpen,
    isSubMenuOpen,
    mainItem,
    toggleSubmenu,
    onNavigate,
}: MenuItemProps) => {
    const hasSubmenu = mainItem.submenu && mainItem.submenu.length > 0;
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const linkRef = useRef<HTMLAnchorElement>(null);

    const handleMainClick = (e: React.MouseEvent) => {
        if (hasSubmenu) {
            e.preventDefault();
            toggleSubmenu();
        } else if (onNavigate) {
            onNavigate();
        }
    };

    const toggleDashboard = (dashboard: string) => {
        if (["Dashboard"].includes(dashboard)) {
            localStorage.setItem("dashboard", dashboard);
        }
    };

    return (
        <li
            className={`mb-1 mt-1 nav-item ${activeItem === mainItem.id ? "active" : ""}`}
            onClick={() => toggleDashboard(mainItem.id)}
        >
            <Link
                ref={linkRef}
                to={hasSubmenu ? "#" : mainItem.link}
                className="nav-link"
                onClick={handleMainClick}
                data-menu-label={mainItem.label}
                onMouseEnter={() => {
                    if (!isSidebarOpen) setTooltipVisible(true);
                }}
                onMouseLeave={() => setTooltipVisible(false)}
            >
                {mainItem.icon && <i className={`${mainItem.icon} icon`}></i>}
                {isSidebarOpen && <span>{mainItem.label}</span>}
                {isSidebarOpen && hasSubmenu && (
                    <i
                        className={`fa-solid ms-auto ${
                            isSubMenuOpen ? "fa-chevron-down" : "fa-chevron-right"
                        }`}
                        style={{ fontSize: "var(--fs-2xs)", opacity: 0.5 }}
                    ></i>
                )}
            </Link>

            <TooltipPortal
                label={mainItem.label}
                icon={mainItem.icon}
                anchorRef={linkRef}
                visible={tooltipVisible}
            />

            {isSidebarOpen && isSubMenuOpen && hasSubmenu && (
                <ul className="nav flex-column submenu-list">
                    {mainItem.submenu!.map((item, index) => (
                        <li
                            key={index}
                            className={`submenu-item ${
                                activeSubItem === item.id ? "active" : ""
                            }`}
                        >
                            <Link
                                to={item.link}
                                className="submenu-link"
                                onClick={() => onNavigate?.()}
                            >
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
};
