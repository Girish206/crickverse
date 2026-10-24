import { useLayoutEffect, useSyncExternalStore } from "react";
import { useDarkTheme } from "../hooks/useDarkTheme";

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bs-theme"] });
  return () => observer.disconnect();
}

// For components that theme themselves in JS (e.g. VirtualTable's
// react-data-table theme) and so must re-render when the theme flips.
export function useIsAdminDark() {
  return useSyncExternalStore(subscribeToTheme, () => document.documentElement.getAttribute("data-bs-theme") === "dark");
}

// The admin shares the public site's light/dark choice (same saved setting,
// following the device's until one is picked). On top of `body.dark-theme`,
// it sets the phone's status bar colour (theme-color) and Bootstrap's
// `data-bs-theme` on <html> so Bootstrap's own components (cards, modals,
// form controls, dropdowns) switch too; admin/dms/css/dark.css keys the
// admin's custom styles off the same attribute. Removed on unmount so the
// public site, which styles itself, never sees it.
export function useAdminTheme() {
  const theme = useDarkTheme();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-bs-theme", theme.isDark ? "dark" : "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.isDark ? "#0f1012" : "#f6f3ef");
    return () => root.removeAttribute("data-bs-theme");
  }, [theme.isDark]);

  return theme;
}
